import { machines } from "../data/machines.js";
import { readMachinePlanState } from "./decision-plan.js";
import { blockerProgress, blockersForPath, readinessFromBlockers } from "./required-checks.js";
import { loadDecisionState, saveDecisionState } from "./decision-state.js";
import { machineDisplayTitle } from "./utils.js";
import { ANALYTICS_EVENTS, trackAnalytics } from "./analytics-events.js";

const shownPromotionKeys = new Set();

function machineBySlug(slug = "") {
  return machines.find((machine) => machine.slug === slug) || null;
}

function readinessRank(label = "") {
  if (label === "Ready to proceed") return 3;
  if (label === "Near-ready") return 2;
  if (label === "Near-ready, blocked") return 1;
  return 0;
}

function readinessInfoForSlug(decisionState, slug, fallbackCondition = "") {
  const machine = machineBySlug(slug);
  if (!machine) return null;
  const plan = readMachinePlanState(decisionState, slug, fallbackCondition);
  const blockers = blockersForPath(plan.selectedPathType, false);
  const progress = blockerProgress(blockers, plan.requiredChecks || {});
  const readiness = readinessFromBlockers({
    pathType: plan.selectedPathType,
    blockers,
    requiredChecks: plan.requiredChecks || {},
    currentPlanStep: plan.currentPlanStep,
    workingPickConfirmed: plan.workingPickConfirmed
  });
  return { machine, plan, progress, readiness };
}

function reasonCodesForPromotion(frontInfo, backupInfo) {
  const codes = [];
  if ((backupInfo.progress.completeCount || 0) > (frontInfo.progress.completeCount || 0)) codes.push("more_required_checks_complete");
  if (frontInfo.readiness.label === "Not ready") codes.push("front_not_ready");
  if (frontInfo.readiness.label === "Near-ready, blocked") codes.push("front_blocked");
  if (backupInfo.readiness.label === "Ready to proceed") codes.push("backup_ready");
  if (!codes.length) codes.push("backup_more_ready");
  return codes;
}

export function buildDecisionContinuityModel(decisionState = loadDecisionState(), options = {}) {
  const fallbackCondition = options.fallbackCondition || "";
  const screen = options.screen || "";
  const page = options.page || "";
  const frontSlug = decisionState.frontRunnerSlug || "";
  const backupSlugs = Array.isArray(decisionState.backupSlugs) ? decisionState.backupSlugs.filter(Boolean) : [];
  const frontInfo = readinessInfoForSlug(decisionState, frontSlug, fallbackCondition);
  const backups = backupSlugs.map((slug) => readinessInfoForSlug(decisionState, slug, fallbackCondition)).filter(Boolean);
  const topBackup = backups[0] || null;
  const frontRank = frontInfo ? readinessRank(frontInfo.readiness.label) : -1;
  const topBackupRank = topBackup ? readinessRank(topBackup.readiness.label) : -1;
  const backupMoreReady = Boolean(frontInfo && topBackup && topBackupRank > frontRank && topBackupRank >= 2);
  const reasonCodes = backupMoreReady ? reasonCodesForPromotion(frontInfo, topBackup) : [];
  const blockedCount = frontInfo?.progress?.blockedCount || 0;
  const compareTooClose = Boolean(decisionState.compareState?.tooClose);
  const temporaryPrimary = Boolean(decisionState.temporaryPrimary);
  const justSwitched = (() => {
    const at = Date.parse(decisionState.frontRunnerLastChangedAt || "");
    return Number.isFinite(at) && Date.now() - at < 1000 * 60 * 8;
  })();

  let summary = "No front-runner selected yet.";
  if (frontInfo) {
    if (temporaryPrimary) {
      summary = "Tie-breaker unresolved. Recheck after next validation.";
    } else if (frontInfo.readiness.label === "Near-ready, blocked") {
      summary = `Near-ready, blocked: ${blockedCount} required check${blockedCount === 1 ? "" : "s"} remaining.`;
    } else if (frontInfo.readiness.label === "Ready to proceed") {
      summary = "Ready to proceed with your current front-runner.";
    } else {
      summary = `${frontInfo.readiness.label}: ${frontInfo.readiness.reason}`;
    }
  }

  let visibility = "hidden";
  if (frontInfo || backups.length) {
    visibility = "compact";
    const decisionHeavy = page === "compare" || page === "help" && (screen === "results" || screen === "sourcing" || screen === "decision-brief");
    const needsFull = decisionHeavy || blockedCount > 0 || temporaryPrimary || compareTooClose || backupMoreReady || justSwitched;
    if (needsFull) visibility = "full";
  }

  return {
    visibility,
    page,
    screen,
    frontInfo,
    backups,
    topBackup,
    backupMoreReady,
    reasonCodes,
    summary,
    temporaryPrimary,
    compareTooClose
  };
}

