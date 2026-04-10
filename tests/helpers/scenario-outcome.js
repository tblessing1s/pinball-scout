import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "test-results", "persona-outcomes");

function safeFileName(value) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createScenarioOutcome(persona) {
  return {
    personaName: persona.name,
    personaId: persona.id,
    profile: persona.profile,
    pathTaken: [],
    flowEnded: "",
    shortlistReached: false,
    compareReached: false,
    frontRunnerSelected: false,
    buyingPlanReached: false,
    decisionBriefReached: false,
    resumeReentryValidated: false,
    confusionFlags: [],
    deadEndStates: [],
    status: "in-progress",
    error: null
  };
}

export function addPathStep(outcome, step) {
  outcome.pathTaken.push(step);
}

export function markReached(outcome, key) {
  outcome[key] = true;
}

export function addConfusionFlag(outcome, flag, detail) {
  outcome.confusionFlags.push({ flag, detail });
}

export function addDeadEnd(outcome, step, detail) {
  outcome.deadEndStates.push({ step, detail });
}

export async function finalizeScenarioOutcome({ page, testInfo, outcome }) {
  outcome.flowEnded = page.url();
  mkdirSync(OUT_DIR, { recursive: true });
  const fileName = safeFileName(`${testInfo.title}-${outcome.personaId}`) || `scenario-${Date.now()}`;
  const filePath = resolve(OUT_DIR, `${fileName}.json`);
  const body = JSON.stringify(outcome, null, 2);
  writeFileSync(filePath, body);
  await testInfo.attach("persona-outcome", {
    body: Buffer.from(body, "utf8"),
    contentType: "application/json"
  });
  // eslint-disable-next-line no-console
  console.log(`[persona-outcome] ${outcome.personaName} | ${outcome.status} | ${filePath}`);
}
