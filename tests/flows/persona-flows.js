import { expect } from "@playwright/test";
import { addConfusionFlag, addPathStep, markReached } from "../helpers/scenario-outcome.js";

async function clickChoice(page, selector, failureMessage) {
  const locator = page.locator(selector);
  await expect(locator, failureMessage).toBeVisible();
  await locator.click();
}

export async function openDiscovery(page, outcome) {
  addPathStep(outcome, "open-discovery");
  await page.goto("/help.html");
  await expect(page.locator("#discovery-app")).toBeVisible();
  await expect(page.locator("[data-entry='no']")).toBeVisible();
}

export async function chooseEntryAndContext(page, persona, outcome) {
  addPathStep(outcome, "entry-and-context");
  await clickChoice(page, `[data-entry="${persona.entry}"]`, "Entry choice not available.");
  await expect(page.locator("[data-action='start-discovery']")).toBeVisible();

  for (const [question, value] of Object.entries(persona.context)) {
    await clickChoice(
      page,
      `[data-context-choice="${question}:${value}"]`,
      `Context choice missing for ${question}:${value}.`
    );
  }

  await clickChoice(page, "[data-action='start-discovery']", "Could not continue from guardrails.");
}

export async function completeTasteProfile(page, persona, outcome) {
  addPathStep(outcome, "taste-profile");
  await expect(page.locator("[data-action='begin-reactions']")).toBeVisible();

  for (const [prompt, value] of Object.entries(persona.taste)) {
    await clickChoice(
      page,
      `[data-taste-choice="${prompt}:${value}"]`,
      `Taste choice missing for ${prompt}:${value}.`
    );
  }

  await clickChoice(page, "[data-action='begin-reactions']", "Could not start machine reaction loop.");
}

export async function runReactionLoopToResults(page, persona, outcome) {
  addPathStep(outcome, "reaction-loop");
  const maxCards = 10;
  let cardIndex = 0;

  while (cardIndex < maxCards) {
    if (await page.locator("[data-action='show-recommendations']").isVisible()) {
      await page.locator("[data-action='show-recommendations']").click();
      break;
    }

    const reactionButtons = page.locator("[data-reaction]");
    await expect(reactionButtons, "No reaction actions visible; likely stuck in discovery flow.").toHaveCount(3);

    const likedAspect = persona.likedAspectSequence[cardIndex % persona.likedAspectSequence.length];
    const concern = persona.concernSequence[cardIndex % persona.concernSequence.length];
    const reaction = persona.reactionSequence[cardIndex % persona.reactionSequence.length];

    await page.locator(`[data-draft-choice="likedAspect:${likedAspect}"]`).click();
    await page.locator(`[data-draft-choice="concern:${concern}"]`).click();
    await page.locator(`[data-reaction="${reaction}"]`).click();
    cardIndex += 1;
  }

  await expect(page.locator(".results-next-step"), "Shortlist results screen did not load.").toBeVisible();
  markReached(outcome, "shortlistReached");

  const actionCount = await page.locator(".results-next-step .card-actions .btn").count();
  if (actionCount > 3) {
    addConfusionFlag(outcome, "next-step-overload", `Results next-step panel exposes ${actionCount} actions.`);
  }
}

export async function openBuyingPlan(page, outcome) {
  addPathStep(outcome, "open-buying-plan");
  await clickChoice(page, ".results-next-step [data-action^='open-sourcing:']", "Could not open buying plan from results.");
  await expect(page.locator("#required-checks")).toBeVisible();
  markReached(outcome, "buyingPlanReached");
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
    page,
    `[data-action='plan-set-path:${persona.preferredBuyPath}']`,
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
}

export async function runResumeCheck(page, outcome) {
  addPathStep(outcome, "resume-reentry-check");
  await page.goto("/help.html?resume=1&brief=1");
  await expect(page.getByRole("heading", { name: "Decision Brief" })).toBeVisible();
  markReached(outcome, "resumeReentryValidated");
}

export async function openCompareFromResults(page, outcome) {
  addPathStep(outcome, "open-compare");
  await clickChoice(page, "[data-action='toggle-more-actions']", "Could not open more actions area on results.");
  await clickChoice(page, "a[href='compare.html']", "Compare shortlist link not available.");
  await expect(page).toHaveURL(/compare\.html/);
  await expect(page.getByRole("heading", { name: "Pick One Now" })).toBeVisible();
  markReached(outcome, "compareReached");
}

export async function chooseThemeDrivenFrontRunner(page, outcome) {
  addPathStep(outcome, "compare-front-runner");
  await clickChoice(page, "[data-action='compare-set-preset:most-excitement']", "Most excitement mode not available.");
  await clickChoice(page, "[data-action^='choose-front-runner:']", "No front-runner selection action was available.");
  markReached(outcome, "frontRunnerSelected");
}

export async function verifyFrontRunnerContinuityAfterCompare(page, outcome) {
  addPathStep(outcome, "front-runner-continuity");
  const decisionState = await page.evaluate(() => JSON.parse(localStorage.getItem("pinballScoutDecisionStateV1") || "{}"));
  if (!decisionState.frontRunnerSlug) {
    addConfusionFlag(outcome, "front-runner-missing", "Compare action did not persist a front-runner.");
  }

  await page.goto("/help.html?resume=1");
  if (await page.locator("#required-checks").isVisible()) {
    markReached(outcome, "buyingPlanReached");
  } else if (await page.locator("[data-action='open-shortlist']").isVisible()) {
    await page.locator("[data-action='open-shortlist']").click();
    await expect(page.locator(".results-next-step")).toBeVisible();
  } else {
    addConfusionFlag(outcome, "resume-ambiguity", "Resume did not open sourcing and did not expose open-shortlist CTA.");
  }
}
