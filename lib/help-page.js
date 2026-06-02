import { discoveryContextQuestions, discoveryTastePrompts } from "../data/discovery-flow.js";
import { discoveryMachineIndex, discoveryMachines } from "../data/discovery-machines.js";
import { TASTE_PIVOT_PAIRS } from "../data/taste-pivot-pairs.js";
import { buildReactionDeck, recommendMachines } from "./discovery-engine.js";
import { REFINEMENT_NEGATIVE_PROMPTS, REFINEMENT_POSITIVE_PROMPTS, mergeTraitSignals } from "../data/refinement-model.js";
import { buildTasteInsightLines } from "./refinement-explanations.js";
import { clearCompareContext, loadCompareContext } from "./compare-context.js";
import { buildMachineLocationIndex, findNearbyLocations } from "./location-discovery.js";
import { buildPinsideMarketUrl } from "./services/pinside-market.js";
import { buildNearbyCatalogSuggestions, buildNearbyExternalMachineSuggestions, buildTasteProbeSuggestions } from "./test-plan-engine.js";
import { attachCompareButtons, attachImageFallbacks, compareStore, machineDisplayTitle, renderMachineImage, renderSplitCard, showSiteMessage, trackEvent, updateCompareCount } from "./utils.js";
import { attachOutboundTracking, buildAffiliateUrl } from "./outbound.js";
import { componentConnectionReason } from "../data/machine-components.js";
import { renderVideoAction, renderVideoModal } from "./video.js";
import { initNav } from "./nav.js";
import { clearDecisionState, hasUsableDecisionBrief, loadDecisionState, saveDecisionState } from "./decision-state.js";
import { initDecisionBar } from "./decision-bar.js";
import { CHECK_STATUS, normalizeCheckStatus } from "./required-checks.js";
import {
  ANALYTICS_EVENTS,
  derivePathType,
  deriveSessionMode,
  startAnalyticsTimer,
  stopAnalyticsTimer,
  trackAnalytics
} from "./analytics-events.js";

// ── State module ───────────────────────────────────────────────────────────
import {
  state,
  defaultContext, defaultTasteAnswers, defaultTasteScores, defaultDraft, defaultExternalDraft, defaultFinals,
  persistDiscoveryState, clearPersistedDiscoveryState, loadPersistedDiscoveryState,
  hasUsableSavedSession, applySavedSession
} from "./help/state.js";

// ── Components ─────────────────────────────────────────────────────────────
import { renderProgress, renderRefinementChips } from "./help/components.js";

// ── Helpers ────────────────────────────────────────────────────────────────
import {
  buildPlayerArchetype, deriveTasteAnswers, buildMachineArchetypeReason, buildPreferenceReflection,
  currentMachine, currentContext, normalizeReaction, videoFeedbackFor, toggleSelection,
  machineBySlug, probeById, nearestMachineForModal, pricingSummary,
  defaultRadiusForTravel, budgetLabel, choiceLabel, clearTransientUiState,
  buildRefinementSignals, hasRefinementEvidence,
  currentRecommendations, currentRecommendationState, captureRefinementBaseline, buildShortlistChangeSummary,
  framedRecommendations, sourcingMachine, initializePlanForMachine, currentPlanState, updateCurrentPlanState,
  syncDecisionStateFromRecommendations, frontRunnerMachineId, buildDecisionBriefFromCurrentPlan,
  getBracketFinalThree, bracketCurrentPair, bracketMatchCount, setBlockerStatus,
  postPlayQuestionsFor
} from "./help/helpers.js";

// ── Screen modules ─────────────────────────────────────────────────────────
import { renderEntryScreen } from "./help/screens/entry.js";
import { renderDiscoverySetup, renderBudgetCheck, renderCalibrationSetup, renderTastePrompt } from "./help/screens/setup.js";
import {
  renderTasteProfile, renderTastePivot, renderTasteProfileReveal,
  renderTastePlayedMachines, renderNarrowToOne
} from "./help/screens/taste.js";
import { renderPreferenceReflection, renderDiscoveryRound, renderCalibrationRound } from "./help/screens/rounds.js";
import { renderBracket, renderBracketNearby } from "./help/screens/bracket.js";
import { renderResults } from "./help/screens/results.js";
import { renderNearbyTestPlan, renderPostPlayFeedback } from "./help/screens/test-plan.js";
import { renderFinals } from "./help/screens/finals.js";
import { renderSourcingForm, renderWhatCountsModal } from "./help/screens/sourcing.js";
import { renderDecisionBrief } from "./help/screens/decision-brief.js";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const root = document.querySelector("#discovery-app");
const pageParams = new URLSearchParams(window.location.search);
initNav();

let lastTrackedScreen = "";
let lastTrackedResultsConfidence = "";
let lastViewportKey = "";
const STICKY_HEADER_OFFSET = 84;
let decisionBarController = null;

// ── Routing helpers ────────────────────────────────────────────────────────

function discoveryMachineIdBySlug(slug = "") {
  return discoveryMachines.find((m) => m.slug === slug)?.id || "";
}

function isSavedSessionFreshEnough(saved, decisionState) {
  if (!saved || typeof saved !== "object") return false;
  const savedAt = Date.parse(saved.updatedAt || "");
  if (!Number.isFinite(savedAt)) return true;
  const decisionAt = Date.parse(decisionState.updatedAt || "");
  if (!Number.isFinite(decisionAt)) return true;
  return savedAt >= decisionAt;
}