export function initDecisionBar({ page = "", getViewState = () => ({}), handlers = {} } = {}) {
  let modalOpen = false;
  let currentModel = null;
  let lastClassName = "";
  let lastHtml = "";
  const navContainer = document.querySelector(".site-header .nav");
  const navRoot = navContainer?.querySelector("[data-nav-root]") || null;
  if (!navContainer) {
    return { render: () => {} };
  }
  let inlineRoot = document.querySelector("#decision-inline-root");
  if (!inlineRoot) {
    inlineRoot = document.createElement("div");
    inlineRoot.id = "decision-inline-root";
    inlineRoot.className = "decision-inline-host";
    if (navRoot) navContainer.insertBefore(inlineRoot, navRoot);
    else navContainer.appendChild(inlineRoot);
  }
  let modalRoot = document.querySelector("#decision-inline-modal-root");
  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "decision-inline-modal-root";
    document.body.appendChild(modalRoot);
  }

  function promoteBackup(backupSlug, model) {
    const decisionState = loadDecisionState();
    const frontSlug = decisionState.frontRunnerSlug;
    if (!backupSlug || !frontSlug || backupSlug === frontSlug) return;
    const nextBackups = [frontSlug, ...decisionState.backupSlugs.filter((slug) => slug !== backupSlug && slug !== frontSlug)].slice(0, 2);
    const reasonCodes = model?.reasonCodes || [];
    saveDecisionState({
      frontRunnerSlug: backupSlug,
      frontRunnerLastChangedAt: new Date().toISOString(),
      backupSlugs: nextBackups,
      temporaryPrimary: false,
      temporaryPrimaryReason: "",
      promotionReasons: reasonCodes
    });
    trackAnalytics(ANALYTICS_EVENTS.BACKUP_PROMOTED, {
      from_slug: frontSlug,
      to_slug: backupSlug,
      reason_codes: reasonCodes
    });
    trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, {
      from_slug: frontSlug,
      to_slug: backupSlug,
      source: "decision_bar"
    });
  }

  function fireActionEvent(actionId) {
    const decisionState = loadDecisionState();
    trackAnalytics(ANALYTICS_EVENTS.DECISION_BAR_ACTION_CLICKED, {
      action_id: actionId,
      screen: getViewState().screen || "",
      front_runner: decisionState.frontRunnerSlug || "",
      temporary_primary: Boolean(decisionState.temporaryPrimary)
    });
  }

  function render() {
    document.documentElement.style.setProperty("--decision-bar-space", "0px");
    const decisionState = loadDecisionState();
    const model = buildDecisionContinuityModel(decisionState, {
      ...getViewState(),
      page
    });
    currentModel = model;

    if (model.backupMoreReady && model.frontInfo && model.topBackup) {
      const key = `${model.frontInfo.machine.slug}:${model.topBackup.machine.slug}:${model.summary}`;
      if (!shownPromotionKeys.has(key)) {
        shownPromotionKeys.add(key);
        trackAnalytics(ANALYTICS_EVENTS.BACKUP_PROMOTION_SHOWN, {
          front_runner: model.frontInfo.machine.slug,
          backup: model.topBackup.machine.slug,
          front_status: model.frontInfo.readiness.label,
          backup_status: model.topBackup.readiness.label,
          reason_codes: model.reasonCodes
        });
      }
    }

    if (model.visibility === "hidden" || !model.frontInfo) {
      inlineRoot.hidden = true;
      inlineRoot.innerHTML = "";
      modalRoot.innerHTML = "";
      modalOpen = false;
      lastClassName = "";
      lastHtml = "";
      return;
    }

    inlineRoot.hidden = false;
    const frontLabel = machineDisplayTitle(model.frontInfo.machine);
    const hasDecisionBrief = Boolean(decisionState.decisionBrief?.machineSlug);
    const heavyPage = page === "compare" || page === "help" && (model.screen === "results" || model.screen === "sourcing" || model.screen === "decision-brief");
    const shouldShowAlert = model.backupMoreReady && model.topBackup;
    const readinessLabel = model.frontInfo?.readiness?.label || "No status";
    const triggerText = `Front-runner: ${frontLabel} · ${readinessLabel}`;

    const primaryActionLabel = model.screen === "decision-brief" ? "Review buying plan" : "Continue buying plan";
    const nextClassName = "decision-inline-host";
    const nextHtml = `
      <button class="decision-inline-trigger" type="button" data-action="decision-open-modal" aria-haspopup="dialog" aria-expanded="${modalOpen ? "true" : "false"}">
        ${triggerText}
      </button>
    `;
    if (nextClassName === lastClassName && nextHtml === lastHtml) {
      return;
    }
    inlineRoot.className = nextClassName;
    inlineRoot.innerHTML = nextHtml;
    lastClassName = nextClassName;
    lastHtml = nextHtml;

    modalRoot.innerHTML = modalOpen ? `
      <div class="modal-backdrop decision-inline-backdrop" data-action="decision-close-modal">
        <div class="modal-panel decision-inline-modal" role="dialog" aria-modal="true" aria-labelledby="decision-inline-title">
          <div class="section-head compact">
            <div>
              <p class="eyebrow">Decision state</p>
              <h3 id="decision-inline-title">Front-runner: ${frontLabel}</h3>
            </div>
            <button class="btn btn-secondary small" type="button" data-action="decision-close-modal">Close</button>
          </div>
          <p class="muted"><strong>Status:</strong> ${readinessLabel}</p>
          <p class="muted">${model.summary}</p>
          ${model.backups.length ? `<p class="muted"><strong>Backups:</strong> ${model.backups.map((item) => machineDisplayTitle(item.machine)).join(", ")}</p>` : ""}
          ${shouldShowAlert ? `
            <article class="decision-alert">
              <p><strong>${machineDisplayTitle(model.topBackup.machine)} is currently more ready.</strong></p>
              <p class="muted">You can promote it now, or keep your pick and finish required checks.</p>
              <div class="card-actions">
                <button class="btn btn-primary small" type="button" data-action="decision-promote-backup" data-slug="${model.topBackup.machine.slug}">Promote backup</button>
                <button class="btn btn-secondary small" type="button" data-action="decision-fix-blockers">Keep current and fix blockers</button>
              </div>
            </article>
          ` : ""}
          <div class="card-actions">
            ${model.temporaryPrimary
              ? `<button class="btn btn-primary small" type="button" data-action="decision-resume-tie-breaker">Resume tie-breaker</button>
                 <button class="btn btn-secondary small" type="button" data-action="decision-review-both">Review both machines</button>`
              : `<button class="btn btn-primary small" type="button" data-action="decision-continue-plan">${primaryActionLabel}</button>
                 ${heavyPage ? "" : `<button class="btn btn-secondary small" type="button" data-action="decision-open-compare">Compare</button>
                 ${hasDecisionBrief ? `<button class="btn btn-secondary small" type="button" data-action="decision-open-brief">Decision Brief</button>` : ""}`}`
            }
          </div>
        </div>
      </div>
    ` : "";
  }

  inlineRoot.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "decision-open-modal") {
      modalOpen = true;
      render();
    }
  });

  modalRoot.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "decision-close-modal") {
      modalOpen = false;
      render();
      return;
    }

    if (action === "decision-promote-backup") {
      fireActionEvent("promote_backup");
      const slug = event.target.closest("[data-slug]")?.dataset.slug;
      if (typeof handlers.promoteBackup === "function") handlers.promoteBackup(slug, currentModel);
      else promoteBackup(slug, currentModel);
      modalOpen = false;
      render();
      return;
    }

    if (action === "decision-fix-blockers") {
      fireActionEvent("fix_blockers");
      if (typeof handlers.fixBlockers === "function") handlers.fixBlockers(currentModel);
      return;
    }

    if (action === "decision-resume-tie-breaker") {
      fireActionEvent("resume_tie_breaker");
      const state = loadDecisionState();
      trackAnalytics(ANALYTICS_EVENTS.TEMPORARY_PRIMARY_RESUMED, {
        machine_slug: state.frontRunnerSlug || "",
        screen: getViewState().screen || ""
      });
      if (typeof handlers.resumeTieBreaker === "function") handlers.resumeTieBreaker(currentModel);
      else window.location.href = "compare.html";
      return;
    }

    if (action === "decision-review-both") {
      fireActionEvent("review_both");
      if (typeof handlers.reviewBoth === "function") handlers.reviewBoth(currentModel);
      else window.location.href = "compare.html";
      return;
    }

    if (action === "decision-continue-plan") {
      fireActionEvent("continue_plan");
      if (typeof handlers.continuePlan === "function") handlers.continuePlan(currentModel);
      else window.location.href = "help.html?resume=1";
      return;
    }

    if (action === "decision-open-compare") {
      fireActionEvent("open_compare");
      if (typeof handlers.openCompare === "function") handlers.openCompare(currentModel);
      else window.location.href = "compare.html";
      return;
    }

    if (action === "decision-open-brief") {
      fireActionEvent("open_brief");
      if (typeof handlers.openBrief === "function") handlers.openBrief(currentModel);
      else window.location.href = "help.html?resume=1&brief=1";
      return;
    }
  });

  window.addEventListener("decision-state-updated", render);
  render();
  return { render };
}
