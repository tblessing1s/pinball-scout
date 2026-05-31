import { expect } from "@playwright/test";
import {
  assertClearPrimaryNextAction,
  assertCompareContextIntegrity,
  assertDecisionBriefConsistency,
  assertFrontRunnerPresent,
  assertResumeQuality
} from "../helpers/assertions.js";
import { capturePersonaCheckpoint, evaluateDecisionBriefContinuity, evaluateResumeContinuity } from "../helpers/persona-observability.js";
import { addConfusionFlag, addPathStep, markReached, markSystemTouched, setContinuitySignal } from "../helpers/scenario-outcome.js";
import {
  buyPathOption,
  frontRunnerChoice,
  resultsCompareLink,
  resultsNextStep
} from "../helpers/locators.js";

async function clickChoice(target, selectorOrMessage, maybeFailureMessage) {
  const isLocatorOnlyCall = typeof maybeFailureMessage === "undefined";
  const locator = isLocatorOnlyCall ? target : target.locator(selectorOrMessage);
  const failureMessage = isLocatorOnlyCall ? selectorOrMessage : maybeFailureMessage;
  await expect(locator, failureMessage).toBeVisible();
  await locator.click();
}

export async function openDiscovery(page, outcome) {
  addPathStep(outcome, "open-discovery");
  await page.goto("/help.html");
  await expect(page.locator("#discovery-app")).toBeVisible();
  await expect(page.locator("[data-entry='no']")).toBeVisible();
  markSystemTouched(outcome, "discovery");
  await capturePersonaCheckpoint(page, outcome, "entry-screen");
}

export async function chooseEntryAndContext(page, persona, outcome) {
  addPathStep(outcome, "entry-and-context");
  await clickChoice(page, `[data-entry="${persona.entry}"]`, "Entry choice not available.");
}

export async function completeTasteProfile(page, persona, outcome) {
  // Deprecated in discovery path — taste preferences now collected via taste-pivot machine comparisons.
  // This no-op is kept so spec files that still call it do not error.
  addPathStep(outcome, "taste-profile-skipped");
}

export async function runReactionLoopToResults(page, persona, outcome) {
  addPathStep(outcome, "reaction-loop");
  const maxCards = 10;
  let cardIndex = 0;

  while (cardIndex < maxCards) {
    const reactionButtons = page.locator("[data-reaction]");
    const hasReactions = await reactionButtons.count() > 0;
    if (!hasReactions) break;

    const likedAspect = persona.likedAspectSequence[cardIndex % persona.likedAspectSequence.length];
    const concern = persona.concernSequence[cardIndex % persona.concernSequence.length];
    const reaction = persona.reactionSequence[cardIndex % persona.reactionSequence.length];

    const likedAspectBtn = page.locator(`[data-draft-choice="likedAspect:${likedAspect}"]`);
    if (await likedAspectBtn.isVisible()) await likedAspectBtn.click();
    const concernBtn = page.locator(`[data-draft-choice="concern:${concern}"]`);
    if (await concernBtn.isVisible()) await concernBtn.click();
    await page.locator(`[data-reaction="${reaction}"]`).click();
    cardIndex += 1;
  }

  // Taste-pivot comparisons (6 rounds, always pick left)
  for (let pivot = 0; pivot < 6; pivot += 1) {
    const pivotBtn = page.locator(`[data-action="taste-pivot-pick:${pivot}:left"]`);
    if (await pivotBtn.isVisible()) {
      await pivotBtn.click();
    } else {
      break;
    }
  }

  // After taste-reveal profile screen, advance to recommendations
  const showRecsBtn = page.locator("[data-action='show-recommendations']");
  if (await showRecsBtn.isVisible()) {
    await showRecsBtn.click();
  }

  await expect(resultsNextStep(page), "Shortlist results screen did not load.").toBeVisible();
  markReached(outcome, "shortlistReached");
  await capturePersonaCheckpoint(page, outcome, "shortlist-results", {
    reactionCardsCompleted: cardIndex
  });
  await assertFrontRunnerPresent(page, outcome, "Shortlist results");
  await assertClearPrimaryNextAction(page, outcome, {
    label: "Shortlist results",
    minPrimaryActions: 1,
    maxPrimaryActions: 3,
    expectedActions: ["open-sourcing:"]
  });

  const actionCount = await resultsNextStep(page).locator(".card-actions .btn").count();
  if (actionCount > 3) {
    addConfusionFlag(outcome, "next-step-overload", `Results next-step panel exposes ${actionCount} actions.`);
  }
}

export async function openBuyingPlan(page, outcome) {
  addPathStep(outcome, "open-buying-plan");
  await clickChoice(resultsNextStep(page).locator("[data-action^='open-sourcing:']").first(), "Could not open buying plan from results.");
  await expect(page.locator("#required-checks")).toBeVisible();
  markReached(outcome, "buyingPlanReached");
  await capturePersonaCheckpoint(page, outcome, "buying-plan-opened");
  await assertFrontRunnerPresent(page, outcome, "Buying plan");
  await assertClearPrimaryNextAction(page, outcome, {
    label: "Buying plan",
    minPrimaryActions: 1,
    maxPrimaryActions: 3,
    expectedActions: ["plan-set-path:", "plan-keep-pick", "plan-next-step"]
  });
}