function resolveInitialHelpRoute({ decisionState, savedSession, params }) {
  const wantsBrief = params.get("brief") === "1";
  const wantsResume = params.get("resume") === "1";
  const hasBrief = hasUsableDecisionBrief(decisionState);
  const frontRunnerId = discoveryMachineIdBySlug(decisionState.frontRunnerSlug || "");

  if (wantsBrief && hasBrief) { state.screen = "decision-brief"; return "brief"; }
  if (!wantsResume) return "default";
  if (hasBrief) { state.screen = "decision-brief"; return "brief"; }
  if (decisionState.frontRunnerSlug && frontRunnerId) {
    state.sourcingMachineId = frontRunnerId;
    state.screen = "sourcing";
    initializePlanForMachine(frontRunnerId);
    return "sourcing";
  }
  if (savedSession && isSavedSessionFreshEnough(savedSession, decisionState) && applySavedSession(savedSession)) return "saved-session";
  if (savedSession && applySavedSession(savedSession)) return "saved-session";
  return "default";
}

// ── Scroll / focus helpers ─────────────────────────────────────────────────

function scrollAfterRender(selector) {
  if (!selector) return;
  window.setTimeout(() => root.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

function renderAndScrollTo(selector) {
  render();
  scrollAfterRender(selector);
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

function setPlanFocus(focusId = "") {
  state.activePlanFocus = focusId;
  if (!focusId) return;
  window.setTimeout(() => {
    if (state.activePlanFocus !== focusId) return;
    state.activePlanFocus = "";
    if (state.screen === "sourcing") render();
  }, 1800);
}

function openSourcingForFrontRunner({ scrollSelector = "" } = {}) {
  const machineId = frontRunnerMachineId();
  if (machineId) { state.sourcingMachineId = machineId; initializePlanForMachine(machineId); }
  state.screen = "sourcing";
  if (scrollSelector) { renderAndScrollTo(scrollSelector); return; }
  render();
}

function openNearbyPlan() {
  clearTransientUiState({ clearMoreActions: true });
  state.screen = "nearby-test";
  render();
}

// ── Inline render functions not yet in screen modules ──────────────────────

function renderExternalMachineCard(item) {
  const locations = item.locations || [];
  return renderSplitCard({
    className: "recommendation-card",
    mediaClassName: "recommendation-card__media",
    bodyClassName: "recommendation-card__body",
    overlayHtml: `<div class="recommendation-rank">Pinball Map</div>`,
    imageHtml: `
      <div class="machine-image-frame machine-image-frame--thumb split-card__image recommendation-card__image">
        <div class="card-image image-fallback"><span>${item.machineName}</span></div>
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
          ${locations.slice(0, 3).map((loc) => `<li>${loc.name} · ${loc.city}, ${loc.state} · about ${loc.distanceMiles} miles</li>`).join("")}
        </ul>
      </div>
      <div class="card-actions">
        <button class="btn btn-secondary small" type="button" data-action="open-external-feedback:${item.machineName}">Log feedback</button>
      </div>
    `
  });
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
            ${nearbyLocations.map((loc, i) => `
              <article class="panel nearest-location-card">
                <div class="badge-row">
                  <span class="badge">#${i + 1}</span>
                  <span class="badge">${loc.distanceMiles} miles</span>
                </div>
                <h3>${loc.name}</h3>
                <p class="muted">${loc.city}, ${loc.state}${loc.locationType ? ` · ${loc.locationType}` : ""}</p>
                <p class="muted"><strong>Distance:</strong> about ${loc.distanceMiles} miles from your searched ZIP.</p>
                <div class="card-actions">
                  ${loc.website ? `<a class="btn btn-secondary small" href="${buildAffiliateUrl(loc.website, { placement: "nearby-location" })}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Open website" data-outbound-placement="nearby-location">Open website</a>` : ""}
                  <button class="btn btn-primary small" type="button" data-action="close-nearest-modal">Done</button>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `<p class="muted">No nearby exact-machine locations are available for this shortlist result yet. Run a nearby search first or widen the drive radius.</p>`}
      </div>
    </div>
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
          ${reactionOptions.map((opt) => `
            <button class="chip-button${feedback.reaction === opt.value ? " is-selected" : ""}" type="button" data-video-reaction="${machine.id}:${opt.value}">
              ${opt.label}
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
  const targets = currentRecommendations().slice(0, 3);
  if (!targets.length) return "";
  const completedCount = targets.filter((m) => videoFeedbackFor(m.id).reaction).length;
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
      ${targets.map((m) => renderVideoRefinementCard(m)).join("")}
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
            ${reactionOptions.map((opt) => `
              <button class="chip-button${draft.reaction === opt.value ? " is-selected" : ""}" type="button" data-external-reaction="${opt.value}">
                ${opt.label}
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

// ── Main render ────────────────────────────────────────────────────────────

function render() {
  if (!root) return;
  root.querySelector("#pivot-details-sheet")?.remove();
  let view = renderEntryScreen();
  if (state.screen === "discovery-setup") view = renderDiscoverySetup();
  if (state.screen === "calibration-setup") view = renderCalibrationSetup();
  if (state.screen === "budget-check") view = renderBudgetCheck();
  if (state.screen === "taste-profile") view = renderTasteProfile(discoveryTastePrompts, renderTastePrompt, renderProgress);
  if (state.screen === "taste-pivot") view = renderTastePivot();
  if (state.screen === "taste-reveal") view = renderTasteProfileReveal(currentContext, buildMachineArchetypeReason, renderProgress);
  if (state.screen === "taste-played-machines") view = renderTastePlayedMachines();
  if (state.screen === "narrow-to-one") view = renderNarrowToOne(buildMachineArchetypeReason);
  if (state.screen === "bracket") view = renderBracket(buildMachineArchetypeReason);
  if (state.screen === "bracket-nearby") view = renderBracketNearby(buildMachineArchetypeReason);
  if (state.screen === "discovery-round") view = renderDiscoveryRound(currentMachine);
  if (state.screen === "calibration-round") view = renderCalibrationRound(currentMachine);
  if (state.screen === "reflection") view = renderPreferenceReflection(buildPreferenceReflection);
  if (state.screen === "results") view = renderResults(currentRecommendationState, framedRecommendations, buildTasteInsightLines, buildRefinementSignals, pricingSummary, buildPinsideMarketUrl, loadDecisionState);
  if (state.screen === "video-refinement") view = renderVideoRefinement();
  if (state.screen === "nearby-test") view = renderNearbyTestPlan(renderExternalMachineCard, sourcingMachine, currentRecommendations);
  if (state.screen === "post-play-feedback") view = renderPostPlayFeedback(probeById, mergeTraitSignals);
  if (state.screen === "external-feedback") view = renderExternalFeedback();
  if (state.screen === "finals") view = renderFinals();
  if (state.screen === "sourcing") view = renderSourcingForm();
  if (state.screen === "decision-brief") view = renderDecisionBrief();

  root.innerHTML = `${view}${renderNearestMachineModal()}${renderWhatCountsModal()}${renderVideoModal(state.activeVideo)}`;
  attachCompareButtons(root);
  attachImageFallbacks(root);
  persistDiscoveryState();

  document.querySelector(".hero-discovery")?.setAttribute("hidden", "");
  document.getElementById("extra-help")?.toggleAttribute("hidden", state.screen !== "entry");
  decisionBarController?.render();

  if (state.screen === "discovery-round" || state.screen === "calibration-round") {
    requestAnimationFrame(() => root.querySelector(".reaction-btn")?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }
  if (state.screen === "results" && state.screen !== lastTrackedScreen) {
    setTimeout(() => root.querySelector(".results-next-step")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  }

  const nextViewportKey = viewportResetKey();
  if (nextViewportKey !== lastViewportKey) {
    if (state.screen !== "results") scrollToDiscoverySectionStart();
    lastViewportKey = nextViewportKey;
  }

  if (state.screen !== lastTrackedScreen) {
    if (state.screen === "reflection") {
      const recState = currentRecommendationState();
      trackAnalytics(ANALYTICS_EVENTS.REFLECTION_VIEWED, {
        signal_level: recState.confidence.level === "high" ? "strong" : recState.confidence.level === "medium" ? "developing" : "early",
        candidate_count: recState.recommendations.length
      });
    }
    lastTrackedScreen = state.screen;
  }

  if (state.screen === "results") {
    const confidenceLevel = currentRecommendationState().confidence.level;
    if (confidenceLevel !== lastTrackedResultsConfidence) {
      const recommendations = currentRecommendations();
      trackAnalytics(ANALYTICS_EVENTS.RESULTS_VIEWED, {
        candidate_count: recommendations.length,
        strength_band: confidenceLevel === "high" ? "strong" : confidenceLevel === "medium" ? "developing" : "early",
        front_runner_present: Boolean(loadDecisionState().frontRunnerSlug)
      });
      lastTrackedResultsConfidence = confidenceLevel;
    }
  } else {
    lastTrackedResultsConfidence = "";
  }
}

// ── Async flow operations ─────────────────────────────────────────────────

function resetDraft() {
  state.draft = defaultDraft();
}

async function preloadNearbyContext() {
  const zip = state.context.zip.trim();
  const maxMiles = defaultRadiusForTravel(state.context.travelWillingness);
  state.locationSearch = { ...state.locationSearch, zip, maxMiles };
  if (zip.length !== 5) return;
  try {
    const locations = await findNearbyLocations({ zip, maxMiles });
    const machineLocationIndex = buildMachineLocationIndex(locations);
    state.locationSearch = { zip, maxMiles, locations, hasSearched: true, error: "", machineLocationIndex };
    state.nearbySuggestions = buildTasteProbeSuggestions(currentRecommendations(), state.context, machineLocationIndex);
    state.nearbyCatalogSuggestions = buildNearbyCatalogSuggestions(currentRecommendations(), machineLocationIndex);
    state.nearbyExternalSuggestions = buildNearbyExternalMachineSuggestions(locations);
  } catch (error) {
    state.locationSearch = { zip, maxMiles, locations: [], hasSearched: true, error: error instanceof Error ? error.message : "Live Pinball Map search failed.", machineLocationIndex: new Map() };
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
    if (!state.locationSearch.hasSearched && state.context.zip?.trim().length === 5) await preloadNearbyContext();
    state.screen = state.mode === "calibration" ? "results" : "reflection";
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
    state.locationSearch = { zip, maxMiles, locations, hasSearched: true, error: "", machineLocationIndex };
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
    state.locationSearch = { zip, maxMiles, locations: [], hasSearched: true, error: message, machineLocationIndex: new Map() };
    state.nearbySuggestions = [];
    state.nearbyCatalogSuggestions = [];
    state.nearbyExternalSuggestions = [];
    showSiteMessage(message, "warning");
    render();
  }
}

function traitSignalsFromProxyAnswers(probe) {
  const questions = postPlayQuestionsFor(probe).filter((q) => q.traitKey);
  return mergeTraitSignals(questions.map((q) => {
    const answer = state.draft[q.id];
    if (!answer) return {};
    const magnitude = answer === "yes" ? 1.15 : answer === "mixed" ? 0.4 : -0.8;
    return { [q.traitKey]: magnitude * (q.positive ? 1 : -1) };
  }));
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
  trackAnalytics(ANALYTICS_EVENTS.VIDEO_REFINEMENT_SUBMITTED, { candidate_count: Object.keys(state.videoFeedback || {}).length });
  render();
}

function openExternalFeedback(machineName = "", returnScreen = "nearby-test") {
  captureRefinementBaseline("external");
  state.externalDraft = { ...defaultExternalDraft(), machineName, returnScreen };
  state.screen = "external-feedback";
  render();
}

function submitExternalFeedback() {
  const draft = state.externalDraft;
  if (!draft.machineName || !draft.reaction) {
    showSiteMessage("Add the machine name and a quick reaction to save this.", "warning");
    return;
  }
  state.externalFeedback = [...(state.externalFeedback || []), {
    machineName: draft.machineName,
    reaction: draft.reaction,
    liked: draft.liked || [],
    disliked: draft.disliked || [],
    notes: draft.notes || "",
    loggedAt: new Date().toISOString()
  }];
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

async function shareProfile(archetype) {
  const text = `My Pinball Scout profile: ${archetype.name}\n→ ${archetype.tags.slice(0, 3).join(" · ")}\n\nFind yours at pinballscout.com`;
  if (navigator.share) {
    try { await navigator.share({ title: `Pinball Scout — ${archetype.name}`, text }); return; } catch {}
  }
  try {
    await navigator.clipboard.writeText(text);
    showSiteMessage("Profile copied to clipboard.");
  } catch {
    showSiteMessage("Could not copy — try selecting and copying manually.", "warning");
  }
}

// ── Click handler ─────────────────────────────────────────────────────────

root?.addEventListener("click", (event) => {
  const entry = event.target.closest("[data-entry]")?.dataset.entry;
  if (entry) {
    state.context.playedBefore = entry;
    state.context.firstPin = entry === "yes" ? "kind-of" : "yes";
    state.screen = entry === "yes" ? "calibration-setup" : "discovery-setup";
    render();
    return;
  }

  const contextChoice = event.target.closest("[data-context-choice]")?.dataset.contextChoice;
  if (contextChoice) {
    const [key, value] = contextChoice.split(":");
    state.context[key] = value;
    if (key === "travelWillingness") state.locationSearch.maxMiles = defaultRadiusForTravel(value);
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
    if (option?.context) state.context = { ...state.context, ...option.context };
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
    state.videoFeedback = { ...state.videoFeedback, [machineId]: { ...current, reaction: current.reaction === value ? "" : value } };
    render();
    return;
  }

  const videoChoice = event.target.closest("[data-video-choice]")?.dataset.videoChoice;
  if (videoChoice) {
    const [machineId, key, value] = videoChoice.split(":");
    const current = videoFeedbackFor(machineId);
    state.videoFeedback = { ...state.videoFeedback, [machineId]: { ...current, [key]: toggleSelection(current[key] || [], value, 2) } };
    render();
    return;
  }

  const externalChoice = event.target.closest("[data-external-choice]")?.dataset.externalChoice;
  if (externalChoice) {
    const [, key, value] = externalChoice.split(":");
    state.externalDraft = { ...state.externalDraft, [key]: toggleSelection(state.externalDraft[key] || [], value, 2) };
    render();
    return;
  }

  const externalReaction = event.target.closest("[data-external-reaction]")?.dataset.externalReaction;
  if (externalReaction) {
    state.externalDraft = { ...state.externalDraft, reaction: state.externalDraft.reaction === externalReaction ? "" : externalReaction };
    render();
    return;
  }

  const finalsChoice = event.target.closest("[data-finals-choice]")?.dataset.finalsChoice;
  if (finalsChoice) {
    const [key, value] = finalsChoice.split(":");
    state.finals = { ...state.finals, [key]: state.finals[key] === value ? "" : value };
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
    state.activeVideo = { url: videoButton.dataset.videoUrl, title: videoButton.dataset.videoTitle || "Pinball video" };
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
    const route = resolveInitialHelpRoute({ decisionState: loadDecisionState(), savedSession: loadPersistedDiscoveryState(), params: new URLSearchParams("resume=1") });
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
    const ds = loadDecisionState();
    trackAnalytics(ANALYTICS_EVENTS.COMPARE_FROM_RESULTS, {
      machine_slug: ds.frontRunnerSlug || currentRecommendations()[0]?.slug || "",
      backup_count: Array.isArray(ds.backupSlugs) ? ds.backupSlugs.length : 0
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
    trackAnalytics(ANALYTICS_EVENTS.START_DISCOVERY_CLICKED, { source: "help_entry_discovery", session_mode: deriveSessionMode(loadDecisionState()) });
    return void startTasteProfile("discovery");
  }
  if (action === "start-calibration") {
    trackAnalytics(ANALYTICS_EVENTS.START_DISCOVERY_CLICKED, { source: "help_entry_calibration", session_mode: deriveSessionMode(loadDecisionState()) });
    return void startTasteProfile("calibration");
  }
  if (action === "begin-reactions") return void beginReactions();

  if (action?.startsWith("taste-pivot-pick:")) {
    const [, indexStr, side] = action.split(":");
    const pairIndex = parseInt(indexStr, 10);
    const pair = TASTE_PIVOT_PAIRS[pairIndex];
    if (!pair) return;
    const chosen = side === "left" ? pair.left : pair.right;
    const newScores = { ...state.tasteScores };
    for (const [dim, delta] of Object.entries(chosen.scores)) newScores[dim] = (newScores[dim] || 0) + delta;
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
    const machine = discoveryMachineIndex.get(side === "left" ? pair.left.machineId : pair.right.machineId);
    if (!machine) return;

    const playedSlugs = state.selectedPlayedMachines.map((id) => discoveryMachineIndex.get(id)?.slug).filter(Boolean);
    let connectionNote = "";
    if (playedSlugs.length > 0) {
      let bestReason = null;
      let bestSlug = null;
      for (const playedSlug of playedSlugs) {
        const reason = componentConnectionReason(playedSlug, machine.slug);
        if (reason && !bestReason) { bestReason = reason; bestSlug = playedSlug; }
      }
      if (bestReason && bestSlug) {
        const playedMachine = discoveryMachineIndex.get(state.selectedPlayedMachines.find((id) => discoveryMachineIndex.get(id)?.slug === bestSlug) || "");
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

  if (action === "pivot-sheet-close") { root.querySelector("#pivot-details-sheet")?.remove(); return; }
  if (action === "taste-continue") { state.tastePivotIndex = 0; state.revalSignal = ""; state.screen = "taste-pivot"; render(); return; }
  if (action === "taste-track-played") {
    state.preLogRecsSnapshot = recommendMachines(currentContext(), [], 3, { machineLocationIndex: state.locationSearch.machineLocationIndex }).map((m) => m.id);
    state.screen = "taste-played-machines";
    render();
    return;
  }
  if (action === "taste-played-done") {
    const newIds = recommendMachines(currentContext(), [], 3, { machineLocationIndex: state.locationSearch.machineLocationIndex }).map((m) => m.id);
    const oldIds = state.preLogRecsSnapshot || [];
    const topChanged = newIds[0] && oldIds[0] && newIds[0] !== oldIds[0];
    state.revalSignal = topChanged ? "major" : newIds.some((id, i) => id !== oldIds[i]) ? "minor" : "";
    state.screen = "taste-reveal";
    render();
    return;
  }
  if (action === "reval-dismiss") { state.revalSignal = ""; render(); return; }
  if (action === "taste-rebuild") { state.tastePivotIndex = 0; state.tasteScores = defaultTasteScores(); state.tasteAnswers = {}; state.screen = "taste-pivot"; render(); return; }
  if (action === "start-narrowing") {
    const recs = recommendMachines(currentContext(), [], 3, { machineLocationIndex: state.locationSearch.machineLocationIndex });
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
    const round = state.narrowRound || 0;
    const totalRounds = (state.narrowCandidates || []).length >= 3 ? 2 : 1;
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
    const recs = recommendMachines(currentContext(), [], 8, { machineLocationIndex: state.locationSearch.machineLocationIndex });
    if (recs.length < 2) return;
    const seedCount = recs.length >= 8 ? 8 : recs.length >= 4 ? 4 : 2;
    state.bracketSeeds = recs.slice(0, seedCount).map((m) => m.id);
    state.bracketRound = 0;
    state.bracketMatchIndex = 0;
    state.bracketFactor = 0;
    state.bracketLeftWins = 0;
    state.bracketRightWins = 0;
    state.bracketWinners = Array.from({ length: Math.log2(seedCount) }, () => []);
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
      state.bracketWinners = state.bracketWinners.map((r, i) => i === state.bracketRound ? [...r, winnerId] : r);
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
      state.sourcingMachineId = state.bracketMatchWon;
      syncDecisionStateFromRecommendations(state.bracketMatchWon, "help_bracket_champion");
      initializePlanForMachine(state.bracketMatchWon);
      state.bracketMatchWon = "";
      state.screen = "bracket-nearby";
    } else {
      state.bracketMatchWon = "";
      state.bracketFactor = 0;
      state.bracketLeftWins = 0;
      state.bracketRightWins = 0;
      if (completed >= matchCount) { state.bracketRound = round + 1; state.bracketMatchIndex = 0; }
      else { state.bracketMatchIndex = completed; }
    }
    render();
    return;
  }
  if (action === "back-to-profile") { state.screen = "taste-reveal"; render(); return; }
  if (action === "bracket-nearby-buy") { state.screen = "sourcing"; render(); return; }
  if (action?.startsWith("bracket-budget-set:")) { state.bracketBudget = action.split(":")[1] || ""; render(); return; }
  if (action === "bracket-skip-budget") { state.bracketBudget = "flexible"; render(); return; }
  if (action === "plan-keep-pick") {
    const machine = sourcingMachine();
    const plan = currentPlanState();
    if (machine && plan) trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, { machine_slug: machine.slug, step_id: "step_1_working_pick", path_type: derivePathType(plan.selectedPathType) });
    updateCurrentPlanState({ workingPickConfirmed: true, currentPlanStep: 2 });
    clearTransientUiState({ clearWhatCounts: false });
    render();
    return;
  }
  if (action === "plan-next-step") {
    const plan = currentPlanState();
    if (!plan) return;
    const machine = sourcingMachine();
    if (machine) trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, { machine_slug: machine.slug, step_id: `step_${plan.currentPlanStep}`, path_type: derivePathType(plan.selectedPathType) });
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
    if (machine && plan) trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, { machine_slug: machine.slug, step_id: "step_4_next_actions", path_type: derivePathType(plan.selectedPathType) });
    updateCurrentPlanState({ currentPlanStep: 4 });
    const decisionBrief = buildDecisionBriefFromCurrentPlan();
    if (decisionBrief) saveDecisionState({ decisionBrief });
    if (hasRefinementEvidence()) trackAnalytics(ANALYTICS_EVENTS.DECISION_BRIEF_AFTER_REFINEMENT, { machine_slug: machine?.slug || "" });
    showSiteMessage("Decision Brief saved. You can resume from this action plan anytime.");
    state.screen = "decision-brief";
    clearTransientUiState();
    render();
    return;
  }
  if (action === "open-decision-brief") {
    if (!hasUsableDecisionBrief(loadDecisionState())) { showSiteMessage("No current Decision Brief. Finish your buying plan first.", "warning"); return; }
    state.screen = "decision-brief";
    if (hasRefinementEvidence()) trackAnalytics(ANALYTICS_EVENTS.DECISION_BRIEF_AFTER_REFINEMENT, { machine_slug: loadDecisionState().decisionBrief?.machineSlug || "" });
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
    if (machine) trackAnalytics(ANALYTICS_EVENTS.PLAN_STEP_COMPLETED, { machine_slug: machine.slug, step_id: "step_3_path_selected", path_type: derivePathType(pathType) });
    updateCurrentPlanState({ selectedPathType: pathType, currentPlanStep: 3 });
    clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
    render();
    return;
  }
  if (action?.startsWith("plan-promote-backup:")) {
    const backupSlug = action.split(":")[1];
    const ds = loadDecisionState();
    const currentFront = ds.frontRunnerSlug;
    if (!backupSlug || !currentFront || backupSlug === currentFront) return;
    const promotedMachine = currentRecommendations().find((m) => m.slug === backupSlug) || machineBySlug(backupSlug);
    const nextBackups = [currentFront, ...ds.backupSlugs.filter((s) => s !== backupSlug && s !== currentFront)].slice(0, 2);
    saveDecisionState({ frontRunnerSlug: backupSlug, frontRunnerLastChangedAt: new Date().toISOString(), backupSlugs: nextBackups, temporaryPrimary: false, temporaryPrimaryReason: "", promotionReasons: ["manual_backup_promotion"] });
    if (promotedMachine?.id) { state.sourcingMachineId = promotedMachine.id; initializePlanForMachine(promotedMachine.id); }
    trackAnalytics(ANALYTICS_EVENTS.BACKUP_PROMOTED, { from_slug: currentFront, to_slug: backupSlug, reason_codes: ["manual_backup_promotion"] });
    trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, { from_slug: currentFront, to_slug: backupSlug, source: "help_plan" });
    showSiteMessage(`${machineDisplayTitle(promotedMachine || { name: backupSlug, title: backupSlug })} is now your front-runner. Your previous machine remains saved with its progress.`);
    render();
    return;
  }
  if (action === "plan-keep-fix") { setPlanFocus("required-checks"); renderAndScrollTo("[data-required-checks]"); return; }
  if (action === "plan-focus-required") { setPlanFocus("required-checks"); renderAndScrollTo("[data-required-checks]"); return; }
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
    startAnalyticsTimer(`what-counts:${machine?.slug || ""}:${blockerId}`);
    trackAnalytics(ANALYTICS_EVENTS.WHAT_COUNTS_OPENED, { blocker_type: blockerId, machine_slug: machine?.slug || "", screen: "sourcing" });
    render();
    return;
  }
  if (action?.startsWith("readiness-action:")) {
    const [, target, blockerId = ""] = action.split(":");
    const cardId = event.target.closest("[data-readiness-card]")?.dataset.readinessCard || "";
    trackAnalytics(ANALYTICS_EVENTS.READINESS_CHIP_CLICKED, { machine_slug: sourcingMachine()?.slug || "", chip_id: cardId || target, target_step: target });
    if (target === "reactions") { state.screen = state.mode === "calibration" ? "calibration-round" : "discovery-round"; clearTransientUiState({ clearWhatCounts: false }); render(); return; }
    if (target === "nearby") { clearTransientUiState({ clearWhatCounts: false }); return void openNearbyPlan(); }
    if (target === "practical-setup") { state.screen = state.mode === "calibration" ? "calibration-setup" : "discovery-setup"; clearTransientUiState({ clearWhatCounts: false }); render(); return; }
    if (target === "path-step") { updateCurrentPlanState({ currentPlanStep: 3 }); setPlanFocus("path-step"); clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false }); renderAndScrollTo("#plan-path-step"); return; }
    if (target === "required-checks") { setPlanFocus(blockerId || "required-checks"); clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false }); renderAndScrollTo(blockerId ? `#required-check-${blockerId}` : "[data-required-checks]"); return; }
    if (target === "fit-risk-step") { updateCurrentPlanState({ currentPlanStep: 2 }); setPlanFocus("fit-risk-step"); clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false }); renderAndScrollTo("#plan-fit-risk-step"); return; }
    if (target === "working-pick-step") { updateCurrentPlanState({ currentPlanStep: 1 }); setPlanFocus("working-pick-step"); clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false }); renderAndScrollTo("#plan-working-pick-step"); return; }
  }
  if (action === "risk-drawer-toggle") { state.activeRiskDrawer = !state.activeRiskDrawer; render(); return; }
  if (action?.startsWith("risk-banner-cta:")) {
    const [, riskType = "", ctaId = "", target = "required-checks"] = action.split(":");
    trackAnalytics(ANALYTICS_EVENTS.RISK_BANNER_CTA_CLICKED, { machine_slug: sourcingMachine()?.slug || "", risk_type: riskType, cta_id: ctaId });
    clearTransientUiState({ clearWhatCounts: false, clearPlanFocus: false });
    if (target === "required-checks") { setPlanFocus("required-checks"); renderAndScrollTo("[data-required-checks]"); return; }
    if (target === "fit-risk-step") { updateCurrentPlanState({ currentPlanStep: 2 }); setPlanFocus("fit-risk-step"); renderAndScrollTo("#plan-fit-risk-step"); return; }
    if (target === "working-pick-step") { updateCurrentPlanState({ currentPlanStep: 1 }); setPlanFocus("working-pick-step"); renderAndScrollTo("#plan-working-pick-step"); return; }
  }
  if (action === "plan-what-counts-close") {
    const blockerId = state.activeWhatCountsId;
    if (blockerId) {
      const machine = sourcingMachine();
      trackAnalytics(ANALYTICS_EVENTS.WHAT_COUNTS_CLOSED, { blocker_type: blockerId, machine_slug: machine?.slug || "", screen: "sourcing", duration_ms: stopAnalyticsTimer(`what-counts:${machine?.slug || ""}:${blockerId}`) });
    }
    state.activeWhatCountsId = "";
    render();
    return;
  }
  if (action === "toggle-more-actions") {
    state.moreActionsOpen = !state.moreActionsOpen;
    if (state.moreActionsOpen) trackAnalytics(ANALYTICS_EVENTS.MORE_ACTIONS_OPENED, { screen: "results", candidate_count: currentRecommendations().length });
    render();
    return;
  }
  if (action === "share-profile") { void shareProfile(buildPlayerArchetype(state.tasteScores)); return; }
  if (action === "show-recommendations") { state.screen = "results"; clearTransientUiState({ clearMoreActions: true, clearWhatCounts: false }); syncDecisionStateFromRecommendations("", "help_show_recommendations"); render(); return; }
  if (action === "back-to-reactions") { state.screen = state.mode === "calibration" ? "calibration-round" : "discovery-round"; render(); return; }
  if (action === "back-to-setup") { state.screen = state.mode === "calibration" ? "calibration-setup" : "discovery-setup"; clearTransientUiState({ clearWhatCounts: false }); render(); return; }
  if (action === "open-nearby") return void openNearbyPlan();
  if (action === "open-video-refinement") {
    captureRefinementBaseline("video");
    trackAnalytics(ANALYTICS_EVENTS.VIDEO_REFINEMENT_OPENED, { candidate_count: currentRecommendations().slice(0, 3).length });
    state.screen = "video-refinement";
    render();
    return;
  }
  if (action === "submit-video-refinement") return void submitVideoRefinement();
  if (action === "open-finals") {
    trackAnalytics(ANALYTICS_EVENTS.FINALS_OPENED, { candidate_count: currentRecommendations().slice(0, 3).length });
    state.screen = "finals";
    render();
    return;
  }
  if (action === "cancel-external-feedback") { state.screen = state.externalDraft.returnScreen || "nearby-test"; render(); return; }
  if (action === "submit-external-feedback") return void submitExternalFeedback();
  if (action === "submit-post-play") return void submitPostPlayFeedback();
  if (action === "open-shortlist") { state.screen = "results"; clearTransientUiState({ clearMoreActions: true, clearWhatCounts: false }); syncDecisionStateFromRecommendations("", "help_open_shortlist"); render(); return; }
  if (action === "back-to-results") { state.screen = "results"; clearTransientUiState({ clearMoreActions: true }); resetDraft(); render(); return; }
  if (action === "close-nearest-modal") { if (!state.activeNearestMachineId) return; state.activeNearestMachineId = ""; render(); return; }
  if (action === "close-video-modal") { if (!state.activeVideo) return; state.activeVideo = null; render(); return; }
  if (action?.startsWith("log-play:")) { captureRefinementBaseline("played"); state.activeProbeId = action.split(":")[1]; state.postPlayReturnScreen = state.screen; resetDraft(); state.screen = "post-play-feedback"; render(); return; }
  if (action?.startsWith("open-nearest:")) { state.activeNearestMachineId = action.split(":")[1]; render(); return; }
  if (action?.startsWith("open-external-feedback:")) {
    openExternalFeedback(action.split(":").slice(1).join(":"), state.screen === "nearby-test" ? "nearby-test" : "results");
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
    Object.assign(state, {
      screen: "entry", mode: null, compareContext: null, hasSavedSession: false, savedSessionUpdatedAt: "",
      context: defaultContext(), tasteAnswers: defaultTasteAnswers(), selectedPlayedMachines: [],
      deck: [], deckIndex: 0, reactions: [], videoFeedback: {}, externalFeedback: [],
      externalDraft: defaultExternalDraft(), finals: defaultFinals(),
      refinementBaseline: null, lastRefinementSummary: null,
      nearbySuggestions: [], nearbyCatalogSuggestions: [], nearbyExternalSuggestions: [],
      activeNearestMachineId: "", activeVideo: null,
      locationSearch: { zip: "", maxMiles: "50", locations: [], hasSearched: false, error: "", machineLocationIndex: new Map() },
      activeProbeId: "", sourcingMachineId: "",
      tastePivotIndex: 0, tasteScores: defaultTasteScores()
    });
    clearTransientUiState({ clearMoreActions: true });
    resetDraft();
    render();
    return;
  }
  if (action === "save-shortlist") {
    const saved = currentRecommendations().map((m) => m.slug);
    compareStore.set(saved.slice(0, 3));
    updateCompareCount();
    trackEvent("save-shortlist", { source: "discovery-results", count: Math.min(saved.length, 3) });
    showSiteMessage("Shortlist saved to compare. You can resume later.");
    return;
  }
  if (action === "email-shortlist") {
    const recState = currentRecommendationState();
    const framed = framedRecommendations(recState.recommendations, recState.confidence.level);
    const subject = encodeURIComponent("My Pinball Scout shortlist");
    const body = encodeURIComponent(
      `Here are my Pinball Scout recommendations:\n\n${framed.map((item, i) => `${i + 1}. ${item.frame}: ${machineDisplayTitle(item.machine)} (${item.machine.budget_band})`).join("\n")}\n\nBudget: ${budgetLabel(state.context.budget)}\nCondition: ${choiceLabel("condition", state.context.condition)}\nTimeline: ${choiceLabel("timeline", state.context.timeline)}`
    );
    trackEvent("email-shortlist", { source: "discovery-results", count: framed.length });
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    return;
  }

  const reaction = event.target.closest("[data-reaction]")?.dataset.reaction;
  if (reaction) void advanceReaction(reaction);
});

// ── Input handler ─────────────────────────────────────────────────────────

root?.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches("[data-video-notes]")) {
    const machineId = target.getAttribute("data-video-notes") || "";
    if (!machineId) return;
    const current = videoFeedbackFor(machineId);
    state.videoFeedback = { ...state.videoFeedback, [machineId]: { ...current, notes: target.value || "" } };
    return;
  }
  if (target.matches("[data-external-notes]")) { state.externalDraft = { ...state.externalDraft, notes: target.value || "" }; return; }
  if (target.matches("[data-external-name]")) { state.externalDraft = { ...state.externalDraft, machineName: target.value || "" }; return; }
  if (target.matches("[data-draft-notes]")) { state.draft = { ...state.draft, notes: target.value || "" }; }
});

