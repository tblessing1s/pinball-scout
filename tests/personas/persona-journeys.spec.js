import { test } from "@playwright/test";
import { personas } from "../fixtures/personas.js";
import {
  chooseEntryAndContext,
  chooseThemeDrivenFrontRunner,
  completeBuyingPlanToBrief,
  completeTasteProfile,
  openBuyingPlan,
  openCompareFromResults,
  openDiscovery,
  runReactionLoopToResults,
  runResumeCheck,
  verifyFrontRunnerContinuityAfterCompare
} from "../flows/persona-flows.js";
import { runPersonaScenario } from "../helpers/persona-runner.js";
import { createScenarioOutcome } from "../helpers/scenario-outcome.js";

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
