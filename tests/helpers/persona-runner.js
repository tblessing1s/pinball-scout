import { addDeadEnd, finalizeScenarioOutcome } from "./scenario-outcome.js";

export async function runPersonaScenario({ page, testInfo, outcome, journey }) {
  try {
    await journey();
    outcome.status = "passed";
  } catch (error) {
    outcome.status = "failed";
    outcome.error = error instanceof Error ? error.message : String(error);
    addDeadEnd(outcome, outcome.pathTaken[outcome.pathTaken.length - 1] || "unknown", outcome.error);
    throw error;
  } finally {
    await finalizeScenarioOutcome({ page, testInfo, outcome });
  }
}
