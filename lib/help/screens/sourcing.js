import { state } from "../state.js";
import { renderProgress } from "../components.js";
import { loadDecisionState } from "../../decision-state.js";
import {
  BUY_PATH_OPTIONS,
  decisionPlanPatch,
  decisionPlanProgress,
  decisionPlanStepTitle,
  nextActionsForPath,
  readMachinePlanState,
  whoShouldSkip
} from "../../decision-plan.js";
import {
  CHECK_STATUS,
  blockerById,
  blockerProgress,
  blockerStatusLabel,
  blockerStatusTone,
  blockersForPath,
  readinessFromBlockers,
  shouldApplyRemoteOverlay
} from "../../required-checks.js";
import { buildReadinessModel } from "../../readiness.js";
import { buildRiskBannerModel } from "../../risk-banner.js";
import { buildDecisionContinuityModel } from "../../decision-bar.js";
import { machineDisplayTitle } from "../../utils.js";
import {
  sourcingMachine,
  sourcingRecommendationProfile,
  currentRecommendations,
  budgetContextNote
} from "../helpers.js";

export function renderWhatCountsModal() {
  if (!state.activeWhatCountsId) return "";
  const blocker = blockerById(state.activeWhatCountsId);
  if (!blocker) return "";
  return `
    <div class="modal-backdrop what-counts-backdrop" data-action="plan-what-counts-close">
      <div class="modal-panel what-counts-sheet" role="dialog" aria-modal="true" aria-labelledby="what-counts-title">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">What counts</p>
            <h3 id="what-counts-title">${blocker.title}</h3>
          </div>
          <button class="btn btn-secondary small" type="button" data-action="plan-what-counts-close">Close</button>
        </div>
        <p class="muted">${blocker.doneWhen}</p>
        <ul class="result-list">
          ${(blocker.whatCounts || []).map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

export function renderSourcingForm() {
  const machine = sourcingMachine();
  const machineProfile = sourcingRecommendationProfile();
  const displayTitle = machine ? machineDisplayTitle(machine) : "your shortlisted machine";
  if (!machine || !machineProfile) {
    return `
      <section class="discovery-shell">
        ${renderProgress(
          "Decision closure plan",
          "Choose a shortlist machine first, then continue with the buying plan.",
          30
        )}
        <article class="panel">
          <h3>No working pick selected yet</h3>
          <p class="muted">Go back to recommendations and choose one machine to anchor your buying plan.</p>
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="back-to-results">Back to shortlist</button>
          </div>
        </article>
      </section>
    `;
  }

  const decisionState = loadDecisionState();
  const planState = readMachinePlanState(decisionState, machine.slug, state.context.condition);
  const step = planState.currentPlanStep;
  const pathType = planState.selectedPathType;
  const pathOption = BUY_PATH_OPTIONS.find((item) => item.value === pathType);
  const includeRemoteOverlay = shouldApplyRemoteOverlay(state.context);
  const blockers = blockersForPath(pathType, includeRemoteOverlay);
  const requiredCheckProgress = blockerProgress(blockers, planState.requiredChecks || {});
  const readiness = readinessFromBlockers({
    pathType,
    blockers,
    requiredChecks: planState.requiredChecks || {},
    currentPlanStep: step,
    workingPickConfirmed: planState.workingPickConfirmed
  });
  const recommendations = currentRecommendations();
  const alternatives = recommendations.filter((item) => item.slug !== machine.slug).slice(0, 2);
  const whyItFits = machineProfile.explanation?.whyMatch || machineProfile.whyItFits || [machineProfile.starterRecommendationReason];
  const downside = machineProfile.explanation?.downside || machineProfile.what_to_know_before_buying?.[0] || machineProfile.cautionNote;
  const confirm = machineProfile.explanation?.confirmInPerson || machineProfile.validationPlan;
  const skipNote = whoShouldSkip(machineProfile);
  const pathActions = nextActionsForPath(pathType, displayTitle);
  const pathTag = pathOption ? pathOption.label : "Pick a route";
  const continuity = buildDecisionContinuityModel(decisionState, {
    page: "help",
    screen: "sourcing",
    fallbackCondition: state.context.condition
  });
  const unresolvedBlockers = blockers.filter((b) => requiredCheckProgress.statusById[b.id] !== CHECK_STATUS.COMPLETE);
  const firstUnresolvedBlockerId = unresolvedBlockers[0]?.id || "";
  const readinessModel = buildReadinessModel({
    machine,
    context: state.context,
    reactions: state.reactions,
    refinementSignals: [],
    recommendations,
    pathType,
    requiredCheckProgress,
    overallReadiness: readiness,
    firstUnresolvedBlockerId
  });
  const riskModel = buildRiskBannerModel({
    machine: machineProfile,
    context: state.context,
    pathType,
    overallReadinessLabel: readiness.label,
    blockedCount: requiredCheckProgress.blockedCount
  });

  const readinessSection = `
    <article class="panel readiness-meter-panel">
      <div class="section-head compact">
        <div>
          <p class="eyebrow">Decision readiness</p>
          <h3>${readiness.label}</h3>
          <p class="muted">${readinessModel.summaryText}</p>
        </div>
      </div>
      <details class="accordion">
        <summary>Show readiness breakdown</summary>
        <div class="accordion__body">
          <div class="readiness-cards-grid">
            ${readinessModel.cards.map((card) => `
              <article class="readiness-card readiness-card--${card.tone}">
                <div class="readiness-card__head">
                  <h4>${card.title}</h4>
                  <span class="badge readiness-band readiness-band--${card.tone}">${card.band}</span>
                </div>
                <p class="muted">${card.description}</p>
                ${card.nextAction ? `
                  <button
                    class="chip-button readiness-action-chip"
                    type="button"
                    data-action="readiness-action:${card.nextAction.target}:${card.nextAction.blockerId || ""}"
                    data-readiness-card="${card.id}"
                  >${card.nextAction.label}</button>
                ` : ""}
              </article>
            `).join("")}
          </div>
        </div>
      </details>
    </article>
  `;

  const dominantStatusPanel = `
    <article class="panel plan-continuity-panel">
      <p class="eyebrow">Current decision</p>
      <h3>${displayTitle}${decisionState.temporaryPrimary ? " (Temporary)" : ""}</h3>
      ${budgetContextNote(machine)}
      <p class="muted"><strong>Status:</strong> ${readiness.label} · ${readiness.reason}</p>
      <p class="muted"><strong>Backups:</strong> ${decisionState.backupSlugs?.length
        ? decisionState.backupSlugs.map((slug) => {
            const m = recommendations.find((r) => r.slug === slug);
            return machineDisplayTitle(m || { name: slug, title: slug });
          }).join(", ")
        : "None saved"
      }</p>
      ${unresolvedBlockers.length ? `
        <article class="required-next-card">
          <p><strong>Next required move:</strong> Complete ${unresolvedBlockers[0].title.toLowerCase()}.</p>
          <button class="btn btn-primary small" type="button" data-action="plan-focus-required">Review required checks</button>
        </article>
      ` : riskModel.primary ? `
        <article class="risk-banner risk-banner--${riskModel.primary.type}">
          <div class="risk-banner__head">
            <h4>${riskModel.primary.title}</h4>
          </div>
          <p class="muted">${riskModel.primary.body}</p>
          <div class="required-check-actions">
            <button class="btn btn-secondary small" type="button" data-action="risk-banner-cta:${riskModel.primary.type}:${riskModel.primary.ctaId}:${riskModel.primary.ctaTarget}">${riskModel.primary.ctaLabel}</button>
          </div>
        </article>
      ` : ""}
      ${continuity.backupMoreReady && continuity.topBackup ? `
        <article class="decision-alert">
          <p><strong>${machineDisplayTitle(continuity.topBackup.machine)} is currently more ready.</strong></p>
          <div class="card-actions">
            <button class="btn btn-primary small" type="button" data-action="plan-promote-backup:${continuity.topBackup.machine.slug}">Promote backup</button>
            <button class="btn btn-secondary small" type="button" data-action="plan-keep-fix">Keep current</button>
          </div>
        </article>
      ` : ""}
      <div class="card-actions">
        <button class="btn btn-secondary small" type="button" data-action="risk-drawer-toggle">
          ${state.activeRiskDrawer ? "Hide readiness breakdown" : "Show readiness breakdown"}
        </button>
      </div>
    </article>
  `;

  const requiredChecksSection = `
    <article class="panel required-checks-panel${state.activePlanFocus === "required-checks" ? " is-focused" : ""}" id="required-checks" data-required-checks>
      <div class="required-checks-head">
        <div>
          <p class="eyebrow">Required checks</p>
          <h3>Required checks (${requiredCheckProgress.completeCount}/${requiredCheckProgress.total || 0} complete)</h3>
          <p class="muted">Status: <strong>${readiness.label}</strong> · ${readiness.reason}</p>
          <p class="muted decision-summary-inline">${readinessModel.summaryText}</p>
        </div>
        <span class="badge readiness-badge readiness-badge--${readiness.tone}">${readiness.label}</span>
      </div>
      ${pathType === "still-deciding" ? `
        <div class="required-check-empty">
          <p class="muted">Choose <strong>Used listing route</strong> or <strong>New / dealer route</strong> first. Required checks unlock after route selection so you stay focused.</p>
          <button class="btn btn-primary" type="button" data-action="plan-set-path:used">Start used route checks</button>
        </div>
      ` : blockers.map((blocker) => {
          const status = requiredCheckProgress.statusById[blocker.id] || CHECK_STATUS.NOT_STARTED;
          const label = blockerStatusLabel(status);
          const tone = blockerStatusTone(status);
          const primaryAction = status === CHECK_STATUS.COMPLETE ? "Reopen this check" : blocker.primaryActionLabel;
          return `
            <article class="required-check-row${state.activePlanFocus === blocker.id ? " is-focused" : ""}" id="required-check-${blocker.id}">
              <div class="required-check-row__head">
                <h4>${blocker.title}</h4>
                <span class="badge blocker-status blocker-status--${tone}">${label}</span>
              </div>
              <p class="muted"><strong>Why this matters:</strong> ${blocker.whyThisMatters}</p>
              <p class="muted"><strong>Done when:</strong> ${blocker.doneWhen}</p>
              <div class="required-check-actions">
                <button class="btn btn-primary small" type="button" data-action="plan-blocker-primary:${blocker.id}">${primaryAction}</button>
                ${blocker.whatCounts?.length ? `
                  <button class="btn btn-secondary small" type="button" data-action="plan-what-counts-open:${blocker.id}">What counts?</button>
                ` : ""}
              </div>
              <div class="mini-chip-row required-check-chips">
                <button class="chip-button${status === CHECK_STATUS.PARTIAL ? " is-selected" : ""}" type="button" data-action="plan-blocker-status:${blocker.id}:${CHECK_STATUS.PARTIAL}">In progress</button>
                <button class="chip-button${status === CHECK_STATUS.SKIPPED ? " is-selected" : ""}" type="button" data-action="plan-blocker-status:${blocker.id}:${CHECK_STATUS.SKIPPED}">Skip for now</button>
                <button class="chip-button${status === CHECK_STATUS.NOT_STARTED ? " is-selected" : ""}" type="button" data-action="plan-blocker-status:${blocker.id}:${CHECK_STATUS.NOT_STARTED}">Reset</button>
              </div>
            </article>
          `;
        }).join("")
      }
      ${includeRemoteOverlay && pathType !== "still-deciding"
        ? `<p class="muted">Remote buyer overlay is active because in-person access looks limited. Complete these extra checks before committing.</p>`
        : ""
      }
    </article>
  `;

  const stepBody = step === 1
    ? `
      <article class="panel plan-step-panel${state.activePlanFocus === "working-pick-step" ? " is-focused" : ""}" id="plan-working-pick-step">
        <p class="eyebrow">Working pick</p>
        <h3>${displayTitle}</h3>
        <p class="muted">${machineProfile.beginner_summary}</p>
        <p class="muted">This is your current front-runner. Keep it if it still feels right, or switch before planning next actions.</p>
        <div class="discovery-actions">
          <button class="btn btn-primary" type="button" data-action="plan-keep-pick">Continue with this machine</button>
          <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
        </div>
      </article>
      ${alternatives.length ? `
        <article class="panel plan-step-panel">
          <p class="eyebrow">Switch pick</p>
          <h3>Try another shortlisted machine</h3>
          <div class="choice-grid">
            ${alternatives.map((item) => `
              <button class="choice-card" type="button" data-action="plan-switch-pick:${item.id}">
                <strong>${machineDisplayTitle(item)}</strong>
                <span>${item.beginner_summary}</span>
              </button>
            `).join("")}
          </div>
        </article>
      ` : ""}
    `
    : step === 2
      ? `
        <article class="panel plan-step-panel${state.activePlanFocus === "fit-risk-step" ? " is-focused" : ""}" id="plan-fit-risk-step">
          <p class="eyebrow">Why this fits / what could go wrong</p>
          <h3>${displayTitle}</h3>
          <p><strong>Why this fits you</strong></p>
          <ul class="result-list">
            ${whyItFits.slice(0, 2).map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <p><strong>Main downside</strong></p>
          <p class="muted">${downside || "Confirm this still feels right after one focused validation step."}</p>
          <p><strong>What to confirm before buying</strong></p>
          <p class="muted">${confirm || "Confirm game feel and ownership fit before committing."}</p>
          ${skipNote ? `<p class="muted"><strong>Who should skip this:</strong> ${skipNote}</p>` : ""}
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="plan-next-step">Choose buy path</button>
            <button class="btn btn-secondary" type="button" data-action="plan-prev-step">Back</button>
          </div>
        </article>
      `
      : step === 3
        ? `
          <article class="panel plan-step-panel${state.activePlanFocus === "path-step" ? " is-focused" : ""}" id="plan-path-step">
            <p class="eyebrow">Buy path decision</p>
            <h3>How do you want to pursue this machine?</h3>
            <div class="choice-grid">
              ${BUY_PATH_OPTIONS.map((option) => `
                <button class="choice-card${pathType === option.value ? " is-selected" : ""}" type="button" data-action="plan-set-path:${option.value}">
                  <strong>${option.label}</strong>
                  <span>${option.hint}</span>
                </button>
              `).join("")}
            </div>
            <div class="discovery-actions">
              <button class="btn btn-primary" type="button" data-action="plan-next-step">Build next actions</button>
              <button class="btn btn-secondary" type="button" data-action="plan-prev-step">Back</button>
            </div>
          </article>
        `
        : `
          <article class="panel plan-step-panel">
            <p class="eyebrow">Next actions</p>
            <h3>What to do next for the ${pathTag.toLowerCase()} route</h3>
            ${unresolvedBlockers.length ? `
              <article class="required-next-card">
                <p><strong>Complete required checks first</strong></p>
                <ul class="result-list">
                  ${unresolvedBlockers.map((b) => `<li>${b.title}</li>`).join("")}
                </ul>
                <button class="btn btn-primary" type="button" data-action="plan-focus-required">Review required checks</button>
              </article>
            ` : ""}
            <ul class="result-list">
              ${pathActions.map((item) => `<li>${item}</li>`).join("")}
            </ul>
            <p class="muted">External listing/deep detail actions stay secondary until required checks are complete.</p>
            <div class="discovery-actions">
              <button class="btn btn-primary" type="button" data-action="plan-finish">Save plan and open Decision Brief</button>
              <button class="btn btn-secondary" type="button" data-action="plan-prev-step">Back</button>
            </div>
          </article>
        `;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        decisionPlanStepTitle(step),
        "Move from shortlist to a calm, actionable buying plan.",
        decisionPlanProgress(step),
        pathTag
      )}
      ${dominantStatusPanel}
      ${requiredChecksSection}
      ${stepBody}
      ${state.activeRiskDrawer ? readinessSection : ""}
    </section>
  `;
}
