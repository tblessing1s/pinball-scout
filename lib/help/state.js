/**
 * Discovery session state — mutable singleton shared across all help/ modules.
 *
 * All screen renders and action handlers read from and write to this object.
 * Persistence and hydration live here; business logic lives in helpers.js.
 */

import { buildMachineLocationIndex } from "../location-discovery.js";
import { discoveryMachineIndex } from "../../data/discovery-machines.js";

// ── Default factories ──────────────────────────────────────────────────────

export const defaultContext = () => ({
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

export const defaultTasteAnswers = () => ({});

export const defaultTasteScores = () => ({
  "learning-curve": 0,
  "pace-feel": 0,
  "theme-pull": 0,
  "challenge": 0,
  "replay": 0,
  "ownership": 0
});

export const defaultDraft = () => ({
  enjoyment: "",
  fun: "",
  likedAspect: "",
  concern: "",
  friction: "",
  replay: "",
  notes: ""
});

export const defaultExternalDraft = () => ({
  machineName: "",
  reaction: "",
  liked: [],
  disliked: [],
  notes: "",
  returnScreen: "nearby-test"
});

export const defaultFinals = () => ({
  mostExciting: "",
  mostReplayable: "",
  bestMatch: ""
});

// ── Session state ──────────────────────────────────────────────────────────

export const state = {
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
  postPlayQueue: [],
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
  preLogRecsSnapshot: [],
  checklistOpen: false
};

// ── Valid screen names ─────────────────────────────────────────────────────

export const VALID_HELP_SCREENS = new Set([
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

// ── Persistence ────────────────────────────────────────────────────────────

const DISCOVERY_STATE_KEY = "pinballScoutDiscoveryStateV2";

export function persistDiscoveryState() {
  try {
    const shouldPersist =
      state.screen !== "entry" ||
      state.reactions.length > 0 ||
      Object.values(state.tasteAnswers).some(Boolean);
    if (!shouldPersist) return;
    state.savedSessionUpdatedAt = new Date().toISOString();
    localStorage.setItem(DISCOVERY_STATE_KEY, JSON.stringify(serializableState()));
  } catch {}
}

export function clearPersistedDiscoveryState() {
  try { localStorage.removeItem(DISCOVERY_STATE_KEY); } catch {}
}

export function loadPersistedDiscoveryState() {
  try {
    const raw = localStorage.getItem(DISCOVERY_STATE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved && typeof saved === "object" ? saved : null;
  } catch { return null; }
}

export function hasUsableSavedSession(saved) {
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

export function applySavedSession(saved) {
  if (!hasUsableSavedSession(saved)) return false;

  const savedScreen = typeof saved.screen === "string" ? saved.screen : "";
  state.screen = VALID_HELP_SCREENS.has(savedScreen) ? savedScreen : "entry";
  state.mode = saved.mode || null;
  state.context = { ...defaultContext(), ...(saved.context || {}) };
  state.tasteAnswers = { ...defaultTasteAnswers(), ...(saved.tasteAnswers || {}) };
  state.selectedPlayedMachines = Array.isArray(saved.selectedPlayedMachines) ? saved.selectedPlayedMachines : [];
  state.deck = Array.isArray(saved.deck)
    ? saved.deck.map((id) => discoveryMachineIndex.get(id)).filter(Boolean)
    : [];
  state.deckIndex = Number.isFinite(saved.deckIndex) ? saved.deckIndex : 0;
  state.reactions = Array.isArray(saved.reactions) ? saved.reactions : [];
  state.draft = { ...defaultDraft(), ...(saved.draft || {}) };
  state.videoFeedback = (saved.videoFeedback && typeof saved.videoFeedback === "object") ? saved.videoFeedback : {};
  state.externalFeedback = Array.isArray(saved.externalFeedback) ? saved.externalFeedback : [];
  state.finals = { ...defaultFinals(), ...(saved.finals || {}) };
  state.locationSearch = {
    zip: saved.locationSearch?.zip || "",
    maxMiles: saved.locationSearch?.maxMiles || "50",
    locations: Array.isArray(saved.locationSearch?.locations) ? saved.locationSearch.locations : [],
    hasSearched: Boolean(saved.locationSearch?.hasSearched),
    error: saved.locationSearch?.error || "",
    machineLocationIndex: buildMachineLocationIndex(
      Array.isArray(saved.locationSearch?.locations) ? saved.locationSearch.locations : []
    )
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
  state.bracketWinners = Array.isArray(saved.bracketWinners)
    ? saved.bracketWinners.map((r) => Array.isArray(r) ? r : [])
    : [[], [], []];
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
    finals: state.finals,
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