export async function completeBuyingPlanToBrief(page, persona, outcome) {
  addPathStep(outcome, "complete-buying-plan");

  if (await page.locator("[data-action='plan-keep-pick']").isVisible()) {
    await page.locator("[data-action='plan-keep-pick']").click();
  }
  if (await page.locator("[data-action='plan-next-step']").isVisible()) {
    await page.locator("[data-action='plan-next-step']").click();
  }

  await clickChoice(
    buyPathOption(page, persona.preferredBuyPath),
    `Preferred buy path '${persona.preferredBuyPath}' not available.`
  );
  await clickChoice(page, "[data-action='plan-next-step']", "Could not continue after selecting buy path.");

  const blockerButtons = page.locator("[data-action^='plan-blocker-primary:']");
  const blockerCount = await blockerButtons.count();
  if (blockerCount === 0) {
    addConfusionFlag(outcome, "no-blockers-visible", "Required check actions were not visible in buying plan.");
  }
  for (let i = 0; i < blockerCount; i += 1) {
    await blockerButtons.nth(i).click();
  }

  await clickChoice(page, "[data-action='plan-finish']", "Could not save plan and open Decision Brief.");
  await expect(page.getByRole("heading", { name: "Decision Brief" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exact next 3 actions" })).toBeVisible();
  markReached(outcome, "decisionBriefReached");
  await capturePersonaCheckpoint(page, outcome, "decision-brief");
  evaluateDecisionBriefContinuity(outcome);
  await assertDecisionBriefConsistency(page, outcome, "Decision Brief");
  await assertClearPrimaryNextAction(page, outcome, {
    label: "Decision Brief",
    minPrimaryActions: 1,
    maxPrimaryActions: 1,
    expectedActions: ["open-sourcing:", "back-to-results"]
  });
}

export async function runResumeCheck(page, outcome) {
  addPathStep(outcome, "resume-reentry-check");
  const beforeResumeFrontRunner = outcome.finalState?.decisionState?.frontRunnerSlug || "";
  await page.goto("/help.html?resume=1&brief=1");
  await expect(page.getByRole("heading", { name: "Decision Brief" })).toBeVisible();
  markReached(outcome, "resumeReentryValidated");
  await capturePersonaCheckpoint(page, outcome, "resume-decision-brief");
  evaluateResumeContinuity(outcome, beforeResumeFrontRunner, outcome.finalState?.decisionState?.frontRunnerSlug || "");
  await assertDecisionBriefConsistency(page, outcome, "Resume Decision Brief");
  await assertResumeQuality(page, outcome, {
    label: "Resume Decision Brief",
    allowedScreens: ["decision-brief"],
    expectedActions: ["open-sourcing:", "back-to-results"]
  });
}

export async function openCompareFromResults(page, outcome) {
  addPathStep(outcome, "open-compare");
  await clickChoice(page, "[data-action='toggle-more-actions']", "Could not open more actions area on results.");
  await clickChoice(resultsCompareLink(page), "Compare shortlist link not available.");
  await expect(page).toHaveURL(/compare\.html/);
  await expect(page.getByRole("heading", { name: "Pick One Now" })).toBeVisible();
  markReached(outcome, "compareReached");
  await capturePersonaCheckpoint(page, outcome, "compare-opened");
  await assertCompareContextIntegrity(page, outcome, "Compare");
  await assertClearPrimaryNextAction(page, outcome, {
    label: "Compare",
    minPrimaryActions: 1,
    maxPrimaryActions: 3,
    expectedActions: ["choose-front-runner:", "tie-breaker-start", "tie-breaker-apply"]
  });
}

export async function chooseThemeDrivenFrontRunner(page, outcome) {
  addPathStep(outcome, "compare-front-runner");
  await clickChoice(page, "[data-action='compare-set-preset:most-excitement']", "Most excitement mode not available.");
  await clickChoice(frontRunnerChoice(page), "No front-runner selection action was available.");
  markReached(outcome, "frontRunnerSelected");
  setContinuitySignal(outcome, "compareContextPreserved", true);
  await capturePersonaCheckpoint(page, outcome, "compare-front-runner-selected");
  await assertCompareContextIntegrity(page, outcome, "Compare after front-runner selection");
  await assertFrontRunnerPresent(page, outcome, "Compare after front-runner selection");
}

export async function verifyFrontRunnerContinuityAfterCompare(page, outcome) {
  addPathStep(outcome, "front-runner-continuity");
  const decisionState = await page.evaluate(() => JSON.parse(localStorage.getItem("pinballScoutDecisionStateV1") || "{}"));
  const beforeResumeFrontRunner = decisionState.frontRunnerSlug || "";
  if (!decisionState.frontRunnerSlug) {
    addConfusionFlag(outcome, "front-runner-missing", "Compare action did not persist a front-runner.");
    setContinuitySignal(outcome, "compareContextPreserved", false);
  }

  await page.goto("/help.html?resume=1");
  if (await page.locator("#required-checks").isVisible()) {
    markReached(outcome, "buyingPlanReached");
  } else if (await page.locator("[data-action='open-shortlist']").isVisible()) {
    await page.locator("[data-action='open-shortlist']").click();
    await expect(resultsNextStep(page)).toBeVisible();
  } else {
    addConfusionFlag(outcome, "resume-ambiguity", "Resume did not open sourcing and did not expose open-shortlist CTA.");
  }
  await capturePersonaCheckpoint(page, outcome, "resume-after-compare");
  evaluateResumeContinuity(outcome, beforeResumeFrontRunner, outcome.finalState?.decisionState?.frontRunnerSlug || "");
  await assertFrontRunnerPresent(page, outcome, "Resume after compare");
  await assertResumeQuality(page, outcome, {
    label: "Resume after compare",
    allowedScreens: ["sourcing", "results"],
    expectedActions: ["plan-set-path:", "plan-keep-pick", "open-sourcing:", "back-to-results"]
  });
}
