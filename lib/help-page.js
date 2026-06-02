import {
  calibrationReactionOptions,
  concernOptions,
  discoveryContextQuestions,
  discoveryReactionOptions,
  discoveryTastePrompts,
  likedAspectOptions
} from "../data/discovery-flow.js";
import { discoveryMachineIndex, discoveryMachines } from "../data/discovery-machines.js";
import { machines } from "../data/machines.js";
import { buildReactionDeck, recommendationConfidence, recommendMachines } from "./discovery-engine.js";
import { REFINEMENT_NEGATIVE_PROMPTS, REFINEMENT_POSITIVE_PROMPTS, mergeTraitSignals, traitLabelMap } from "../data/refinement-model.js";
import { buildTraitSignalsFromRefinement } from "./refinement-helpers.js";
import { buildTasteInsightLines } from "./refinement-explanations.js";
import { buildEvidenceModel, labelTraitList } from "./refinement-evidence.js";
import { clearCompareContext, loadCompareContext } from "./compare-context.js";
import { buildMachineLocationIndex, findNearbyLocations } from "./location-discovery.js";
import { buildPinsideMarketUrl } from "./services/pinside-market.js";
import { buildNearbyCatalogSuggestions, buildNearbyExternalMachineSuggestions, buildTasteProbeSuggestions } from "./test-plan-engine.js";
import { attachCompareButtons, attachImageFallbacks, compareStore, formatCurrency, machineDisplayTitle, renderMachineImage, renderSplitCard, showSiteMessage, trackEvent, updateCompareCount } from "./utils.js";
import { attachOutboundTracking, buildAffiliateUrl } from "./outbound.js";
import { componentConnectionReason, componentsForMachine, proxyConnectionHint, COMPONENT_INDEX } from "../data/machine-components.js";
import { renderVideoAction, renderVideoModal } from "./video.js";
import { initNav } from "./nav.js";
import { clearDecisionState, hasUsableDecisionBrief, loadDecisionState, saveDecisionState } from "./decision-state.js";
import { BUY_PATH_OPTIONS, decisionPlanPatch, decisionPlanProgress, decisionPlanStepTitle, nextActionsForPath, readMachinePlanState, whoShouldSkip } from "./decision-plan.js";
import {
  CHECK_STATUS,
  blockerById,
  blockerProgress,
  blockerStatusLabel,
  blockerStatusTone,
  blockersForPath,
  normalizeCheckStatus,
  readinessFromBlockers,
  shouldApplyRemoteOverlay
} from "./required-checks.js";
import { buildReadinessModel } from "./readiness.js";
import { buildRiskBannerModel } from "./risk-banner.js";
import { buildDecisionContinuityModel, initDecisionBar } from "./decision-bar.js";
import {
  ANALYTICS_EVENTS,
  derivePathType,
  deriveSessionMode,
  startAnalyticsTimer,
  stopAnalyticsTimer,
  trackAnalytics,
  trackAnalyticsOnce
} from "./analytics-events.js";
import * as utils from "./utils.js";

const root = document.querySelector("#discovery-app");
const DISCOVERY_STATE_KEY = "pinballScoutDiscoveryStateV2";
const pageParams = new URLSearchParams(window.location.search);
initNav();
let lastTrackedScreen = "";
let lastTrackedResultsConfidence = "";
let lastViewportKey = "";
const STICKY_HEADER_OFFSET = 84;
const viewedHardBlockers = new Set();
const viewedReadinessMeters = new Set();
const viewedPlanStepKeys = new Set();
let decisionBarController = null;

const defaultContext = () => ({
  playedBefore: "",
  firstPin: "yes",
  budget: "",
  condition: "either",
  buyingStyle: "",
  playAccess: "some",
  zip: "",
  travelWillingness: "regional",
  timeline: "1to3months"
});

const defaultTasteAnswers = () => ({});

const defaultTasteScores = () => ({
  "learning-curve": 0,
  "pace-feel": 0,
  "theme-pull": 0,
  "challenge": 0,
  "replay": 0,
  "ownership": 0
});

const defaultDraft = () => ({
  enjoyment: "",
  fun: "",
  likedAspect: "",
  concern: "",
  friction: "",
  replay: "",
  notes: ""
});

const defaultExternalDraft = () => ({
  machineName: "",
  reaction: "",
  liked: [],
  disliked: [],
  notes: "",
  returnScreen: "nearby-test"
});

const defaultFinals = () => ({
  mostExciting: "",
  mostReplayable: "",
  bestMatch: ""
});

const state = {
  screen: "entry",
  mode: null,
  compareContext: null,
  hasSavedSession: false,
  savedSessionUpdatedAt: "",
  context: defaultContext(),
  tasteAnswers: defaultTasteAnswers(),
  selectedPlayedMachines: [],
  deck: [],
  deckIndex: 0,
  reactions: [],
  draft: defaultDraft(),
  videoFeedback: {},
  externalFeedback: [],
  externalDraft: defaultExternalDraft(),
  finals: defaultFinals(),
  refinementBaseline: null,
  lastRefinementSummary: null,
  nearbySuggestions: [],
  nearbyCatalogSuggestions: [],
  nearbyExternalSuggestions: [],
  activeNearestMachineId: "",
  locationSearch: {
    zip: "",
    maxMiles: "50",
    locations: [],
    hasSearched: false,
    error: "",
    machineLocationIndex: new Map()
  },
  activeProbeId: "",
  activeVideo: null,
  sourcingMachineId: "",
  moreActionsOpen: false,
  activeWhatCountsId: "",
  activeRiskDrawer: false,
  activePlanFocus: "",
  tastePivotIndex: 0,
  tasteScores: defaultTasteScores(),
  narrowCandidates: [],
  narrowRound: 0,
  narrowWinner: "",
  bracketSeeds: [],
  bracketRound: 0,
  bracketMatchIndex: 0,
  bracketFactor: 0,
  bracketLeftWins: 0,
  bracketRightWins: 0,
  bracketWinners: [[], [], []],
  bracketMatchWon: "",
  bracketMatchScore: "",
  bracketBudget: "",
  ownedMachines: [],
  revalSignal: "",
  preLogRecsSnapshot: []
};

const VALID_HELP_SCREENS = new Set([
  "entry",
  "discovery-setup",
  "calibration-setup",
  "budget-check",
  "taste-profile",
  "taste-pivot",
  "taste-reveal",
  "taste-played-machines",
  "narrow-to-one",
  "bracket",
  "bracket-nearby",
  "discovery-round",
  "calibration-round",
  "reflection",
  "results",
  "video-refinement",
  "nearby-test",
  "post-play-feedback",
  "external-feedback",
  "finals",
  "sourcing",
  "decision-brief"
]);

function serializableState() {
  return {
    updatedAt: state.savedSessionUpdatedAt || new Date().toISOString(),
    screen: state.screen,
    mode: state.mode,
    context: state.context,
    tasteAnswers: state.tasteAnswers,
    selectedPlayedMachines: state.selectedPlayedMachines,
    deck: state.deck.map((machine) => machine.id),
    deckIndex: state.deckIndex,
    reactions: state.reactions,
    draft: state.draft,
    videoFeedback: state.videoFeedback,
    externalFeedback: state.externalFeedback,
    externalDraft: state.externalDraft,
    finals: state.finals,
    refinementBaseline: state.refinementBaseline,
    lastRefinementSummary: state.lastRefinementSummary,
    locationSearch: {
      zip: state.locationSearch.zip,
      maxMiles: state.locationSearch.maxMiles,
      locations: state.locationSearch.locations,
      hasSearched: state.locationSearch.hasSearched,
      error: state.locationSearch.error
    },
    activeProbeId: state.activeProbeId,
    sourcingMachineId: state.sourcingMachineId,
    moreActionsOpen: state.moreActionsOpen,
    tastePivotIndex: state.tastePivotIndex,
    tasteScores: state.tasteScores,
    narrowCandidates: state.narrowCandidates,
    narrowRound: state.narrowRound,
    narrowWinner: state.narrowWinner,
    bracketSeeds: state.bracketSeeds,
    bracketRound: state.bracketRound,
    bracketMatchIndex: state.bracketMatchIndex,
    bracketFactor: state.bracketFactor,
    bracketLeftWins: state.bracketLeftWins,
    bracketRightWins: state.bracketRightWins,
    bracketWinners: state.bracketWinners,
    bracketMatchWon: state.bracketMatchWon,
    bracketMatchScore: state.bracketMatchScore,
    bracketBudget: state.bracketBudget,
    ownedMachines: state.ownedMachines,
    revalSignal: state.revalSignal,
    preLogRecsSnapshot: state.preLogRecsSnapshot
  };
}

function persistDiscoveryState() {
  try {
    const shouldPersist = state.screen !== "entry" || state.reactions.length > 0 || Object.values(state.tasteAnswers).some(Boolean);
    if (!shouldPersist) return;
    state.savedSessionUpdatedAt = new Date().toISOString();
    localStorage.setItem(DISCOVERY_STATE_KEY, JSON.stringify(serializableState()));
  } catch {}
}

function clearPersistedDiscoveryState() {
  try {
    localStorage.removeItem(DISCOVERY_STATE_KEY);
  } catch {}
}

function loadPersistedDiscoveryState() {
  try {
    const raw = localStorage.getItem(DISCOVERY_STATE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    return saved;
  } catch {
    return null;
  }
}

function hasUsableSavedSession(saved) {
  if (!saved || typeof saved !== "object") return false;
  const screen = typeof saved.screen === "string" ? saved.screen : "";
  if (screen && screen !== "entry") return true;
  if (Array.isArray(saved.reactions) && saved.reactions.length > 0) return true;
  if (Array.isArray(saved.selectedPlayedMachines) && saved.selectedPlayedMachines.length > 0) return true;
  if (typeof saved.sourcingMachineId === "string" && saved.sourcingMachineId) return true;
  if (typeof saved.mode === "string" && saved.mode) return true;
  if (saved.tasteAnswers && typeof saved.tasteAnswers === "object" && Object.values(saved.tasteAnswers).some(Boolean)) return true;
  return false;
}

function applySavedSession(saved) {
  if (!hasUsableSavedSession(saved)) return false;

  const savedScreen = typeof saved.screen === "string" ? saved.screen : "";
  state.screen = VALID_HELP_SCREENS.has(savedScreen) ? savedScreen : "entry";
  state.mode = saved.mode || null;
  state.context = { ...defaultContext(), ...(saved.context || {}) };
  state.tasteAnswers = { ...defaultTasteAnswers(), ...(saved.tasteAnswers || {}) };
  state.selectedPlayedMachines = Array.isArray(saved.selectedPlayedMachines) ? saved.selectedPlayedMachines : [];
  state.deck = Array.isArray(saved.deck) ? saved.deck.map((id) => discoveryMachineIndex.get(id)).filter(Boolean) : [];
  state.deckIndex = Number.isFinite(saved.deckIndex) ? saved.deckIndex : 0;
  state.reactions = Array.isArray(saved.reactions) ? saved.reactions : [];
  state.draft = { ...defaultDraft(), ...(saved.draft || {}) };
  state.videoFeedback = saved.videoFeedback && typeof saved.videoFeedback === "object" ? saved.videoFeedback : {};
  state.externalFeedback = Array.isArray(saved.externalFeedback) ? saved.externalFeedback : [];
  state.externalDraft = { ...defaultExternalDraft(), ...(saved.externalDraft || {}) };
  state.finals = { ...defaultFinals(), ...(saved.finals || {}) };
  state.refinementBaseline = saved.refinementBaseline || null;
  state.lastRefinementSummary = saved.lastRefinementSummary || null;
  state.locationSearch = {
    zip: saved.locationSearch?.zip || "",
    maxMiles: saved.locationSearch?.maxMiles || "50",
    locations: Array.isArray(saved.locationSearch?.locations) ? saved.locationSearch.locations : [],
    hasSearched: Boolean(saved.locationSearch?.hasSearched),
    error: saved.locationSearch?.error || "",
    machineLocationIndex: buildMachineLocationIndex(Array.isArray(saved.locationSearch?.locations) ? saved.locationSearch.locations : [])
  };
  state.activeProbeId = saved.activeProbeId || "";
  state.sourcingMachineId = saved.sourcingMachineId || "";
  state.moreActionsOpen = Boolean(saved.moreActionsOpen);
  state.tastePivotIndex = Number.isFinite(saved.tastePivotIndex) ? saved.tastePivotIndex : 0;
  state.tasteScores = (saved.tasteScores && typeof saved.tasteScores === "object")
    ? { ...defaultTasteScores(), ...saved.tasteScores }
    : defaultTasteScores();
  state.narrowCandidates = Array.isArray(saved.narrowCandidates) ? saved.narrowCandidates : [];
  state.narrowRound = Number.isFinite(saved.narrowRound) ? saved.narrowRound : 0;
  state.narrowWinner = typeof saved.narrowWinner === "string" ? saved.narrowWinner : "";
  state.bracketSeeds = Array.isArray(saved.bracketSeeds) ? saved.bracketSeeds : [];
  state.bracketRound = Number.isFinite(saved.bracketRound) ? saved.bracketRound : 0;
  state.bracketMatchIndex = Number.isFinite(saved.bracketMatchIndex) ? saved.bracketMatchIndex : 0;
  state.bracketFactor = Number.isFinite(saved.bracketFactor) ? saved.bracketFactor : 0;
  state.bracketLeftWins = Number.isFinite(saved.bracketLeftWins) ? saved.bracketLeftWins : 0;
  state.bracketRightWins = Number.isFinite(saved.bracketRightWins) ? saved.bracketRightWins : 0;
  state.bracketWinners = Array.isArray(saved.bracketWinners) ? saved.bracketWinners.map((r) => Array.isArray(r) ? r : []) : [[], [], []];
  state.bracketMatchWon = typeof saved.bracketMatchWon === "string" ? saved.bracketMatchWon : "";
  state.bracketMatchScore = typeof saved.bracketMatchScore === "string" ? saved.bracketMatchScore : "";
  state.bracketBudget = typeof saved.bracketBudget === "string" ? saved.bracketBudget : "";
  state.ownedMachines = Array.isArray(saved.ownedMachines) ? saved.ownedMachines : [];
  state.revalSignal = typeof saved.revalSignal === "string" ? saved.revalSignal : "";
  state.preLogRecsSnapshot = Array.isArray(saved.preLogRecsSnapshot) ? saved.preLogRecsSnapshot : [];
  state.activeRiskDrawer = false;
  state.activePlanFocus = "";
  state.activeWhatCountsId = "";
  state.hasSavedSession = true;
  state.savedSessionUpdatedAt = saved.updatedAt || "";
  return true;
}

function isSavedSessionFreshEnough(saved, decisionState) {
  if (!saved || typeof saved !== "object") return false;
  const savedAt = Date.parse(saved.updatedAt || "");
  if (!Number.isFinite(savedAt)) return true;
  const decisionAt = Date.parse(decisionState.updatedAt || "");
  if (!Number.isFinite(decisionAt)) return true;
  return savedAt >= decisionAt;
}

function discoveryMachineIdBySlug(slug = "") {
  const match = discoveryMachines.find((machine) => machine.slug === slug);
  return match?.id || "";
}

function resolveInitialHelpRoute({ decisionState, savedSession, params }) {
  const wantsBrief = params.get("brief") === "1";
  const wantsResume = params.get("resume") === "1";
  const hasBrief = hasUsableDecisionBrief(decisionState);
  const frontRunnerId = discoveryMachineIdBySlug(decisionState.frontRunnerSlug || "");

  if (wantsBrief && hasBrief) {
    state.screen = "decision-brief";
    return "brief";
  }

  if (!wantsResume) {
    return "default";
  }

  if (hasBrief) {
    state.screen = "decision-brief";
    return "brief";
  }

  if (decisionState.frontRunnerSlug && frontRunnerId) {
    state.sourcingMachineId = frontRunnerId;
    state.screen = "sourcing";
    initializePlanForMachine(frontRunnerId);
    return "sourcing";
  }

  if (savedSession && isSavedSessionFreshEnough(savedSession, decisionState) && applySavedSession(savedSession)) {
    return "saved-session";
  }

  if (savedSession && applySavedSession(savedSession)) {
    return "saved-session";
  }

  return "default";
}

function formatSavedSessionTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function pricingSummary(machine) {
  if (typeof utils.machinePricingSummary === "function") {
    return utils.machinePricingSummary(machine);
  }

  return {
    estimated: {
      label: "Estimated price",
      rangeText: `${formatCurrency(machine.estimated_price_min)}–${formatCurrency(machine.estimated_price_max)}`,
      detailText: "Seeded catalog estimate"
    },
    used: null
  };
}

function normalizeReaction(value) {
  return value === "liked-it" ? "looks-fun" : value;
}

function currentMachine() {
  return state.deck[state.deckIndex] || null;
}

function currentContext() {
  return {
    ...state.context,
    tasteAnswers: state.tasteAnswers
  };
}

function buildRefinementSignals() {
  const signals = [];

  Object.entries(state.videoFeedback || {}).forEach(([machineId, feedback]) => {
    if (!feedback || !feedback.reaction) return;
    const traitSignals = buildTraitSignalsFromRefinement({
      liked: feedback.liked || [],
      disliked: feedback.disliked || []
    });

    signals.push({
      machineId,
      reaction: normalizeReaction(feedback.reaction),
      traitSignals,
      experienceType: "video",
      weight: 1,
      notes: feedback.notes || ""
    });
  });

  (state.externalFeedback || []).forEach((entry) => {
    if (!entry || (!entry.reaction && !(entry.liked || []).length && !(entry.disliked || []).length)) return;
    const traitSignals = buildTraitSignalsFromRefinement({
      liked: entry.liked || [],
      disliked: entry.disliked || []
    });

    signals.push({
      machineId: "",
      reaction: normalizeReaction(entry.reaction || "not-sure"),
      traitSignals,
      experienceType: "external",
      weight: 1,
      notes: entry.notes || "",
      machineName: entry.machineName || ""
    });
  });

  return signals;
}

function topTraitSignals() {
  const labelMap = traitLabelMap();
  const totals = {};

  buildRefinementSignals().forEach((signal) => {
    const weight = signal.weight || 1;
    Object.entries(signal.traitSignals || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Number(value || 0) * weight;
    });
  });

  return Object.entries(totals)
    .filter(([, value]) => value > 0.4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => labelMap[key] || key);
}

function currentRecommendations() {
  return recommendMachines(currentContext(), state.reactions, 3, {
    machineLocationIndex: state.locationSearch.machineLocationIndex,
    refinementSignals: buildRefinementSignals(),
    playedMachineIds: state.selectedPlayedMachines
  });
}

function currentRecommendationState() {
  const recommendations = currentRecommendations();
  return {
    recommendations,
    confidence: recommendationConfidence(currentContext(), state.reactions, recommendations, {
      refinementSignals: buildRefinementSignals()
    })
  };
}

function captureRefinementBaseline(source = "") {
  const recommendations = currentRecommendations();
  state.refinementBaseline = {
    source,
    slugs: recommendations.map((machine) => machine.slug),
    capturedAt: new Date().toISOString()
  };
}

function buildShortlistChangeSummary(baseline, recommendations) {
  if (!baseline?.slugs?.length || !recommendations?.length) return null;
  const currentSlugs = recommendations.map((machine) => machine.slug);
  const baselineTop = baseline.slugs[0] || "";
  const currentTop = currentSlugs[0] || "";
  const added = currentSlugs.filter((slug) => !baseline.slugs.includes(slug));
  const removed = baseline.slugs.filter((slug) => !currentSlugs.includes(slug));

  const lines = [];
  let changed = false;
  if (baselineTop && currentTop && baselineTop !== currentTop) {
    const fromName = machineDisplayTitle(discoveryMachineIndex.get(baselineTop) || { name: baselineTop, title: baselineTop });
    const toName = machineDisplayTitle(discoveryMachineIndex.get(currentTop) || { name: currentTop, title: currentTop });
    lines.push(`Your top pick shifted from ${fromName} to ${toName}.`);
    changed = true;
  }
  if (added.length) {
    const names = added.map((slug) => machineDisplayTitle(discoveryMachineIndex.get(slug) || { name: slug, title: slug }));
    lines.push(`New in your top 3: ${names.join(", ")}.`);
    changed = true;
  }
  if (removed.length) {
    const names = removed.map((slug) => machineDisplayTitle(discoveryMachineIndex.get(slug) || { name: slug, title: slug }));
    lines.push(`Dropped out: ${names.join(", ")}.`);
    changed = true;
  }

  if (!lines.length) {
    lines.push("Your shortlist stayed stable; the latest feedback mostly confirmed the initial fit.");
  }

  return {
    source: baseline.source || "refinement",
    lines,
    changed,
    fromTop: baselineTop,
    toTop: currentTop
  };
}

function hasRefinementEvidence() {
  const hasVideo = Object.keys(state.videoFeedback || {}).length > 0;
  const hasExternal = (state.externalFeedback || []).length > 0;
  const hasRealPlay = (state.reactions || []).some((reaction) => String(reaction.source || "").startsWith("real-play"));
  return hasVideo || hasExternal || hasRealPlay;
}

function syncDecisionStateFromRecommendations(frontMachineId = "", source = "help_results") {
  const recommendations = currentRecommendations();
  if (!recommendations.length) return;

  const current = loadDecisionState();
  const preferred = recommendations.find((machine) => machine.id === frontMachineId);
  const frontRunnerSlug = (preferred || recommendations[0]).slug;
  const backupSlugs = recommendations
    .map((machine) => machine.slug)
    .filter((slug) => slug !== frontRunnerSlug)
    .slice(0, 2);
  const frontChanged = frontRunnerSlug && frontRunnerSlug !== current.frontRunnerSlug;

  saveDecisionState({
    frontRunnerSlug,
    frontRunnerLastChangedAt: frontChanged ? new Date().toISOString() : current.frontRunnerLastChangedAt || "",
    backupSlugs,
    temporaryPrimary: false,
    temporaryPrimaryReason: "",
    promotionReasons: [],
    hasLegacyDiscovery: true
  });

  if (frontChanged) {
    trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, {
      from_slug: current.frontRunnerSlug || "",
      to_slug: frontRunnerSlug,
      source
    });
  }
}

function defaultRadiusForTravel(value) {
  if (value === "local-only") return "50";
  if (value === "regional") return "150";
  if (value === "overnight") return "300";
  return "100";
}

function budgetLabel(value) {
  return discoveryContextQuestions.find((question) => question.id === "budget")?.choices.find((choice) => choice.value === value)?.label || value;
}

function choiceLabel(questionId, value) {
  return discoveryContextQuestions.find((question) => question.id === questionId)?.choices.find((choice) => choice.value === value)?.label || value;
}

function machineBySlug(slug = "") {
  return machines.find((machine) => machine.slug === slug) || null;
}

function probeById() {
  return [...state.nearbySuggestions, ...state.nearbyCatalogSuggestions].find((item) => item.machineId === state.activeProbeId) || null;
}

function sourcingMachine() {
  return discoveryMachineIndex.get(state.sourcingMachineId) || currentRecommendations()[0] || null;
}

function sourcingRecommendationProfile() {
  const active = sourcingMachine();
  if (!active) return null;
  return currentRecommendations().find((machine) => machine.id === active.id) || active;
}

function currentPlanState(machineId) {
  const machine = discoveryMachineIndex.get(machineId) || sourcingMachine();
  if (!machine) return null;
  const decisionState = loadDecisionState();
  return readMachinePlanState(decisionState, machine.slug, state.context.condition);
}

function updateCurrentPlanState(patch = {}) {
  const machine = sourcingMachine();
  if (!machine) return;
  const decisionState = loadDecisionState();
  const nextPatch = decisionPlanPatch(decisionState, machine.slug, patch, state.context.condition);
  saveDecisionState(nextPatch);
}

function initializePlanForMachine(machineId = "") {
  const machine = discoveryMachineIndex.get(machineId) || sourcingMachine();
  if (!machine) return;
  const decisionState = loadDecisionState();
  const seed = readMachinePlanState(decisionState, machine.slug, state.context.condition);
  const nextPatch = decisionPlanPatch(decisionState, machine.slug, {
    currentPlanStep: seed.currentPlanStep || 1,
    selectedPathType: seed.selectedPathType,
    workingPickConfirmed: seed.workingPickConfirmed
  }, state.context.condition);
  saveDecisionState(nextPatch);
}

function activeBlockersForCurrentPlan(machine, planState) {
  if (!machine || !planState) return [];
  const includeRemote = shouldApplyRemoteOverlay(state.context);
  return blockersForPath(planState.selectedPathType, includeRemote);
}

function setBlockerStatus(blockerId, nextStatus) {
  const machine = sourcingMachine();
  if (!machine || !blockerId) return;

  const plan = currentPlanState(machine.id);
  if (!plan) return;

  const blockers = activeBlockersForCurrentPlan(machine, plan);
  if (!blockers.find((blocker) => blocker.id === blockerId)) return;

  const status = normalizeCheckStatus(nextStatus);
  const currentStatus = normalizeCheckStatus(plan.requiredChecks?.[blockerId]);
  if (status === currentStatus) return;

  const before = blockerProgress(blockers, plan.requiredChecks || {});
  const requiredChecks = {
    ...(plan.requiredChecks || {}),
    [blockerId]: status
  };
  const after = blockerProgress(blockers, requiredChecks);

  updateCurrentPlanState({ requiredChecks });
  setPlanFocus(blockerId);

  const basePayload = {
    machine_slug: machine.slug,
    path_type: derivePathType(plan.selectedPathType),
    blocker_type: blockerId
  };
  const blockerTimerKey = `blocker:${machine.slug}:${plan.selectedPathType}:${blockerId}`;
  if (currentStatus !== CHECK_STATUS.COMPLETE && status === CHECK_STATUS.COMPLETE) {
    trackAnalytics(ANALYTICS_EVENTS.HARD_BLOCKER_RESOLVED, {
      ...basePayload,
      time_to_resolve_sec: Math.round(stopAnalyticsTimer(blockerTimerKey) / 1000)
    });
  }
  if (currentStatus === CHECK_STATUS.COMPLETE && status !== CHECK_STATUS.COMPLETE) {
    startAnalyticsTimer(blockerTimerKey);
    trackAnalytics(ANALYTICS_EVENTS.HARD_BLOCKER_REOPENED, {
      machine_slug: machine.slug,
      blocker_type: blockerId,
      reason: "status_changed_from_complete"
    });
  }
  if (before.blockedCount > 0 && after.blockedCount === 0 && after.total > 0) {
    const startedAt = Date.parse(plan.updatedAt || "");
    const elapsed = Number.isFinite(startedAt) ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
    trackAnalytics(ANALYTICS_EVENTS.FINAL_HARD_BLOCKER_COMPLETED, {
      machine_slug: machine.slug,
      path_type: derivePathType(plan.selectedPathType),
      time_from_plan_start_sec: elapsed
    });
  }
}

