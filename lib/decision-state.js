import { machines } from "../data/machines.js";
import { migrateLegacyDecisionState } from "./state-migrations.js";
import { normalizeRequiredChecks } from "./required-checks.js";

export const DECISION_STATE_KEY = "pinballScoutDecisionStateV1";
const VALID_SLUGS = new Set(machines.map((machine) => machine.slug));

function defaultDecisionState() {
  return {
    schemaVersion: 1,
    updatedAt: "",
    frontRunnerSlug: "",
    frontRunnerLastChangedAt: "",
    backupSlugs: [],
    temporaryPrimary: false,
    temporaryPrimaryReason: "",
    finalPrimaryLocked: false,
    promotionReasons: [],
    selectedPathType: "",
    currentPlanStep: 1,
    perMachinePlanState: {},
    compareState: {
      presetMode: "balanced",
      compareMode: "pick-one-now",
      tooClose: false,
      tieBreakerResponses: {},
      tieBreakerStartedAt: "",
      selectedSlugs: [],
      temporaryPrimaryCandidate: ""
    },
    planLastUpdated: "",
    decisionBrief: null,
    hasLegacyDiscovery: false,
    migrationCompleted: false
  };
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sanitizeState(input = {}) {
  const next = defaultDecisionState();
  next.updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : "";
  next.frontRunnerSlug = VALID_SLUGS.has(input.frontRunnerSlug) ? input.frontRunnerSlug : "";
  next.frontRunnerLastChangedAt = typeof input.frontRunnerLastChangedAt === "string" ? input.frontRunnerLastChangedAt : "";
  next.backupSlugs = Array.isArray(input.backupSlugs)
    ? [...new Set(input.backupSlugs)].filter((slug) => VALID_SLUGS.has(slug) && slug !== next.frontRunnerSlug).slice(0, 2)
    : [];
  next.temporaryPrimary = Boolean(input.temporaryPrimary);
  next.temporaryPrimaryReason = typeof input.temporaryPrimaryReason === "string" ? input.temporaryPrimaryReason : "";
  next.finalPrimaryLocked = Boolean(input.finalPrimaryLocked);
  next.promotionReasons = Array.isArray(input.promotionReasons)
    ? input.promotionReasons.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
    : [];
  next.selectedPathType = typeof input.selectedPathType === "string" ? input.selectedPathType : "";
  next.currentPlanStep = Number.isFinite(Number(input.currentPlanStep))
    ? Math.min(4, Math.max(1, Math.round(Number(input.currentPlanStep))))
    : 1;
  next.planLastUpdated = typeof input.planLastUpdated === "string" ? input.planLastUpdated : "";
  next.perMachinePlanState = {};
  if (input.perMachinePlanState && typeof input.perMachinePlanState === "object") {
    Object.entries(input.perMachinePlanState).forEach(([slug, value]) => {
      if (!VALID_SLUGS.has(slug) || !value || typeof value !== "object") return;
      next.perMachinePlanState[slug] = {
        selectedPathType: typeof value.selectedPathType === "string" ? value.selectedPathType : "",
        currentPlanStep: Number.isFinite(Number(value.currentPlanStep))
          ? Math.min(4, Math.max(1, Math.round(Number(value.currentPlanStep))))
          : 1,
        workingPickConfirmed: Boolean(value.workingPickConfirmed),
        requiredChecks: normalizeRequiredChecks(value.requiredChecks),
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : ""
      };
    });
  }
  const rawCompare = input.compareState && typeof input.compareState === "object" ? input.compareState : {};
  const validPresetModes = new Set(["balanced", "lowest-regret", "most-excitement", "easiest-ownership"]);
  const validCompareModes = new Set(["pick-one-now", "deep-details"]);
  const canonicalDecisionSlugs = [next.frontRunnerSlug, ...next.backupSlugs].filter(Boolean);
  const rawSelectedSlugs = Array.isArray(rawCompare.selectedSlugs)
    ? [...new Set(rawCompare.selectedSlugs)].filter((slug) => VALID_SLUGS.has(slug)).slice(0, 3)
    : [];
  const normalizedSelectedSlugs = canonicalDecisionSlugs.length
    ? [next.frontRunnerSlug, ...rawSelectedSlugs, ...next.backupSlugs]
      .filter(Boolean)
      .filter((slug, index, list) => list.indexOf(slug) === index)
      .slice(0, 3)
    : rawSelectedSlugs;
  next.compareState = {
    presetMode: validPresetModes.has(rawCompare.presetMode) ? rawCompare.presetMode : "balanced",
    compareMode: validCompareModes.has(rawCompare.compareMode) ? rawCompare.compareMode : "pick-one-now",
    tooClose: Boolean(rawCompare.tooClose),
    tieBreakerResponses: rawCompare.tieBreakerResponses && typeof rawCompare.tieBreakerResponses === "object"
      ? Object.entries(rawCompare.tieBreakerResponses).reduce((acc, [key, value]) => {
        if (typeof key !== "string") return acc;
        if (value === "a" || value === "b" || value === "both") acc[key] = value;
        return acc;
      }, {})
      : {},
    tieBreakerStartedAt: typeof rawCompare.tieBreakerStartedAt === "string" ? rawCompare.tieBreakerStartedAt : "",
    selectedSlugs: normalizedSelectedSlugs,
    temporaryPrimaryCandidate: VALID_SLUGS.has(rawCompare.temporaryPrimaryCandidate) ? rawCompare.temporaryPrimaryCandidate : ""
  };
  const rawDecisionBrief = input.decisionBrief && typeof input.decisionBrief === "object" ? input.decisionBrief : null;
  next.decisionBrief = sanitizeDecisionBrief(rawDecisionBrief);
  if (next.decisionBrief && !isDecisionBriefCompatible(next.decisionBrief, next)) {
    next.decisionBrief = null;
  }
  next.hasLegacyDiscovery = Boolean(input.hasLegacyDiscovery);
  next.migrationCompleted = Boolean(input.migrationCompleted);
  return next;
}

function sanitizeStringList(value = [], { max = 6 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function sanitizeSlugList(value = [], { max = 3, exclude = "" } = {}) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value)]
    .map((slug) => String(slug || "").trim())
    .filter((slug) => VALID_SLUGS.has(slug) && slug !== exclude)
    .slice(0, max);
}

