import { expect } from "@playwright/test";
import { readPersonaSnapshot } from "./persona-observability.js";
import { addConfusionFlag } from "./scenario-outcome.js";

function actionsMatch(primaryButtons, expectedActions = []) {
  if (!expectedActions.length) return true;
  return primaryButtons.some((button) => expectedActions.some((expected) => button.action.startsWith(expected) || button.href === expected));
}

export async function assertClearPrimaryNextAction(page, outcome, {
  label,
  minPrimaryActions = 1,
  maxPrimaryActions = 3,
  includeSmallButtons = false,
  expectedActions = []
} = {}) {
  const snapshot = await readPersonaSnapshot(page);
  const primaryButtons = includeSmallButtons
    ? snapshot.visiblePrimaryButtons
    : snapshot.visiblePrimaryButtons.filter((button) => !button.isSmall);

  expect(primaryButtons.length, `${label} should expose at least ${minPrimaryActions} primary next action(s).`).toBeGreaterThanOrEqual(minPrimaryActions);

  if (primaryButtons.length > maxPrimaryActions) {
    addConfusionFlag(
      outcome,
      "primary-action-ambiguity",
      `${label} exposes ${primaryButtons.length} dominant primary actions: ${primaryButtons.map((button) => button.text).join(", ")}.`
    );
  }

  expect(primaryButtons.length, `${label} exposes too many competing dominant primary actions (${primaryButtons.length}).`).toBeLessThanOrEqual(maxPrimaryActions);

  if (expectedActions.length && !actionsMatch(primaryButtons, expectedActions)) {
    addConfusionFlag(
      outcome,
      "missing-primary-next-step",
      `${label} did not expose an expected next action. Saw: ${primaryButtons.map((button) => button.action || button.href || button.text).join(", ")}.`
    );
  }

  expect(actionsMatch(primaryButtons, expectedActions), `${label} should expose one of the expected next actions.`).toBeTruthy();

  return snapshot;
}

export async function assertFrontRunnerPresent(page, outcome, label) {
  const snapshot = await readPersonaSnapshot(page);
  const frontRunnerSlug = snapshot.decisionState.frontRunnerSlug;

  if (!frontRunnerSlug) {
    addConfusionFlag(outcome, "missing-front-runner", `${label} has no active front-runner in decision state.`);
  }

  expect(frontRunnerSlug, `${label} should preserve an active front-runner.`).toBeTruthy();
  return snapshot;
}

export async function assertDecisionBriefConsistency(page, outcome, label) {
  const snapshot = await readPersonaSnapshot(page);
  const { frontRunnerSlug, backupSlugs, decisionBrief } = snapshot.decisionState;

  expect(decisionBrief, `${label} should have a Decision Brief in decision state.`).toBeTruthy();
  expect(decisionBrief?.machineSlug, `${label} should persist a Decision Brief machine slug.`).toBeTruthy();
  expect(decisionBrief?.machineSlug, `${label} Decision Brief should match the active front-runner.`).toBe(frontRunnerSlug);

  const briefBackups = Array.isArray(decisionBrief?.backupSlugs) ? decisionBrief.backupSlugs : [];
  const conflictingBackup = briefBackups.find((slug) => !backupSlugs.includes(slug));
  if (conflictingBackup) {
    addConfusionFlag(
      outcome,
      "decision-brief-backup-drift",
      `${label} Decision Brief backup '${conflictingBackup}' is not present in current decision backups.`
    );
  }
  expect(conflictingBackup, `${label} Decision Brief backups should align with current decision backups.`).toBeUndefined();

  return snapshot;
}

export async function assertCompareContextIntegrity(page, outcome, label) {
  const snapshot = await readPersonaSnapshot(page);
  const compareState = snapshot.decisionState.compareState;
  const frontRunnerSlug = snapshot.decisionState.frontRunnerSlug;
  const selectedSlugs = Array.isArray(compareState?.selectedSlugs) ? compareState.selectedSlugs : [];

  expect(compareState, `${label} should preserve compare context.`).toBeTruthy();
  expect(selectedSlugs.length, `${label} should keep at least two machines selected for compare.`).toBeGreaterThanOrEqual(2);

  if (frontRunnerSlug && !selectedSlugs.includes(frontRunnerSlug)) {
    addConfusionFlag(
      outcome,
      "compare-front-runner-detached",
      `${label} compare selection lost the active front-runner '${frontRunnerSlug}'.`
    );
  }
  expect(frontRunnerSlug ? selectedSlugs.includes(frontRunnerSlug) : true, `${label} compare selection should include the active front-runner.`).toBeTruthy();

  return snapshot;
}

export async function assertResumeQuality(page, outcome, {
  label,
  allowedScreens = [],
  expectedActions = []
} = {}) {
  const snapshot = await assertClearPrimaryNextAction(page, outcome, {
    label,
    minPrimaryActions: 1,
    maxPrimaryActions: 3,
    expectedActions
  });

  if (allowedScreens.length) {
    const screen = snapshot.discoveryState.screen;
    if (!allowedScreens.includes(screen)) {
      addConfusionFlag(
        outcome,
        "resume-screen-mismatch",
        `${label} resumed to '${screen}', expected one of: ${allowedScreens.join(", ")}.`
      );
    }
    expect(allowedScreens.includes(screen), `${label} should resume into a sensible continuation screen.`).toBeTruthy();
  }

  return snapshot;
}
