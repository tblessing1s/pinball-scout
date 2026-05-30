import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve(process.cwd(), "test-results", "persona-outcomes");
const SCHEMA_VERSION = 2;

function safeFileName(value) {
  return value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function createScenarioOutcome(persona) {
  return {
    schemaVersion: SCHEMA_VERSION,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    testTitle: "",
    personaName: persona.name,
    personaId: persona.id,
    profile: persona.profile,
    persona: {
      id: persona.id,
      name: persona.name,
      profile: persona.profile,
      tendencies: [...(persona.tendencies || [])],
      expectations: [...(persona.expectations || [])]
    },
    pathTaken: [],
    timeline: [],
    flowEnded: "",
    shortlistReached: false,
    compareReached: false,
    frontRunnerSelected: false,
    buyingPlanReached: false,
    decisionBriefReached: false,
    resumeReentryValidated: false,
    systemsTouched: {
      discovery: false,
      shortlist: false,
      compare: false,
      buyingPlan: false,
      decisionBrief: false,
      resume: false
    },
    continuity: {
      frontRunnerPreservedOnResume: null,
      compareContextPreserved: null,
      decisionBriefMatchesDecisionState: null
    },
    finalState: null,
    checkpoints: [],
    confusionFlags: [],
    deadEndStates: [],
    status: "in-progress",
    error: null
  };
}

export function addPathStep(outcome, step) {
  outcome.pathTaken.push(step);
  outcome.timeline.push({
    type: "step",
    step,
    at: new Date().toISOString()
  });
}

export function markReached(outcome, key) {
  outcome[key] = true;
  if (key === "shortlistReached") outcome.systemsTouched.shortlist = true;
  if (key === "compareReached") outcome.systemsTouched.compare = true;
  if (key === "buyingPlanReached") outcome.systemsTouched.buyingPlan = true;
  if (key === "decisionBriefReached") outcome.systemsTouched.decisionBrief = true;
  if (key === "resumeReentryValidated") outcome.systemsTouched.resume = true;
}

export function addConfusionFlag(outcome, flag, detail) {
  outcome.confusionFlags.push({ flag, detail, at: new Date().toISOString() });
}

export function addDeadEnd(outcome, step, detail) {
  outcome.deadEndStates.push({ step, detail, at: new Date().toISOString() });
}

export function markSystemTouched(outcome, key) {
  if (Object.hasOwn(outcome.systemsTouched, key)) {
    outcome.systemsTouched[key] = true;
  }
}

export function setContinuitySignal(outcome, key, value) {
  if (Object.hasOwn(outcome.continuity, key)) {
    outcome.continuity[key] = value;
  }
}

export function addCheckpoint(outcome, checkpoint) {
  outcome.checkpoints.push({
    at: new Date().toISOString(),
    ...checkpoint
  });
}

export async function finalizeScenarioOutcome({ page, testInfo, outcome }) {
  outcome.finishedAt = new Date().toISOString();
  outcome.testTitle = testInfo.title;
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
