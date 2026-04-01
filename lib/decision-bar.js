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
    const decisionHeavy = page === "compare" || page === "help" && (screen === "results" || screen === "sourcing");
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
  let expanded = false;
  const collapseStorageKey = `pinball_scout_decision_bar_collapsed_${page || "global"}`;
  let userCollapsed = (() => {
    try {
      return window.localStorage.getItem(collapseStorageKey) === "1";
    } catch {
      return false;
    }
  })();
  let currentModel = null;
  let root = document.querySelector("#decision-bar-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "decision-bar-root";
    document.body.appendChild(root);
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

    if (model.visibility === "hidden") {
      root.innerHTML = "";
      root.className = "decision-bar-host is-hidden";
      return;
    }

    const frontLabel = model.frontInfo ? machineDisplayTitle(model.frontInfo.machine) : "None";
    const backupLabel = model.backups.length
      ? model.backups.map((item) => machineDisplayTitle(item.machine)).join(", ")
      : "None";
    const isCompact = model.visibility === "compact" && !expanded;
    const isContentCollapsed = userCollapsed || isCompact;
    const collapseLabel = isContentCollapsed ? "Expand" : "Collapse";

    root.className = `decision-bar-host ${isCompact ? "is-compact" : "is-full"}${expanded ? " is-expanded" : ""}`;
    root.innerHTML = `
      <section class="decision-bar">
        <div class="decision-bar-top">
          <button class="decision-bar-toggle" type="button" data-action="decision-bar-toggle">
            Front-runner: ${frontLabel} · ${model.frontInfo?.readiness?.label || "No status"}
          </button>
          <button class="btn btn-secondary small decision-bar-collapse-btn" type="button" data-action="decision-bar-user-toggle">${collapseLabel}</button>
        </div>
        <div class="decision-bar-content ${isContentCollapsed ? "is-collapsed" : ""}">
          <div>
            <p class="eyebrow">Decision state</p>
            <p><strong>Front-runner:</strong> ${frontLabel} ${model.temporaryPrimary ? `<span class="badge">Temporary</span>` : ""}</p>
            <p class="muted"><strong>Backups:</strong> ${backupLabel}</p>
            <p class="muted">${model.summary}</p>
          </div>
          ${model.backupMoreReady && model.topBackup ? `
            <article class="decision-alert">
              <p><strong>${machineDisplayTitle(model.topBackup.machine)} is currently more ready.</strong></p>
              <p class="muted">Why: ${model.reasonCodes.join(", ").replaceAll("_", " ")}.</p>
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
              : `<button class="btn btn-primary small" type="button" data-action="decision-continue-plan">Finalize plan</button>
                 <button class="btn btn-secondary small" type="button" data-action="decision-open-compare">Compare</button>`
            }
          </div>
        </div>
      </section>
    `;
  }

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "decision-bar-toggle") {
      if (userCollapsed) {
        userCollapsed = false;
        try {
          window.localStorage.setItem(collapseStorageKey, "0");
        } catch {
          // ignore storage failures and continue with in-memory state
        }
      }
      expanded = !expanded;
      render();
      return;
    }

    if (action === "decision-bar-user-toggle") {
      userCollapsed = !userCollapsed;
      if (userCollapsed) expanded = false;
      try {
        window.localStorage.setItem(collapseStorageKey, userCollapsed ? "1" : "0");
      } catch {
        // ignore storage failures and continue with in-memory state
      }
      render();
      return;
    }

    if (action === "decision-promote-backup") {
      fireActionEvent("promote_backup");
      const slug = event.target.closest("[data-slug]")?.dataset.slug;
      if (typeof handlers.promoteBackup === "function") handlers.promoteBackup(slug, currentModel);
      else promoteBackup(slug, currentModel);
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
    }
  });

  window.addEventListener("decision-state-updated", render);
  render();
  return { render };
}