function setPlanFocus(focusId = "") {
  state.activePlanFocus = focusId;
  if (!focusId) return;
  window.setTimeout(() => {
    if (state.activePlanFocus !== focusId) return;
    state.activePlanFocus = "";
    if (state.screen === "sourcing") render();
  }, 1800);
}

function clearTransientUiState({ clearMoreActions = false, clearWhatCounts = true, clearRisk = true, clearPlanFocus = true } = {}) {
  if (clearMoreActions) state.moreActionsOpen = false;
  if (clearWhatCounts) state.activeWhatCountsId = "";
  if (clearRisk) state.activeRiskDrawer = false;
  if (clearPlanFocus) state.activePlanFocus = "";
}

function scrollAfterRender(selector) {
  if (!selector) return;
  window.setTimeout(() => {
    root.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 40);
}

function renderAndScrollTo(selector) {
  render();
  scrollAfterRender(selector);
}

function frontRunnerMachineId() {
  const frontRunnerSlug = loadDecisionState().frontRunnerSlug;
  if (!frontRunnerSlug) return "";
  return currentRecommendations().find((machine) => machine.slug === frontRunnerSlug)?.id || discoveryMachineIdBySlug(frontRunnerSlug);
}

function openSourcingForFrontRunner({ scrollSelector = "" } = {}) {
  const machineId = frontRunnerMachineId();
  if (machineId) {
    state.sourcingMachineId = machineId;
    initializePlanForMachine(machineId);
  }
  state.screen = "sourcing";
  if (scrollSelector) {
    renderAndScrollTo(scrollSelector);
    return;
  }
  render();
}

function buildDecisionBriefFromCurrentPlan() {
  const machine = sourcingMachine();
  if (!machine) return null;

  const recommendationState = currentRecommendationState();
  const recommendation = recommendationState.recommendations.find((item) => item.id === machine.id) || machine;
  const plan = currentPlanState(machine.id);
  if (!plan) return null;

  const includeRemoteOverlay = shouldApplyRemoteOverlay(state.context);
  const blockers = blockersForPath(plan.selectedPathType, includeRemoteOverlay);
  const requiredCheckProgress = blockerProgress(blockers, plan.requiredChecks || {});
  const readiness = readinessFromBlockers({
    pathType: plan.selectedPathType,
    blockers,
    requiredChecks: plan.requiredChecks || {},
    currentPlanStep: plan.currentPlanStep,
    workingPickConfirmed: plan.workingPickConfirmed
  });
  const whyItFits = (recommendation.explanation?.whyMatch || recommendation.whyItFits || [recommendation.starterRecommendationReason])
    .filter(Boolean)
    .slice(0, 3);
  const refinementInsights = buildTasteInsightLines(state.reactions, buildRefinementSignals()).slice(0, 3);
  const mismatchSignals = Array.isArray(recommendation.mismatchSignals) ? recommendation.mismatchSignals : [];
  const confidenceNextStep = recommendationState.confidence.nextSteps?.[0]?.detail || "";
  const backupCandidate = recommendationState.recommendations.find((item) => item.id !== recommendation.id) || null;
  const backupReason = backupCandidate
    ? `Backup: ${machineDisplayTitle(backupCandidate)} stays relevant because it aligns with ${traitAlignmentList(backupCandidate).slice(0, 2).join(" and ").toLowerCase() || "your general taste signals"}.`
    : "";
  const completedBlockers = blockers
    .filter((blocker) => requiredCheckProgress.statusById[blocker.id] === CHECK_STATUS.COMPLETE)
    .map((blocker) => blocker.title);
  const outstandingBlockers = blockers
    .filter((blocker) => requiredCheckProgress.statusById[blocker.id] !== CHECK_STATUS.COMPLETE)
    .map((blocker) => blocker.title);
  const now = new Date().toISOString();
  const decisionState = loadDecisionState();
  const previousBrief = decisionState.decisionBrief;
  const planUpdatedAt = decisionState.perMachinePlanState?.[recommendation.slug]?.updatedAt || "";

  return {
    machineSlug: recommendation.slug,
    createdAt: previousBrief?.machineSlug === recommendation.slug ? previousBrief.createdAt || now : now,
    updatedAt: now,
    pathType: plan.selectedPathType,
    confidenceLevel: recommendationState.confidence.level,
    confidenceTitle: recommendationState.confidence.title,
    readinessLabel: readiness.label,
    readinessReason: readiness.reason,
    whyItFits,
    refinementInsights,
    refinementMismatch: mismatchSignals.slice(0, 2),
    refinementNextStep: confidenceNextStep,
    refinementBackupReason: backupReason,
    backupSlugs: (decisionState.backupSlugs || []).filter((slug) => slug !== recommendation.slug).slice(0, 2),
    sourceFrontRunnerSlug: decisionState.frontRunnerSlug || recommendation.slug,
    sourceBackupSlugs: (decisionState.backupSlugs || []).filter((slug) => slug !== recommendation.slug).slice(0, 2),
    sourcePlanUpdatedAt: planUpdatedAt,
    completedBlockers,
    outstandingBlockers,
    nextActions: nextActionsForPath(plan.selectedPathType, machineDisplayTitle(recommendation)).slice(0, 3),
    links: {
      machineDetail: `machine.html?slug=${recommendation.slug}`,
      compare: "compare.html",
      market: recommendation.externalLinks?.pinsideMarket || buildPinsideMarketUrl(recommendation)
    }
  };
}

function nearestMachineForModal() {
  if (!state.activeNearestMachineId) return null;
  return currentRecommendations().find((machine) => machine.id === state.activeNearestMachineId) || null;
}

function renderProgress(title, description, progress, badgeText = "") {
  return `
    <div class="panel discovery-progress">
      <div class="progress-label-row">
        <div>
          <p class="eyebrow">Pinball Scout</p>
          <h2>${title}</h2>
          <p class="muted">${description}</p>
        </div>
        ${badgeText ? `<span class="badge">${badgeText}</span>` : ""}
      </div>
      <div class="progress-bar" aria-hidden="true"><span style="width: ${progress}%"></span></div>
    </div>
  `;
}

function renderChoiceGroup(question, selectedValue) {
  return `
    <article class="panel discovery-question">
      <p class="eyebrow">${question.eyebrow}</p>
      <h3>${question.title}</h3>
      <p class="muted">${question.description}</p>
      <div class="choice-grid">
        ${question.choices.map((choice) => `
          <button
            class="choice-card${selectedValue === choice.value ? " is-selected" : ""}"
            type="button"
            data-context-choice="${question.id}:${choice.value}"
          >
            <strong>${choice.label}</strong>
            <span>${choice.hint || ""}</span>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function renderSignalPicker(title, options, selectedValue, dataKey) {
  return `
    <div class="detail-list-block">
      <p><strong>${title}</strong></p>
      <div class="mini-chip-row">
        ${options.map((option) => `
          <button
            class="chip-button${selectedValue === option.value ? " is-selected" : ""}"
            type="button"
            data-draft-choice="${dataKey}:${option.value}"
          >
            ${option.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRefinementChips(title, prompts, selectedValues, dataKey, dataAttr, contextId) {
  return `
    <div class="detail-list-block">
      <p><strong>${title}</strong></p>
      <div class="mini-chip-row">
        ${prompts.map((prompt) => `
          <button
            class="chip-button${selectedValues.includes(prompt.id) ? " is-selected" : ""}"
            type="button"
            data-${dataAttr}="${contextId}:${dataKey}:${prompt.id}"
          >
            ${prompt.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function videoFeedbackFor(machineId) {
  return state.videoFeedback[machineId] || { reaction: "", liked: [], disliked: [], notes: "" };
}

function toggleSelection(list = [], value = "", max = 2) {
  const next = Array.isArray(list) ? [...list] : [];
  const index = next.indexOf(value);
  if (index >= 0) {
    next.splice(index, 1);
    return next;
  }
  if (next.length >= max) return next;
  next.push(value);
  return next;
}

function traitAlignmentList(machine) {
  const alignment = Array.isArray(machine?.traitAlignment) ? machine.traitAlignment : [];
  return alignment;
}

function renderEntryScreen() {
  const decisionBrief = loadDecisionState().decisionBrief;
  const briefMachine = decisionBrief?.machineSlug ? machineBySlug(decisionBrief.machineSlug) : null;
  const savedAtLabel = formatSavedSessionTimestamp(state.savedSessionUpdatedAt);
  const comparedMachines = state.compareContext?.machineTitles?.length
    ? state.compareContext.machineTitles
    : (state.compareContext?.selectedSlugs || [])
      .map((slug) => machines.find((machine) => machine.slug === slug))
      .filter(Boolean)
      .map((machine) => machineDisplayTitle(machine));
  const hasContinueOptions = state.hasSavedSession || decisionBrief?.machineSlug || comparedMachines?.length;
  const continuePrimaryAction = decisionBrief?.machineSlug
    ? `<button class="btn btn-primary" type="button" data-action="open-decision-brief">Open Decision Brief</button>`
    : state.hasSavedSession
      ? `<button class="btn btn-primary" type="button" data-action="resume-saved">Continue plan</button>`
      : comparedMachines?.length
        ? `<a class="btn btn-primary" href="compare.html">Continue compare</a>`
        : "";
  const continueCard = hasContinueOptions
    ? `
      <article class="panel">
        <p class="eyebrow">Continue where you left off</p>
        <h3>${briefMachine ? `${machineDisplayTitle(briefMachine)} plan is ready` : "Your progress is saved"}</h3>
        <p class="muted">
          ${decisionBrief?.machineSlug
            ? "Your Decision Brief is saved with a clear action plan."
            : state.hasSavedSession
              ? `Resume your guided shortlist flow.${savedAtLabel ? ` Last saved ${savedAtLabel}.` : ""}`
              : `You were comparing ${comparedMachines.join(" vs ")}. Continue with a focused tie-break decision.`}
        </p>
        <div class="card-actions">
          ${continuePrimaryAction}
          ${state.hasSavedSession ? `<button class="btn btn-secondary" type="button" data-action="discard-saved">Start fresh</button>` : ""}
          ${decisionBrief?.machineSlug ? `<button class="btn btn-secondary" type="button" data-action="open-shortlist">Open shortlist</button>` : ""}
          ${comparedMachines?.length ? `<a class="btn btn-secondary" href="compare.html">Open compare</a>` : ""}
        </div>
      </article>
    `
    : "";

  return `
    <section class="discovery-shell">
      <div class="panel entry-intro">
        <p class="eyebrow">First-pin discovery</p>
        <h2>Pick your starting path</h2>
        <p class="muted">Takes about 5 minutes. We'll narrow down machines that fit your budget, taste, and situation.</p>
      </div>
      ${continueCard}
      <div class="entry-path-grid">
        <button class="entry-path-card panel" type="button" data-entry="no">
          <div class="entry-path-header">
            <span class="entry-path-number">A</span>
            <h3>I'm new to pinball</h3>
          </div>
          <p class="muted">Guide me through budget, taste, and machine reactions — I'll build a shortlist from scratch.</p>
          <span class="entry-path-cta btn btn-primary">Start here →</span>
        </button>
        <button class="entry-path-card panel" type="button" data-entry="yes">
          <div class="entry-path-header">
            <span class="entry-path-number">B</span>
            <h3>I've played before</h3>
          </div>
          <p class="muted">Skip the basics — calibrate using machines you've already played to dial in your taste profile.</p>
          <span class="entry-path-cta btn btn-secondary">Calibrate instead →</span>
        </button>
      </div>
    </section>
  `;
}

function renderDiscoverySetup() {
  const complete = Boolean(state.context.budget && state.context.condition);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 1: Set your guardrails",
        "Two quick questions to keep machine suggestions realistic for your budget and situation.",
        20
      )}
      <div class="discovery-question-stack">
        ${renderChoiceGroup(discoveryContextQuestions.find((q) => q.id === "budget"), state.context.budget)}
        ${renderChoiceGroup(discoveryContextQuestions.find((q) => q.id === "condition"), state.context.condition)}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-discovery" ${complete ? "" : "disabled"}>See my first machines</button>
      </div>
    </section>
  `;
}

function renderBudgetCheck() {
  const budgetQ = discoveryContextQuestions.find((q) => q.id === "budget");
  return `
    <section class="discovery-shell">
      ${renderProgress(
        "What's your budget?",
        "One tap — we'll filter to what's actually within reach.",
        15
      )}
      <div class="choice-grid budget-grid">
        ${budgetQ.choices.map((c) => `
          <button class="choice-card${state.context.budget === c.value ? " is-selected" : ""}"
            type="button"
            data-context-choice="budget:${c.value}">
            <strong>${c.label}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPlayedSelector(machine) {
  const selected = state.selectedPlayedMachines.includes(machine.id);
  const displayTitle = machineDisplayTitle(machine);

  return `
    <button class="played-machine-card${selected ? " is-selected" : ""}" type="button" data-toggle-played="${machine.id}">
      ${renderMachineImage(machine, { className: "machine-image-frame--thumb played-machine-card__image" })}
      <strong>${displayTitle}</strong>
      <span>${machine.beginner_summary}</span>
    </button>
  `;
}

function renderCalibrationSetup() {
  const complete = Boolean(state.context.budget && state.context.condition && state.context.travelWillingness && state.context.timeline && state.selectedPlayedMachines.length);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 1: Practical guardrails + calibration",
        "Set budget and timeline, then calibrate from games you already know. You can add your ZIP later for nearby test planning.",
        20,
        `${state.selectedPlayedMachines.length} selected`
      )}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "budget"), state.context.budget)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "condition"), state.context.condition)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "travelWillingness"), state.context.travelWillingness)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "timeline"), state.context.timeline)}
      <article class="panel discovery-question">
        <p class="eyebrow">Played before</p>
        <h3>Which of these machines have you played?</h3>
        <p class="muted">You only need one, but more gives the system a better starting read.</p>
        <div class="played-grid">
          ${discoveryMachines.map((machine) => renderPlayedSelector(machine)).join("")}
        </div>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-calibration" ${complete ? "" : "disabled"}>Build my taste profile</button>
      </div>
    </section>
  `;
}

function renderTastePrompt(prompt, selectedValue) {
  return `
    <article class="panel discovery-question taste-card">
      <p class="eyebrow">${prompt.eyebrow}</p>
      <h3>${prompt.title}</h3>
      <div class="choice-grid taste-grid">
        ${prompt.options.map((option) => `
          <button
            class="choice-card${selectedValue === option.value ? " is-selected" : ""}"
            type="button"
            data-taste-choice="${prompt.id}:${option.value}"
          >
            <strong>${option.label}</strong>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function renderTasteSummary() {
  const isDiscovery = state.mode !== "calibration";
  const selections = discoveryTastePrompts
    .map((prompt) => {
      const selectedValue = state.tasteAnswers[prompt.id];
      const option = prompt.options.find((item) => item.value === selectedValue);
      return option ? option.label : "";
    })
    .filter(Boolean);

  return `
    <article class="panel taste-summary">
      <p class="eyebrow">Pinball taste profile</p>
      <h3>Your preferences</h3>
      <p class="muted">${isDiscovery ? "These picks refine your shortlist based on the machines you just reacted to." : "These quick choices shape the first round of machine previews."}</p>
      <div class="taste-chip-row">
        ${selections.length ? selections.map((label) => `<span class="badge">${label}</span>`).join("") : `<span class="muted">Make a few picks to sharpen the shortlist.</span>`}
      </div>
    </article>
  `;
}

const TASTE_SCALES = [
  { id: "learning-curve", left: "Easy to pick up", right: "Deep & rewarding" },
  { id: "pace-feel", left: "Fast & flowing", right: "Deliberate & precise" },
  { id: "theme-pull", left: "Gameplay-first", right: "Theme-first" },
  { id: "challenge", left: "Forgiving", right: "Demanding" },
  { id: "replay", left: "Quick sessions", right: "Long goals" },
  { id: "ownership", left: "Safe first buy", right: "Bold pick" }
];

const PLAYER_ARCHETYPES = [
  {
    id: "easy-rider",
    name: "The Easy Rider",
    summary: "You want to sit down and have fun right away. Games that click within the first few balls are your sweet spot — no homework required.",
    lookFor: "Approachable machines with clear goals, satisfying shots, and rules that feel good before you've read anything.",
    tags: ["Quick to enjoy", "Flow-focused", "Accessible"],
    vector: { "learning-curve": -3, "challenge": -2, "pace-feel": -1, "replay": -2 },
    componentFit: {
      good: ["simple_ruleset", "wide_open_layout", "flowing_ramps", "focused_multiball", "jackpot_structure", "orbit_shots"],
      bad: ["stacking_modes", "wizard_mode", "frequent_multiball", "captive_ball", "upper_playfield"]
    }
  },
  {
    id: "theme-collector",
    name: "The Theme Collector",
    summary: "The world and characters matter as much as the shots. You want to own something you love, not just something that plays well.",
    lookFor: "Strong licensed themes with recognizable characters — machines that feel like bringing the film or show home.",
    tags: ["Theme-first", "Collector instinct", "Broad appeal"],
    vector: { "theme-pull": 3, "ownership": -1 },
    componentFit: {
      good: ["interactive_toy", "story_modes", "physical_lock", "magnet_effects"],
      bad: ["simple_ruleset", "jackpot_structure"]
    }
  },
  {
    id: "serious-player",
    name: "The Serious Player",
    summary: "Deep rules, high skill ceiling, and months of mastery ahead. You're drawn to machines that reward hundreds of games, not dozens.",
    lookFor: "Complex rule sets, multi-ball stacking, and machines with a skill gap you can close over time.",
    tags: ["Skill-driven", "Deep rules", "Long-term replay"],
    vector: { "learning-curve": 3, "challenge": 2, "replay": 2, "pace-feel": 1 },
    componentFit: {
      good: ["stacking_modes", "wizard_mode", "story_modes", "captive_ball", "drop_targets", "physical_lock", "upper_playfield", "frequent_multiball"],
      bad: ["simple_ruleset", "wide_open_layout"]
    }
  },
  {
    id: "flow-chaser",
    name: "The Flow Chaser",
    summary: "Fast shots, smooth flow, and that satisfying feeling when everything clicks. You care about how it feels more than what it unlocks.",
    lookFor: "Wide-open layouts, fast ramps, and machines that reward a natural flowing shooting style.",
    tags: ["Fast & flowing", "Shot-focused", "Immediate fun"],
    vector: { "pace-feel": -3, "replay": -1, "theme-pull": -1 },
    componentFit: {
      good: ["flowing_ramps", "orbit_shots", "loop_combos", "spinner_shot", "focused_multiball"],
      bad: ["stacking_modes", "upper_playfield", "captive_ball", "frequent_multiball"]
    }
  },
  {
    id: "safe-starter",
    name: "The Safe Starter",
    summary: "Low regret, broad appeal, and easy to share. You want a machine that works for everyone in the house and holds its value long-term.",
    lookFor: "Strong resale, easy rules, and crowd-pleasing machines that guests can enjoy on game one.",
    tags: ["Low-regret", "Family-friendly", "Resale-safe"],
    vector: { "ownership": -3, "challenge": -2, "learning-curve": -1 },
    componentFit: {
      good: ["simple_ruleset", "wide_open_layout", "focused_multiball", "jackpot_structure", "interactive_toy"],
      bad: ["stacking_modes", "wizard_mode", "frequent_multiball", "captive_ball"]
    }
  },
  {
    id: "deep-explorer",
    name: "The Deep Explorer",
    summary: "Strategic depth and big objectives. You like setting up shots deliberately and chasing missions that build across weeks of play.",
    lookFor: "Multi-layered rules, wizard modes to chase, and machines that keep revealing new goals the deeper you dig.",
    tags: ["Strategic", "Goal-driven", "Patient"],
    vector: { "learning-curve": 2, "replay": 3, "pace-feel": 1, "challenge": 1 },
    componentFit: {
      good: ["stacking_modes", "wizard_mode", "story_modes", "physical_lock", "drop_targets", "captive_ball", "upper_playfield"],
      bad: ["simple_ruleset", "jackpot_structure", "wide_open_layout"]
    }
  }
];

const TASTE_PIVOT_PAIRS = [
  {
    question: "When you sit down at a machine you've never played, what matters most?",
    left: {
      machineId: "deadpool-pro",
      details: [
        "Cracking up on your first ball — humor and clear targets click immediately",
        "Short, energetic games that make you want to hit start again right away"
      ],
      scores: { "learning-curve": -3, "pace-feel": -1, "replay": -2 }
    },
    right: {
      machineId: "jurassic-park-pro",
      details: [
        "Big story moments that unlock over time — always chasing the next dinosaur sequence",
        "The more games you play, the more the machine opens up and reveals"
      ],
      scores: { "learning-curve": 3, "challenge": 1, "replay": 2 }
    }
  },
  {
    question: "When you describe your machine to someone, what do you lead with?",
    left: {
      machineId: "iron-maiden-pro",
      details: [
        "Tight, fast layout built around nailing a set of precise, satisfying shots",
        "Pure shooting feel — you get better at it, not just more familiar with it"
      ],
      scores: { "theme-pull": -3, "challenge": 2, "pace-feel": -1 }
    },
    right: {
      machineId: "stranger-things-pro",
      details: [
        "You're literally inside the show — Demogorgons, the Mind Flayer, and Eleven",
        "Any guest can walk up and immediately feel what they're supposed to do"
      ],
      scores: { "theme-pull": 3, "ownership": -1 }
    }
  },
  {
    question: "After a great game, which feeling are you chasing next time?",
    left: {
      machineId: "attack-from-mars-remake",
      details: [
        "Every game is satisfying on its own — great time in 5 minutes, no buildup needed",
        "Works for the whole family and any guest, first visit or fiftieth"
      ],
      scores: { "challenge": -2, "replay": -3, "ownership": -2 }
    },
    right: {
      machineId: "godzilla-pro",
      details: [
        "Deep modes and big multiball sequences that reward you for learning the rules",
        "Still discovering new strategies and goals months after you bring it home"
      ],
      scores: { "learning-curve": 1, "replay": 3, "ownership": 2 }
    }
  },
  {
    question: "When you think about owning a machine for years, what keeps you coming back?",
    left: {
      machineId: "foo-fighters-pro",
      details: [
        "The personality and energy make every game feel good, even when you drain fast",
        "Easy to share with anyone — guests pick it up and enjoy it immediately"
      ],
      scores: { "learning-curve": -2, "pace-feel": -1, "ownership": -2, "theme-pull": 1 }
    },
    right: {
      machineId: "avengers-infinity-quest-pro",
      details: [
        "Dense rules and a high ceiling — still uncovering new strategies a year in",
        "The kind of machine you want to get better at, not just get familiar with"
      ],
      scores: { "learning-curve": 3, "challenge": 3, "replay": 2 }
    }
  },
  {
    question: "A friend who's never played pinball walks up — which reaction do you want?",
    left: {
      machineId: "mandalorian-pro",
      details: [
        "They recognize Mando immediately — the theme does all the selling before they even pull back the plunger",
        "Modern shot coaching and approachable rules mean they're scoring and smiling in 60 seconds"
      ],
      scores: { "theme-pull": 3, "learning-curve": -1, "ownership": -1 }
    },
    right: {
      machineId: "fish-tales",
      details: [
        "Pure instinct — hit the fish, everything makes sense from the first second",
        "Simple targets, fast games, and a big ramp make it addictive for anyone regardless of age or experience"
      ],
      scores: { "learning-curve": -3, "challenge": -2, "replay": -1 }
    }
  },
  {
    question: "Which machine would you still be happy to own in five years?",
    left: {
      machineId: "funhouse",
      details: [
        "Rudy watches your every move and reacts — the character IS the experience, not just the backdrop",
        "Playful and weird; every session feels fun even when your game completely falls apart"
      ],
      scores: { "theme-pull": 2, "ownership": -2, "challenge": -2 }
    },
    right: {
      machineId: "medieval-madness-remake",
      details: [
        "Smashing the castle and saucer never gets old — the shots themselves are the reward",
        "Enough strategy to stay interesting across hundreds of games without ever feeling overwhelming"
      ],
      scores: { "replay": 2, "ownership": 1, "challenge": 1 }
    }
  }
];

const BRACKET_FACTORS = [
  {
    id: "feel",
    question: "Which sounds more satisfying to play right now?",
    eyebrow: "Game feel",
    getBlurb: (m) => m.why_like_it || m.description || "",
    getDetail: () => null
  },
  {
    id: "vibe",
    question: "Which personality would you love living in your house?",
    eyebrow: "Theme & personality",
    getBlurb: (m) => m.description || "",
    getDetail: (m) => m.theme || null
  },
  {
    id: "legacy",
    question: "Which would you still be obsessed with in a year?",
    eyebrow: "Long-term ownership",
    getBlurb: (m) => m.best_for || m.description || "",
    getDetail: (m) => m.considerations ? `Worth knowing: ${m.considerations}` : null
  }
];

function bracketCurrentPair() {
  const { bracketRound: round, bracketMatchIndex: mi, bracketSeeds: seeds, bracketWinners: winners } = state;
  if (round === 0) return [seeds[mi * 2], seeds[mi * 2 + 1]];
  const prev = winners[round - 1] || [];
  return [prev[mi * 2], prev[mi * 2 + 1]];
}

function bracketMatchCount(round) {
  return Math.max(1, Math.floor(state.bracketSeeds.length / Math.pow(2, round + 1)));
}

function bracketRoundLabel(round) {
  const maxRounds = state.bracketWinners.length;
  if (maxRounds >= 3) return (["Quarter-final", "Semi-final", "Final"])[round] ?? "Final";
  if (maxRounds === 2) return (["Semi-final", "Final"])[round] ?? "Final";
  return "Final";
}

function renderBracketStatus() {
  const { bracketSeeds: seeds, bracketRound, bracketMatchIndex, bracketWinners, bracketMatchWon } = state;
  const roundCount = bracketWinners.length;
  const abbrevs = roundCount >= 3 ? ["QF", "SF", "F"] : roundCount === 2 ? ["SF", "F"] : ["F"];

  return `
    <div class="bracket-status">
      ${abbrevs.map((abbrev, rIdx) => {
        const count = bracketMatchCount(rIdx);
        const roundWinners = bracketWinners[rIdx] || [];
        const rows = Array.from({ length: count }, (_, i) => {
          let leftId, rightId;
          if (rIdx === 0) { leftId = seeds[i * 2]; rightId = seeds[i * 2 + 1]; }
          else { const prev = bracketWinners[rIdx - 1] || []; leftId = prev[i * 2]; rightId = prev[i * 2 + 1]; }
          const winnerId = roundWinners[i];
          const isCurrent = rIdx === bracketRound && i === bracketMatchIndex && !bracketMatchWon;
          const leftName = leftId ? (discoveryMachineIndex.get(leftId)?.name ?? "?") : "TBD";
          const rightName = rightId ? (discoveryMachineIndex.get(rightId)?.name ?? "?") : "TBD";
          const winnerName = winnerId ? (discoveryMachineIndex.get(winnerId)?.name ?? "?") : "";
          return `<div class="bracket-match-row${isCurrent ? " is-current" : ""}${winnerId ? " is-done" : ""}">
            ${winnerId
              ? `<span class="bm-winner">✓ ${winnerName}</span>`
              : `<span class="bm-pair">${leftName} <span class="bm-vs">vs</span> ${rightName}</span>`
            }
          </div>`;
        });
        return `<div class="bracket-round-group">
          <span class="bracket-group-label">${abbrev}</span>
          <div class="bracket-group-matches">${rows.join("")}</div>
        </div>`;
      }).join("")}
    </div>
  `;
}

function renderBracketPips(wins) {
  return Array.from({ length: 3 }, (_, i) => `<span class="bracket-pip${i < wins ? " is-filled" : ""}"></span>`).join("");
}

function renderBracket() {
  const { bracketRound: round, bracketMatchIndex: mi, bracketFactor, bracketLeftWins, bracketRightWins, bracketMatchWon, bracketMatchScore, bracketWinners } = state;
  const archetype = buildPlayerArchetype(state.tasteScores);
  const matchCount = bracketMatchCount(round);
  const roundLabel = bracketRoundLabel(round);
  const isFinal = round === bracketWinners.length - 1;

  if (bracketMatchWon) {
    const winner = discoveryMachineIndex.get(bracketMatchWon);
    const isChampion = isFinal && (bracketWinners[round]?.length ?? 0) === matchCount;
    return `
      <section class="discovery-shell">
        <div class="bracket-winner-screen panel${isChampion ? " is-champion" : ""}">
          ${renderMachineImage(winner, { eager: true, className: "machine-image-frame--thumb bracket-winner-img" })}
          <div class="bracket-winner-label">
            <p class="eyebrow">${isChampion ? "Your #1 machine" : "Advances!"}</p>
            <h2 class="bracket-winner-name">${isChampion ? "🏆 " : ""}${machineDisplayTitle(winner)}</h2>
            ${isChampion
              ? `<p>${buildMachineArchetypeReason(winner, archetype, state.tasteScores)}</p>`
              : `<p class="muted">Won ${bracketMatchScore}</p>`
            }
          </div>
        </div>
        ${renderBracketStatus()}
        <div class="discovery-actions">
          ${isChampion
            ? `<button class="btn btn-primary" type="button" data-action="bracket-next-match">See what's near you →</button>`
            : `<button class="btn btn-primary" type="button" data-action="bracket-next-match">Next match →</button>`
          }
          <button class="btn btn-secondary small" type="button" data-action="back-to-profile">Back to profile</button>
        </div>
      </section>
    `;
  }

  const [leftId, rightId] = bracketCurrentPair();
  const leftMachine = leftId ? discoveryMachineIndex.get(leftId) : null;
  const rightMachine = rightId ? discoveryMachineIndex.get(rightId) : null;
  if (!leftMachine || !rightMachine) return "";

  const factor = BRACKET_FACTORS[bracketFactor] ?? BRACKET_FACTORS[0];

  const renderCard = (machine, wins) => `
    <article class="taste-pivot-card panel bracket-factor-card">
      ${renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb" })}
      <div class="taste-pivot-body">
        <h3>${machineDisplayTitle(machine)}</h3>
        ${factor.getDetail(machine) ? `<p class="eyebrow bracket-card-eyebrow">${factor.getDetail(machine)}</p>` : ""}
        <p class="bracket-blurb">${factor.getBlurb(machine)}</p>
      </div>
      <div class="bracket-card-pips">${renderBracketPips(wins)}</div>
      <button class="btn btn-primary" type="button" data-action="bracket-pick:${machine.id}">Pick this</button>
    </article>
  `;

  return `
    <section class="discovery-shell">
      <div class="bracket-header panel">
        <div class="bracket-header-row">
          <span class="bracket-round-chip">${roundLabel} · Match ${mi + 1} of ${matchCount}</span>
          <span class="bracket-factor-chip">${factor.eyebrow} · Factor ${bracketFactor + 1} / 3</span>
        </div>
        <p class="bracket-question">${factor.question}</p>
        ${bracketFactor > 0 ? `<p class="bracket-lead-note muted">${
          bracketLeftWins > bracketRightWins
            ? `${machineDisplayTitle(leftMachine)} leads — pick to win or close the gap`
            : bracketRightWins > bracketLeftWins
            ? `${machineDisplayTitle(rightMachine)} leads — pick to win or close the gap`
            : "Tied — this pick decides who takes the lead"
        }</p>` : ""}
      </div>
      <div class="taste-pivot-grid">
        ${renderCard(leftMachine, bracketLeftWins)}
        <div class="taste-pivot-or"><span>vs</span></div>
        ${renderCard(rightMachine, bracketRightWins)}
      </div>
      <details class="bracket-status-details">
        <summary>Full bracket</summary>
        ${renderBracketStatus()}
      </details>
    </section>
  `;
}

function renderBracketNearby() {
  const finalThree = getBracketFinalThree();
  const champion = finalThree[0] ? discoveryMachineIndex.get(finalThree[0]) : null;
  const runnerUp = finalThree[1] ? discoveryMachineIndex.get(finalThree[1]) : null;
  const third = finalThree[2] ? discoveryMachineIndex.get(finalThree[2]) : null;
  const archetype = buildPlayerArchetype(state.tasteScores);
  const formatPrice = (m) => m?.estimated_price_min && m?.estimated_price_max
    ? `$${m.estimated_price_min.toLocaleString()} – $${m.estimated_price_max.toLocaleString()}`
    : "";

  const MEDALS = { 1: { emoji: "🥇", label: "Gold", cls: "gold" }, 2: { emoji: "🥈", label: "Silver", cls: "silver" }, 3: { emoji: "🥉", label: "Bronze", cls: "bronze" } };

  const renderPodiumCard = (machine, rank) => {
    if (!machine) return "";
    const medal = MEDALS[rank];
    const isPlayed = state.selectedPlayedMachines.includes(machine.id);
    const isOwned = state.ownedMachines.includes(machine.id);
    return `
      <article class="panel bracket-podium-card bracket-podium-card--${medal.cls}">
        <div class="bracket-podium-medal">${medal.emoji} <span>${medal.label}</span></div>
        ${renderMachineImage(machine, { eager: rank === 1, className: "machine-image-frame--thumb" })}
        <div class="bracket-podium-body">
          <h3>${machineDisplayTitle(machine)}</h3>
          <p class="bracket-podium-reason">${buildMachineArchetypeReason(machine, archetype, state.tasteScores)}</p>
          ${formatPrice(machine) ? `<p class="bracket-podium-price">${formatPrice(machine)}</p>` : ""}
          ${isPlayed || isOwned ? `<div class="badge-row" style="margin-top:.35rem">
            ${isPlayed ? `<span class="played-badge">Played</span>` : ""}
            ${isOwned ? `<span class="owned-badge">Owned</span>` : ""}
          </div>` : ""}
        </div>
      </article>`;
  };

  const championName = champion ? machineDisplayTitle(champion) : "your top pick";

  return `
    <section class="discovery-shell">
      <div class="bracket-podium-header">
        <p class="eyebrow">Bracket complete</p>
        <h2>Your #1 pick is ${championName}</h2>
        <p class="muted">Based on your taste profile, here's how the machines ranked.</p>
      </div>
      <div class="bracket-podium">
        ${renderPodiumCard(champion, 1)}
        ${runnerUp || third ? `
          <div class="bracket-podium-row">
            ${renderPodiumCard(runnerUp, 2)}
            ${renderPodiumCard(third, 3)}
          </div>` : ""}
      </div>
      <article class="panel results-next-step">
        <p class="eyebrow">Before you buy</p>
        <h3>Try ${championName} before you commit</h3>
        <p class="muted">Playing it — or something with a similar feel — in person is the fastest way to confirm you've got the right machine. We'll use Pinball Map to find locations near you.</p>
        <div class="card-actions">
          <button class="btn btn-primary" type="button" data-action="open-nearby">Find machines to test nearby</button>
          <button class="btn btn-secondary" type="button" data-action="bracket-nearby-buy">Skip — start buying plan</button>
        </div>
      </article>
      <button class="btn btn-secondary small" type="button" data-action="back-to-profile">Back to taste profile</button>
    </section>`;
}

function buildPlayerArchetype(scores) {
  let best = PLAYER_ARCHETYPES[0];
  let bestDot = -Infinity;
  for (const archetype of PLAYER_ARCHETYPES) {
    let dot = 0;
    for (const [dim, weight] of Object.entries(archetype.vector)) {
      dot += (scores[dim] || 0) * weight;
    }
    if (dot > bestDot) {
      bestDot = dot;
      best = archetype;
    }
  }
  return best;
}

function budgetContextNote(machine) {
  const bandId = state.bracketBudget;
  if (!bandId || bandId === "flexible" || !machine) return "";
  const min = machine.estimated_price_min || 0;
  const max = machine.estimated_price_max || 0;
  if (!min || !max) return "";
  const bandRanges = { "under5k": [0, 5000], "5k-8k": [5000, 8000], "8k-12k": [8000, 12000], "over12k": [12000, Infinity] };
  const [bMin, bMax] = bandRanges[bandId] || [0, Infinity];
  const bandLabel = BUDGET_BANDS.find((b) => b.id === bandId)?.label || bandId;
  if (min >= bMin && max <= bMax) {
    return `<p class="budget-context-note budget-context-note--match">✓ Fits your ${bandLabel} budget range</p>`;
  }
  if (min > bMax) {
    return `<p class="budget-context-note budget-context-note--over">Above your ${bandLabel} range — search used market for better pricing</p>`;
  }
  return `<p class="budget-context-note budget-context-note--under">Lower-end examples available near or below your ${bandLabel} range</p>`;
}

function getBracketFinalThree() {
  const w = state.bracketWinners;
  const champion = w[2]?.[0] || w[1]?.[0] || "";
  const sfWinners = w[1] || [];
  const runnerUp = sfWinners.find((id) => id !== champion) || "";
  const sfWinnerSet = new Set(sfWinners);
  const sfLosers = (w[0] || []).filter((id) => !sfWinnerSet.has(id));
  const third = sfLosers[0] || "";
  return [champion, runnerUp, third].filter(Boolean);
}

function getNearbyTasteMatches(excludeIds = []) {
  const locationIndex = state.locationSearch.machineLocationIndex;
  if (!locationIndex || locationIndex.size === 0) return [];
  const excludeSet = new Set(excludeIds);
  const nearbyIds = new Set(locationIndex.keys());
  const recs = recommendMachines(currentContext(), state.reactions, 30, {
    machineLocationIndex: locationIndex
  });
  return recs.filter((m) => nearbyIds.has(m.id) && !excludeSet.has(m.id)).slice(0, 5);
}

const BUDGET_BANDS = [
  { id: "under5k", label: "Under $5k", desc: "Budget classic market" },
  { id: "5k-8k", label: "$5k–$8k", desc: "Mid-range, most Stern Pros" },
  { id: "8k-12k", label: "$8k–$12k", desc: "Premium modern & remakes" },
  { id: "over12k", label: "$12k+", desc: "High-end and Jersey Jack" },
  { id: "flexible", label: "I'm flexible", desc: "Show me the best fit" }
];

function deriveTasteAnswers(scores) {
  return {
    "learning-curve": (scores["learning-curve"] || 0) < 0 ? "quick-start" : "deep-discovery",
    "pace-feel": (scores["pace-feel"] || 0) < 0 ? "fast-smooth" : "controlled",
    "theme-pull": (scores["theme-pull"] || 0) > 0 ? "theme-first" : "gameplay-first",
    "challenge-level": (scores["challenge"] || 0) < 0 ? "forgiving" : "demanding",
    "replay-itch": (scores["replay"] || 0) < 0 ? "instant-replay" : "longer-progress",
    "ownership-style": (scores["ownership"] || 0) < 0 ? "safe" : "specific"
  };
}

function renderTasteScale(scale, score, compact = false) {
  const isSet = score !== 0;
  const clampedPct = Math.max(6, Math.min(94, Math.round(((score + 6) / 12) * 100)));
  const leftActive = score < -0.5;
  const rightActive = score > 0.5;

  if (compact) {
    return `
      <div class="taste-scale taste-scale--compact">
        <span class="taste-scale-label taste-scale-label--left${leftActive ? " is-active" : ""}">${scale.left}</span>
        <div class="taste-scale-track">
          <div class="taste-scale-needle${isSet ? "" : " is-neutral"}" style="left: ${clampedPct}%"></div>
        </div>
        <span class="taste-scale-label taste-scale-label--right${rightActive ? " is-active" : ""}">${scale.right}</span>
      </div>
    `;
  }

  return `
    <div class="taste-scale">
      <div class="taste-scale-labels">
        <span class="${leftActive ? "scale-label-active" : ""}">${scale.left}</span>
        <span class="${rightActive ? "scale-label-active" : ""}">${scale.right}</span>
      </div>
      <div class="taste-scale-track">
        <div class="taste-scale-needle${isSet ? "" : " is-neutral"}" style="left: ${clampedPct}%"></div>
      </div>
    </div>
  `;
}

function renderTastePivot() {
  const pairIndex = state.tastePivotIndex || 0;
  const pair = TASTE_PIVOT_PAIRS[pairIndex];
  if (!pair) return "";

  const leftMachine = discoveryMachineIndex.get(pair.left.machineId);
  const rightMachine = discoveryMachineIndex.get(pair.right.machineId);
  if (!leftMachine || !rightMachine) return "";

  const progress = Math.round(((pairIndex + 1) / (TASTE_PIVOT_PAIRS.length + 1)) * 100);
  const hasAnyScore = Object.values(state.tasteScores).some((s) => s !== 0);

  const leftPlayed = state.selectedPlayedMachines.includes(leftMachine.id);
  const rightPlayed = state.selectedPlayedMachines.includes(rightMachine.id);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Build your taste profile",
        pair.question,
        progress,
        `${pairIndex + 1} of ${TASTE_PIVOT_PAIRS.length}`
      )}
      <div class="taste-pivot-grid">
        <article class="taste-pivot-card panel" data-action="taste-pivot-details:${pairIndex}:left">
          ${leftPlayed ? `<span class="played-badge">You've played this</span>` : ""}
          ${renderMachineImage(leftMachine, { eager: true, className: "machine-image-frame--thumb" })}
          <div class="taste-pivot-body">
            <h3>${machineDisplayTitle(leftMachine)}</h3>
            <p class="taste-pivot-hint">Tap to see why</p>
          </div>
        </article>
        <div class="taste-pivot-or"><span>or</span></div>
        <article class="taste-pivot-card panel" data-action="taste-pivot-details:${pairIndex}:right">
          ${rightPlayed ? `<span class="played-badge">You've played this</span>` : ""}
          ${renderMachineImage(rightMachine, { eager: true, className: "machine-image-frame--thumb" })}
          <div class="taste-pivot-body">
            <h3>${machineDisplayTitle(rightMachine)}</h3>
            <p class="taste-pivot-hint">Tap to see why</p>
          </div>
        </article>
      </div>
      ${hasAnyScore ? `
        <article class="panel taste-scales-preview">
          <p class="eyebrow">Your taste profile — forming</p>
          <div class="taste-scales taste-scales--compact">
            ${TASTE_SCALES.map((scale) => renderTasteScale(scale, state.tasteScores[scale.id] || 0, true)).join("")}
          </div>
        </article>
      ` : ""}
    </section>
  `;
}

function buildShareText(archetype) {
  const topTags = archetype.tags.slice(0, 3).join(" · ");
  return `My Pinball Scout profile: ${archetype.name}\n→ ${topTags}\n\nFind yours at pinballscout.com`;
}

async function shareProfile(archetype) {
  const text = buildShareText(archetype);
  if (navigator.share) {
    try {
      await navigator.share({ title: `Pinball Scout — ${archetype.name}`, text });
      return;
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(text);
    showSiteMessage("Profile copied to clipboard.");
  } catch {
    showSiteMessage("Could not copy — try selecting and copying manually.", "warning");
  }
}

function buildMachineArchetypeReason(machine, archetype, scores) {
  const archetypeOpeners = {
    "easy-rider": "For someone who values fun without friction",
    "flow-chaser": "For your flow-seeking style",
    "theme-collector": "Given your theme-first instincts",
    "serious-player": "For a player focused on mastery",
    "safe-starter": "For a low-regret first buy",
    "deep-explorer": "Given your appetite for depth"
  };

  const sortedDims = Object.entries(scores)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const [topDim, topVal] = sortedDims[0] || [];

  const dimNotes = {
    "learning-curve": topVal < 0 ? "it clicks without a rulebook" : "it rewards deep learning",
    "pace-feel": topVal < 0 ? "the pace keeps you in constant motion" : "the deliberate feel suits your style",
    "theme-pull": topVal < 0 ? "the gameplay stands completely on its own" : "the theme integration is exceptional",
    "challenge": topVal < 0 ? "it's rewarding without being punishing" : "it demands and develops real skill",
    "replay": topVal < 0 ? "every game is satisfying on its own" : "the depth keeps you discovering for months",
    "ownership": topVal < 0 ? "it's easy to share and maintain" : "it grows with you as an owner"
  };

  const opener = archetypeOpeners[archetype.id] || "A strong match";
  const machineWhy = machine.why_like_it || machine.description || "";
  const tasteNote = dimNotes[topDim];
  return `${opener} — ${machineWhy}${tasteNote ? `, and ${tasteNote}` : ""}.`;
}

function renderPlayedCatalogGroup(eraLabel, machines) {
  return `
    <div class="played-era-group">
      <h4 class="played-era-label">${eraLabel}</h4>
      <div class="played-machine-grid">
        ${machines.map((machine) => {
          const isPlayed = state.selectedPlayedMachines.includes(machine.id);
          const isOwned = state.ownedMachines.includes(machine.id);
          return `
            <button
              class="played-machine-btn${isPlayed || isOwned ? " is-selected" : ""}"
              type="button"
              data-toggle-played="${machine.id}"
            >
              ${renderMachineImage(machine, { eager: false, className: "machine-image-frame--micro" })}
              <span class="played-machine-name">${machineDisplayTitle(machine)}</span>
              ${isOwned ? `<span class="owned-badge-sm">Owned</span>` : isPlayed ? `<span class="played-badge-sm">Played</span>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTastePlayedMachines() {
  const eras = ["2020s", "2010s", "2000s", "1990s"];
  const byEra = new Map(eras.map((e) => [e, []]));
  discoveryMachines.forEach((m) => {
    const era = m.era_category || m.era || "Other";
    if (!byEra.has(era)) byEra.set(era, []);
    byEra.get(era).push(m);
  });

  const totalSelected = state.selectedPlayedMachines.length + state.ownedMachines.length;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Games you've played or own",
        "Log any machines from our catalog. We'll use these to sharpen your taste comparisons.",
        90
      )}
      ${totalSelected > 0 ? `<p class="played-tally">${totalSelected} machine${totalSelected === 1 ? "" : "s"} logged</p>` : ""}
      ${[...byEra.entries()]
        .filter(([, ms]) => ms.length > 0)
        .map(([era, ms]) => renderPlayedCatalogGroup(era, ms))
        .join("")}
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="taste-played-done">Done</button>
      </div>
    </section>
  `;
}

function renderNarrowToOne() {
  const archetype = buildPlayerArchetype(state.tasteScores);
  const candidates = state.narrowCandidates || [];
  const round = state.narrowRound || 0;
  const totalRounds = candidates.length >= 3 ? 2 : 1;
  const isLastRound = round >= totalRounds - 1;

  const leftId = round === 0 ? candidates[0] : state.narrowWinner;
  const rightId = round === 0 ? candidates[1] : candidates[2];
  const leftMachine = discoveryMachineIndex.get(leftId);
  const rightMachine = discoveryMachineIndex.get(rightId);
  if (!leftMachine || !rightMachine) return "";

  const pickLabel = isLastRound ? "This is my machine" : "This one";
  const subtitle = round === 0
    ? "Two machines that match your profile — which feels more like you?"
    : "Final pick — does your first choice hold up?";

  const formatPrice = (m) =>
    (m.estimated_price_min && m.estimated_price_max)
      ? `$${m.estimated_price_min.toLocaleString()} – $${m.estimated_price_max.toLocaleString()}`
      : "";

  const renderNarrowCard = (machine, side) => `
    <article class="taste-pivot-card panel narrow-card">
      ${renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb" })}
      <div class="taste-pivot-body">
        <h3>${machineDisplayTitle(machine)}</h3>
        <p class="narrow-reason">${buildMachineArchetypeReason(machine, archetype, state.tasteScores)}</p>
        ${formatPrice(machine) ? `<p class="narrow-price muted">${formatPrice(machine)}</p>` : ""}
      </div>
      <button class="btn btn-primary" type="button" data-action="narrow-pick:${machine.id}">${pickLabel}</button>
    </article>
  `;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Pick your machine",
        subtitle,
        98,
        `Round ${round + 1} of ${totalRounds}`
      )}
      <div class="taste-pivot-grid">
        ${renderNarrowCard(leftMachine, "left")}
        <div class="taste-pivot-or"><span>or</span></div>
        ${renderNarrowCard(rightMachine, "right")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-secondary small" type="button" data-action="back-to-profile">Back to my profile</button>
      </div>
    </section>
  `;
}

function renderTasteProfileReveal() {
  const archetype = buildPlayerArchetype(state.tasteScores);
  const recs = recommendMachines(currentContext(), [], 3, {
    machineLocationIndex: state.locationSearch.machineLocationIndex
  });

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Your player profile",
        "Here's how you play — and the machines that match.",
        96,
        archetype.name
      )}
      ${state.revalSignal === "major" ? `
        <div class="panel reval-signal reval-signal--major">
          <p class="eyebrow">Your top pick shifted</p>
          <h3>Machines you logged updated your #1 recommendation</h3>
          <p class="muted">Playing those machines gave your profile new signal. Re-run the bracket to find your new champion.</p>
          <div class="card-actions">
            <button class="btn btn-primary small" type="button" data-action="start-bracket">Re-run the bracket</button>
            <button class="btn btn-secondary small" type="button" data-action="reval-dismiss">Dismiss</button>
          </div>
        </div>
      ` : state.revalSignal === "minor" ? `
        <div class="panel reval-signal reval-signal--minor">
          <p class="eyebrow">Profile updated</p>
          <h3>Your top pick held — but a few more comparisons will sharpen it</h3>
          <p class="muted">Your rankings shifted slightly. A few more this-vs-that rounds will tighten your profile.</p>
          <div class="card-actions">
            <button class="btn btn-primary small" type="button" data-action="taste-continue">Dial in more</button>
            <button class="btn btn-secondary small" type="button" data-action="reval-dismiss">Skip</button>
          </div>
        </div>
      ` : ""}
      <article class="panel archetype-reveal-card">
        <p class="eyebrow">Player type</p>
        <h2 class="archetype-name">${archetype.name}</h2>
        <p>${archetype.summary}</p>
        <p class="muted"><strong>What to look for:</strong> ${archetype.lookFor}</p>
        <div class="badge-row">
          ${archetype.tags.map((t) => `<span class="badge">${t}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary small" type="button" data-action="share-profile">Share my profile</button>
        </div>
      </article>
      <article class="panel">
        <p class="eyebrow">Taste profile</p>
        <h3>Where you lean</h3>
        <div class="taste-scales">
          ${TASTE_SCALES.map((scale) => renderTasteScale(scale, state.tasteScores[scale.id] || 0, false)).join("")}
        </div>
      </article>
      ${recs.length > 0 ? `
        <article class="panel">
          <p class="eyebrow">Top seeds</p>
          <h3>Your top 3 — enter the bracket to find #1</h3>
          <div class="profile-recs">
            ${recs.map((machine) => `
              <div class="profile-rec-card">
                ${renderMachineImage(machine, { className: "machine-image-frame--thumb" })}
                <div class="profile-rec-body">
                  <strong>${machineDisplayTitle(machine)}</strong>
                  <p>${buildMachineArchetypeReason(machine, archetype, state.tasteScores)}</p>
                </div>
              </div>
            `).join("")}
          </div>
        </article>
      ` : ""}
      <article class="panel profile-actions-panel">
        <p class="eyebrow">Your profile</p>
        <h3>What would you like to do?</h3>
        <div class="profile-action-list">
          <button class="profile-action-btn" type="button" data-action="taste-continue">
            <span class="profile-action-icon">🎯</span>
            <div>
              <strong>Dial in your taste more</strong>
              <p>Run another round of comparisons to sharpen your profile</p>
            </div>
          </button>
          <button class="profile-action-btn" type="button" data-action="taste-track-played">
            <span class="profile-action-icon">🕹️</span>
            <div>
              <strong>Track games I've played</strong>
              <p>Mark machines you've played — they'll be prioritized in future comparisons</p>
            </div>
          </button>
          <button class="profile-action-btn" type="button" data-action="taste-rebuild">
            <span class="profile-action-icon">🔄</span>
            <div>
              <strong>Rebuild my taste profile</strong>
              <p>Start the comparisons over from scratch</p>
            </div>
          </button>
        </div>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-bracket">Enter the Bracket 🏆</button>
        <button class="btn btn-secondary small" type="button" data-action="show-recommendations">Browse all recommendations</button>
      </div>
    </section>
  `;
}

function renderTasteProfile() {
  const complete = discoveryTastePrompts.every((prompt) => Boolean(state.tasteAnswers[prompt.id]));
  const isDiscovery = state.mode !== "calibration";
  const stageLabel = isDiscovery ? "Stage 4: Sharpen your shortlist" : "Stage 2: Preference prompts";
  const description = isDiscovery
    ? "A few quick picks to sharpen your shortlist."
    : "These are simple, beginner-friendly tradeoffs. There are no wrong answers.";
  const progress = isDiscovery ? 72 : 28;

  return `
    <section class="discovery-shell">
      ${renderProgress(stageLabel, description, progress)}
      <div class="discovery-question-stack">
        ${discoveryTastePrompts.map((prompt) => renderTastePrompt(prompt, state.tasteAnswers[prompt.id])).join("")}
      </div>
      <div class="discovery-actions">
        ${isDiscovery ? "" : `<button class="btn btn-secondary" type="button" data-action="back-to-setup">Back</button>`}
        <button class="btn btn-primary" type="button" data-action="${isDiscovery ? "submit-taste" : "begin-reactions"}" ${complete ? "" : "disabled"}>${isDiscovery ? "Show my recommendations" : "Continue to machine previews"}</button>
      </div>
    </section>
  `;
}

function buildPreferenceReflection() {
  const notes = [];
  const likesTheme = state.tasteAnswers["theme-pull"] === "theme-first" || state.reactions.some((reaction) => reaction.likedAspect === "theme");
  const prefersApproachable = state.tasteAnswers["learning-curve"] === "quick-start" || state.tasteAnswers["challenge-level"] === "forgiving";
  const prefersDepth = state.tasteAnswers["learning-curve"] === "deep-discovery" || state.tasteAnswers["replay-itch"] === "longer-progress";
  const wantsLowerRegret = state.context.buyingStyle === "safe" || state.tasteAnswers["ownership-style"] === "safe";
  const hasLimitedAccess = state.context.playAccess === "very-little";

  if (prefersApproachable) notes.push("You seem to prefer approachable games that still reward repeat play.");
  if (prefersDepth) notes.push("You seem open to deeper games you can grow into over time.");
  if (likesTheme) notes.push("Theme connection appears to matter in your final decision.");
  if (wantsLowerRegret || hasLimitedAccess) notes.push("Lower-regret choices and resale safety should be weighted more heavily for you.");
  if (!notes.length) notes.push("You look like a balanced buyer, so the shortlist will blend safety with taste fit.");

  return notes.slice(0, 4);
}

function renderPreferenceReflection() {
  const notes = buildPreferenceReflection();

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Preference reflection before results",
        "Here is the reasoning lens we will use before showing recommendations.",
        68,
        "Trust check"
      )}
      <article class="panel">
        <p class="eyebrow">What we learned so far</p>
        <h3>Your buyer profile in plain English</h3>
        <ul class="result-list">
          ${notes.map((note) => `<li>${note}</li>`).join("")}
        </ul>
        <p class="muted">Next, results will be framed by buying decision type, not just a generic top-3 list.</p>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="back-to-reactions">Back</button>
        <button class="btn btn-primary" type="button" data-action="show-recommendations">Show my recommendations</button>
      </div>
    </section>
  `;
}

function renderReactionCard(machine, options, modeLabel) {
  const displayTitle = machineDisplayTitle(machine);

  return `
    ${renderSplitCard({
      className: "discovery-machine-card",
      mediaClassName: "discovery-machine-card__media",
      bodyClassName: "discovery-machine-copy",
      imageHtml: renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb split-card__image discovery-machine-image" }),
      bodyHtml: `
        <div class="badge-row">
          <span class="badge">${machine.budget_band}</span>
          <span class="badge">${machine.theme}</span>
        </div>
        <h2>${displayTitle}</h2>
        <p class="hero-copy">${machine.beginner_summary}</p>
        <div class="card-actions">
          ${renderVideoAction({ url: machine.overview_video_url, label: machine.overview_video_label || "Watch overview", title: `${machine.name} overview` })}
          <a class="btn btn-secondary small" href="machine.html?slug=${machine.slug}">Tell me more</a>
        </div>
      `
    })}
    <div class="reaction-actions">
      <span class="muted reaction-prompt">${modeLabel}</span>
      ${options.map((option) => `
        <button class="btn ${option.value === options[0].value ? "btn-primary" : "btn-secondary"} reaction-btn" type="button" data-reaction="${option.value}">
          ${option.label}
        </button>
      `).join("")}
    </div>
    <details class="reaction-signals">
      <summary>Refine this reaction <span class="muted">(optional)</span></summary>
      ${renderSignalPicker("What stands out most in a good way?", likedAspectOptions, state.draft.likedAspect, "likedAspect")}
      ${renderSignalPicker("Any immediate concern?", concernOptions, state.draft.concern, "concern")}
    </details>
  `;
}

function renderDiscoveryRound() {
  const machine = currentMachine();
  if (!machine) return "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 3: Guided machine reactions",
        "Review one machine, then react. Keep moving with your first impression.",
        30 + Math.round(((state.deckIndex + 1) / state.deck.length) * 30),
        `Machine ${state.deckIndex + 1} of ${state.deck.length}`
      )}
      ${renderReactionCard(machine, discoveryReactionOptions, "Does this look fun?")}
    </section>
  `;
}

function renderCalibrationRound() {
  const machine = currentMachine();
  if (!machine) return "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 3: Calibration reactions",
        "Use your memory of this machine and give a quick reaction.",
        35 + Math.round(((state.deckIndex + 1) / state.deck.length) * 25),
        `Machine ${state.deckIndex + 1} of ${state.deck.length}`
      )}
      ${renderReactionCard(machine, calibrationReactionOptions, "How did this one land for you?")}
    </section>
  `;
}

const proxyTraitPrompts = [
  { key: "pace", high: "Do you enjoy how fast and exciting it feels?", low: "Does the pace feel too slow or too frantic?" },
  { key: "shot_satisfaction", high: "Do the shots feel satisfying when you hit them?", low: "Do the shots feel awkward or unrewarding?" },
  { key: "rules_depth", high: "Does it feel like there is enough to discover over time?", low: "Does it feel too simple or too hard to follow?" },
  { key: "beginner_friendly", high: "Can you understand what to do without getting overwhelmed?", low: "Does it feel confusing too quickly?" },
  { key: "theme_integration", high: "Does the theme pull you in while you play?", low: "Does the theme feel flat or distracting?" },
  { key: "chaos_level", high: "Do you enjoy the bigger chaotic moments?", low: "Do the bigger moments feel messy or stressful?" },
  { key: "replayability", high: "Does it make you want to hit Start again?", low: "Does it feel repetitive after a game or two?" }
];

function rankedProxyTraitChecks(machine, limit = 4) {
  const profile = machine?.trait_profile || {};
  const ranked = proxyTraitPrompts
    .map((item) => ({ ...item, score: Number(profile[item.key] || 3) }))
    .sort((a, b) => b.score - a.score);

  return [...ranked.slice(0, 3).map((item) => ({ ...item, prompt: item.high, positive: true })), ...ranked.slice(-1).map((item) => ({ ...item, prompt: item.low, positive: false }))]
    .slice(0, limit);
}

function proxyChecklistItems(suggestion) {
  const checks = rankedProxyTraitChecks(suggestion.machine, suggestion.probeType === "proxy" ? 4 : 3);
  return checks.map((item) => item.prompt);
}

const BRACKET_RANK_LABELS = [
  { medal: "🥇", rank: "Gold · Your #1 pick", priority: "Highest priority — try to play this one first." },
  { medal: "🥈", rank: "Silver · Runner-up", priority: "Try this if your #1 isn't available nearby." },
  { medal: "🥉", rank: "Bronze · Third place", priority: "Good fallback if the top two aren't close." }
];

function renderBracketTestGroup(targetMachine, rankIndex, allSuggestions) {
  const meta = BRACKET_RANK_LABELS[rankIndex] || BRACKET_RANK_LABELS[2];
  const allProbes = allSuggestions.filter((s) => s.targetIds.includes(targetMachine.id));
  const hasExactNearby = allProbes.some((s) => s.probeType === "exact");
  const probes = hasExactNearby ? allProbes.filter((s) => s.probeType === "exact") : allProbes;
  const focusChecks = rankedProxyTraitChecks(targetMachine, 3).map((item) => item.prompt);

  const renderProbeRow = (suggestion) => {
    const nearest = suggestion.locationMatches[0];
    const distLabel = nearest ? `${nearest.distanceMiles} mi · ${nearest.name}` : "No location found";
    const typeLabel = suggestion.probeType === "exact" ? "Exact match" : "Proxy";
    const alreadyPlayed = (state.reactions || []).some(
      (r) => r.machineId === suggestion.machineId && String(r.source || "").startsWith("real-play")
    );

    let proxyHintHtml = "";
    if (suggestion.probeType === "proxy") {
      const componentHints = proxyConnectionHint(targetMachine.slug, suggestion.machine.slug);
      const hintText = componentHints
        ? componentHints.join(" · ")
        : (focusChecks[0] || "Notice how the game feel compares to what you want to own.");
      proxyHintHtml = `<p class="bracket-probe-hint">When playing this, notice: ${hintText}</p>`;
    }

    return `
      <div class="bracket-probe-row${alreadyPlayed ? " is-played" : ""}">
        ${renderMachineImage(suggestion.machine, { className: "machine-image-frame--thumb bracket-probe-thumb" })}
        <div class="bracket-probe-body">
          <div class="bracket-probe-header">
            <strong>${machineDisplayTitle(suggestion.machine)}</strong>
            <span class="badge">${typeLabel}</span>
          </div>
          <p class="muted">${distLabel}</p>
          ${proxyHintHtml}
        </div>
        <div class="bracket-probe-action">
          ${alreadyPlayed
            ? `<span class="played-badge">Played ✓</span>`
            : `<button class="btn btn-primary small" type="button" data-action="log-play:${suggestion.machineId}">I played this</button>`
          }
        </div>
      </div>
    `;
  };

  return `
    <div class="bracket-test-group panel">
      <div class="bracket-test-group__header">
        <span class="bracket-test-group__medal">${meta.medal}</span>
        <div>
          <p class="eyebrow">${meta.rank}</p>
          <h3>${machineDisplayTitle(targetMachine)}</h3>
          ${focusChecks.length ? `
            <p class="muted"><strong>What to focus on when testing:</strong> ${focusChecks.join(" · ")}</p>
          ` : ""}
        </div>
      </div>
      ${probes.length ? `
        <div class="bracket-probe-list">
          ${probes.map((s) => renderProbeRow(s)).join("")}
        </div>
      ` : `
        <p class="bracket-probe-empty muted">${state.locationSearch.hasSearched
          ? "No nearby matches found for this machine within your radius. Try a larger search distance, or log a game you've already played."
          : "Search your ZIP above to find places nearby where you can play this."
        }</p>
      `}
    </div>
  `;
}

function postPlayQuestionsFor(probe) {
  if (!probe) return [];
  const baseQuestions = [
    {
      id: "enjoyment",
      title: "How did that one land for you?",
      choices: [
        { value: "liked-it", label: "Loved it" },
        { value: "not-sure", label: "Mixed / not sure" },
        { value: "not-for-me", label: "Not for me" }
      ]
    }
  ];

  if (probe.probeType === "proxy") {
    return [
      ...baseQuestions,
      ...rankedProxyTraitChecks(probe.machine, 4).map((item) => ({
        id: `trait_${item.key}`,
        title: item.prompt,
        traitKey: item.key,
        positive: item.positive,
        choices: [
          { value: "yes", label: "Yes" },
          { value: "mixed", label: "A bit" },
          { value: "no", label: "No" }
        ]
      }))
    ];
  }

  return [
    ...baseQuestions,
    {
      id: "fun",
      title: "What felt most fun?",
      choices: likedAspectOptions
    },
    {
      id: "friction",
      title: "What felt most frustrating?",
      choices: [
        { value: "too-hard", label: "Too hard" },
        { value: "too-easy", label: "Too easy" },
        { value: "too-chaotic", label: "Too chaotic" },
        { value: "too-slow", label: "Too slow" },
        { value: "theme-miss", label: "Theme did not hook me" },
        { value: "none", label: "Nothing major" }
      ]
    },
    {
      id: "replay",
      title: "Did it make you want another game immediately?",
      choices: [
        { value: "yes", label: "Yes" },
        { value: "maybe", label: "Maybe" },
        { value: "no", label: "No" }
      ]
    }
  ];
}

function isPostPlayComplete(probe) {
  const questions = postPlayQuestionsFor(probe);
  return questions.every((question) => Boolean(state.draft[question.id]));
}

function traitSignalsFromProxyAnswers(probe) {
  const questions = postPlayQuestionsFor(probe).filter((question) => question.traitKey);
  const signalList = questions.map((question) => {
    const answer = state.draft[question.id];
    if (!answer) return {};
    const magnitude = answer === "yes" ? 1.15 : answer === "mixed" ? 0.4 : -0.8;
    return { [question.traitKey]: magnitude * (question.positive ? 1 : -1) };
  });
  return mergeTraitSignals(signalList);
}

function renderProbeCard(suggestion) {
  const targetNames = suggestion.targetIds.map((id) => discoveryMachineIndex.get(id)?.name).filter(Boolean).join(", ");
  const nearbyLocations = suggestion.locationMatches || [];
  const displayTitle = machineDisplayTitle(suggestion.machine);
  const helpsValidate = targetNames
    ? `<p class="muted"><strong>Helps validate:</strong> ${targetNames}</p>`
    : `<p class="muted"><strong>Why it is here:</strong> It is one of the closest catalog machines you can realistically go play.</p>`;
  const rankLabel = suggestion.probeType === "exact"
    ? "Exact"
    : suggestion.probeType === "proxy"
      ? "Proxy"
      : "Nearby";
  const checklistItems = proxyChecklistItems(suggestion);

  return renderSplitCard({
    className: "recommendation-card",
    mediaClassName: "recommendation-card__media",
    bodyClassName: "recommendation-card__body",
    overlayHtml: `<div class="recommendation-rank">${rankLabel}</div>`,
    imageHtml: renderMachineImage(suggestion.machine, { className: "machine-image-frame--thumb split-card__image recommendation-card__image", eager: true }),
    bodyHtml: `
      <div class="badge-row">
        <span class="badge">${suggestion.machine.new_or_used_availability}</span>
        <span class="badge">${suggestion.machine.budget_band}</span>
        ${suggestion.machine.versions?.length > 1 ? `<span class="badge">${suggestion.machine.versions.length} versions</span>` : ""}
      </div>
      <h3>${displayTitle}</h3>
      <p class="muted">${suggestion.reason}</p>
      <p class="fit-summary">${suggestion.reveals}</p>
      ${helpsValidate}
      ${checklistItems.length ? `
        <div class="detail-list-block">
          <p><strong>When you play this, look for:</strong></p>
          <ul class="result-list">
            ${checklistItems.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      <div class="detail-list-block">
        <p><strong>Nearby places to try it</strong></p>
        ${nearbyLocations.length
          ? `<ul class="result-list">${nearbyLocations.slice(0, 3).map((location) => `<li>${location.name} · ${location.city}, ${location.state} · about ${location.distanceMiles} miles</li>`).join("")}</ul>`
          : `<p class="muted">No live Pinball Map location in your current drive radius appears to have this machine.</p>`
        }
      </div>
      <div class="card-actions">
        <a class="btn btn-secondary small" href="${suggestion.machine.gameplay_video_url}" target="_blank" rel="noreferrer">Preview before you go</a>
        <button class="btn btn-primary small" type="button" data-action="log-play:${suggestion.machineId}">I played this</button>
      </div>
    `
  });
}

function renderExternalMachineCard(item) {
  const locations = item.locations || [];

  return renderSplitCard({
    className: "recommendation-card",
    mediaClassName: "recommendation-card__media",
    bodyClassName: "recommendation-card__body",
    overlayHtml: `<div class="recommendation-rank">Pinball Map</div>`,
    imageHtml: `
      <div class="machine-image-frame machine-image-frame--thumb split-card__image recommendation-card__image">
        <div class="card-image image-fallback">
          <span>${item.machineName}</span>
        </div>
      </div>
    `,
    bodyHtml: `
      <div class="badge-row">
        <span class="badge">Outside catalog</span>
        <span class="badge">${locations[0]?.distanceMiles ?? "?"} mi closest</span>
      </div>
      <h3>${item.machineName}</h3>
      <p class="muted">This machine showed up in nearby Pinball Map results, but Pinball Scout does not have a full internal profile for it yet.</p>
      <div class="detail-list-block">
        <p><strong>Nearby places to try it</strong></p>
        <ul class="result-list">
          ${locations.slice(0, 3).map((location) => `<li>${location.name} · ${location.city}, ${location.state} · about ${location.distanceMiles} miles</li>`).join("")}
        </ul>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary small" type="button" data-action="open-external-feedback:${item.machineName}">Log feedback</button>
      </div>
    `
  });
}

function uniqueRecommendationBy(recommendations, pick) {
  const candidate = pick(recommendations);
  if (!candidate) return null;
  return candidate;
}

function framedRecommendations(recommendations, confidenceLevel = "high") {
  if (!recommendations.length) return [];

  if (confidenceLevel === "low") {
    return recommendations.slice(0, 2).map((machine) => ({
      frame: "Candidate to validate",
      summary: "A plausible fit based on early inputs, but not yet a final-ranked decision.",
      machine
    }));
  }

  if (confidenceLevel === "medium") {
    const likely = recommendations[0];
    const safer = uniqueRecommendationBy(
      recommendations.filter((machine) => machine.id !== likely.id),
      (list) => [...list].sort((left, right) => ((right.resaleStrength + right.beginnerFriendly) - (left.resaleStrength + left.beginnerFriendly)))[0]
    );
    const taste = uniqueRecommendationBy(
      recommendations.filter((machine) => machine.id !== likely.id && machine.id !== safer?.id),
      (list) => [...list].sort((left, right) => ((right.themeStrength + right.gameplayDepth) - (left.themeStrength + left.gameplayDepth)))[0]
    );

    return [
      { frame: "Likely fit", summary: "Currently the strongest match, but still close to alternatives.", machine: likely },
      { frame: "Safer alternative", summary: "Lower-regret option if resale and ownership simplicity matter more.", machine: safer || recommendations[1] || likely },
      { frame: "Taste-driven alternative", summary: "Worth considering if theme pull and personality drive your choice.", machine: taste || recommendations[2] || likely }
    ].filter((item, index, array) => item.machine && array.findIndex((check) => check.machine.id === item.machine.id) === index);
  }

  const overall = recommendations[0];
  const safest = uniqueRecommendationBy(
    recommendations.filter((machine) => machine.id !== overall.id),
    (list) => [...list].sort((left, right) => ((right.resaleStrength + right.beginnerFriendly) - (left.resaleStrength + left.beginnerFriendly)))[0]
  );
  const theme = uniqueRecommendationBy(
    recommendations.filter((machine) => machine.id !== overall.id && machine.id !== safest?.id),
    (list) => [...list].sort((left, right) => ((right.themeStrength + right.gameplayDepth) - (left.themeStrength + left.gameplayDepth)))[0]
  );

  return [
    { frame: "Best overall fit", summary: "Most balanced match across confidence, replayability, and practical ownership.", machine: overall },
    { frame: "Safest first buy", summary: "Best choice if regret reduction, resale strength, and easier ownership matter most.", machine: safest || recommendations[1] || overall },
    { frame: "Best if theme matters most", summary: "Strong pick when emotional theme pull is a key part of long-term ownership.", machine: theme || recommendations[2] || overall }
  ].filter((item, index, array) => item.machine && array.findIndex((check) => check.machine.id === item.machine.id) === index);
}

function beginnerLabel(score) {
  if (score >= 5) return "Very beginner-friendly";
  if (score >= 4) return "Beginner-friendly";
  if (score >= 3) return "Moderate ramp";
  return "Steeper first-owner ramp";
}

function resaleLabel(score) {
  if (score >= 5) return "Very strong";
  if (score >= 4) return "Strong";
  if (score >= 3) return "Moderate";
  return "More niche";
}

function maintenanceLabel(score) {
  if (score <= 2) return "Lower";
  if (score <= 3) return "Medium";
  return "Higher";
}

function computeArchetypeMatch(machine, archetype) {
  if (!archetype?.componentFit) return null;
  const machineComponents = new Set(componentsForMachine(machine.slug));
  if (machineComponents.size === 0) return null;

  const { good = [], bad = [] } = archetype.componentFit;
  const matchedGood = good.filter((id) => machineComponents.has(id));
  const matchedBad = bad.filter((id) => machineComponents.has(id));

  const score = Math.max(0, Math.min(100,
    50 + (matchedGood.length * 12) - (matchedBad.length * 10)
  ));

  const label = score >= 74 ? "Strong fit" : score >= 54 ? "Good fit" : score >= 40 ? "Mixed fit" : "Some friction";

  const pros = matchedGood
    .map((id) => COMPONENT_INDEX.get(id)?.archetypePro)
    .filter(Boolean);

  const cons = matchedBad
    .map((id) => COMPONENT_INDEX.get(id)?.archetypeCon)
    .filter(Boolean);

  return { score, label, pros, cons };
}

function renderArchetypeMatch(machine, archetype) {
  const match = computeArchetypeMatch(machine, archetype);
  if (!match) return "";

  const labelClass = match.score >= 74 ? "fit-strong" : match.score >= 54 ? "fit-good" : match.score >= 40 ? "fit-mixed" : "fit-friction";

  return `
    <div class="archetype-match">
      <div class="archetype-match__header">
        <span class="archetype-match__label ${labelClass}">${match.label} for ${archetype.name}</span>
      </div>
      ${match.pros.length ? `
        <ul class="archetype-match__list archetype-match__list--pros">
          ${match.pros.map((p) => `<li>${p}</li>`).join("")}
        </ul>
      ` : ""}
      ${match.cons.length ? `
        <ul class="archetype-match__list archetype-match__list--cons">
          ${match.cons.map((c) => `<li>${c}</li>`).join("")}
        </ul>
      ` : ""}
    </div>
  `;
}

function renderResults() {
  const recommendationState = currentRecommendationState();
  const recommendations = recommendationState.recommendations;
  const confidence = recommendationState.confidence;
  const framed = framedRecommendations(recommendations, confidence.level);
  const isLowConfidence = confidence.level === "low";
  const isMediumConfidence = confidence.level === "medium";
  const progressTitle = isLowConfidence
    ? "Stage 4: Early shortlist and confidence check"
    : "Stage 4: Your recommendation shortlist";
  const progressDescription = isLowConfidence
    ? "You have a useful shortlist, but not enough signal yet for a final ranked decision."
    : isMediumConfidence
      ? "You have strong candidates, with some ambiguity still worth resolving before final choice."
      : "You have a strong shortlist signal with clear tradeoffs and next-step validation guidance.";
  const progressBadge = isLowConfidence ? "Needs more signal" : isMediumConfidence ? "Refine once more" : "Strong signal";
  const insightLines = buildTasteInsightLines(state.reactions, buildRefinementSignals());
  const tasteSelections = discoveryTastePrompts
    .map((prompt) => {
      const selectedValue = state.tasteAnswers[prompt.id];
      const option = prompt.options.find((item) => item.value === selectedValue);
      return option ? option.label : "";
    })
    .filter(Boolean);
  const topRecommendation = recommendations[0] || null;
  const topRecommendationMarketUrl = buildAffiliateUrl(topRecommendation ? (topRecommendation.externalLinks?.pinsideMarket || buildPinsideMarketUrl(topRecommendation)) : "", { machineSlug: topRecommendation?.slug, placement: "shortlist-more-actions" });
  const topRecommendationDetailUrl = topRecommendation ? `machine.html?slug=${topRecommendation.slug}` : "";
  const strengthLabel = confidence.level === "high" ? "Strong signal" : confidence.level === "medium" ? "Developing signal" : "Early signal";
  const decisionState = loadDecisionState();
  const frontSlug = decisionState.frontRunnerSlug;
  const backupSlugs = decisionState.backupSlugs || [];
  const frontInRecommendations = frontSlug
    ? recommendations.some((machine) => machine.slug === frontSlug)
    : false;
  const primarySlug = (frontInRecommendations ? frontSlug : "") || topRecommendation?.slug || "";
  const refinementSummary = state.lastRefinementSummary;
  const hasArchetype = Object.values(state.tasteScores).some((s) => s !== 0);
  const archetype = hasArchetype ? buildPlayerArchetype(state.tasteScores) : null;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        progressTitle,
        progressDescription,
        75,
        progressBadge
      )}
      ${archetype ? `
        <article class="panel archetype-banner">
          <p class="eyebrow">Matched to your profile</p>
          <div class="archetype-banner-inner">
            <div>
              <h3>${archetype.name}</h3>
              <p class="muted">${archetype.summary}</p>
            </div>
            <div class="badge-row">
              ${archetype.tags.map((t) => `<span class="badge">${t}</span>`).join("")}
            </div>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary small" type="button" data-action="share-profile">Share my profile</button>
          </div>
        </article>
      ` : ""}
      <article class="panel results-next-step">
        <p class="eyebrow">Before you buy</p>
        <h3>Try it before you commit</h3>
        <p class="muted">Playing your top pick — or something close to it — in person is the fastest way to confirm you've got the right machine. We'll find locations near you using Pinball Map.</p>
        <div class="card-actions">
          <button class="btn btn-primary" type="button" data-action="open-nearby">Find machines to test nearby</button>
          <button class="btn btn-secondary" type="button" data-action="open-sourcing:${topRecommendation?.id || ""}">Skip — start buying plan</button>
        </div>
      </article>
      <article class="panel">
        <p class="eyebrow">What we learned</p>
        <h3>Your taste signals so far</h3>
        <ul class="result-list">
          ${insightLines.map((line) => `<li>${line}</li>`).join("")}
        </ul>
      </article>
      ${refinementSummary ? `
        <article class="panel">
          <p class="eyebrow">Shortlist update</p>
          <h3>Why the shortlist shifted</h3>
          <ul class="result-list">
            ${refinementSummary.lines.map((line) => `<li>${line}</li>`).join("")}
          </ul>
        </article>
      ` : ""}
      <article class="panel">
        <p class="eyebrow">${strengthLabel}</p>
        <h3>${confidence.title}</h3>
        <p class="muted">${confidence.summary}</p>
        <ul class="result-list">
          ${confidence.reasons.slice(0, 2).map((reason) => `<li>${reason}</li>`).join("")}
        </ul>
        ${isLowConfidence || isMediumConfidence ? `
          <div class="card-actions">
            ${confidence.nextSteps.map((step) => `<button class="btn btn-secondary small" type="button" data-action="${step.action}" data-confidence-step="${step.id}">${step.label}</button>`).join("")}
          </div>
          <p class="muted">${confidence.nextSteps[0]?.detail || ""}</p>
        ` : ""}
      </article>
      <div class="result-header panel">
        <p class="muted">Budget: <strong>${budgetLabel(state.context.budget)}</strong> · Condition: <strong>${choiceLabel("condition", state.context.condition)}</strong> · Timeline: <strong>${choiceLabel("timeline", state.context.timeline)}</strong></p>

        ${tasteSelections.length ? `
          <div class="taste-chip-row">
            ${tasteSelections.map((label) => `<span class="badge">${label}</span>`).join("")}
          </div>
        ` : ""}
      </div>
      ${decisionState.decisionBrief?.machineSlug ? `
        <article class="panel">
          <p class="eyebrow">Saved decision brief</p>
          <h3>Your action plan is already saved</h3>
          <p class="muted">Reopen your latest Decision Brief any time to continue from a clear next-action list.</p>
          <div class="card-actions">
            <button class="btn btn-secondary" type="button" data-action="open-decision-brief">Open Decision Brief</button>
          </div>
        </article>
      ` : ""}
      <div class="discovery-results-grid">
        ${framed.map((item) => {
          const machine = item.machine;
          const explanation = machine.explanation || {};
          const likelyFitTags = Array.isArray(machine?.likely_fit_tags) ? machine.likely_fit_tags : [];
          const whatToKnow = Array.isArray(machine?.what_to_know_before_buying) ? machine.what_to_know_before_buying : [];
          const pricing = pricingSummary(machine);
          const displayTitle = machineDisplayTitle(machine);
          const isFront = machine.slug === frontSlug;
          const isBackup = backupSlugs.includes(machine.slug);
          const isTemporary = isFront && decisionState.temporaryPrimary;
          const isPrimary = machine.slug === primarySlug;
          const whyMatch = (explanation.whyMatch || machine.whyItFits || []).slice(0, isPrimary ? 3 : 1);
          const downsideText = explanation.downside || whatToKnow[0] || machine.cautionNote || "Confirm game feel before committing.";
          const confirmText = explanation.confirmInPerson || machine.validationPlan;

          return renderSplitCard({
            className: `recommendation-card${isPrimary ? " recommendation-card--primary" : " recommendation-card--secondary"}`,
            mediaClassName: "recommendation-card__media",
            bodyClassName: "recommendation-card__body",
            overlayHtml: `<div class="recommendation-rank">${isPrimary ? "Top fit" : (isLowConfidence ? "Candidate" : "Backup fit")}</div>`,
            imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image recommendation-card__image", eager: true }),
            bodyHtml: `
            <div class="badge-row">
              ${isFront ? `<span class="badge">Front-runner</span>` : ""}
              ${isTemporary ? `<span class="badge">Temporary</span>` : ""}
              ${isBackup ? `<span class="badge">Backup</span>` : ""}
              <span class="badge">${item.frame}</span>
              <span class="badge">${machine.budget_band}</span>
              <span class="badge">${machine.rarityLabel}</span>
              ${machine.versions?.length > 1 ? `<span class="badge">${machine.versions.length} versions</span>` : ""}
            </div>
            <h3>${displayTitle}</h3>
            <p class="muted"><strong>${item.frame}:</strong> ${item.summary}</p>
            <p class="muted">${machine.beginner_summary}</p>
            <p class="muted"><strong>${pricing.estimated.label}:</strong> ${pricing.estimated.rangeText}</p>
            <p><strong>Why this fits you</strong></p>
            <ul class="result-list">
              ${whyMatch.map((reason) => `<li>${reason}</li>`).join("")}
            </ul>
            ${archetype ? renderArchetypeMatch(machine, archetype) : ""}
            <p class="muted"><strong>Watch-out:</strong> ${downsideText}</p>
            ${isPrimary ? `
              <p class="muted"><strong>Next check:</strong> ${confirmText}</p>
              <p class="fit-summary"><strong>Confidence:</strong> ${machine.confidenceBlurb}</p>
              <p class="muted"><strong>Beginner fit:</strong> ${beginnerLabel(machine.beginnerFriendly)} · <strong>Resale:</strong> ${resaleLabel(machine.resaleStrength)} · <strong>Upkeep:</strong> ${maintenanceLabel(machine.maintenanceComplexity)}</p>
              ${machine.nearestLocation ? `<p class="muted"><strong>Nearest test option:</strong> ${machine.nearestLocation.name} · about ${machine.nearestDistance} miles</p>` : ""}
            ` : `
              <p class="muted"><strong>Next check:</strong> ${confirmText}</p>
            `}
            ${isPrimary && likelyFitTags.length ? `
              <div class="discovery-tag-row">
                ${likelyFitTags.map((tag) => `<span class="badge">${tag}</span>`).join("")}
              </div>
            ` : ""}
            <div class="card-actions">
              <button class="btn btn-primary small" type="button" data-action="open-sourcing:${machine.id}">${isPrimary ? "Continue buying plan" : "Set as front-runner"}</button>
              <button class="btn btn-secondary small" type="button" data-action="${machine.nearbyLocations?.length ? `open-nearest:${machine.id}` : "open-nearby"}">${machine.nearbyLocations?.length ? "Find nearest test machine" : "Find a place to test"}</button>
            </div>
            `
          });
        }).join("")}
      </div>
      <article class="panel more-actions-panel">
        <div class="section-head compact">
          <h3>More actions</h3>
          <button class="btn btn-secondary small" type="button" data-action="toggle-more-actions">${state.moreActionsOpen ? "Hide" : "Show"}</button>
        </div>
        ${state.moreActionsOpen ? `
          <div class="card-actions">
            <button class="btn btn-secondary" type="button" data-action="save-shortlist">Save shortlist</button>
            <button class="btn btn-secondary" type="button" data-action="email-shortlist">Email summary</button>
            <a class="btn btn-secondary" href="compare.html">Compare shortlist</a>
            ${topRecommendation ? `<a class="btn btn-secondary" href="${topRecommendationDetailUrl}">View full machine detail</a>` : ""}
            ${topRecommendation ? `<a class="btn btn-secondary" href="${topRecommendationMarketUrl}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Open used listings" data-outbound-slug="${topRecommendation.slug}" data-outbound-placement="shortlist-more-actions">Open used listings</a>` : ""}
          </div>
        ` : `<p class="muted">Optional tools for deeper review. You can skip these and continue with the guided buying plan.</p>`}
      </article>
    </section>
  `;
}

function renderNearestMachineModal() {
  const machine = nearestMachineForModal();
  if (!machine) return "";

  const nearbyLocations = (machine.nearbyLocations || []).slice(0, 3);
  const displayTitle = machineDisplayTitle(machine);

  return `
    <div class="modal-backdrop" data-action="close-nearest-modal">
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="nearest-machine-title">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Nearest Test Locations</p>
            <h3 id="nearest-machine-title">${displayTitle}</h3>
          </div>
          <button class="btn btn-secondary small" type="button" data-action="close-nearest-modal">Close</button>
        </div>
        ${nearbyLocations.length ? `
          <p class="muted">Top nearby places to play this exact machine based on your current ZIP search.</p>
          <div class="discovery-question-stack">
            ${nearbyLocations.map((location, index) => `
              <article class="panel nearest-location-card">
                <div class="badge-row">
                  <span class="badge">#${index + 1}</span>
                  <span class="badge">${location.distanceMiles} miles</span>
                </div>
                <h3>${location.name}</h3>
                <p class="muted">${location.city}, ${location.state}${location.locationType ? ` · ${location.locationType}` : ""}</p>
                <p class="muted"><strong>Distance:</strong> about ${location.distanceMiles} miles from your searched ZIP.</p>
                <div class="card-actions">
                  ${location.website ? `<a class="btn btn-secondary small" href="${buildAffiliateUrl(location.website, { placement: "nearby-location" })}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Open website" data-outbound-placement="nearby-location">Open website</a>` : ""}
                  <button class="btn btn-primary small" type="button" data-action="close-nearest-modal">Done</button>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `
          <p class="muted">No nearby exact-machine locations are available for this shortlist result yet. Run a nearby search first or widen the drive radius.</p>
        `}
      </div>
    </div>
  `;
}

function renderNearbyTestPlan() {
  const hasLiveLocations = state.locationSearch.locations.length > 0;
  const nearbyCountLabel = state.nearbySuggestions.length
    ? `${state.nearbySuggestions.length} preference matches`
    : state.nearbyCatalogSuggestions.length
      ? `${state.nearbyCatalogSuggestions.length} nearby catalog options`
      : "No nearby matches yet";

  const BRACKET_MEDALS = ["🥇", "🥈", "🥉"];
  const bracketFinalIds = getBracketFinalThree();
  const bracketMachines = bracketFinalIds.map((id) => discoveryMachineIndex.get(id)).filter(Boolean);
  const hasBracketContext = bracketMachines.length > 0;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Validate before you buy",
        "Playing your top pick — or a machine with a similar feel — before committing is the best way to avoid regret. Search Pinball Map to find places near you.",
        85,
        nearbyCountLabel
      )}
      <form id="nearby-search-form" class="panel sourcing-form">
        <p class="muted">${hasBracketContext ? `Enter your ZIP to find places near you where you can play ${bracketMachines[0] ? machineDisplayTitle(bracketMachines[0]) : "your top picks"} before you buy.` : "Add your ZIP to unlock live nearby places and machines worth testing before you buy."}</p>
        <div class="form-grid">
          <label>Zip code<input name="zip" value="${state.locationSearch.zip}" placeholder="60614" required /></label>
          <label>Max drive distance
            <select name="maxMiles">
              ${["50", "100", "150", "250", "300", "500"].map((value) => `<option value="${value}" ${state.locationSearch.maxMiles === value ? "selected" : ""}>${value} miles</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="discovery-actions">
          <button class="btn btn-primary" type="submit">Find nearby playable machines</button>
          <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
        </div>
      </form>
      ${state.locationSearch.locations.length ? `
        <div class="panel result-header">
          <p class="muted"><strong>Search area:</strong> ${state.locationSearch.zip} within ${state.locationSearch.maxMiles} miles</p>
          <p class="muted"><strong>Nearby locations found:</strong> ${state.locationSearch.locations.map((location) => `${location.name} (${location.distanceMiles} mi)`).join(" · ")}</p>
        </div>
      ` : ""}
      ${state.locationSearch.error ? `
        <div class="panel empty-state">
          <h3>Live location search failed</h3>
          <p class="muted">${state.locationSearch.error}</p>
        </div>
      ` : ""}
      ${hasBracketContext ? `
        <div class="bracket-test-groups">
          ${bracketMachines.map((m, i) => renderBracketTestGroup(m, i, state.nearbySuggestions)).join("")}
        </div>
        ${state.locationSearch.hasSearched && state.locationSearch.error === "" && !state.nearbySuggestions.length ? `
          <div class="panel empty-state">
            <h3>No playable matches found nearby</h3>
            <p class="muted">Pinball Map didn’t find any of your bracket machines or their proxies within ${state.locationSearch.maxMiles} miles of ${state.locationSearch.zip}. Try a larger search radius, or log a game you’ve already played using the button above.</p>
          </div>
        ` : ""}
      ` : `
        <div class="discovery-results-grid">
          ${state.nearbySuggestions.length
            ? state.nearbySuggestions.map((suggestion) => renderProbeCard(suggestion)).join("")
            : state.locationSearch.hasSearched && hasLiveLocations
              ? `<div class="panel empty-state"><h3>No nearby preference matches yet</h3><p class="muted">Pinball Map returned nearby locations for ${state.locationSearch.zip}, but none of the close-by machines matched your current shortlist or proxy validation targets.</p></div>`
              : state.locationSearch.hasSearched
                ? `<div class="panel empty-state"><h3>No Pinball Map locations found nearby</h3><p class="muted">No mapped public locations in the live Pinball Map results were within ${state.locationSearch.maxMiles} miles of ${state.locationSearch.zip}. Try a larger radius.</p></div>`
              : `<div class="panel empty-state"><h3>Start with your zip code</h3><p class="muted">We’ll use live Pinball Map location data to suggest nearby exact matches and proxy machines worth trying.</p></div>`
          }
        </div>
        ${state.locationSearch.hasSearched && state.nearbyCatalogSuggestions.length ? `
          <section class="section-inner">
            <div class="section-head">
              <div>
                <p class="eyebrow">Also nearby</p>
                <h3>Other close-by catalog machines</h3>
                <p class="muted">These are not your strongest preference matches, but they are close enough to be useful if you want more real-world play data.</p>
              </div>
            </div>
            <div class="discovery-results-grid">
              ${state.nearbyCatalogSuggestions.map((suggestion) => renderProbeCard(suggestion)).join("")}
            </div>
          </section>
        ` : ""}
      `}
      ${state.locationSearch.hasSearched && state.nearbyExternalSuggestions.length ? `
        <section class="section-inner">
          <div class="section-head">
            <div>
              <p class="eyebrow">Nearby On Pinball Map</p>
              <h3>Machines outside the current catalog</h3>
              <p class="muted">These titles are nearby and playable, but Pinball Scout does not have full recommendation metadata for them yet.</p>
            </div>
          </div>
          <div class="discovery-results-grid">
            ${state.nearbyExternalSuggestions.map((item) => renderExternalMachineCard(item)).join("")}
          </div>
        </section>
      ` : ""}
      ${(() => {
        const topRec = sourcingMachine() || currentRecommendations()[0] || null;
        return `
          <article class="panel results-next-step">
            <p class="eyebrow">Ready to move forward?</p>
            <h3>${topRec ? `Start your buying plan for ${machineDisplayTitle(topRec)}` : "Start your buying plan"}</h3>
            <p class="muted">Walk through condition, sourcing options, and what to check before you commit.</p>
            <div class="card-actions">
              <button class="btn btn-primary" type="button" data-action="open-sourcing:${topRec?.id || ""}">Start buying plan →</button>
              <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
            </div>
          </article>
        `;
      })()}
    </section>
  `;
}

function renderPostPlayFeedback() {
  const probe = probeById();
  if (!probe) return "";
  const questions = postPlayQuestionsFor(probe);
  const probeBadge = probe.probeType === "exact" ? "Exact probe" : probe.probeType === "proxy" ? "Proxy probe" : "Nearby machine";
  const progressBadge = probe.probeType === "exact" ? "Exact machine played" : probe.probeType === "proxy" ? "Proxy machine played" : "Nearby machine played";
  const displayTitle = machineDisplayTitle(probe.machine);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Post-play feedback",
        "This is where the system gets materially smarter. Real-world play should influence the shortlist more strongly than video-only reactions.",
        92,
        progressBadge
      )}
      ${renderSplitCard({
        className: "discovery-machine-card",
        mediaClassName: "discovery-machine-card__media",
        bodyClassName: "discovery-machine-copy",
        imageHtml: renderMachineImage(probe.machine, { className: "machine-image-frame--thumb split-card__image discovery-machine-image" }),
        bodyHtml: `
          <div class="badge-row">
            <span class="badge">${probeBadge}</span>
            <span class="badge">${displayTitle}</span>
          </div>
          <h2>${displayTitle}</h2>
          <p class="muted">${probe.reason}</p>
          ${probe.probeType === "proxy" ? `<p class="muted"><strong>Answer the same watch-for points from the checklist.</strong> Each answer now feeds directly into the trait model and tightens the shortlist.</p>` : ""}
          <div class="discovery-question-stack">
            ${questions.map((question) => `
              <div class="detail-list-block">
                <p><strong>${question.title}</strong></p>
                <div class="mini-chip-row">
                  ${question.choices.map((choice) => `
                    <button
                      class="chip-button${state.draft[question.id] === choice.value ? " is-selected" : ""}"
                      type="button"
                      data-draft-choice="${question.id}:${choice.value}"
                    >
                      ${choice.label}
                    </button>
                  `).join("")}
                </div>
              </div>
            `).join("")}
            <label class="detail-list-block">
              <p><strong>Optional notes</strong></p>
              <textarea rows="3" data-draft-notes="post-play" placeholder="Anything else that stood out?">${state.draft.notes || ""}</textarea>
            </label>
          </div>
        `
      })}
      <div class="discovery-actions">
        <button
          class="btn btn-primary"
          type="button"
          data-action="submit-post-play"
          ${isPostPlayComplete(probe) ? "" : "disabled"}
        >
          Refine recommendations
        </button>
      </div>
    </section>
  `;
}

function renderVideoRefinementCard(machine) {
  const feedback = videoFeedbackFor(machine.id);
  const reactionOptions = [
    { value: "liked-it", label: "Looks exciting" },
    { value: "not-sure", label: "Not sure yet" },
    { value: "not-for-me", label: "Not for me" }
  ];

  return renderSplitCard({
    className: "discovery-machine-card",
    mediaClassName: "discovery-machine-card__media",
    bodyClassName: "discovery-machine-copy",
    imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image discovery-machine-image" }),
    bodyHtml: `
      <div class="badge-row">
        <span class="badge">Video refine</span>
        <span class="badge">${machine.budget_band}</span>
      </div>
      <h2>${machineDisplayTitle(machine)}</h2>
      <p class="muted">${machine.shortDescription}</p>
      <div class="card-actions">
        ${renderVideoAction({ url: machine.overview_video_url, label: "Watch overview", title: `${machine.name} overview` })}
        ${renderVideoAction({ url: machine.gameplay_video_url, label: "Watch gameplay", title: `${machine.name} gameplay` })}
      </div>
      <div class="detail-list-block">
        <p><strong>Did this look exciting?</strong></p>
        <div class="mini-chip-row">
          ${reactionOptions.map((option) => `
            <button
              class="chip-button${feedback.reaction === option.value ? " is-selected" : ""}"
              type="button"
              data-video-reaction="${machine.id}:${option.value}"
            >
              ${option.label}
            </button>
          `).join("")}
        </div>
      </div>
      ${renderRefinementChips("What stood out most?", REFINEMENT_POSITIVE_PROMPTS, feedback.liked || [], "liked", "video-choice", machine.id)}
      ${renderRefinementChips("What did not look fun?", REFINEMENT_NEGATIVE_PROMPTS, feedback.disliked || [], "disliked", "video-choice", machine.id)}
      <label class="detail-list-block">
        <p><strong>Optional notes</strong></p>
        <textarea rows="2" data-video-notes="${machine.id}" placeholder="Quick notes for later">${feedback.notes || ""}</textarea>
      </label>
    `
  });
}

function renderVideoRefinement() {
  const recommendations = currentRecommendations();
  const targets = recommendations.slice(0, 3);
  if (!targets.length) return "";
  const completedCount = targets.filter((machine) => videoFeedbackFor(machine.id).reaction).length;
  const ready = completedCount > 0;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 4b: Video refinement",
        "Watch a quick overview or gameplay clip for your shortlist and give fast feedback. This helps sharpen the order before you travel.",
        82,
        `${completedCount} of ${targets.length} logged`
      )}
      <article class="panel">
        <p class="eyebrow">Quick refinement</p>
        <h3>Tell us what looked exciting or not</h3>
        <p class="muted">Short, simple reactions here can save you a wasted trip later.</p>
      </article>
      ${targets.map((machine) => renderVideoRefinementCard(machine)).join("")}
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
        <button class="btn btn-primary" type="button" data-action="submit-video-refinement" ${ready ? "" : "disabled"}>Apply video feedback</button>
      </div>
    </section>
  `;
}

function renderExternalFeedback() {
  const draft = state.externalDraft;
  const reactionOptions = [
    { value: "liked-it", label: "Liked it" },
    { value: "not-sure", label: "Not sure" },
    { value: "not-for-me", label: "Not for me" }
  ];

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Log a machine outside the catalog",
        "We can still learn from your reaction even if the exact machine is not in the Pinball Scout library.",
        88,
        "Outside catalog"
      )}
      <article class="panel">
        <label class="detail-list-block">
          <p><strong>Machine name</strong></p>
          <input data-external-name value="${draft.machineName || ""}" placeholder="Example: Theatre of Magic" />
        </label>
        <div class="detail-list-block">
          <p><strong>How did it land for you?</strong></p>
          <div class="mini-chip-row">
            ${reactionOptions.map((option) => `
              <button
                class="chip-button${draft.reaction === option.value ? " is-selected" : ""}"
                type="button"
                data-external-reaction="${option.value}"
              >
                ${option.label}
              </button>
            `).join("")}
          </div>
        </div>
        ${renderRefinementChips("What stood out most?", REFINEMENT_POSITIVE_PROMPTS, draft.liked || [], "liked", "external-choice", "external")}
        ${renderRefinementChips("What did not click?", REFINEMENT_NEGATIVE_PROMPTS, draft.disliked || [], "disliked", "external-choice", "external")}
        <label class="detail-list-block">
          <p><strong>Optional notes</strong></p>
          <textarea rows="3" data-external-notes placeholder="Anything else to remember?">${draft.notes || ""}</textarea>
        </label>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="cancel-external-feedback">Back</button>
        <button class="btn btn-primary" type="button" data-action="submit-external-feedback">Save feedback</button>
      </div>
    </section>
  `;
}

function hasPlayedMachine(machineId) {
  return state.reactions.some((reaction) => reaction.machineId === machineId && reaction.experienceType === "played");
}

function renderFinals() {
  const recommendations = currentRecommendations();
  if (!recommendations.length) return "";
  const topThree = recommendations.slice(0, 3);
  const topTraits = topTraitSignals();
  const evidenceModel = buildEvidenceModel(state.reactions, buildRefinementSignals());
  const conflictTraits = labelTraitList(evidenceModel.conflicts || []);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 6: Final shortlist focus",
        "Pick what feels most exciting, replayable, and overall right. We will highlight the best fit even if you have not played it yet.",
        95,
        "Finals"
      )}
      <article class="panel">
        <p class="eyebrow">Finals check</p>
        <h3>Lock in your top 3 direction</h3>
        <p class="muted">Choose the winner for each prompt. This does not lock your final decision yet.</p>
        ${topTraits.length ? `<p class="muted"><strong>Signals you seem to like:</strong> ${topTraits.join(" Â· ")}</p>` : ""}
        ${conflictTraits.length ? `<p class="muted"><strong>Still mixed on:</strong> ${conflictTraits.join(" Â· ")}</p>` : ""}
      </article>
      <article class="panel">
        <div class="detail-list-block">
          <p><strong>Most exciting</strong></p>
          <div class="mini-chip-row">
            ${topThree.map((machine) => `
              <button class="chip-button${state.finals.mostExciting === machine.id ? " is-selected" : ""}" type="button" data-finals-choice="mostExciting:${machine.id}">
                ${machineDisplayTitle(machine)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="detail-list-block">
          <p><strong>Most replayable</strong></p>
          <div class="mini-chip-row">
            ${topThree.map((machine) => `
              <button class="chip-button${state.finals.mostReplayable === machine.id ? " is-selected" : ""}" type="button" data-finals-choice="mostReplayable:${machine.id}">
                ${machineDisplayTitle(machine)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="detail-list-block">
          <p><strong>Best overall match</strong></p>
          <div class="mini-chip-row">
            ${topThree.map((machine) => `
              <button class="chip-button${state.finals.bestMatch === machine.id ? " is-selected" : ""}" type="button" data-finals-choice="bestMatch:${machine.id}">
                ${machineDisplayTitle(machine)}
              </button>
            `).join("")}
          </div>
        </div>
      </article>
      <div class="discovery-results-grid">
        ${topThree.map((machine) => {
          const alignment = traitAlignmentList(machine);
          const playedLabel = hasPlayedMachine(machine.id) ? "Played" : "Not played yet";
          const videoFeedback = state.videoFeedback?.[machine.id]?.reaction || "";
          const mismatchSignals = Array.isArray(machine.mismatchSignals) ? machine.mismatchSignals : [];
          const playedIds = state.reactions.filter((reaction) => reaction.experienceType === "played").map((reaction) => reaction.machineId);
          const proxyPlayed = (machine.proxy_machine_ids || []).find((id) => playedIds.includes(id)) || "";
          const proxyName = proxyPlayed ? machineDisplayTitle(discoveryMachineIndex.get(proxyPlayed) || { name: proxyPlayed, title: proxyPlayed }) : "";
          const evidenceLine = hasPlayedMachine(machine.id)
            ? "Based on your real-world play feedback."
            : videoFeedback
              ? "Based on your video reactions."
              : "Based on your broader taste signals so far.";
          const whyStillHere = alignment.length
            ? `It lines up with ${alignment.slice(0, 2).join(" and ").toLowerCase()}.`
            : "It matches the overall direction of your feedback so far.";
          const uncertaintyLine = mismatchSignals.length
            ? `Potential mismatch: ${mismatchSignals.join(" and ")} may not feel right in person.`
            : hasPlayedMachine(machine.id)
              ? "Main uncertainty: confirm this still holds up over longer play sessions."
              : "Main uncertainty: you have not played it in person yet.";
          const tieBreakLine = hasPlayedMachine(machine.id)
            ? "If it is still close, compare it side-by-side with your top alternative."
            : "A focused play session or one more video will help break the tie.";
          const deepDiveNote = !hasPlayedMachine(machine.id) && alignment.length
            ? `If you liked ${alignment.slice(0, 2).join(" and ")}, this still looks like a strong fit.`
            : "";
          return renderSplitCard({
            className: "recommendation-card",
            mediaClassName: "recommendation-card__media",
            bodyClassName: "recommendation-card__body",
            overlayHtml: `<div class="recommendation-rank">Finals</div>`,
            imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image recommendation-card__image", eager: true }),
            bodyHtml: `
              <div class="badge-row">
                <span class="badge">${playedLabel}</span>
                <span class="badge">${machine.budget_band}</span>
              </div>
              <h3>${machineDisplayTitle(machine)}</h3>
              <p class="muted">${machine.beginner_summary}</p>
              <p class="muted">${evidenceLine}</p>
              ${alignment.length ? `
                <p><strong>Why it matches your taste</strong></p>
                <ul class="result-list">
                  ${alignment.map((item) => `<li>${item}</li>`).join("")}
                </ul>
              ` : `<p class="muted">Use your video + play feedback to judge this fit.</p>`}
              <p><strong>Why it is still here</strong></p>
              <p class="muted">${whyStillHere}</p>
              <p><strong>What to validate</strong></p>
              <p class="muted">${uncertaintyLine}</p>
              ${proxyName ? `
                <p><strong>Proxy evidence</strong></p>
                <p class="muted">You played ${proxyName}, which is a good proxy for this style.</p>
              ` : ""}
              <p><strong>What would break the tie</strong></p>
              <p class="muted">${tieBreakLine}</p>
              ${deepDiveNote ? `<p class="muted">${deepDiveNote}</p>` : ""}
              <div class="card-actions">
                ${renderVideoAction({ url: machine.overview_video_url, label: "Watch overview", title: `${machine.name} overview` })}
                ${renderVideoAction({ url: machine.gameplay_video_url, label: "Watch gameplay", title: `${machine.name} gameplay` })}
                <button class="btn btn-secondary small" type="button" data-action="open-sourcing:${machine.id}">Open buying plan</button>
              </div>
            `
          });
        }).join("")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
        <button class="btn btn-primary" type="button" data-action="open-sourcing:${topThree[0]?.id || ""}">Continue with top fit</button>
      </div>
    </section>
  `;
}

function renderWhatCountsModal() {
  if (!state.activeWhatCountsId) return "";
  const blocker = blockerById(state.activeWhatCountsId);
  if (!blocker) return "";
  return `
    <div class="modal-backdrop what-counts-backdrop" data-action="plan-what-counts-close">
      <div class="modal-panel what-counts-sheet" role="dialog" aria-modal="true" aria-labelledby="what-counts-title">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">What counts</p>
            <h3 id="what-counts-title">${blocker.title}</h3>
          </div>
          <button class="btn btn-secondary small" type="button" data-action="plan-what-counts-close">Close</button>
        </div>
        <p class="muted">${blocker.doneWhen}</p>
        <ul class="result-list">
          ${(blocker.whatCounts || []).map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderSourcingForm() {
  const machine = sourcingMachine();
  const machineProfile = sourcingRecommendationProfile();
  const displayTitle = machine ? machineDisplayTitle(machine) : "your shortlisted machine";
  if (!machine || !machineProfile) {
    return `
      <section class="discovery-shell">
        ${renderProgress(
          "Decision closure plan",
          "Choose a shortlist machine first, then continue with the buying plan.",
          30
        )}
        <article class="panel">
          <h3>No working pick selected yet</h3>
          <p class="muted">Go back to recommendations and choose one machine to anchor your buying plan.</p>
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="back-to-results">Back to shortlist</button>
          </div>
        </article>
      </section>
    `;
  }

  const decisionState = loadDecisionState();
  const planState = readMachinePlanState(decisionState, machine.slug, state.context.condition);
  const step = planState.currentPlanStep;
  const pathType = planState.selectedPathType;
  const pathOption = BUY_PATH_OPTIONS.find((item) => item.value === pathType);
  const includeRemoteOverlay = shouldApplyRemoteOverlay(state.context);
  const blockers = blockersForPath(pathType, includeRemoteOverlay);
  const requiredCheckProgress = blockerProgress(blockers, planState.requiredChecks || {});
  const readiness = readinessFromBlockers({
    pathType,
    blockers,
    requiredChecks: planState.requiredChecks || {},
    currentPlanStep: step,
    workingPickConfirmed: planState.workingPickConfirmed
  });
  const recommendations = currentRecommendations();
  const alternatives = recommendations.filter((item) => item.slug !== machine.slug).slice(0, 2);
  const whyItFits = machineProfile.explanation?.whyMatch || machineProfile.whyItFits || [machineProfile.starterRecommendationReason];
  const downside = machineProfile.explanation?.downside || machineProfile.what_to_know_before_buying?.[0] || machineProfile.cautionNote;
  const confirm = machineProfile.explanation?.confirmInPerson || machineProfile.validationPlan;
  const skipNote = whoShouldSkip(machineProfile);
  const pathActions = nextActionsForPath(pathType, displayTitle);
  const pathTag = pathOption ? pathOption.label : "Pick a route";
  const continuity = buildDecisionContinuityModel(decisionState, {
    page: "help",
    screen: "sourcing",
    fallbackCondition: state.context.condition
  });
  const unresolvedBlockers = blockers.filter((blocker) => requiredCheckProgress.statusById[blocker.id] !== CHECK_STATUS.COMPLETE);
  const firstUnresolvedBlockerId = unresolvedBlockers[0]?.id || "";
  const readinessModel = buildReadinessModel({
    machine,
    context: state.context,
    reactions: state.reactions,
    refinementSignals: buildRefinementSignals(),
    recommendations,
    pathType,
    requiredCheckProgress,
    overallReadiness: readiness,
    firstUnresolvedBlockerId
  });
  const riskModel = buildRiskBannerModel({
    machine: machineProfile,
    context: state.context,
    pathType,
    overallReadinessLabel: readiness.label,
    blockedCount: requiredCheckProgress.blockedCount
  });

  const planOpenKey = `${machine.slug}:${pathType}:${Boolean(decisionState.temporaryPrimary)}`;
  trackAnalyticsOnce(ANALYTICS_EVENTS.BUYING_PLAN_OPENED, planOpenKey, {
    machine_slug: machine.slug,
    path_type: derivePathType(pathType),
    temporary_primary: Boolean(decisionState.temporaryPrimary)
  });
  const stepViewKey = `${machine.slug}:${pathType}:step:${step}`;
  if (!viewedPlanStepKeys.has(stepViewKey)) {
    viewedPlanStepKeys.add(stepViewKey);
    trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_VIEWED, {
      machine_slug: machine.slug,
      step_id: `step_${step}`,
      path_type: derivePathType(pathType)
    });
  }

  blockers.forEach((blocker) => {
    const viewKey = `${machine.slug}:${pathType}:${blocker.id}`;
    if (!viewedHardBlockers.has(viewKey)) {
      viewedHardBlockers.add(viewKey);
      startAnalyticsTimer(`blocker:${machine.slug}:${pathType}:${blocker.id}`);
      trackAnalytics(ANALYTICS_EVENTS.HARD_BLOCKER_VIEWED, {
        machine_slug: machine.slug,
        path_type: derivePathType(pathType),
        blocker_type: blocker.id,
        screen: "sourcing"
      });
    }
  });

  const readinessViewKey = `${machine.slug}:${pathType}`;
  if (!viewedReadinessMeters.has(readinessViewKey)) {
    viewedReadinessMeters.add(readinessViewKey);
    trackAnalytics(ANALYTICS_EVENTS.READINESS_METER_VIEWED, {
      machine_slug: machine.slug,
      path_type: derivePathType(pathType),
      overall_state: readiness.label
    });
  }

  const readinessSection = `
    <article class="panel readiness-meter-panel">
      <div class="section-head compact">
        <div>
          <p class="eyebrow">Decision readiness</p>
          <h3>${readiness.label}</h3>
          <p class="muted">${readinessModel.summaryText}</p>
        </div>
      </div>
      <details class="accordion">
        <summary>Show readiness breakdown</summary>
        <div class="accordion__body">
          <div class="readiness-cards-grid">
            ${readinessModel.cards.map((card) => `
              <article class="readiness-card readiness-card--${card.tone}">
                <div class="readiness-card__head">
                  <h4>${card.title}</h4>
                  <span class="badge readiness-band readiness-band--${card.tone}">${card.band}</span>
                </div>
                <p class="muted">${card.description}</p>
                ${card.nextAction ? `
                  <button
                    class="chip-button readiness-action-chip"
                    type="button"
                    data-action="readiness-action:${card.nextAction.target}:${card.nextAction.blockerId || ""}"
                    data-readiness-card="${card.id}"
                  >${card.nextAction.label}</button>
                ` : ""}
              </article>
            `).join("")}
          </div>
        </div>
      </details>
    </article>
  `;

  const dominantStatusPanel = `
    <article class="panel plan-continuity-panel">
      <p class="eyebrow">Current decision</p>
      <h3>${displayTitle}${decisionState.temporaryPrimary ? " (Temporary)" : ""}</h3>
      ${budgetContextNote(machine)}
      <p class="muted"><strong>Status:</strong> ${readiness.label} · ${readiness.reason}</p>
      <p class="muted"><strong>Backups:</strong> ${decisionState.backupSlugs?.length
        ? decisionState.backupSlugs.map((slug) => machineDisplayTitle(machineBySlug(slug) || { name: slug, title: slug })).join(", ")
        : "None saved"
      }</p>
      ${unresolvedBlockers.length ? `
        <article class="required-next-card">
          <p><strong>Next required move:</strong> Complete ${unresolvedBlockers[0].title.toLowerCase()}.</p>
          <button class="btn btn-primary small" type="button" data-action="plan-focus-required">Review required checks</button>
        </article>
      ` : riskModel.primary ? `
        <article class="risk-banner risk-banner--${riskModel.primary.type}">
          <div class="risk-banner__head">
            <h4>${riskModel.primary.title}</h4>
          </div>
          <p class="muted">${riskModel.primary.body}</p>
          <div class="required-check-actions">
            <button class="btn btn-secondary small" type="button" data-action="risk-banner-cta:${riskModel.primary.type}:${riskModel.primary.ctaId}:${riskModel.primary.ctaTarget}">${riskModel.primary.ctaLabel}</button>
          </div>
        </article>
      ` : ""}
      ${continuity.backupMoreReady && continuity.topBackup ? `
        <article class="decision-alert">
          <p><strong>${machineDisplayTitle(continuity.topBackup.machine)} is currently more ready.</strong></p>
          <div class="card-actions">
            <button class="btn btn-primary small" type="button" data-action="plan-promote-backup:${continuity.topBackup.machine.slug}">Promote backup</button>
            <button class="btn btn-secondary small" type="button" data-action="plan-keep-fix">Keep current</button>
          </div>
        </article>
      ` : ""}
      <div class="card-actions">
        <button class="btn btn-secondary small" type="button" data-action="risk-drawer-toggle">
          ${state.activeRiskDrawer ? "Hide readiness breakdown" : "Show readiness breakdown"}
        </button>
      </div>
    </article>
  `;

  const requiredChecksSection = `
    <article class="panel required-checks-panel${state.activePlanFocus === "required-checks" ? " is-focused" : ""}" id="required-checks" data-required-checks>
      <div class="required-checks-head">
        <div>
          <p class="eyebrow">Required checks</p>
          <h3>Required checks (${requiredCheckProgress.completeCount}/${requiredCheckProgress.total || 0} complete)</h3>
          <p class="muted">Status: <strong>${readiness.label}</strong> · ${readiness.reason}</p>
          <p class="muted decision-summary-inline">${readinessModel.summaryText}</p>
        </div>
        <span class="badge readiness-badge readiness-badge--${readiness.tone}">${readiness.label}</span>
      </div>
      ${pathType === "still-deciding" ? `
        <div class="required-check-empty">
          <p class="muted">Choose <strong>Used listing route</strong> or <strong>New / dealer route</strong> first. Required checks unlock after route selection so you stay focused.</p>
          <button class="btn btn-primary" type="button" data-action="plan-set-path:used">Start used route checks</button>
        </div>
      ` : blockers.map((blocker) => {
          const status = requiredCheckProgress.statusById[blocker.id] || CHECK_STATUS.NOT_STARTED;
          const label = blockerStatusLabel(status);
          const tone = blockerStatusTone(status);
          const primaryAction = status === CHECK_STATUS.COMPLETE ? "Reopen this check" : blocker.primaryActionLabel;
          return `
            <article class="required-check-row${state.activePlanFocus === blocker.id ? " is-focused" : ""}" id="required-check-${blocker.id}">
              <div class="required-check-row__head">
                <h4>${blocker.title}</h4>
                <span class="badge blocker-status blocker-status--${tone}">${label}</span>
              </div>
              <p class="muted"><strong>Why this matters:</strong> ${blocker.whyThisMatters}</p>
              <p class="muted"><strong>Done when:</strong> ${blocker.doneWhen}</p>
              <div class="required-check-actions">
                <button
                  class="btn btn-primary small"
                  type="button"
                  data-action="plan-blocker-primary:${blocker.id}"
                >${primaryAction}</button>
                ${blocker.whatCounts?.length ? `
                  <button class="btn btn-secondary small" type="button" data-action="plan-what-counts-open:${blocker.id}">What counts?</button>
                ` : ""}
              </div>
              <div class="mini-chip-row required-check-chips">
                <button class="chip-button${status === CHECK_STATUS.PARTIAL ? " is-selected" : ""}" type="button" data-action="plan-blocker-status:${blocker.id}:${CHECK_STATUS.PARTIAL}">In progress</button>
                <button class="chip-button${status === CHECK_STATUS.SKIPPED ? " is-selected" : ""}" type="button" data-action="plan-blocker-status:${blocker.id}:${CHECK_STATUS.SKIPPED}">Skip for now</button>
                <button class="chip-button${status === CHECK_STATUS.NOT_STARTED ? " is-selected" : ""}" type="button" data-action="plan-blocker-status:${blocker.id}:${CHECK_STATUS.NOT_STARTED}">Reset</button>
              </div>
            </article>
          `;
        }).join("")
      }
      ${includeRemoteOverlay && pathType !== "still-deciding"
        ? `<p class="muted">Remote buyer overlay is active because in-person access looks limited. Complete these extra checks before committing.</p>`
        : ""
      }
    </article>
  `;

  const stepBody = step === 1
    ? `
      <article class="panel plan-step-panel${state.activePlanFocus === "working-pick-step" ? " is-focused" : ""}" id="plan-working-pick-step">
        <p class="eyebrow">Working pick</p>
        <h3>${displayTitle}</h3>
        <p class="muted">${machineProfile.beginner_summary}</p>
        <p class="muted">This is your current front-runner. Keep it if it still feels right, or switch before planning next actions.</p>
        <div class="discovery-actions">
          <button class="btn btn-primary" type="button" data-action="plan-keep-pick">Continue with this machine</button>
          <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
        </div>
      </article>
      ${alternatives.length ? `
        <article class="panel plan-step-panel">
          <p class="eyebrow">Switch pick</p>
          <h3>Try another shortlisted machine</h3>
          <div class="choice-grid">
            ${alternatives.map((item) => `
              <button class="choice-card" type="button" data-action="plan-switch-pick:${item.id}">
                <strong>${machineDisplayTitle(item)}</strong>
                <span>${item.beginner_summary}</span>
              </button>
            `).join("")}
          </div>
        </article>
      ` : ""}
    `
    : step === 2
      ? `
        <article class="panel plan-step-panel${state.activePlanFocus === "fit-risk-step" ? " is-focused" : ""}" id="plan-fit-risk-step">
          <p class="eyebrow">Why this fits / what could go wrong</p>
          <h3>${displayTitle}</h3>
          <p><strong>Why this fits you</strong></p>
          <ul class="result-list">
            ${whyItFits.slice(0, 2).map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <p><strong>Main downside</strong></p>
          <p class="muted">${downside || "Confirm this still feels right after one focused validation step."}</p>
          <p><strong>What to confirm before buying</strong></p>
          <p class="muted">${confirm || "Confirm game feel and ownership fit before committing."}</p>
          ${skipNote ? `<p class="muted"><strong>Who should skip this:</strong> ${skipNote}</p>` : ""}
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="plan-next-step">Choose buy path</button>
            <button class="btn btn-secondary" type="button" data-action="plan-prev-step">Back</button>
          </div>
        </article>
      `
      : step === 3
        ? `
          <article class="panel plan-step-panel${state.activePlanFocus === "path-step" ? " is-focused" : ""}" id="plan-path-step">
            <p class="eyebrow">Buy path decision</p>
            <h3>How do you want to pursue this machine?</h3>
            <div class="choice-grid">
              ${BUY_PATH_OPTIONS.map((option) => `
                <button class="choice-card${pathType === option.value ? " is-selected" : ""}" type="button" data-action="plan-set-path:${option.value}">
                  <strong>${option.label}</strong>
                  <span>${option.hint}</span>
                </button>
              `).join("")}
            </div>
            <div class="discovery-actions">
              <button class="btn btn-primary" type="button" data-action="plan-next-step">Build next actions</button>
              <button class="btn btn-secondary" type="button" data-action="plan-prev-step">Back</button>
            </div>
          </article>
        `
        : `
          <article class="panel plan-step-panel">
            <p class="eyebrow">Next actions</p>
            <h3>What to do next for the ${pathTag.toLowerCase()} route</h3>
            ${unresolvedBlockers.length ? `
              <article class="required-next-card">
                <p><strong>Complete required checks first</strong></p>
                <ul class="result-list">
                  ${unresolvedBlockers.map((blocker) => `<li>${blocker.title}</li>`).join("")}
                </ul>
                <button class="btn btn-primary" type="button" data-action="plan-focus-required">Review required checks</button>
              </article>
            ` : ""}
            <ul class="result-list">
              ${pathActions.map((item) => `<li>${item}</li>`).join("")}
            </ul>
            <p class="muted">External listing/deep detail actions stay secondary until required checks are complete.</p>
            <div class="discovery-actions">
              <button class="btn btn-primary" type="button" data-action="plan-finish">Save plan and open Decision Brief</button>
              <button class="btn btn-secondary" type="button" data-action="plan-prev-step">Back</button>
            </div>
          </article>
        `;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        decisionPlanStepTitle(step),
        "Move from shortlist to a calm, actionable buying plan.",
        decisionPlanProgress(step),
        pathTag
      )}
      ${dominantStatusPanel}
      ${requiredChecksSection}
      ${stepBody}
      ${state.activeRiskDrawer ? readinessSection : ""}
    </section>
  `;
}

function renderDecisionBrief() {
  const decisionState = loadDecisionState();
  const brief = decisionState.decisionBrief;
  if (!brief?.machineSlug) {
    return `
      <section class="discovery-shell">
        ${renderProgress(
          "Decision Brief",
          "Finish your buying-plan flow to generate a clear decision brief.",
          92,
          "Not saved yet"
        )}
        <article class="panel">
          <h3>No saved Decision Brief yet</h3>
          <p class="muted">Continue from your shortlist and complete the buying plan to create a reusable action brief.</p>
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="back-to-results">Back to shortlist</button>
          </div>
        </article>
      </section>
    `;
  }

  const machine = currentRecommendations().find((item) => item.slug === brief.machineSlug) || machineBySlug(brief.machineSlug);
  const displayTitle = machine ? machineDisplayTitle(machine) : brief.machineSlug;
  const backupLabels = (brief.backupSlugs || [])
    .map((slug) => machineBySlug(slug))
    .filter(Boolean)
    .map((item) => machineDisplayTitle(item));
  const confidenceTone = brief.confidenceLevel === "high" ? "Strong signal" : brief.confidenceLevel === "medium" ? "Developing signal" : "Early signal";
  const savedAt = formatSavedSessionTimestamp(brief.updatedAt || brief.createdAt);
  const machineId = discoveryMachineIndex.get(brief.machineSlug)?.id || "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Decision Brief",
        "Your first-pin decision is now translated into a clear, persistent action plan.",
        100,
        "Plan saved"
      )}
      <article class="panel">
        <p class="eyebrow">Current front-runner</p>
        <h3>${displayTitle}</h3>
        <p class="muted">${savedAt ? `Last updated ${savedAt}.` : "Saved in this session."}</p>
        <div class="badge-row">
          <span class="badge">${confidenceTone}</span>
          <span class="badge">${brief.readinessLabel || "Readiness pending"}</span>
        </div>
        ${brief.readinessReason ? `<p class="muted"><strong>Readiness summary:</strong> ${brief.readinessReason}</p>` : ""}
      </article>

      <article class="panel">
        <h3>Why this fits you</h3>
        <ul class="result-list">
          ${(brief.whyItFits || []).map((item) => `<li>${item}</li>`).join("") || "<li>Based on your guided reactions and practical constraints.</li>"}
        </ul>
      </article>

      ${(brief.refinementInsights || []).length ? `
        <article class="panel">
          <h3>What your feedback consistently pointed toward</h3>
          <ul class="result-list">
            ${(brief.refinementInsights || []).map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      ` : ""}

      ${brief.refinementMismatch?.length ? `
        <article class="panel">
          <h3>What still needs validation</h3>
          <p class="muted">${brief.refinementMismatch.join(" and ")} may still be a potential mismatch. A focused play test will confirm.</p>
          ${brief.refinementNextStep ? `<p class="muted"><strong>Best next step:</strong> ${brief.refinementNextStep}</p>` : ""}
        </article>
      ` : ""}

      ${brief.refinementBackupReason ? `
        <article class="panel">
          <h3>Best backup if your top pick falls through</h3>
          <p class="muted">${brief.refinementBackupReason}</p>
        </article>
      ` : ""}

      <article class="panel">
        <h3>Backups you can fall back to</h3>
        <p class="muted">${backupLabels.length ? backupLabels.join(", ") : "No backups saved yet."}</p>
      </article>

      <div class="feature-grid">
        <article class="panel">
          <h3>Completed blockers</h3>
          ${(brief.completedBlockers || []).length
            ? `<ul class="result-list">${brief.completedBlockers.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : `<p class="muted">No required checks marked complete yet.</p>`
          }
        </article>
        <article class="panel">
          <h3>Outstanding blockers</h3>
          ${(brief.outstandingBlockers || []).length
            ? `<ul class="result-list">${brief.outstandingBlockers.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : `<p class="muted">No outstanding blockers. You are clear to proceed.</p>`
          }
        </article>
      </div>

      <article class="panel">
        <h3>Exact next 3 actions</h3>
        <ol class="steps">
          ${(brief.nextActions || []).slice(0, 3).map((item) => `<li>${item}</li>`).join("")}
        </ol>
        <div class="card-actions">
          ${brief.links?.machineDetail ? `<a class="btn btn-secondary" href="${brief.links.machineDetail}">View machine detail</a>` : ""}
          ${brief.links?.market ? `<a class="btn btn-secondary" href="${buildAffiliateUrl(brief.links.market, { machineSlug: brief.machineSlug, placement: "decision-brief" })}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Open used listings" data-outbound-slug="${brief.machineSlug ?? ""}" data-outbound-placement="decision-brief">Open used listings</a>` : ""}
          ${brief.links?.compare ? `<a class="btn btn-secondary" href="${brief.links.compare}">Compare backups</a>` : ""}
          ${machineId ? `<button class="btn btn-primary" type="button" data-action="open-sourcing:${machineId}">Continue buying plan</button>` : `<button class="btn btn-primary" type="button" data-action="back-to-results">Back to shortlist</button>`}
        </div>
      </article>
    </section>
  `;
}

function viewportResetKey() {
  if (state.screen === "sourcing") {
    const machine = sourcingMachine();
    const plan = currentPlanState(machine?.id);
    return `sourcing:${machine?.id || ""}:${plan?.currentPlanStep || 0}`;
  }
  return state.screen;
}

function scrollToDiscoverySectionStart() {
  const section = root?.closest(".section");
  const target = section || root;
  if (!target) return;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - STICKY_HEADER_OFFSET);
  window.scrollTo({ top, behavior: "smooth" });
}

function render() {
  if (!root) return;
  root.querySelector("#pivot-details-sheet")?.remove();

  let view = renderEntryScreen();
  if (state.screen === "discovery-setup") view = renderDiscoverySetup();
  if (state.screen === "calibration-setup") view = renderCalibrationSetup();
  if (state.screen === "budget-check") view = renderBudgetCheck();
  if (state.screen === "taste-profile") view = renderTasteProfile();
  if (state.screen === "taste-pivot") view = renderTastePivot();
  if (state.screen === "taste-reveal") view = renderTasteProfileReveal();
  if (state.screen === "taste-played-machines") view = renderTastePlayedMachines();
  if (state.screen === "narrow-to-one") view = renderNarrowToOne();
  if (state.screen === "bracket") view = renderBracket();
  if (state.screen === "bracket-nearby") view = renderBracketNearby();
  if (state.screen === "discovery-round") view = renderDiscoveryRound();
  if (state.screen === "calibration-round") view = renderCalibrationRound();
  if (state.screen === "reflection") view = renderPreferenceReflection();
  if (state.screen === "results") view = renderResults();
  if (state.screen === "video-refinement") view = renderVideoRefinement();
  if (state.screen === "nearby-test") view = renderNearbyTestPlan();
  if (state.screen === "post-play-feedback") view = renderPostPlayFeedback();
  if (state.screen === "external-feedback") view = renderExternalFeedback();
  if (state.screen === "finals") view = renderFinals();
  if (state.screen === "sourcing") view = renderSourcingForm();
  if (state.screen === "decision-brief") view = renderDecisionBrief();

  root.innerHTML = `${view}${renderNearestMachineModal()}${renderWhatCountsModal()}${renderVideoModal(state.activeVideo)}`;
  attachCompareButtons(root);
  attachImageFallbacks(root);
  persistDiscoveryState();

  // Hero section: SPA owns the visible entry — always hide it to prevent layout offset
  document.querySelector(".hero-discovery")?.setAttribute("hidden", "");
  // Optional support: only relevant before the user has a shortlist
  const onEntry = state.screen === "entry";
  document.getElementById("extra-help")?.toggleAttribute("hidden", !onEntry);
  decisionBarController?.render();

  if (state.screen === "discovery-round" || state.screen === "calibration-round") {
    requestAnimationFrame(() => {
      root.querySelector(".reaction-btn")?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }

  if (state.screen === "results" && state.screen !== lastTrackedScreen) {
    setTimeout(() => {
      root.querySelector(".results-next-step")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }

  const nextViewportKey = viewportResetKey();
  if (nextViewportKey !== lastViewportKey) {
    // "results" has its own scroll logic (scrollIntoView on results-next-step)
    if (state.screen !== "results") scrollToDiscoverySectionStart();
    lastViewportKey = nextViewportKey;
  }

  if (state.screen !== lastTrackedScreen) {
    if (state.screen === "reflection") {
      const recommendationState = currentRecommendationState();
      trackAnalytics(ANALYTICS_EVENTS.REFLECTION_VIEWED, {
        signal_level: recommendationState.confidence.level === "high" ? "strong" : recommendationState.confidence.level === "medium" ? "developing" : "early",
        candidate_count: recommendationState.recommendations.length
      });
    }
    lastTrackedScreen = state.screen;
  }

  if (state.screen === "results") {
    const confidenceLevel = currentRecommendationState().confidence.level;
    if (confidenceLevel !== lastTrackedResultsConfidence) {
      const decisionState = loadDecisionState();
      const recommendations = currentRecommendations();
      trackAnalytics(ANALYTICS_EVENTS.RESULTS_VIEWED, {
        candidate_count: recommendations.length,
        strength_band: confidenceLevel === "high" ? "strong" : confidenceLevel === "medium" ? "developing" : "early",
        front_runner_present: Boolean(decisionState.frontRunnerSlug)
      });
      lastTrackedResultsConfidence = confidenceLevel;
    }
  } else {
    lastTrackedResultsConfidence = "";
  }
}

function resetDraft() {
  state.draft = defaultDraft();
}

async function preloadNearbyContext() {
  const zip = state.context.zip.trim();
  const maxMiles = defaultRadiusForTravel(state.context.travelWillingness);

  state.locationSearch = {
    ...state.locationSearch,
    zip,
    maxMiles
  };

  if (zip.length !== 5) {
    return;
  }

  try {
    const locations = await findNearbyLocations({ zip, maxMiles });
    const machineLocationIndex = buildMachineLocationIndex(locations);
    const recommendations = currentRecommendations();

    state.locationSearch = {
      zip,
      maxMiles,
      locations,
      hasSearched: true,
      error: "",
      machineLocationIndex
    };
    state.nearbySuggestions = buildTasteProbeSuggestions(recommendations, state.context, machineLocationIndex);
    state.nearbyCatalogSuggestions = buildNearbyCatalogSuggestions(recommendations, machineLocationIndex);
    state.nearbyExternalSuggestions = buildNearbyExternalMachineSuggestions(locations);
  } catch (error) {
    state.locationSearch = {
      zip,
      maxMiles,
      locations: [],
      hasSearched: true,
      error: error instanceof Error ? error.message : "Live Pinball Map search failed.",
      machineLocationIndex: new Map()
    };
    state.nearbySuggestions = [];
    state.nearbyCatalogSuggestions = [];
    state.nearbyExternalSuggestions = [];
  }
}

function startTasteProfile(mode) {
  state.mode = mode;
  state.screen = "taste-profile";
  render();
}

async function beginReactions() {
  if (state.mode === "calibration") {
    state.deck = state.selectedPlayedMachines.map((id) => discoveryMachineIndex.get(id)).filter(Boolean);
  } else {
    state.deck = buildReactionDeck(currentContext(), 6);
  }
  state.deckIndex = 0;
  state.reactions = [];
  resetDraft();
  await preloadNearbyContext();
  state.screen = state.mode === "calibration" ? "calibration-round" : "discovery-round";
  trackAnalytics(ANALYTICS_EVENTS.GUARDRAILS_COMPLETED, {
    budget_present: Boolean(state.context.budget),
    path_known: state.context.condition === "new" || state.context.condition === "used",
    zip_present: Boolean(state.context.zip?.trim().length === 5),
    timeline_present: Boolean(state.context.timeline)
  });
  render();
}

async function advanceReaction(rawReaction) {
  const machine = currentMachine();
  if (!machine) return;

  state.reactions.push({
    machineId: machine.id,
    reaction: normalizeReaction(rawReaction),
    source: state.mode === "calibration" ? "played-before" : "video-preview",
    weight: state.mode === "calibration" ? 1.35 : 1,
    experienceType: state.mode === "calibration" ? "played" : "preview",
    likedAspect: state.draft.likedAspect,
    concern: state.draft.concern
  });
  trackAnalytics(ANALYTICS_EVENTS.REACTION_SELECTED, {
    machine_slug: machine.slug,
    reaction_type: normalizeReaction(rawReaction),
    step_index: state.deckIndex + 1
  });

  if (state.deckIndex >= state.deck.length - 1) {
    if (!state.locationSearch.hasSearched && state.context.zip?.trim().length === 5) {
      await preloadNearbyContext();
    }
    const nextTasteScreen = state.context.budget ? "taste-pivot" : "budget-check";
    state.screen = state.mode === "calibration" ? "results" : nextTasteScreen;
    if (state.mode !== "calibration") {
      state.tastePivotIndex = 0;
      state.tasteScores = defaultTasteScores();
    }
    trackAnalytics(ANALYTICS_EVENTS.DISCOVERY_COMPLETED, {
      candidate_count: currentRecommendations().length,
      has_zip: Boolean(state.context.zip?.trim().length === 5),
      play_access: state.context.playAccess || ""
    });
  } else {
    state.deckIndex += 1;
  }

  resetDraft();
  render();
}

function openNearbyPlan() {
  clearTransientUiState({ clearMoreActions: true });
  state.screen = "nearby-test";
  render();
}

async function searchNearbyLocations(form) {
  const formData = new FormData(form);
  const zip = String(formData.get("zip") || "").trim();
  const maxMiles = String(formData.get("maxMiles") || "50");
  state.context.zip = zip;

  try {
    const locations = await findNearbyLocations({ zip, maxMiles });
    const machineLocationIndex = buildMachineLocationIndex(locations);
    const bracketFinalIds = getBracketFinalThree();
    const recommendations = bracketFinalIds.length > 0
      ? bracketFinalIds.map((id) => discoveryMachineIndex.get(id)).filter(Boolean)
      : currentRecommendations();

    state.locationSearch = {
      zip,
      maxMiles,
      locations,
      hasSearched: true,
      error: "",
      machineLocationIndex
    };
    const allSuggestions = buildTasteProbeSuggestions(recommendations, state.context, machineLocationIndex);
    const bracketFinalSet = new Set(bracketFinalIds);
    state.nearbySuggestions = bracketFinalSet.size > 0
      ? allSuggestions.filter((s) => !bracketFinalSet.has(s.machineId) || s.targetIds.includes(s.machineId))
      : allSuggestions;
    state.nearbyCatalogSuggestions = buildNearbyCatalogSuggestions(recommendations, machineLocationIndex);
    state.nearbyExternalSuggestions = buildNearbyExternalMachineSuggestions(locations);
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live Pinball Map search failed.";
    state.locationSearch = {
      zip,
      maxMiles,
      locations: [],
      hasSearched: true,
      error: message,
      machineLocationIndex: new Map()
    };
    state.nearbySuggestions = [];
    state.nearbyCatalogSuggestions = [];
    state.nearbyExternalSuggestions = [];
    showSiteMessage(message, "warning");
    render();
  }
}

function submitPostPlayFeedback() {
  const probe = probeById();
  if (!probe) return;
  const traitSignals = probe.probeType === "proxy" ? traitSignalsFromProxyAnswers(probe) : {};

  state.reactions.push({
    machineId: probe.machineId,
    reaction: normalizeReaction(state.draft.enjoyment),
    source: probe.probeType === "exact" ? "real-play-exact" : probe.probeType === "proxy" ? "real-play-proxy" : "real-play-nearby",
    weight: probe.probeType === "exact" ? 2.5 : probe.probeType === "proxy" ? 1.8 : 1.5,
    experienceType: "played",
    likedAspect: state.draft.fun,
    concern: state.draft.friction === "none" ? "just-right" : state.draft.friction === "too-hard" ? "too-complex" : state.draft.friction === "too-easy" ? "too-simple" : state.draft.friction,
    replay: state.draft.replay,
    traitSignals,
    notes: state.draft.notes || ""
  });

  state.lastRefinementSummary = buildShortlistChangeSummary(state.refinementBaseline, currentRecommendations());
  if (state.lastRefinementSummary?.changed) {
    trackAnalytics(ANALYTICS_EVENTS.REFINEMENT_RECO_CHANGED, {
      source: state.lastRefinementSummary.source,
      from_top: state.lastRefinementSummary.fromTop || "",
      to_top: state.lastRefinementSummary.toTop || ""
    });
  }
  state.refinementBaseline = null;
  resetDraft();
  state.screen = "results";
  syncDecisionStateFromRecommendations("", "help_post_play_refine");
  trackEvent("post_play_feedback_submit", { machineId: probe.machineId, probeType: probe.probeType });
  render();
}

function submitVideoRefinement() {
  state.lastRefinementSummary = buildShortlistChangeSummary(state.refinementBaseline, currentRecommendations());
  if (state.lastRefinementSummary?.changed) {
    trackAnalytics(ANALYTICS_EVENTS.REFINEMENT_RECO_CHANGED, {
      source: state.lastRefinementSummary.source,
      from_top: state.lastRefinementSummary.fromTop || "",
      to_top: state.lastRefinementSummary.toTop || ""
    });
  }
  state.refinementBaseline = null;
  state.screen = "results";
  syncDecisionStateFromRecommendations("", "help_video_refine");
  trackAnalytics(ANALYTICS_EVENTS.VIDEO_REFINEMENT_SUBMITTED, {
    candidate_count: Object.keys(state.videoFeedback || {}).length
  });
  render();
}

function openExternalFeedback(machineName = "", returnScreen = "nearby-test") {
  captureRefinementBaseline("external");
  state.externalDraft = {
    ...defaultExternalDraft(),
    machineName,
    returnScreen
  };
  state.screen = "external-feedback";
  render();
}

function submitExternalFeedback() {
  const draft = state.externalDraft;
  if (!draft.machineName || !draft.reaction) {
    showSiteMessage("Add the machine name and a quick reaction to save this.", "warning");
    return;
  }
  state.externalFeedback = [
    ...(state.externalFeedback || []),
    {
      machineName: draft.machineName,
      reaction: draft.reaction,
      liked: draft.liked || [],
      disliked: draft.disliked || [],
      notes: draft.notes || "",
      loggedAt: new Date().toISOString()
    }
  ];
  state.externalDraft = defaultExternalDraft();
  state.lastRefinementSummary = buildShortlistChangeSummary(state.refinementBaseline, currentRecommendations());
  if (state.lastRefinementSummary?.changed) {
    trackAnalytics(ANALYTICS_EVENTS.REFINEMENT_RECO_CHANGED, {
      source: state.lastRefinementSummary.source,
      from_top: state.lastRefinementSummary.fromTop || "",
      to_top: state.lastRefinementSummary.toTop || ""
    });
  }
  state.refinementBaseline = null;
  state.screen = draft.returnScreen || "nearby-test";
  syncDecisionStateFromRecommendations("", "help_external_feedback");
  trackAnalytics(ANALYTICS_EVENTS.EXTERNAL_FEEDBACK_SUBMITTED, { machine_name: draft.machineName || "" });
  render();
}

root?.addEventListener("click", (event) => {
  const entry = event.target.closest("[data-entry]")?.dataset.entry;
  if (entry) {
    state.context.playedBefore = entry;
    state.context.firstPin = entry === "yes" ? "kind-of" : "yes";
    if (entry === "yes") {
      state.screen = "calibration-setup";
      render();
    } else {
      state.mode = "discovery";
      state.tastePivotIndex = 0;
      state.tasteScores = defaultTasteScores();
      state.screen = "taste-pivot";
      render();
    }
    return;
  }

  const contextChoice = event.target.closest("[data-context-choice]")?.dataset.contextChoice;
  if (contextChoice) {
    const [key, value] = contextChoice.split(":");
    state.context[key] = value;
    if (key === "travelWillingness") {
      state.locationSearch.maxMiles = defaultRadiusForTravel(value);
    }
    if (state.screen === "budget-check" && key === "budget") {
      state.tastePivotIndex = 0;
      state.tasteScores = defaultTasteScores();
      state.screen = "taste-pivot";
    }
    render();
    return;
  }

  const tasteChoice = event.target.closest("[data-taste-choice]")?.dataset.tasteChoice;
  if (tasteChoice) {
    const [promptId, value] = tasteChoice.split(":");
    state.tasteAnswers = { ...state.tasteAnswers, [promptId]: value };
    const prompt = discoveryTastePrompts.find((item) => item.id === promptId);
    const option = prompt?.options.find((item) => item.value === value);
    if (option?.context) {
      state.context = { ...state.context, ...option.context };
    }
    render();
    return;
  }

  const draftChoice = event.target.closest("[data-draft-choice]")?.dataset.draftChoice;
  if (draftChoice) {
    const [key, value] = draftChoice.split(":");
    state.draft[key] = state.draft[key] === value ? "" : value;
    render();
    return;
  }

  const videoReaction = event.target.closest("[data-video-reaction]")?.dataset.videoReaction;
  if (videoReaction) {
    const [machineId, value] = videoReaction.split(":");
    const current = videoFeedbackFor(machineId);
    state.videoFeedback = {
      ...state.videoFeedback,
      [machineId]: {
        ...current,
        reaction: current.reaction === value ? "" : value
      }
    };
    render();
    return;
  }

  const videoChoice = event.target.closest("[data-video-choice]")?.dataset.videoChoice;
  if (videoChoice) {
    const [machineId, key, value] = videoChoice.split(":");
    const current = videoFeedbackFor(machineId);
    state.videoFeedback = {
      ...state.videoFeedback,
      [machineId]: {
        ...current,
        [key]: toggleSelection(current[key] || [], value, 2)
      }
    };
    render();
    return;
  }

  const externalChoice = event.target.closest("[data-external-choice]")?.dataset.externalChoice;
  if (externalChoice) {
    const [, key, value] = externalChoice.split(":");
    state.externalDraft = {
      ...state.externalDraft,
      [key]: toggleSelection(state.externalDraft[key] || [], value, 2)
    };
    render();
    return;
  }

  const externalReaction = event.target.closest("[data-external-reaction]")?.dataset.externalReaction;
  if (externalReaction) {
    state.externalDraft = {
      ...state.externalDraft,
      reaction: state.externalDraft.reaction === externalReaction ? "" : externalReaction
    };
    render();
    return;
  }

  const finalsChoice = event.target.closest("[data-finals-choice]")?.dataset.finalsChoice;
  if (finalsChoice) {
    const [key, value] = finalsChoice.split(":");
    state.finals = {
      ...state.finals,
      [key]: state.finals[key] === value ? "" : value
    };
    render();
    return;
  }

  const playedToggle = event.target.closest("[data-toggle-played]")?.dataset.togglePlayed;
  if (playedToggle) {
    state.selectedPlayedMachines = state.selectedPlayedMachines.includes(playedToggle)
      ? state.selectedPlayedMachines.filter((id) => id !== playedToggle)
      : [...state.selectedPlayedMachines, playedToggle];
    render();
    return;
  }

  const videoButton = event.target.closest("[data-video-url]");
  if (videoButton) {
    state.activeVideo = {
      url: videoButton.dataset.videoUrl,
      title: videoButton.dataset.videoTitle || "Pinball video"
    };
    render();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  const confidenceStep = event.target.closest("[data-confidence-step]")?.dataset.confidenceStep;
  if (confidenceStep && action) {
    const confidenceLevel = currentRecommendationState().confidence.level;
    trackAnalytics(ANALYTICS_EVENTS.PRIMARY_NEXT_STEP_CLICKED, {
      cta_id: confidenceStep,
      machine_slug: currentRecommendations()[0]?.slug || "",
      strength_band: confidenceLevel === "high" ? "strong" : confidenceLevel === "medium" ? "developing" : "early"
    });
  }
  if (action === "resume-saved") {
    const route = resolveInitialHelpRoute({
      decisionState: loadDecisionState(),
      savedSession: loadPersistedDiscoveryState(),
      params: new URLSearchParams("resume=1")
    });
    if (route === "default") return;
    trackAnalytics(ANALYTICS_EVENTS.RESUME_BANNER_CLICKED, {
      state_type: route === "brief" ? "decision_brief" : route === "sourcing" ? "decision_state" : "saved_session",
      screen: state.screen
    });
    render();
    return;
  }

  const compareLink = event.target.closest('a[href="compare.html"]');
  if (compareLink && state.screen === "results") {
    const decisionState = loadDecisionState();
    trackAnalytics(ANALYTICS_EVENTS.COMPARE_FROM_RESULTS, {
      machine_slug: decisionState.frontRunnerSlug || currentRecommendations()[0]?.slug || "",
      backup_count: Array.isArray(decisionState.backupSlugs) ? decisionState.backupSlugs.length : 0
    });
  }
  if (action === "discard-saved") {
    clearPersistedDiscoveryState();
    clearCompareContext();
    clearDecisionState();
    state.compareContext = null;
    state.hasSavedSession = false;
    state.savedSessionUpdatedAt = "";
    clearTransientUiState();
    state.screen = "entry";
    render();
    return;
  }
  if (action === "start-discovery") {
    trackAnalytics(ANALYTICS_EVENTS.START_DISCOVERY_CLICKED, {
      source: "help_entry_discovery",
      session_mode: deriveSessionMode(loadDecisionState())
    });
    state.mode = "discovery";
    return void beginReactions();
  }
  if (action === "start-calibration") {
    trackAnalytics(ANALYTICS_EVENTS.START_DISCOVERY_CLICKED, {
      source: "help_entry_calibration",
      session_mode: deriveSessionMode(loadDecisionState())
    });
    return void startTasteProfile("calibration");
  }
  if (action === "begin-reactions") return void beginReactions();
  if (action === "submit-taste") {
    state.screen = "results";
    render();
    return;
  }
  if (action?.startsWith("taste-pivot-pick:")) {
    const [, indexStr, side] = action.split(":");
    const pairIndex = parseInt(indexStr, 10);
    const pair = TASTE_PIVOT_PAIRS[pairIndex];
    if (!pair) return;
    const chosen = side === "left" ? pair.left : pair.right;
    const newScores = { ...state.tasteScores };
    for (const [dim, delta] of Object.entries(chosen.scores)) {
      newScores[dim] = (newScores[dim] || 0) + delta;
    }
    state.tasteScores = newScores;
    state.tasteAnswers = deriveTasteAnswers(newScores);
    state.tastePivotIndex = pairIndex + 1;
    if (state.tastePivotIndex >= TASTE_PIVOT_PAIRS.length) {
      state.screen = "taste-reveal";
      syncDecisionStateFromRecommendations("", "help_taste_pivot");
    }
    render();
    return;
  }
  if (action?.startsWith("taste-pivot-details:")) {
    const [, indexStr, side] = action.split(":");
    const pairIndex = parseInt(indexStr, 10);
    const pair = TASTE_PIVOT_PAIRS[pairIndex];
    if (!pair) return;
    const sideData = side === "left" ? pair.left : pair.right;
    const machine = side === "left"
      ? discoveryMachineIndex.get(pair.left.machineId)
      : discoveryMachineIndex.get(pair.right.machineId);
    if (!machine) return;

    // Find the best-matched played machine via component overlap and build a connection note.
    const playedSlugs = state.selectedPlayedMachines
      .map((id) => discoveryMachineIndex.get(id)?.slug)
      .filter(Boolean);
    let connectionNote = "";
    if (playedSlugs.length > 0) {
      let bestReason = null;
      let bestSlug = null;
      for (const playedSlug of playedSlugs) {
        const reason = componentConnectionReason(playedSlug, machine.slug);
        if (reason && !bestReason) { bestReason = reason; bestSlug = playedSlug; }
      }
      if (bestReason && bestSlug) {
        const playedMachine = discoveryMachineIndex.get(
          state.selectedPlayedMachines.find((id) => discoveryMachineIndex.get(id)?.slug === bestSlug) || ""
        );
        const playedTitle = playedMachine ? machineDisplayTitle(playedMachine) : bestSlug;
        connectionNote = `<p class="pivot-connection-note"><strong>Connects to ${playedTitle}:</strong> shares ${bestReason}.</p>`;
      }
    }

    root.querySelector("#pivot-details-sheet")?.remove();
    const el = document.createElement("div");
    el.id = "pivot-details-sheet";
    el.className = "modal-backdrop what-counts-backdrop";
    el.innerHTML = `
      <div class="modal-panel what-counts-sheet" role="dialog" aria-modal="true">
        <p class="eyebrow">Why this machine?</p>
        <h3 style="margin:.2rem 0 .85rem">${machineDisplayTitle(machine)}</h3>
        ${connectionNote}
        <ul class="taste-pivot-details taste-pivot-details--sheet">
          ${sideData.details.map((d) => `<li>${d}</li>`).join("")}
        </ul>
        <div class="card-actions" style="margin-top:1.25rem">
          <button class="btn btn-primary" type="button" data-action="taste-pivot-pick:${pairIndex}:${side}">This sounds like me</button>
          <button class="btn btn-secondary" type="button" data-action="pivot-sheet-close">Back</button>
        </div>
      </div>`;
    el.addEventListener("click", (e) => { if (e.target === el) el.remove(); });
    root.appendChild(el);
    return;
  }
  if (action === "pivot-sheet-close") {
    root.querySelector("#pivot-details-sheet")?.remove();
    return;
  }
  if (action === "taste-continue") {
    state.tastePivotIndex = 0;
    state.revalSignal = "";
    state.screen = "taste-pivot";
    render();
    return;
  }
  if (action === "taste-track-played") {
    const snapRecs = recommendMachines(currentContext(), [], 3, { machineLocationIndex: state.locationSearch.machineLocationIndex });
    state.preLogRecsSnapshot = snapRecs.map((m) => m.id);
    state.screen = "taste-played-machines";
    render();
    return;
  }
  if (action === "taste-played-done") {
    const afterRecs = recommendMachines(currentContext(), [], 3, { machineLocationIndex: state.locationSearch.machineLocationIndex });
    const newIds = afterRecs.map((m) => m.id);
    const oldIds = state.preLogRecsSnapshot || [];
    const topChanged = newIds[0] && oldIds[0] && newIds[0] !== oldIds[0];
    const anyShifted = newIds.some((id, i) => id !== oldIds[i]);
    state.revalSignal = topChanged ? "major" : anyShifted ? "minor" : "";
    state.screen = "taste-reveal";
    render();
    return;
  }
  if (action === "reval-dismiss") {
    state.revalSignal = "";
    render();
    return;
  }
  if (action === "taste-rebuild") {
    state.tastePivotIndex = 0;
    state.tasteScores = defaultTasteScores();
    state.tasteAnswers = {};
    state.screen = "taste-pivot";
    render();
    return;
  }
  if (action === "start-narrowing") {
    const recs = recommendMachines(currentContext(), [], 3, {
      machineLocationIndex: state.locationSearch.machineLocationIndex
    });
    if (recs.length === 0) return;
    state.narrowCandidates = recs.map((m) => m.id);
    state.narrowRound = 0;
    state.narrowWinner = "";
    if (recs.length === 1) {
      state.sourcingMachineId = recs[0].id;
      syncDecisionStateFromRecommendations(recs[0].id, "help_narrow_to_one");
      initializePlanForMachine(recs[0].id);
      state.screen = "sourcing";
    } else {
      state.screen = "narrow-to-one";
    }
    render();
    return;
  }
  if (action?.startsWith("narrow-pick:")) {
    const pickedId = action.split(":")[1];
    const candidates = state.narrowCandidates || [];
    const round = state.narrowRound || 0;
    const totalRounds = candidates.length >= 3 ? 2 : 1;
    if (round >= totalRounds - 1) {
      state.sourcingMachineId = pickedId;
      syncDecisionStateFromRecommendations(pickedId, "help_narrow_to_one");
      initializePlanForMachine(pickedId);
      state.screen = "sourcing";
    } else {
      state.narrowWinner = pickedId;
      state.narrowRound = round + 1;
      state.screen = "narrow-to-one";
    }
    render();
    return;
  }
  if (action === "start-bracket") {
    const recs = recommendMachines(currentContext(), [], 8, {
      machineLocationIndex: state.locationSearch.machineLocationIndex
    });
    if (recs.length < 2) return;
    const seedCount = recs.length >= 8 ? 8 : recs.length >= 4 ? 4 : 2;
    const maxRounds = Math.log2(seedCount);
    state.bracketSeeds = recs.slice(0, seedCount).map((m) => m.id);
    state.bracketRound = 0;
    state.bracketMatchIndex = 0;
    state.bracketFactor = 0;
    state.bracketLeftWins = 0;
    state.bracketRightWins = 0;
    state.bracketWinners = Array.from({ length: maxRounds }, () => []);
    state.bracketMatchWon = "";
    state.bracketMatchScore = "";
    state.revalSignal = "";
    state.screen = "bracket";
    render();
    return;
  }
  if (action?.startsWith("bracket-pick:")) {
    const pickedId = action.split(":")[1];
    const [leftId, rightId] = bracketCurrentPair();
    const isLeft = pickedId === leftId;
    const newLeft = isLeft ? state.bracketLeftWins + 1 : state.bracketLeftWins;
    const newRight = !isLeft ? state.bracketRightWins + 1 : state.bracketRightWins;
    if (newLeft >= 2 || newRight >= 2) {
      const winnerId = newLeft >= 2 ? leftId : rightId;
      const newRoundWinners = [...(state.bracketWinners[state.bracketRound] || []), winnerId];
      state.bracketWinners = state.bracketWinners.map((r, i) => i === state.bracketRound ? newRoundWinners : r);
      state.bracketMatchWon = winnerId;
      state.bracketMatchScore = `${newLeft}–${newRight}`;
      state.bracketLeftWins = newLeft;
      state.bracketRightWins = newRight;
    } else {
      state.bracketFactor += 1;
      state.bracketLeftWins = newLeft;
      state.bracketRightWins = newRight;
    }
    render();
    return;
  }
  if (action === "bracket-next-match") {
    const round = state.bracketRound;
    const matchCount = bracketMatchCount(round);
    const completed = (state.bracketWinners[round] || []).length;
    const isFinalRound = round === state.bracketWinners.length - 1;
    if (isFinalRound && completed >= matchCount) {
      const championId = state.bracketMatchWon;
      state.sourcingMachineId = championId;
      syncDecisionStateFromRecommendations(championId, "help_bracket_champion");
      initializePlanForMachine(championId);
      state.bracketMatchWon = "";
      state.screen = "bracket-nearby";
    } else {
      state.bracketMatchWon = "";
      state.bracketFactor = 0;
      state.bracketLeftWins = 0;
      state.bracketRightWins = 0;
      if (completed >= matchCount) {
        state.bracketRound = round + 1;
        state.bracketMatchIndex = 0;
      } else {
        state.bracketMatchIndex = completed;
      }
    }
    render();
    return;
  }
  if (action === "back-to-profile") {
    state.screen = "taste-reveal";
    render();
    return;
  }
  if (action === "bracket-nearby-buy") {
    state.screen = "sourcing";
    render();
    return;
  }
  if (action?.startsWith("bracket-budget-set:")) {
    state.bracketBudget = action.split(":")[1] || "";
    render();
    return;
  }
  if (action === "bracket-skip-budget") {
    state.bracketBudget = "flexible";
    render();
    return;
  }
  if (action === "taste-toggle-owned") {
    const ownedToggle = el?.dataset?.ownedToggle || "";
    if (!ownedToggle) return;
    state.ownedMachines = state.ownedMachines.includes(ownedToggle)
      ? state.ownedMachines.filter((id) => id !== ownedToggle)
      : [...state.ownedMachines, ownedToggle];
    render();
    return;
  }
  if (action === "plan-keep-pick") {
    const machine = sourcingMachine();
    const plan = currentPlanState();
    if (machine && plan) {
      trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, {
        machine_slug: machine.slug,
        step_id: "step_1_working_pick",
        path_type: derivePathType(plan.selectedPathType)
      });
    }
    updateCurrentPlanState({ workingPickConfirmed: true, currentPlanStep: 2 });
    clearTransientUiState({ clearWhatCounts: false });
    render();
    return;
  }
  if (action === "plan-next-step") {
    const plan = currentPlanState();
    if (!plan) return;
    const machine = sourcingMachine();
    if (machine) {
      trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, {
        machine_slug: machine.slug,
        step_id: `step_${plan.currentPlanStep}`,
        path_type: derivePathType(plan.selectedPathType)
      });
    }
    updateCurrentPlanState({ currentPlanStep: Math.min(4, plan.currentPlanStep + 1) });
    clearTransientUiState({ clearWhatCounts: false });
    render();
    return;
  }
  if (action === "plan-prev-step") {
    const plan = currentPlanState();
    if (!plan) return;
    updateCurrentPlanState({ currentPlanStep: Math.max(1, plan.currentPlanStep - 1) });
    clearTransientUiState({ clearWhatCounts: false });
    render();
    return;
  }
  if (action === "plan-finish") {
    const machine = sourcingMachine();
    const plan = currentPlanState();
    if (machine && plan) {
      trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, {
        machine_slug: machine.slug,
        step_id: "step_4_next_actions",
        path_type: derivePathType(plan.selectedPathType)
      });
    }
    updateCurrentPlanState({ currentPlanStep: 4 });
    const decisionBrief = buildDecisionBriefFromCurrentPlan();
    if (decisionBrief) {
      saveDecisionState({ decisionBrief });
    }
    if (hasRefinementEvidence()) {
      trackAnalytics(ANALYTICS_EVENTS.DECISION_BRIEF_AFTER_REFINEMENT, {
        machine_slug: machine?.slug || ""
      });
    }
    showSiteMessage("Decision Brief saved. You can resume from this action plan anytime.");
    state.screen = "decision-brief";
    clearTransientUiState();
    render();
    return;
  }
  if (action === "open-decision-brief") {
    if (!hasUsableDecisionBrief(loadDecisionState())) {
      showSiteMessage("No current Decision Brief. Finish your buying plan first.", "warning");
      return;
    }
    state.screen = "decision-brief";
    if (hasRefinementEvidence()) {
      trackAnalytics(ANALYTICS_EVENTS.DECISION_BRIEF_AFTER_REFINEMENT, {
        machine_slug: loadDecisionState().decisionBrief?.machineSlug || ""
      });
    }
    clearTransientUiState();
    render();
    return;
  }
  if (action?.startsWith("plan-switch-pick:")) {
    const machineId = action.split(":")[1];
    state.sourcingMachineId = machineId;
    syncDecisionStateFromRecommendations(machineId, "help_plan_switch");
    initializePlanForMachine(machineId);
    clearTransientUiState({ clearWhatCounts: false });
    render();
    return;
  }
  if (action?.startsWith("plan-set-path:")) {
    const pathType = action.split(":")[1];
    const machine = sourcingMachine();
    if (machine) {
      trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, {
        machine_slug: machine.slug,
        step_id: "step_3_path_selected",
        path_type: derivePathType(pathType)
      });
    }
    updateCurrentPlanState({ selectedPathType: pathType, currentPlanStep: 3 });
    clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
    render();
    return;
  }
  if (action?.startsWith("plan-promote-backup:")) {
    const backupSlug = action.split(":")[1];
    const decisionState = loadDecisionState();
    const currentFront = decisionState.frontRunnerSlug;
    if (!backupSlug || !currentFront || backupSlug === currentFront) return;
    const promotedMachine = currentRecommendations().find((machine) => machine.slug === backupSlug) || machineBySlug(backupSlug);
    const nextBackups = [currentFront, ...decisionState.backupSlugs.filter((slug) => slug !== backupSlug && slug !== currentFront)].slice(0, 2);
    saveDecisionState({
      frontRunnerSlug: backupSlug,
      frontRunnerLastChangedAt: new Date().toISOString(),
      backupSlugs: nextBackups,
      temporaryPrimary: false,
      temporaryPrimaryReason: "",
      promotionReasons: ["manual_backup_promotion"]
    });
    if (promotedMachine?.id) {
      state.sourcingMachineId = promotedMachine.id;
      initializePlanForMachine(promotedMachine.id);
    }
    trackAnalytics(ANALYTICS_EVENTS.BACKUP_PROMOTED, {
      from_slug: currentFront,
      to_slug: backupSlug,
      reason_codes: ["manual_backup_promotion"]
    });
    trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, {
      from_slug: currentFront,
      to_slug: backupSlug,
      source: "help_plan"
    });
    showSiteMessage(`${machineDisplayTitle(promotedMachine || { name: backupSlug, title: backupSlug })} is now your front-runner. Your previous machine remains saved with its progress.`);
    render();
    return;
  }
  if (action === "plan-keep-fix") {
    setPlanFocus("required-checks");
    renderAndScrollTo("[data-required-checks]");
    return;
  }
  if (action === "plan-focus-required") {
    setPlanFocus("required-checks");
    renderAndScrollTo("[data-required-checks]");
    return;
  }
  if (action?.startsWith("plan-blocker-primary:")) {
    const blockerId = action.split(":")[1];
    const plan = currentPlanState();
    const current = normalizeCheckStatus(plan?.requiredChecks?.[blockerId]);
    setBlockerStatus(blockerId, current === CHECK_STATUS.COMPLETE ? CHECK_STATUS.PARTIAL : CHECK_STATUS.COMPLETE);
    render();
    return;
  }
  if (action?.startsWith("plan-blocker-status:")) {
    const [, blockerId, nextStatus] = action.split(":");
    setBlockerStatus(blockerId, nextStatus);
    render();
    return;
  }
  if (action?.startsWith("plan-what-counts-open:")) {
    const blockerId = action.split(":")[1];
    state.activeWhatCountsId = blockerId;
    const machine = sourcingMachine();
    const timerKey = `what-counts:${machine?.slug || ""}:${blockerId}`;
    startAnalyticsTimer(timerKey);
    trackAnalytics(ANALYTICS_EVENTS.WHAT_COUNTS_OPENED, {
      blocker_type: blockerId,
      machine_slug: machine?.slug || "",
      screen: "sourcing"
    });
    render();
    return;
  }
  if (action?.startsWith("readiness-action:")) {
    const [, target, blockerId = ""] = action.split(":");
    const cardId = event.target.closest("[data-readiness-card]")?.dataset.readinessCard || "";
    const activeMachine = sourcingMachine();
    trackAnalytics(ANALYTICS_EVENTS.READINESS_CHIP_CLICKED, {
      machine_slug: activeMachine?.slug || "",
      chip_id: cardId || target,
      target_step: target
    });

    if (target === "reactions") {
      state.screen = state.mode === "calibration" ? "calibration-round" : "discovery-round";
      clearTransientUiState({ clearWhatCounts: false });
      render();
      return;
    }
    if (target === "nearby") {
      clearTransientUiState({ clearWhatCounts: false });
      return void openNearbyPlan();
    }
    if (target === "practical-setup") {
      state.screen = state.mode === "calibration" ? "calibration-setup" : "discovery-setup";
      clearTransientUiState({ clearWhatCounts: false });
      render();
      return;
    }
    if (target === "path-step") {
      updateCurrentPlanState({ currentPlanStep: 3 });
      setPlanFocus("path-step");
      clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
      renderAndScrollTo("#plan-path-step");
      return;
    }
    if (target === "required-checks") {
      setPlanFocus(blockerId || "required-checks");
      clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
      renderAndScrollTo(blockerId ? `#required-check-${blockerId}` : "[data-required-checks]");
      return;
    }
    if (target === "fit-risk-step") {
      updateCurrentPlanState({ currentPlanStep: 2 });
      setPlanFocus("fit-risk-step");
      clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
      renderAndScrollTo("#plan-fit-risk-step");
      return;
    }
    if (target === "working-pick-step") {
      updateCurrentPlanState({ currentPlanStep: 1 });
      setPlanFocus("working-pick-step");
      clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
      renderAndScrollTo("#plan-working-pick-step");
      return;
    }
  }
  if (action === "risk-drawer-toggle") {
    state.activeRiskDrawer = !state.activeRiskDrawer;
    render();
    return;
  }
  if (action?.startsWith("risk-banner-cta:")) {
    const [, riskType = "", ctaId = "", target = "required-checks"] = action.split(":");
    const activeMachine = sourcingMachine();
    trackAnalytics(ANALYTICS_EVENTS.RISK_BANNER_CTA_CLICKED, {
      machine_slug: activeMachine?.slug || "",
      risk_type: riskType,
      cta_id: ctaId
    });
    clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
    if (target === "required-checks") {
      setPlanFocus("required-checks");
      renderAndScrollTo("[data-required-checks]");
      return;
    }
    if (target === "fit-risk-step") {
      updateCurrentPlanState({ currentPlanStep: 2 });
      setPlanFocus("fit-risk-step");
      renderAndScrollTo("#plan-fit-risk-step");
      return;
    }
    if (target === "working-pick-step") {
      updateCurrentPlanState({ currentPlanStep: 1 });
      setPlanFocus("working-pick-step");
      renderAndScrollTo("#plan-working-pick-step");
      return;
    }
  }
  if (action === "plan-what-counts-close") {
    const blockerId = state.activeWhatCountsId;
    if (blockerId) {
      const machine = sourcingMachine();
      const durationMs = stopAnalyticsTimer(`what-counts:${machine?.slug || ""}:${blockerId}`);
      trackAnalytics(ANALYTICS_EVENTS.WHAT_COUNTS_CLOSED, {
        blocker_type: blockerId,
        machine_slug: machine?.slug || "",
        screen: "sourcing",
        duration_ms: durationMs
      });
    }
    state.activeWhatCountsId = "";
    render();
    return;
  }
  if (action === "toggle-more-actions") {
    state.moreActionsOpen = !state.moreActionsOpen;
    if (state.moreActionsOpen) {
      trackAnalytics(ANALYTICS_EVENTS.MORE_ACTIONS_OPENED, {
        screen: "results",
        candidate_count: currentRecommendations().length
      });
    }
    render();
    return;
  }
  if (action === "share-profile") {
    const archetype = buildPlayerArchetype(state.tasteScores);
    void shareProfile(archetype);
    return;
  }
  if (action === "show-recommendations") {
    state.screen = "results";
    clearTransientUiState({ clearMoreActions: true, clearWhatCounts: false });
    syncDecisionStateFromRecommendations("", "help_show_recommendations");
    render();
    return;
  }
  if (action === "back-to-reactions") {
    state.screen = state.mode === "calibration" ? "calibration-round" : "discovery-round";
    render();
    return;
  }
  if (action === "back-to-setup") {
    state.screen = state.mode === "calibration" ? "calibration-setup" : "discovery-setup";
    clearTransientUiState({ clearWhatCounts: false });
    render();
    return;
  }
  if (action === "open-nearby") return void openNearbyPlan();
  if (action === "open-video-refinement") {
    captureRefinementBaseline("video");
    trackAnalytics(ANALYTICS_EVENTS.VIDEO_REFINEMENT_OPENED, {
      candidate_count: currentRecommendations().slice(0, 3).length
    });
    state.screen = "video-refinement";
    render();
    return;
  }
  if (action === "submit-video-refinement") return void submitVideoRefinement();
  if (action === "open-finals") {
    trackAnalytics(ANALYTICS_EVENTS.FINALS_OPENED, {
      candidate_count: currentRecommendations().slice(0, 3).length
    });
    state.screen = "finals";
    render();
    return;
  }
  if (action === "cancel-external-feedback") {
    state.screen = state.externalDraft.returnScreen || "nearby-test";
    render();
    return;
  }
  if (action === "submit-external-feedback") return void submitExternalFeedback();
  if (action === "submit-post-play") return void submitPostPlayFeedback();
  if (action === "open-shortlist") {
    state.screen = "results";
    clearTransientUiState({ clearMoreActions: true, clearWhatCounts: false });
    syncDecisionStateFromRecommendations("", "help_open_shortlist");
    render();
    return;
  }
  if (action === "back-to-results") {
    state.screen = "results";
    clearTransientUiState({ clearMoreActions: true });
    resetDraft();
    render();
    return;
  }
  if (action === "close-nearest-modal") {
    if (!state.activeNearestMachineId) return;
    state.activeNearestMachineId = "";
    render();
    return;
  }
  if (action === "close-video-modal") {
    if (!state.activeVideo) return;
    state.activeVideo = null;
    render();
    return;
  }

  if (action?.startsWith("log-play:")) {
    captureRefinementBaseline("played");
    state.activeProbeId = action.split(":")[1];
    state.postPlayReturnScreen = state.screen;
    resetDraft();
    state.screen = "post-play-feedback";
    render();
    return;
  }

  if (action?.startsWith("open-nearest:")) {
    state.activeNearestMachineId = action.split(":")[1];
    render();
    return;
  }

  if (action?.startsWith("open-external-feedback:")) {
    const machineName = action.split(":").slice(1).join(":");
    openExternalFeedback(machineName, state.screen === "nearby-test" ? "nearby-test" : "results");
    return;
  }

  if (action?.startsWith("open-sourcing:")) {
    state.sourcingMachineId = action.split(":")[1];
    const selectedMachine = discoveryMachineIndex.get(state.sourcingMachineId);
    const strength = currentRecommendationState().confidence.level;
    trackAnalytics(ANALYTICS_EVENTS.PRIMARY_NEXT_STEP_CLICKED, {
      cta_id: "open_buying_plan",
      machine_slug: selectedMachine?.slug || "",
      strength_band: strength === "high" ? "strong" : strength === "medium" ? "developing" : "early"
    });
    syncDecisionStateFromRecommendations(state.sourcingMachineId, "help_open_sourcing");
    initializePlanForMachine(state.sourcingMachineId);
    clearTransientUiState({ clearMoreActions: true });
    state.screen = "sourcing";
    render();
    return;
  }

  if (action === "restart") {
    clearPersistedDiscoveryState();
    clearCompareContext();
    clearDecisionState();
    state.screen = "entry";
    state.mode = null;
    state.compareContext = null;
    state.hasSavedSession = false;
    state.savedSessionUpdatedAt = "";
    state.context = defaultContext();
    state.tasteAnswers = defaultTasteAnswers();
    state.selectedPlayedMachines = [];
    state.deck = [];
    state.deckIndex = 0;
    state.reactions = [];
    state.videoFeedback = {};
    state.externalFeedback = [];
    state.externalDraft = defaultExternalDraft();
    state.finals = defaultFinals();
    state.refinementBaseline = null;
    state.lastRefinementSummary = null;
    state.nearbySuggestions = [];
    state.nearbyCatalogSuggestions = [];
    state.nearbyExternalSuggestions = [];
    state.activeNearestMachineId = "";
    state.activeVideo = null;
    state.locationSearch = { zip: "", maxMiles: "50", locations: [], hasSearched: false, error: "", machineLocationIndex: new Map() };
    state.activeProbeId = "";
    state.sourcingMachineId = "";
    state.tastePivotIndex = 0;
    state.tasteScores = defaultTasteScores();
    clearTransientUiState({ clearMoreActions: true });
    resetDraft();
    render();
    return;
  }
  if (action === "save-shortlist") {
    const recommendations = currentRecommendations();
    const saved = recommendations.map((machine) => machine.slug);
    compareStore.set(saved.slice(0, 3));
    updateCompareCount();
    trackEvent("save-shortlist", { source: "discovery-results", count: Math.min(saved.length, 3) });
    showSiteMessage("Shortlist saved to compare. You can resume later.");
    return;
  }
  if (action === "email-shortlist") {
    const recommendationState = currentRecommendationState();
    const framed = framedRecommendations(recommendationState.recommendations, recommendationState.confidence.level);
    const subject = encodeURIComponent("My Pinball Scout shortlist");
    const body = encodeURIComponent(
      `Here are my Pinball Scout recommendations:\n\n${framed.map((item, index) => `${index + 1}. ${item.frame}: ${machineDisplayTitle(item.machine)} (${item.machine.budget_band})`).join("\n")}\n\nBudget: ${budgetLabel(state.context.budget)}\nCondition: ${choiceLabel("condition", state.context.condition)}\nTimeline: ${choiceLabel("timeline", state.context.timeline)}`
    );
    trackEvent("email-shortlist", { source: "discovery-results", count: framed.length });
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    return;
  }

  const reaction = event.target.closest("[data-reaction]")?.dataset.reaction;
  if (reaction) {
    void advanceReaction(reaction);
  }
});

root?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.matches("[data-video-notes]")) {
    const machineId = target.getAttribute("data-video-notes") || "";
    if (!machineId) return;
    const current = videoFeedbackFor(machineId);
    state.videoFeedback = {
      ...state.videoFeedback,
      [machineId]: {
        ...current,
        notes: target.value || ""
      }
    };
    return;
  }

  if (target.matches("[data-external-notes]")) {
    state.externalDraft = {
      ...state.externalDraft,
      notes: target.value || ""
    };
    return;
  }

  if (target.matches("[data-external-name]")) {
    state.externalDraft = {
      ...state.externalDraft,
      machineName: target.value || ""
    };
    return;
  }

  if (target.matches("[data-draft-notes]")) {
    state.draft = {
      ...state.draft,
      notes: target.value || ""
    };
  }
});

root?.addEventListener("submit", (event) => {
  const nearbyForm = event.target.closest("#nearby-search-form");
  if (nearbyForm) {
    event.preventDefault();
    searchNearbyLocations(nearbyForm);
    return;
  }
});

const decisionState = loadDecisionState();
const initialSavedSession = loadPersistedDiscoveryState();
state.hasSavedSession = hasUsableSavedSession(initialSavedSession) || Boolean(decisionState.hasLegacyDiscovery) || hasUsableDecisionBrief(decisionState);
state.savedSessionUpdatedAt = initialSavedSession?.updatedAt || decisionState.decisionBrief?.updatedAt || decisionState.updatedAt || "";
state.compareContext = loadCompareContext();
decisionBarController = initDecisionBar({
  page: "help",
  getViewState: () => ({
    screen: state.screen,
    fallbackCondition: state.context.condition
  }),
  handlers: {
    promoteBackup: (backupSlug) => {
      if (!backupSlug) return;
      const current = loadDecisionState();
      const front = current.frontRunnerSlug;
      if (!front || front === backupSlug) return;
      const nextBackups = [front, ...current.backupSlugs.filter((slug) => slug !== backupSlug && slug !== front)].slice(0, 2);
      saveDecisionState({
        frontRunnerSlug: backupSlug,
        frontRunnerLastChangedAt: new Date().toISOString(),
        backupSlugs: nextBackups,
        temporaryPrimary: false,
        temporaryPrimaryReason: "",
        promotionReasons: ["decision_bar_promotion"]
      });
      const nextMachine = currentRecommendations().find((machine) => machine.slug === backupSlug);
      if (nextMachine?.id) {
        state.sourcingMachineId = nextMachine.id;
        initializePlanForMachine(nextMachine.id);
      }
      trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, {
        from_slug: front,
        to_slug: backupSlug,
        source: "decision_bar"
      });
      showSiteMessage(`${machineDisplayTitle(machineBySlug(backupSlug) || { name: backupSlug, title: backupSlug })} is now your front-runner. Your previous machine remains saved with its progress.`);
      render();
    },
    fixBlockers: () => {
      clearTransientUiState({ clearMoreActions: true });
      openSourcingForFrontRunner({ scrollSelector: "[data-required-checks]" });
    },
    continuePlan: () => {
      clearTransientUiState({ clearMoreActions: true });
      openSourcingForFrontRunner();
    },
    openCompare: () => {
      window.location.href = "compare.html";
    },
    resumeTieBreaker: () => {
      window.location.href = "compare.html";
    },
    reviewBoth: () => {
      window.location.href = "compare.html";
    },
    openBrief: () => {
      if (!loadDecisionState().decisionBrief?.machineSlug) return;
      state.screen = "decision-brief";
      clearTransientUiState();
      render();
    }
  }
});
const initialRoute = resolveInitialHelpRoute({
  decisionState,
  savedSession: initialSavedSession,
  params: pageParams
});
if (pageParams.get("resume") === "1" && initialRoute !== "default") {
  trackAnalytics(ANALYTICS_EVENTS.RESUME_BANNER_CLICKED, {
    state_type: initialRoute === "brief" ? "decision_brief" : initialRoute === "sourcing" ? "decision_state" : "saved_session",
    screen: state.screen
  });
}
render();
updateCompareCount();
attachOutboundTracking();