function sanitizeDecisionBrief(input = null) {
  if (!input) return null;
  const machineSlug = VALID_SLUGS.has(input.machineSlug) ? input.machineSlug : "";
  if (!machineSlug) return null;
  return {
    machineSlug,
    createdAt: typeof input.createdAt === "string" ? input.createdAt : "",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : "",
    pathType: typeof input.pathType === "string" ? input.pathType : "",
    confidenceLevel: typeof input.confidenceLevel === "string" ? input.confidenceLevel : "",
    confidenceTitle: typeof input.confidenceTitle === "string" ? input.confidenceTitle : "",
    readinessLabel: typeof input.readinessLabel === "string" ? input.readinessLabel : "",
    readinessReason: typeof input.readinessReason === "string" ? input.readinessReason : "",
    whyItFits: sanitizeStringList(input.whyItFits, { max: 4 }),
    refinementInsights: sanitizeStringList(input.refinementInsights, { max: 4 }),
    refinementMismatch: sanitizeStringList(input.refinementMismatch, { max: 3 }),
    refinementNextStep: typeof input.refinementNextStep === "string" ? input.refinementNextStep : "",
    refinementBackupReason: typeof input.refinementBackupReason === "string" ? input.refinementBackupReason : "",
    nextActions: sanitizeStringList(input.nextActions, { max: 3 }),
    completedBlockers: sanitizeStringList(input.completedBlockers, { max: 8 }),
    outstandingBlockers: sanitizeStringList(input.outstandingBlockers, { max: 8 }),
    backupSlugs: sanitizeSlugList(input.backupSlugs, { max: 2, exclude: machineSlug }),
    sourceFrontRunnerSlug: VALID_SLUGS.has(input.sourceFrontRunnerSlug) ? input.sourceFrontRunnerSlug : "",
    sourceBackupSlugs: sanitizeSlugList(input.sourceBackupSlugs, { max: 2, exclude: machineSlug }),
    sourcePlanUpdatedAt: typeof input.sourcePlanUpdatedAt === "string" ? input.sourcePlanUpdatedAt : "",
    links: {
      machineDetail: typeof input.links?.machineDetail === "string" ? input.links.machineDetail : "",
      compare: typeof input.links?.compare === "string" ? input.links.compare : "",
      market: typeof input.links?.market === "string" ? input.links.market : ""
    }
  };
}

function isDecisionBriefCompatible(brief, decisionState) {
  if (!brief?.machineSlug || !VALID_SLUGS.has(brief.machineSlug)) return false;
  const canonicalBackups = (decisionState.backupSlugs || []).slice(0, 2);
  if (decisionState.frontRunnerSlug && brief.machineSlug !== decisionState.frontRunnerSlug) return false;
  if (brief.sourceFrontRunnerSlug && decisionState.frontRunnerSlug && brief.sourceFrontRunnerSlug !== decisionState.frontRunnerSlug) return false;
  if (brief.sourceBackupSlugs?.length && JSON.stringify(brief.sourceBackupSlugs) !== JSON.stringify(canonicalBackups)) return false;
  if (brief.sourcePlanUpdatedAt) {
    const planUpdatedAt = decisionState.perMachinePlanState?.[brief.machineSlug]?.updatedAt || "";
    if (!planUpdatedAt || planUpdatedAt !== brief.sourcePlanUpdatedAt) return false;
  }
  return true;
}

function readStoredDecisionState() {
  const parsed = safeJsonParse(localStorage.getItem(DECISION_STATE_KEY) || "null", null);
  if (!parsed || typeof parsed !== "object") return null;
  return sanitizeState(parsed);
}

function writeState(state) {
  localStorage.setItem(DECISION_STATE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("decision-state-updated", { detail: state }));
}

export function loadDecisionState() {
  const stored = readStoredDecisionState();
  if (stored) return stored;

  const migrated = migrateLegacyDecisionState(VALID_SLUGS);
  if (migrated) {
    const next = sanitizeState(migrated);
    writeState(next);
    return next;
  }

  return defaultDecisionState();
}

export function saveDecisionState(patch = {}) {
  const current = loadDecisionState();
  const next = sanitizeState({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    migrationCompleted: true
  });
  writeState(next);
  return next;
}

export function clearDecisionState() {
  localStorage.removeItem(DECISION_STATE_KEY);
  const reset = defaultDecisionState();
  window.dispatchEvent(new CustomEvent("decision-state-updated", { detail: reset }));
  return reset;
}

export function hasDecisionContext(state = loadDecisionState()) {
  return Boolean(state.frontRunnerSlug || state.backupSlugs.length || state.hasLegacyDiscovery);
}

export function sessionMode(state = loadDecisionState()) {
  return hasDecisionContext(state) ? "returning" : "first-time";
}

export function hasUsableDecisionBrief(state = loadDecisionState()) {
  return Boolean(state.decisionBrief?.machineSlug);
}