// ── Form handler ──────────────────────────────────────────────────────────

root?.addEventListener("submit", (event) => {
  const nearbyForm = event.target.closest("#nearby-search-form");
  if (nearbyForm) { event.preventDefault(); searchNearbyLocations(nearbyForm); }
});

// ── Initialization ────────────────────────────────────────────────────────

const decisionState = loadDecisionState();
const initialSavedSession = loadPersistedDiscoveryState();
state.hasSavedSession = hasUsableSavedSession(initialSavedSession) || Boolean(decisionState.hasLegacyDiscovery) || hasUsableDecisionBrief(decisionState);
state.savedSessionUpdatedAt = initialSavedSession?.updatedAt || decisionState.decisionBrief?.updatedAt || decisionState.updatedAt || "";
state.compareContext = loadCompareContext();

decisionBarController = initDecisionBar({
  page: "help",
  getViewState: () => ({ screen: state.screen, fallbackCondition: state.context.condition }),
  handlers: {
    promoteBackup: (backupSlug) => {
      if (!backupSlug) return;
      const current = loadDecisionState();
      const front = current.frontRunnerSlug;
      if (!front || front === backupSlug) return;
      const nextBackups = [front, ...current.backupSlugs.filter((s) => s !== backupSlug && s !== front)].slice(0, 2);
      saveDecisionState({ frontRunnerSlug: backupSlug, frontRunnerLastChangedAt: new Date().toISOString(), backupSlugs: nextBackups, temporaryPrimary: false, temporaryPrimaryReason: "", promotionReasons: ["decision_bar_promotion"] });
      const nextMachine = currentRecommendations().find((m) => m.slug === backupSlug);
      if (nextMachine?.id) { state.sourcingMachineId = nextMachine.id; initializePlanForMachine(nextMachine.id); }
      trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, { from_slug: front, to_slug: backupSlug, source: "decision_bar" });
      showSiteMessage(`${machineDisplayTitle(machineBySlug(backupSlug) || { name: backupSlug, title: backupSlug })} is now your front-runner. Your previous machine remains saved with its progress.`);
      render();
    },
    fixBlockers: () => { clearTransientUiState({ clearMoreActions: true }); openSourcingForFrontRunner({ scrollSelector: "[data-required-checks]" }); },
    continuePlan: () => { clearTransientUiState({ clearMoreActions: true }); openSourcingForFrontRunner(); },
    openCompare: () => { window.location.href = "compare.html"; },
    resumeTieBreaker: () => { window.location.href = "compare.html"; },
    reviewBoth: () => { window.location.href = "compare.html"; },
    openBrief: () => {
      if (!loadDecisionState().decisionBrief?.machineSlug) return;
      state.screen = "decision-brief";
      clearTransientUiState();
      render();
    }
  }
});

const initialRoute = resolveInitialHelpRoute({ decisionState, savedSession: initialSavedSession, params: pageParams });
if (pageParams.get("resume") === "1" && initialRoute !== "default") {
  trackAnalytics(ANALYTICS_EVENTS.RESUME_BANNER_CLICKED, {
    state_type: initialRoute === "brief" ? "decision_brief" : initialRoute === "sourcing" ? "decision_state" : "saved_session",
    screen: state.screen
  });
}
render();
updateCompareCount();
attachOutboundTracking();
