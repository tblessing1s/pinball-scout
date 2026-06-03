import { test, expect } from "@playwright/test";
import { personas } from "../fixtures/personas.js";
import {
  chooseEntryAndContext,
  chooseEntryAndContextCalibration,
  chooseThemeDrivenFrontRunner,
  completeBuyingPlanToBrief,
  completeTasteProfile,
  openBuyingPlan,
  openCompareFromResults,
  openDiscovery,
  runCalibrationLoopToResults,
  runReactionLoopToResults,
  runResumeCheck,
  verifyFrontRunnerContinuityAfterCompare
} from "../flows/persona-flows.js";
import { runPersonaScenario } from "../helpers/persona-runner.js";
import { addConfusionFlag, createScenarioOutcome } from "../helpers/scenario-outcome.js";

test.describe("Persona Journeys", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index.html");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("Overwhelmed Novice reaches shortlist, buying plan, brief, and resume path", async ({ page }, testInfo) => {
    const persona = personas.overwhelmedNovice;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContext(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runReactionLoopToResults(page, persona, outcome);
        await openBuyingPlan(page, outcome);
        await completeBuyingPlanToBrief(page, persona, outcome);
        await runResumeCheck(page, outcome);
      }
    });
  });

  test("Practical Buyer validates blocker/readiness flow and reaches decision brief", async ({ page }, testInfo) => {
    const persona = personas.practicalBuyer;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContext(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runReactionLoopToResults(page, persona, outcome);
        await openBuyingPlan(page, outcome);
        await completeBuyingPlanToBrief(page, persona, outcome);
      }
    });
  });

  // ── Challenger personas ──────────────────────────────────────────────────

  test("Ready-to-Buy Returner uses calibration path and reaches decision brief", async ({ page }, testInfo) => {
    const persona = personas.readyToBuyReturner;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContextCalibration(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runCalibrationLoopToResults(page, persona, outcome);
        await openBuyingPlan(page, outcome);
        await completeBuyingPlanToBrief(page, persona, outcome);
      }
    });
  });

  test("On-the-Fence Researcher lands on weak-signal results and still has a path forward", async ({ page }, testInfo) => {
    const persona = personas.onTheFenceResearcher;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContext(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runReactionLoopToResults(page, persona, outcome);

        // Record confidence level — researcher should land on low or medium, not high
        const highConfidenceVisible = await page.locator(".discovery-shell").getByText("Strong signal").isVisible();
        if (highConfidenceVisible) {
          addConfusionFlag(outcome, "unexpectedly-high-confidence", "Researcher reached high confidence — consider tightening the persona reaction mix.");
        }

        // Key check: confidence refinement next-steps must be visible (low/medium paths)
        const confidenceNextStep = page.locator("[data-confidence-step]").first();
        const hasRefinementPath = await confidenceNextStep.isVisible();
        if (!hasRefinementPath) {
          addConfusionFlag(outcome, "missing-refinement-path", "Researcher reached results with no confidence next-step actions — low-signal users have no forward path.");
        }

        // Results screen must still offer a usable forward path regardless of confidence
        await openBuyingPlan(page, outcome);
        await completeBuyingPlanToBrief(page, persona, outcome);
      }
    });
  });

  test("Pinball Enthusiast uses calibration path with polarized reactions and gets a non-generic shortlist", async ({ page }, testInfo) => {
    const persona = personas.pinballEnthusiast;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContextCalibration(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runCalibrationLoopToResults(page, persona, outcome);

        // Enthusiast's shortlist should reflect their demanding taste — verify the top card
        // carries a "Top fit" rank label (engine surfaced something, not a blank slate)
        const topFitLabel = page.locator(".recommendation-rank").filter({ hasText: "Top fit" });
        await expect(topFitLabel, "Enthusiast shortlist should have a ranked top-fit card.").toBeVisible();

        await openBuyingPlan(page, outcome);
        await completeBuyingPlanToBrief(page, persona, outcome);
      }
    });
  });

  test("Contrarian with mostly-negative reactions still reaches a usable shortlist", async ({ page }, testInfo) => {
    const persona = personas.theContrarian;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContext(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runReactionLoopToResults(page, persona, outcome);

        // Engine must not return an empty shortlist even with 5/6 negative reactions
        const recommendationCards = page.locator(".recommendation-card");
        const cardCount = await recommendationCards.count();
        if (cardCount === 0) {
          addConfusionFlag(outcome, "empty-shortlist", "Contrarian reached results with zero recommendation cards — engine fallback did not fire.");
        }
        expect(cardCount, "Engine should produce at least one recommendation even with mostly-negative reactions.").toBeGreaterThanOrEqual(1);

        await openBuyingPlan(page, outcome);
      }
    });
  });

  test("Theme-Driven Buyer uses compare flow and keeps front-runner continuity on resume", async ({ page }, testInfo) => {
    const persona = personas.themeDrivenBuyer;
    const outcome = createScenarioOutcome(persona);

    await runPersonaScenario({
      page,
      testInfo,
      outcome,
      journey: async () => {
        await openDiscovery(page, outcome);
        await chooseEntryAndContext(page, persona, outcome);
        await completeTasteProfile(page, persona, outcome);
        await runReactionLoopToResults(page, persona, outcome);
        await openCompareFromResults(page, outcome);
        await chooseThemeDrivenFrontRunner(page, outcome);
        await verifyFrontRunnerContinuityAfterCompare(page, outcome);
      }
    });
  });
});
