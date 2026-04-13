import { addCheckpoint, addConfusionFlag, setContinuitySignal } from "./scenario-outcome.js";

function cloneValue(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function summarizeDecisionState(decisionState = {}) {
  return {
    frontRunnerSlug: decisionState.frontRunnerSlug || "",
    backupSlugs: Array.isArray(decisionState.backupSlugs) ? decisionState.backupSlugs : [],
    selectedPathType: decisionState.selectedPathType || "",
    currentPlanStep: Number.isFinite(Number(decisionState.currentPlanStep)) ? Number(decisionState.currentPlanStep) : null,
    compareState: decisionState.compareState ? {
      presetMode: decisionState.compareState.presetMode || "",
      compareMode: decisionState.compareState.compareMode || "",
      tooClose: Boolean(decisionState.compareState.tooClose),
      selectedSlugs: Array.isArray(decisionState.compareState.selectedSlugs) ? decisionState.compareState.selectedSlugs : [],
      temporaryPrimaryCandidate: decisionState.compareState.temporaryPrimaryCandidate || ""
    } : null,
    decisionBrief: decisionState.decisionBrief ? {
      machineSlug: decisionState.decisionBrief.machineSlug || "",
      pathType: decisionState.decisionBrief.pathType || "",
      confidenceTitle: decisionState.decisionBrief.confidenceTitle || "",
      readinessLabel: decisionState.decisionBrief.readinessLabel || "",
      nextActions: Array.isArray(decisionState.decisionBrief.nextActions) ? decisionState.decisionBrief.nextActions : [],
      backupSlugs: Array.isArray(decisionState.decisionBrief.backupSlugs) ? decisionState.decisionBrief.backupSlugs : []
    } : null
  };
}

function summarizeDiscoveryState(discoveryState = {}) {
  return {
    screen: discoveryState.screen || "",
    mode: discoveryState.mode || "",
    deckIndex: Number.isFinite(Number(discoveryState.deckIndex)) ? Number(discoveryState.deckIndex) : null,
    reactionCount: Array.isArray(discoveryState.reactions) ? discoveryState.reactions.length : 0,
    sourcingMachineId: discoveryState.sourcingMachineId || "",
    moreActionsOpen: Boolean(discoveryState.moreActionsOpen),
    tasteAnswerCount: discoveryState.tasteAnswers && typeof discoveryState.tasteAnswers === "object"
      ? Object.values(discoveryState.tasteAnswers).filter(Boolean).length
      : 0
  };
}

function normalizeSnapshot(snapshot = {}) {
  return {
    url: snapshot.url || "",
    heading: snapshot.heading || "",
    readinessSummary: snapshot.readinessSummary || "",
    visiblePrimaryButtons: Array.isArray(snapshot.visiblePrimaryButtons) ? snapshot.visiblePrimaryButtons : [],
    decisionState: summarizeDecisionState(snapshot.decisionState || {}),
    discoveryState: summarizeDiscoveryState(snapshot.discoveryState || {})
  };
}

export async function readPersonaSnapshot(page) {
  const snapshot = await page.evaluate(() => {
    const decisionState = JSON.parse(localStorage.getItem("pinballScoutDecisionStateV1") || "null");
    const discoveryState = JSON.parse(localStorage.getItem("pinballScoutDiscoveryStateV2") || "null");
    const mainHeading = document.querySelector("main h1, main h2")?.textContent?.trim() || "";
    const visiblePrimaryButtons = Array.from(document.querySelectorAll(".btn.btn-primary"))
      .map((node) => ({
        text: node.textContent?.trim() || "",
        action: node.getAttribute("data-action") || "",
        href: node.getAttribute("href") || "",
        disabled: node.hasAttribute("disabled"),
        isSmall: node.classList.contains("small")
      }))
      .filter((item) => item.text && !item.disabled);
    const readinessSummary = document.querySelector("#required-checks .required-checks-head .muted")?.textContent?.trim() || "";
    return {
      url: window.location.href,
      heading: mainHeading,
      visiblePrimaryButtons,
      readinessSummary,
      decisionState,
      discoveryState
    };
  });

  return normalizeSnapshot(snapshot);
}

export async function capturePersonaCheckpoint(page, outcome, label, detail = {}) {
  const snapshot = await readPersonaSnapshot(page);

  if (snapshot.visiblePrimaryButtons.length > 3) {
    addConfusionFlag(
      outcome,
      "primary-action-overload",
      `${label} shows ${snapshot.visiblePrimaryButtons.length} visible primary buttons.`
    );
  }

  addCheckpoint(outcome, {
    label,
    detail,
    url: snapshot.url,
    heading: snapshot.heading,
    readinessSummary: snapshot.readinessSummary,
    visiblePrimaryButtons: snapshot.visiblePrimaryButtons,
    decisionState: snapshot.decisionState,
    discoveryState: snapshot.discoveryState
  });

  outcome.finalState = {
    label,
    url: snapshot.url,
    heading: snapshot.heading,
    readinessSummary: snapshot.readinessSummary,
    visiblePrimaryButtons: cloneValue(snapshot.visiblePrimaryButtons),
    decisionState: snapshot.decisionState,
    discoveryState: snapshot.discoveryState
  };
}

export function evaluateDecisionBriefContinuity(outcome) {
  const finalDecisionState = outcome.finalState?.decisionState;
  const brief = finalDecisionState?.decisionBrief;
  if (!brief) return;
  const matches = brief.machineSlug === finalDecisionState.frontRunnerSlug;
  setContinuitySignal(outcome, "decisionBriefMatchesDecisionState", matches);
  if (!matches) {
    addConfusionFlag(
      outcome,
      "decision-brief-drift",
      `Decision Brief machine '${brief.machineSlug}' differs from front-runner '${finalDecisionState.frontRunnerSlug}'.`
    );
  }
}

export function evaluateResumeContinuity(outcome, beforeResumeFrontRunner = "", afterResumeFrontRunner = "") {
  if (!beforeResumeFrontRunner || !afterResumeFrontRunner) return;
  const preserved = beforeResumeFrontRunner === afterResumeFrontRunner;
  setContinuitySignal(outcome, "frontRunnerPreservedOnResume", preserved);
  if (!preserved) {
    addConfusionFlag(
      outcome,
      "front-runner-drift-on-resume",
      `Front-runner changed from '${beforeResumeFrontRunner}' to '${afterResumeFrontRunner}' after resume.`
    );
  }
}
