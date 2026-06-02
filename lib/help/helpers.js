/**
 * Shared business logic for the discovery flow.
 * Pure functions only — no DOM, no render() calls.
 */

import { state } from "./state.js";
import { discoveryMachineIndex, discoveryMachines } from "../../data/discovery-machines.js";
import { machines } from "../../data/machines.js";
import { discoveryContextQuestions, likedAspectOptions } from "../../data/discovery-flow.js";
import { PLAYER_ARCHETYPES } from "../../data/player-archetypes.js";
import { BUDGET_BANDS } from "../../data/bracket-config.js";
import { recommendMachines, recommendationConfidence } from "../discovery-engine.js";
import { buildTraitSignalsFromRefinement } from "../refinement-helpers.js";
import { traitLabelMap } from "../../data/refinement-model.js";
import { buildTasteInsightLines } from "../refinement-explanations.js";
import { buildEvidenceModel } from "../refinement-evidence.js";
import { loadDecisionState, saveDecisionState } from "../decision-state.js";
import { decisionPlanPatch, nextActionsForPath, readMachinePlanState } from "../decision-plan.js";
import {
  CHECK_STATUS,
  blockerProgress,
  blockersForPath,
  normalizeCheckStatus,
  readinessFromBlockers,
  shouldApplyRemoteOverlay
} from "../required-checks.js";
import { buildPinsideMarketUrl } from "../services/pinside-market.js";
import { machineDisplayTitle, formatCurrency, trackEvent } from "../utils.js";
import { ANALYTICS_EVENTS, trackAnalytics } from "../analytics-events.js";
import * as utils from "../utils.js";
import { proxyTraitPrompts } from "./screens/rounds.js";

// ── Taste / archetype ─────────────────────────────────────────────────────

export function buildPlayerArchetype(scores) {
  let best = PLAYER_ARCHETYPES[0];
  let bestDot = -Infinity;
  for (const archetype of PLAYER_ARCHETYPES) {
    let dot = 0;
    for (const [dim, weight] of Object.entries(archetype.vector)) {
      dot += (scores[dim] || 0) * weight;
    }
    if (dot > bestDot) { bestDot = dot; best = archetype; }
  }
  return best;
}

export function deriveTasteAnswers(scores) {
  return {
    "learning-curve": (scores["learning-curve"] || 0) < 0 ? "quick-start" : "deep-discovery",
    "pace-feel": (scores["pace-feel"] || 0) < 0 ? "fast-smooth" : "controlled",
    "theme-pull": (scores["theme-pull"] || 0) > 0 ? "theme-first" : "gameplay-first",
    "challenge-level": (scores["challenge"] || 0) < 0 ? "forgiving" : "demanding",
    "replay-itch": (scores["replay"] || 0) < 0 ? "instant-replay" : "longer-progress",
    "ownership-style": (scores["ownership"] || 0) < 0 ? "safe" : "specific"
  };
}

export function buildMachineArchetypeReason(machine, archetype, scores) {
  const archetypeOpeners = {
    "easy-rider": "For someone who values fun without friction",
    "flow-chaser": "For your flow-seeking style",
    "theme-collector": "Given your theme-first instincts",
    "serious-player": "For a player focused on mastery",
    "safe-starter": "For a low-regret first buy",
    "deep-explorer": "Given your appetite for depth"
  };
  const sortedDims = Object.entries(scores).filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
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

export function buildPreferenceReflection() {
  const notes = [];
  const likesTheme = state.tasteAnswers["theme-pull"] === "theme-first" || state.reactions.some((r) => r.likedAspect === "theme");
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

// ── Context / machine helpers ─────────────────────────────────────────────

export function currentMachine() {
  return state.deck[state.deckIndex] || null;
}

export function currentContext() {
  return { ...state.context, tasteAnswers: state.tasteAnswers };
}

export function normalizeReaction(value) {
  return value === "liked-it" ? "looks-fun" : value;
}

export function videoFeedbackFor(machineId) {
  return state.videoFeedback[machineId] || { reaction: "", liked: [], disliked: [], notes: "" };
}

export function toggleSelection(list = [], value = "", max = 2) {
  const next = Array.isArray(list) ? [...list] : [];
  const index = next.indexOf(value);
  if (index >= 0) { next.splice(index, 1); return next; }
  if (next.length >= max) return next;
  next.push(value);
  return next;
}

export function hasPlayedMachine(machineId) {
  return state.reactions.some((r) => r.machineId === machineId && r.experienceType === "played");
}

export function traitAlignmentList(machine) {
  return Array.isArray(machine?.traitAlignment) ? machine.traitAlignment : [];
}

export function machineBySlug(slug = "") {
  return machines.find((m) => m.slug === slug) || null;
}

export function probeById() {
  return [...state.nearbySuggestions, ...state.nearbyCatalogSuggestions].find((item) => item.machineId === state.activeProbeId) || null;
}

export function nearestMachineForModal() {
  if (!state.activeNearestMachineId) return null;
  return currentRecommendations().find((m) => m.id === state.activeNearestMachineId) || null;
}

export function formatSavedSessionTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export function pricingSummary(machine) {
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

export function defaultRadiusForTravel(value) {
  if (value === "local-only") return "50";
  if (value === "regional") return "150";
  if (value === "overnight") return "300";
  return "100";
}

export function budgetLabel(value) {
  return discoveryContextQuestions.find((q) => q.id === "budget")?.choices.find((c) => c.value === value)?.label || value;
}

export function choiceLabel(questionId, value) {
  return discoveryContextQuestions.find((q) => q.id === questionId)?.choices.find((c) => c.value === value)?.label || value;
}

export function clearTransientUiState({ clearMoreActions = false, clearWhatCounts = true, clearRisk = true, clearPlanFocus = true } = {}) {
  if (clearMoreActions) state.moreActionsOpen = false;
  if (clearWhatCounts) state.activeWhatCountsId = "";
  if (clearRisk) state.activeRiskDrawer = false;
  if (clearPlanFocus) state.activePlanFocus = "";
}

// ── Refinement signals ────────────────────────────────────────────────────

export function buildRefinementSignals() {
  const signals = [];
  Object.entries(state.videoFeedback || {}).forEach(([machineId, feedback]) => {
    if (!feedback || !feedback.reaction) return;
    signals.push({
      machineId,
      reaction: normalizeReaction(feedback.reaction),
      traitSignals: buildTraitSignalsFromRefinement({ liked: feedback.liked || [], disliked: feedback.disliked || [] }),
      experienceType: "video",
      weight: 1,
      notes: feedback.notes || ""
    });
  });
  (state.externalFeedback || []).forEach((entry) => {
    if (!entry || (!entry.reaction && !(entry.liked || []).length && !(entry.disliked || []).length)) return;
    signals.push({
      machineId: "",
      reaction: normalizeReaction(entry.reaction || "not-sure"),
      traitSignals: buildTraitSignalsFromRefinement({ liked: entry.liked || [], disliked: entry.disliked || [] }),
      experienceType: "external",
      weight: 1,
      notes: entry.notes || "",
      machineName: entry.machineName || ""
    });
  });
  return signals;
}

export function topTraitSignals() {
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

export function hasRefinementEvidence() {
  const hasVideo = Object.keys(state.videoFeedback || {}).length > 0;
  const hasExternal = (state.externalFeedback || []).length > 0;
  const hasRealPlay = (state.reactions || []).some((r) => String(r.source || "").startsWith("real-play"));
  return hasVideo || hasExternal || hasRealPlay;
}

// ── Recommendations ────────────────────────────────────────────────────────

export function currentRecommendations() {
  return recommendMachines(currentContext(), state.reactions, 3, {
    machineLocationIndex: state.locationSearch.machineLocationIndex,
    refinementSignals: buildRefinementSignals(),
    playedMachineIds: state.selectedPlayedMachines
  });
}

export function currentRecommendationState() {
  const recommendations = currentRecommendations();
  return {
    recommendations,
    confidence: recommendationConfidence(currentContext(), state.reactions, recommendations, {
      refinementSignals: buildRefinementSignals()
    })
  };
}

export function captureRefinementBaseline(source = "") {
  state.refinementBaseline = {
    source,
    slugs: currentRecommendations().map((m) => m.slug),
    capturedAt: new Date().toISOString()
  };
}

export function buildShortlistChangeSummary(baseline, recommendations) {
  if (!baseline?.slugs?.length || !recommendations?.length) return null;
  const currentSlugs = recommendations.map((m) => m.slug);
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
    lines.push(`New in your top 3: ${added.map((slug) => machineDisplayTitle(discoveryMachineIndex.get(slug) || { name: slug, title: slug })).join(", ")}.`);
    changed = true;
  }
  if (removed.length) {
    lines.push(`Dropped out: ${removed.map((slug) => machineDisplayTitle(discoveryMachineIndex.get(slug) || { name: slug, title: slug })).join(", ")}.`);
    changed = true;
  }
  if (!lines.length) lines.push("Your shortlist stayed stable; the latest feedback mostly confirmed the initial fit.");
  return { source: baseline.source || "refinement", lines, changed, fromTop: baselineTop, toTop: currentTop };
}

// ── Framing / labels ───────────────────────────────────────────────────────

function uniqueRecommendationBy(recommendations, pick) {
  if (!recommendations.length) return null;
  try { return pick(recommendations) || null; } catch { return null; }
}

export function framedRecommendations(recommendations, confidenceLevel = "high") {
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
      recommendations.filter((m) => m.id !== likely.id),
      (list) => [...list].sort((a, b) => ((b.resaleStrength + b.beginnerFriendly) - (a.resaleStrength + a.beginnerFriendly)))[0]
    );
    const taste = uniqueRecommendationBy(
      recommendations.filter((m) => m.id !== likely.id && m.id !== safer?.id),
      (list) => [...list].sort((a, b) => ((b.themeStrength + b.gameplayDepth) - (a.themeStrength + a.gameplayDepth)))[0]
    );
    return [
      { frame: "Likely fit", summary: "Currently the strongest match, but still close to alternatives.", machine: likely },
      { frame: "Safer alternative", summary: "Lower-regret option if resale and ownership simplicity matter more.", machine: safer || recommendations[1] || likely },
      { frame: "Taste-driven alternative", summary: "Worth considering if theme pull and personality drive your choice.", machine: taste || recommendations[2] || likely }
    ].filter((item, i, arr) => item.machine && arr.findIndex((c) => c.machine.id === item.machine.id) === i);
  }
  const overall = recommendations[0];
  const safest = uniqueRecommendationBy(
    recommendations.filter((m) => m.id !== overall.id),
    (list) => [...list].sort((a, b) => ((b.resaleStrength + b.beginnerFriendly) - (a.resaleStrength + a.beginnerFriendly)))[0]
  );
  const theme = uniqueRecommendationBy(
    recommendations.filter((m) => m.id !== overall.id && m.id !== safest?.id),
    (list) => [...list].sort((a, b) => ((b.themeStrength + b.gameplayDepth) - (a.themeStrength + a.gameplayDepth)))[0]
  );
  return [
    { frame: "Best overall fit", summary: "Most balanced match across confidence, replayability, and practical ownership.", machine: overall },
    { frame: "Safest first buy", summary: "Best choice if regret reduction, resale strength, and easier ownership matter most.", machine: safest || recommendations[1] || overall },
    { frame: "Best if theme matters most", summary: "Strong pick when emotional theme pull is a key part of long-term ownership.", machine: theme || recommendations[2] || overall }
  ].filter((item, i, arr) => item.machine && arr.findIndex((c) => c.machine.id === item.machine.id) === i);
}

export function beginnerLabel(score) {
  if (score >= 5) return "Very beginner-friendly";
  if (score >= 4) return "Beginner-friendly";
  if (score >= 3) return "Moderate ramp";
  return "Steeper first-owner ramp";
}

export function resaleLabel(score) {
  if (score >= 5) return "Very strong";
  if (score >= 4) return "Strong";
  if (score >= 3) return "Moderate";
  return "More niche";
}

export function maintenanceLabel(score) {
  if (score <= 2) return "Lower";
  if (score <= 3) return "Medium";
  return "Higher";
}

// ── Sourcing / plan helpers ────────────────────────────────────────────────

export function sourcingMachine() {
  return discoveryMachineIndex.get(state.sourcingMachineId) || currentRecommendations()[0] || null;
}

export function sourcingRecommendationProfile() {
  const active = sourcingMachine();
  if (!active) return null;
  return currentRecommendations().find((m) => m.id === active.id) || active;
}

export function currentPlanState(machineId) {
  const machine = machineId ? discoveryMachineIndex.get(machineId) : sourcingMachine();
  if (!machine) return null;
  return readMachinePlanState(loadDecisionState(), machine.slug, state.context.condition);
}

export function updateCurrentPlanState(patch = {}) {
  const machine = sourcingMachine();
  if (!machine) return;
  saveDecisionState(decisionPlanPatch(loadDecisionState(), machine.slug, patch, state.context.condition));
}

export function initializePlanForMachine(machineId = "") {
  const machine = discoveryMachineIndex.get(machineId) || sourcingMachine();
  if (!machine) return;
  const decisionState = loadDecisionState();
  const seed = readMachinePlanState(decisionState, machine.slug, state.context.condition);
  saveDecisionState(decisionPlanPatch(decisionState, machine.slug, {
    currentPlanStep: seed.currentPlanStep || 1,
    selectedPathType: seed.selectedPathType,
    workingPickConfirmed: seed.workingPickConfirmed
  }, state.context.condition));
}

export function activeBlockersForCurrentPlan(machine, planState) {
  if (!machine || !planState) return [];
  return blockersForPath(planState.selectedPathType, shouldApplyRemoteOverlay(state.context));
}

export function setBlockerStatus(blockerId, nextStatus) {
  const machine = sourcingMachine();
  if (!machine || !blockerId) return;
  const plan = currentPlanState(machine.id);
  if (!plan) return;
  const blockers = activeBlockersForCurrentPlan(machine, plan);
  if (!blockers.find((b) => b.id === blockerId)) return;
  const status = normalizeCheckStatus(nextStatus);
  const currentStatus = normalizeCheckStatus(plan.requiredChecks?.[blockerId]);
  if (status === currentStatus) return;
  updateCurrentPlanState({ requiredChecks: { ...(plan.requiredChecks || {}), [blockerId]: status } });
}

export function syncDecisionStateFromRecommendations(frontMachineId = "", source = "help_results") {
  const recommendations = currentRecommendations();
  if (!recommendations.length) return;
  const current = loadDecisionState();
  const preferred = recommendations.find((m) => m.id === frontMachineId);
  const frontRunnerSlug = (preferred || recommendations[0]).slug;
  const backupSlugs = recommendations.map((m) => m.slug).filter((slug) => slug !== frontRunnerSlug).slice(0, 2);
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

export function frontRunnerMachineId() {
  const frontRunnerSlug = loadDecisionState().frontRunnerSlug;
  if (!frontRunnerSlug) return "";
  return currentRecommendations().find((m) => m.slug === frontRunnerSlug)?.id || "";
}

export function buildDecisionBriefFromCurrentPlan() {
  const machine = sourcingMachine();
  if (!machine) return null;
  const recommendationState = currentRecommendationState();
  const recommendation = recommendationState.recommendations.find((item) => item.id === machine.id) || machine;
  const plan = currentPlanState(machine.id);
  if (!plan) return null;

  const blockers = blockersForPath(plan.selectedPathType, shouldApplyRemoteOverlay(state.context));
  const requiredCheckProgress = blockerProgress(blockers, plan.requiredChecks || {});
  const readiness = readinessFromBlockers({
    pathType: plan.selectedPathType, blockers, requiredChecks: plan.requiredChecks || {},
    currentPlanStep: plan.currentPlanStep, workingPickConfirmed: plan.workingPickConfirmed
  });
  const whyItFits = (recommendation.explanation?.whyMatch || recommendation.whyItFits || [recommendation.starterRecommendationReason]).filter(Boolean).slice(0, 3);
  const refinementInsights = buildTasteInsightLines(state.reactions, buildRefinementSignals()).slice(0, 3);
  const mismatchSignals = Array.isArray(recommendation.mismatchSignals) ? recommendation.mismatchSignals : [];
  const confidenceNextStep = recommendationState.confidence.nextSteps?.[0]?.detail || "";
  const backupCandidate = recommendationState.recommendations.find((item) => item.id !== recommendation.id) || null;
  const backupReason = backupCandidate
    ? `Backup: ${machineDisplayTitle(backupCandidate)} stays relevant because it aligns with ${traitAlignmentList(backupCandidate).slice(0, 2).join(" and ").toLowerCase() || "your general taste signals"}.`
    : "";
  const completedBlockers = blockers.filter((b) => requiredCheckProgress.statusById[b.id] === CHECK_STATUS.COMPLETE).map((b) => b.title);
  const outstandingBlockers = blockers.filter((b) => requiredCheckProgress.statusById[b.id] !== CHECK_STATUS.COMPLETE).map((b) => b.title);
  const now = new Date().toISOString();
  const decisionState = loadDecisionState();
  const previousBrief = decisionState.decisionBrief;

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

// ── Bracket helpers ────────────────────────────────────────────────────────

export function bracketCurrentPair() {
  const { bracketRound: round, bracketMatchIndex: mi, bracketSeeds: seeds, bracketWinners: winners } = state;
  if (round === 0) return [seeds[mi * 2], seeds[mi * 2 + 1]];
  const prev = winners[round - 1] || [];
  return [prev[mi * 2], prev[mi * 2 + 1]];
}

export function bracketMatchCount(round) {
  return Math.max(1, Math.floor(state.bracketSeeds.length / Math.pow(2, round + 1)));
}

export function bracketRoundLabel(round) {
  const maxRounds = state.bracketWinners.length;
  if (maxRounds >= 3) return (["Quarter-final", "Semi-final", "Final"])[round] ?? "Final";
  if (maxRounds === 2) return (["Semi-final", "Final"])[round] ?? "Final";
  return "Final";
}

export function getBracketFinalThree() {
  const w = state.bracketWinners;
  const champion = w[2]?.[0] || w[1]?.[0] || "";
  const sfWinners = w[1] || [];
  const runnerUp = sfWinners.find((id) => id !== champion) || "";
  const sfWinnerSet = new Set(sfWinners);
  const third = (w[0] || []).filter((id) => !sfWinnerSet.has(id))[0] || "";
  return [champion, runnerUp, third].filter(Boolean);
}

export function budgetContextNote(machine) {
  const bandId = state.bracketBudget;
  if (!bandId || bandId === "flexible" || !machine) return "";
  const min = machine.estimated_price_min || 0;
  const max = machine.estimated_price_max || 0;
  if (!min || !max) return "";
  const bandRanges = { "under5k": [0, 5000], "5k-8k": [5000, 8000], "8k-12k": [8000, 12000], "over12k": [12000, Infinity] };
  const [bMin, bMax] = bandRanges[bandId] || [0, Infinity];
  const bandLabel = BUDGET_BANDS.find((b) => b.id === bandId)?.label || bandId;
  if (min >= bMin && max <= bMax) return `<p class="budget-context-note budget-context-note--match">✓ Fits your ${bandLabel} budget range</p>`;
  if (min > bMax) return `<p class="budget-context-note budget-context-note--over">Above your ${bandLabel} range — search used market for better pricing</p>`;
  return `<p class="budget-context-note budget-context-note--under">Lower-end examples available near or below your ${bandLabel} range</p>`;
}

// ── Test plan helpers ──────────────────────────────────────────────────────

export function rankedProxyTraitChecks(machine, limit = 4) {
  const profile = machine?.trait_profile || {};
  const ranked = proxyTraitPrompts
    .map((item) => ({ ...item, score: Number(profile[item.key] || 3) }))
    .sort((a, b) => b.score - a.score);
  return [
    ...ranked.slice(0, 3).map((item) => ({ ...item, prompt: item.high, positive: true })),
    ...ranked.slice(-1).map((item) => ({ ...item, prompt: item.low, positive: false }))
  ].slice(0, limit);
}

export function proxyChecklistItems(suggestion) {
  return rankedProxyTraitChecks(suggestion.machine, suggestion.probeType === "proxy" ? 4 : 3).map((item) => item.prompt);
}

export function postPlayQuestionsFor(probe) {
  if (!probe) return [];
  const baseQuestions = [{
    id: "enjoyment", title: "How did that one land for you?",
    choices: [{ value: "liked-it", label: "Loved it" }, { value: "not-sure", label: "Mixed / not sure" }, { value: "not-for-me", label: "Not for me" }]
  }];
  if (probe.probeType === "proxy") {
    return [
      ...baseQuestions,
      ...rankedProxyTraitChecks(probe.machine, 4).map((item) => ({
        id: `trait_${item.key}`, title: item.prompt, traitKey: item.key, positive: item.positive,
        choices: [{ value: "yes", label: "Yes" }, { value: "mixed", label: "A bit" }, { value: "no", label: "No" }]
      }))
    ];
  }
  return [
    ...baseQuestions,
    { id: "fun", title: "What felt most fun?", choices: likedAspectOptions },
    {
      id: "friction", title: "What felt most frustrating?",
      choices: [
        { value: "too-hard", label: "Too hard" }, { value: "too-easy", label: "Too easy" },
        { value: "too-chaotic", label: "Too chaotic" }, { value: "too-slow", label: "Too slow" },
        { value: "theme-miss", label: "Theme did not hook me" }, { value: "none", label: "Nothing major" }
      ]
    },
    {
      id: "replay", title: "Did it make you want another game immediately?",
      choices: [{ value: "yes", label: "Yes" }, { value: "maybe", label: "Maybe" }, { value: "no", label: "No" }]
    }
  ];
}

export function isPostPlayComplete(probe) {
  return postPlayQuestionsFor(probe).every((q) => Boolean(state.draft[q.id]));
}
