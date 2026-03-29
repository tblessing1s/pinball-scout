import {
  calibrationReactionOptions,
  concernOptions,
  discoveryContextQuestions,
  discoveryReactionOptions,
  likedAspectOptions,
  postPlayQuestions
} from "../data/discovery-flow.js";
import { discoveryMachineIndex, discoveryMachines } from "../data/discovery-machines.js";
import { buildReactionDeck, recommendMachines } from "./discovery-engine.js";
import { leadCaptureConfig } from "./config.js";
import { submitLead } from "./lead-capture.js";
import { buildMachineLocationIndex, findNearbyLocations } from "./location-discovery.js";
import { buildPinsideMachineUrl, buildPinsideMarketUrl, buildPinsidePricingUrl } from "./services/pinside-market.js";
import { buildNearbyCatalogSuggestions, buildNearbyExternalMachineSuggestions, buildTasteProbeSuggestions } from "./test-plan-engine.js";
import { attachImageFallbacks, formatCurrency, machineDisplayTitle, renderMachineImage, showSiteMessage, trackEvent, updateCompareCount } from "./utils.js";
import { renderVideoAction, renderVideoModal } from "./video.js";
import * as utils from "./utils.js";

const root = document.querySelector("#discovery-app");

const defaultContext = () => ({
  playedBefore: "",
  firstPin: "yes",
  budget: "",
  condition: "either",
  playAccess: "some",
  zip: "",
  travelWillingness: "regional",
  timeline: "1to3months"
});

const defaultDraft = () => ({
  likedAspect: "",
  concern: "",
  replay: ""
});

const state = {
  screen: "entry",
  mode: null,
  context: defaultContext(),
  selectedPlayedMachines: [],
  deck: [],
  deckIndex: 0,
  reactions: [],
  draft: defaultDraft(),
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
  sourcingState: {
    submitting: false,
    submitted: false,
    message: ""
  }
};

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

function currentRecommendations() {
  return recommendMachines(state.context, state.reactions, 3, {
    machineLocationIndex: state.locationSearch.machineLocationIndex
  });
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

function confidenceLabel(index) {
  if (index === 0) return "High confidence";
  if (index === 1) return "Strong shortlist";
  return "Worth a closer look";
}

function probeById() {
  return [...state.nearbySuggestions, ...state.nearbyCatalogSuggestions].find((item) => item.machineId === state.activeProbeId) || null;
}

function sourcingMachine() {
  return discoveryMachineIndex.get(state.sourcingMachineId) || currentRecommendations()[0] || null;
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

function renderEntryScreen() {
  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Have you played pinball before?",
        "If you have, we can calibrate from real machines you already know. If not, we will guide you through a beginner-safe exploration flow.",
        10
      )}
      <div class="choice-grid">
        <button class="choice-card" type="button" data-entry="no">
          <strong>No, not really</strong>
          <span>Start broad, learn from overviews and gameplay videos, and narrow from there.</span>
        </button>
        <button class="choice-card" type="button" data-entry="yes">
          <strong>Yes, at least a bit</strong>
          <span>Use the faster calibration path based on machines you have already touched.</span>
        </button>
      </div>
    </section>
  `;
}

function renderDiscoverySetup() {
  const requiredIds = ["budget", "condition", "playAccess", "travelWillingness", "timeline"];
  const complete = requiredIds.every((id) => Boolean(state.context[id]));
  const radiusMiles = defaultRadiusForTravel(state.context.travelWillingness);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Start high-level",
        "We only ask a few practical questions up front. The product gets smarter by showing you machines, not by forcing you to speak pinball jargon.",
        20
      )}
      <div class="discovery-question-stack">
        ${requiredIds.map((id) => renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === id), state.context[id])).join("")}
        <article class="panel discovery-question">
          <p class="eyebrow">Location</p>
          <h3>What ZIP code should we use for nearby test planning?</h3>
          <p class="muted">Your travel answer above sets the default nearby radius to about ${radiusMiles} miles.</p>
          <label>
            Zip code
            <input id="context-zip" name="contextZip" value="${state.context.zip}" inputmode="numeric" pattern="[0-9]{5}" placeholder="63701" maxlength="5" />
          </label>
        </article>
      </div>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-discovery" ${(complete && state.context.zip.trim().length === 5) ? "" : "disabled"}>Show likely-fit games</button>
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
  const complete = Boolean(state.context.budget && state.context.condition && state.context.travelWillingness && state.context.timeline && state.selectedPlayedMachines.length && state.context.zip.trim().length === 5);
  const radiusMiles = defaultRadiusForTravel(state.context.travelWillingness);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Use known games to calibrate taste",
        "Pick the machines you have played before. Then we will ask simple, plain-English reactions and turn those into better recommendations.",
        20,
        `${state.selectedPlayedMachines.length} selected`
      )}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "budget"), state.context.budget)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "condition"), state.context.condition)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "travelWillingness"), state.context.travelWillingness)}
      <article class="panel discovery-question">
        <p class="eyebrow">Location</p>
        <h3>What ZIP code should we use for nearby test planning?</h3>
        <p class="muted">Your travel answer above sets the default nearby radius to about ${radiusMiles} miles.</p>
        <label>
          Zip code
          <input id="context-zip" name="contextZip" value="${state.context.zip}" inputmode="numeric" pattern="[0-9]{5}" placeholder="63701" maxlength="5" />
        </label>
      </article>
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
        <button class="btn btn-primary" type="button" data-action="start-calibration" ${complete ? "" : "disabled"}>Calibrate my taste</button>
      </div>
    </section>
  `;
}

function renderReactionCard(machine, options, modeLabel) {
  const whyPeopleLikeIt = Array.isArray(machine?.why_people_like_it) ? machine.why_people_like_it : [];
  const whatToKnow = Array.isArray(machine?.what_to_know_before_buying) ? machine.what_to_know_before_buying : [];
  const likelyFitTags = Array.isArray(machine?.likely_fit_tags) ? machine.likely_fit_tags : [];
  const recommendedVideos = Array.isArray(machine?.recommendedVideos) ? machine.recommendedVideos : [];
  const displayTitle = machineDisplayTitle(machine);

  return `
    <article class="panel discovery-machine-card">
      <div class="discovery-machine-visual">
        ${renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb discovery-machine-image" })}
      </div>
      <div class="discovery-machine-copy">
        <div class="badge-row">
          <span class="badge">${machine.budget_band}</span>
          <span class="badge">${machine.manufacturer}</span>
          <span class="badge">${machine.era_category}</span>
          <span class="badge">${machine.theme}</span>
          ${machine.versions?.length > 1 ? `<span class="badge">${machine.versions.length} versions</span>` : ""}
        </div>
        <h2>${displayTitle}</h2>
        <p class="hero-copy">${machine.beginner_summary}</p>
        <p class="fit-summary"><strong>What it feels like to play:</strong> ${machine.play_experience_summary}</p>
        <div class="detail-list-block">
          <p><strong>Why people like it</strong></p>
          <ul class="result-list">
            ${whyPeopleLikeIt.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
        <div class="detail-list-block">
          <p><strong>What to know before buying</strong></p>
          <ul class="result-list">
            ${whatToKnow.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
        <div class="card-actions">
          ${renderVideoAction({ url: machine.overview_video_url, label: machine.overview_video_label || "Watch overview", title: `${machine.name} overview` })}
          ${renderVideoAction({ url: machine.gameplay_video_url, label: machine.gameplay_video_label || "Watch gameplay", title: `${machine.name} gameplay` })}
        </div>
        ${recommendedVideos.length ? `
          <p class="muted discovery-helper">Recommended watch path: ${recommendedVideos.map((video) => `${video.type} via ${video.creatorName}`).join(" · ")}</p>
        ` : ""}
        ${renderSignalPicker("What stands out most in a good way?", likedAspectOptions, state.draft.likedAspect, "likedAspect")}
        ${renderSignalPicker("Any immediate concern?", concernOptions, state.draft.concern, "concern")}
        <div class="discovery-tag-row">
          ${likelyFitTags.map((tag) => `<span class="badge">${tag}</span>`).join("")}
        </div>
      </div>
    </article>
    <div class="reaction-actions">
      <span class="muted reaction-prompt">${modeLabel}</span>
      ${options.map((option) => `
        <button class="btn ${option.value === options[0].value ? "btn-primary" : "btn-secondary"} reaction-btn" type="button" data-reaction="${option.value}">
          ${option.label}
        </button>
      `).join("")}
    </div>
  `;
}

function renderDiscoveryRound() {
  const machine = currentMachine();
  if (!machine) return "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Guided machine exploration",
        "See the machine, understand it in plain language, watch a quick overview or gameplay clip if needed, then react.",
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
        "Taste calibration",
        "Think back to what this machine felt like. You are not trying to score it correctly. You are just helping Pinball Scout understand your taste.",
        35 + Math.round(((state.deckIndex + 1) / state.deck.length) * 25),
        `Machine ${state.deckIndex + 1} of ${state.deck.length}`
      )}
      ${renderReactionCard(machine, calibrationReactionOptions, "How did this one land for you?")}
    </section>
  `;
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

  return `
    <article class="panel recommendation-card">
      <div class="recommendation-rank">${rankLabel}</div>
      ${renderMachineImage(suggestion.machine, { className: "machine-image-frame--thumb recommendation-card__image" })}
      <div class="badge-row">
        <span class="badge">${suggestion.machine.new_or_used_availability}</span>
        <span class="badge">${suggestion.machine.budget_band}</span>
        ${suggestion.machine.versions?.length > 1 ? `<span class="badge">${suggestion.machine.versions.length} versions</span>` : ""}
      </div>
      <h3>${displayTitle}</h3>
      <p class="muted">${suggestion.reason}</p>
      <p class="fit-summary">${suggestion.reveals}</p>
      ${helpsValidate}
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
    </article>
  `;
}

function renderExternalMachineCard(item) {
  const locations = item.locations || [];

  return `
    <article class="panel recommendation-card">
      <div class="recommendation-rank">Pinball Map</div>
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
    </article>
  `;
}

function renderResults() {
  const recommendations = currentRecommendations();

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Your refined shortlist",
        "These are the machines Pinball Scout thinks are most likely to fit what you enjoy. They are framed to help you move forward with more confidence, not to overwhelm you with specs.",
        75,
        "Top 3 recommendations"
      )}
      <div class="result-header panel">
        <p class="muted">Budget: <strong>${budgetLabel(state.context.budget)}</strong> · Condition: <strong>${choiceLabel("condition", state.context.condition)}</strong> · Timeline: <strong>${choiceLabel("timeline", state.context.timeline)}</strong></p>
      </div>
      <div class="discovery-results-grid">
        ${recommendations.map((machine, index) => {
          const likelyFitTags = Array.isArray(machine?.likely_fit_tags) ? machine.likely_fit_tags : [];
          const whatToKnow = Array.isArray(machine?.what_to_know_before_buying) ? machine.what_to_know_before_buying : [];
          const marketUrl = machine.externalLinks?.pinsideMarket || buildPinsideMarketUrl(machine);
          const pricing = pricingSummary(machine);
          const displayTitle = machineDisplayTitle(machine);

          return `
          <article class="panel recommendation-card">
            <div class="recommendation-rank">#${index + 1}</div>
            ${renderMachineImage(machine, { className: "machine-image-frame--thumb recommendation-card__image" })}
            <div class="badge-row">
              <span class="badge">${confidenceLabel(index)}</span>
              <span class="badge">${machine.budget_band}</span>
              <span class="badge">${machine.rarityLabel}</span>
              ${machine.versions?.length > 1 ? `<span class="badge">${machine.versions.length} versions</span>` : ""}
            </div>
            <h3>${displayTitle}</h3>
            <p class="muted">${machine.beginner_summary}</p>
            <p class="muted"><strong>${pricing.estimated.label}:</strong> ${pricing.estimated.rangeText}</p>
            ${pricing.used ? `<p class="muted"><strong>${pricing.used.label}:</strong> ${pricing.used.rangeText}</p>` : ""}
            <p><strong>Why this fits you</strong></p>
            <ul class="result-list">
              ${machine.whyItFits.map((reason) => `<li>${reason}</li>`).join("")}
            </ul>
            <p><strong>What you seem to like</strong></p>
            <div class="discovery-tag-row">
              ${likelyFitTags.map((tag) => `<span class="badge">${tag}</span>`).join("")}
            </div>
            <p class="muted"><strong>What to know before buying:</strong> ${whatToKnow[0] || machine.cautionNote || "This one is worth a closer look before buying."}</p>
            <p class="fit-summary"><strong>Confidence:</strong> ${machine.confidenceBlurb}</p>
            <p class="muted"><strong>Practicality:</strong> ${machine.validationDifficulty} · Findability ${machine.findabilityScore}/5</p>
            <p class="muted"><strong>Validation plan:</strong> ${machine.validationPlan}</p>
            <p class="muted"><strong>Accessibility:</strong> ${machine.practicalFitSummary}</p>
            ${machine.nearestLocation ? `<p class="muted"><strong>Nearest machine to play:</strong> ${machine.nearestLocation.name} in ${machine.nearestLocation.city}, ${machine.nearestLocation.state} · about ${machine.nearestDistance} miles</p>` : ""}
            ${machine.alternative ? `<p class="muted"><strong>Easier proxy to try first:</strong> ${machine.alternative.name}</p>` : ""}
            <p class="muted"><strong>Similar games shaping this result:</strong> ${(machine.proxy_machine_ids || []).slice(0, 2).map((id) => discoveryMachineIndex.get(id)?.name).filter(Boolean).join(", ") || "Your reactions in the guided flow."}</p>
            <div class="card-actions">
              ${renderVideoAction({ url: machine.overview_video_url, label: machine.overview_video_label || "Watch overview", title: `${machine.name} overview` })}
              ${renderVideoAction({ url: machine.gameplay_video_url, label: machine.gameplay_video_label || "Watch gameplay", title: `${machine.name} gameplay` })}
              <a class="btn btn-secondary small" href="${marketUrl}" target="_blank" rel="noreferrer">Used listings on Pinside</a>
              <a class="btn btn-secondary small" href="machine.html?slug=${machine.slug}">View details</a>
              <button class="btn btn-secondary small" type="button" data-action="${machine.nearbyLocations?.length ? `open-nearest:${machine.id}` : "open-nearby"}">${machine.nearbyLocations?.length ? "Find nearest machine to test" : "Find nearby places to test"}</button>
              <button class="btn btn-primary small" type="button" data-action="open-sourcing:${machine.id}">Help me find this machine</button>
            </div>
          </article>
        `;
        }).join("")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="open-nearby">Refine with real-world play</button>
        <button class="btn btn-primary" type="button" data-action="open-sourcing:${recommendations[0]?.id || ""}">Help me find a machine</button>
        <button class="btn btn-secondary" type="button" data-action="restart">Start over</button>
      </div>
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
                  ${location.website ? `<a class="btn btn-secondary small" href="${location.website}" target="_blank" rel="noreferrer">Open website</a>` : ""}
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

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Nearby taste probes",
        "You do not always need the exact machine nearby to make progress. These test suggestions are chosen because they can reveal useful taste signals and sharpen the shortlist.",
        85,
        nearbyCountLabel
      )}
      <form id="nearby-search-form" class="panel sourcing-form">
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
          <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to recommendations</button>
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
    </section>
  `;
}

function renderPostPlayFeedback() {
  const probe = probeById();
  if (!probe) return "";
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
      <article class="panel discovery-machine-card">
        <div class="discovery-machine-visual">
          ${renderMachineImage(probe.machine, { className: "machine-image-frame--thumb discovery-machine-image" })}
        </div>
        <div class="discovery-machine-copy">
          <div class="badge-row">
            <span class="badge">${probeBadge}</span>
            <span class="badge">${displayTitle}</span>
          </div>
          <h2>${displayTitle}</h2>
          <p class="muted">${probe.reason}</p>
          <div class="discovery-question-stack">
            ${postPlayQuestions.map((question) => `
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
          </div>
        </div>
      </article>
      <div class="discovery-actions">
        <button
          class="btn btn-primary"
          type="button"
          data-action="submit-post-play"
          ${(state.draft.enjoyment && state.draft.fun && state.draft.friction && state.draft.replay) ? "" : "disabled"}
        >
          Refine recommendations
        </button>
      </div>
    </section>
  `;
}

function renderSourcingForm() {
  const machine = sourcingMachine();
  const marketUrl = machine ? (machine.externalLinks?.pinsideMarket || buildPinsideMarketUrl(machine)) : "";
  const pinsideUrl = machine ? (machine.externalLinks?.pinside || buildPinsideMachineUrl(machine)) : "";
  const pricingUrl = machine ? (machine.externalLinks?.pinsidePricing || buildPinsidePricingUrl(machine)) : "";
  const conditionLabel = choiceLabel("condition", state.context.condition);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Help me find this machine",
        "Once you feel confident, Pinball Scout should help you take the next step. This lightweight handoff captures what you want and how you want to buy it.",
        100,
        machine ? machineDisplayTitle(machine) : "Sourcing"
      )}
      ${machine ? `
        <article class="panel">
          <div class="section-head compact">
            <div>
              <p class="eyebrow">Direct market path</p>
              <h3>Use Pinside to check current supply first</h3>
            </div>
          </div>
          <p class="muted">Pinball Scout cannot pull live Pinside classifieds into this static app, but it can send you straight to the exact machine market page. This is the fastest way to see active used listings, seller locations, and recent asking prices for ${machineDisplayTitle(machine)}.</p>
          <p class="muted"><strong>Your current buying frame:</strong> ${budgetLabel(state.context.budget)} · ${conditionLabel} · ${choiceLabel("travelWillingness", state.context.travelWillingness)}</p>
          <div class="card-actions">
            <a class="btn btn-primary" href="${marketUrl}" target="_blank" rel="noreferrer">Open used listings on Pinside</a>
            <a class="btn btn-secondary" href="${pricingUrl}" target="_blank" rel="noreferrer">Check price history</a>
            <a class="btn btn-secondary" href="${pinsideUrl}" target="_blank" rel="noreferrer">Open machine page</a>
          </div>
        </article>
      ` : ""}
      <form id="sourcing-form" class="panel sourcing-form">
        <input type="hidden" name="machine" value="${machine?.name || ""}" />
        <input type="hidden" name="form-name" value="${leadCaptureConfig.formName}" />
        <div class="form-grid">
          <label>Name<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Machine<input value="${machine?.name || ""}" disabled /></label>
          <label>Budget<select name="budget" required>${discoveryContextQuestions.find((question) => question.id === "budget").choices.map((choice) => `<option value="${choice.label}" ${state.context.budget === choice.value ? "selected" : ""}>${choice.label}</option>`).join("")}</select></label>
          <label>New / used<select name="condition" required>${discoveryContextQuestions.find((question) => question.id === "condition").choices.map((choice) => `<option value="${choice.label}" ${state.context.condition === choice.value ? "selected" : ""}>${choice.label}</option>`).join("")}</select></label>
          <label>Travel / ship<select name="travel" required>${discoveryContextQuestions.find((question) => question.id === "travelWillingness").choices.map((choice) => `<option value="${choice.label}" ${state.context.travelWillingness === choice.value ? "selected" : ""}>${choice.label}</option>`).join("")}</select></label>
          <label>Timeline<select name="timeline" required>${discoveryContextQuestions.find((question) => question.id === "timeline").choices.map((choice) => `<option value="${choice.label}" ${state.context.timeline === choice.value ? "selected" : ""}>${choice.label}</option>`).join("")}</select></label>
        </div>
        <label>Anything else?<textarea name="notes" rows="4" placeholder="Tell us if you prefer a safer first buy, whether you need family-friendly appeal, or anything else that matters."></textarea></label>
        <div class="discovery-actions">
          <button class="btn btn-primary" type="submit" ${state.sourcingState.submitting ? "disabled" : ""}>${state.sourcingState.submitting ? "Submitting..." : "Send request"}</button>
          <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to recommendations</button>
        </div>
        ${state.sourcingState.message ? `<p class="muted">${state.sourcingState.message}</p>` : ""}
      </form>
    </section>
  `;
}

function render() {
  if (!root) return;

  let view = renderEntryScreen();
  if (state.screen === "discovery-setup") view = renderDiscoverySetup();
  if (state.screen === "calibration-setup") view = renderCalibrationSetup();
  if (state.screen === "discovery-round") view = renderDiscoveryRound();
  if (state.screen === "calibration-round") view = renderCalibrationRound();
  if (state.screen === "results") view = renderResults();
  if (state.screen === "nearby-test") view = renderNearbyTestPlan();
  if (state.screen === "post-play-feedback") view = renderPostPlayFeedback();
  if (state.screen === "sourcing") view = renderSourcingForm();

  root.innerHTML = `${view}${renderNearestMachineModal()}${renderVideoModal(state.activeVideo)}`;
  attachImageFallbacks(root);
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

async function startDiscovery() {
  state.mode = "discovery";
  state.deck = buildReactionDeck(state.context, 6);
  state.deckIndex = 0;
  state.reactions = [];
  resetDraft();
  await preloadNearbyContext();
  state.screen = "discovery-round";
  trackEvent("discovery_started", { mode: "discovery", budget: state.context.budget, condition: state.context.condition });
  render();
}

async function startCalibration() {
  state.mode = "calibration";
  state.deck = state.selectedPlayedMachines.map((id) => discoveryMachineIndex.get(id)).filter(Boolean);
  state.deckIndex = 0;
  state.reactions = [];
  resetDraft();
  await preloadNearbyContext();
  state.screen = "calibration-round";
  trackEvent("discovery_started", { mode: "calibration", selectedCount: state.deck.length, budget: state.context.budget });
  render();
}

function advanceReaction(rawReaction) {
  const machine = currentMachine();
  if (!machine) return;

  state.reactions.push({
    machineId: machine.id,
    reaction: normalizeReaction(rawReaction),
    source: state.mode === "calibration" ? "played-before" : "video-preview",
    weight: state.mode === "calibration" ? 1.35 : 1,
    likedAspect: state.draft.likedAspect,
    concern: state.draft.concern
  });

  if (state.deckIndex >= state.deck.length - 1) {
    state.screen = "results";
    trackEvent("discovery_completed", { mode: state.mode, reactions: state.reactions.length });
  } else {
    state.deckIndex += 1;
  }

  resetDraft();
  render();
}

function openNearbyPlan() {
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

  state.reactions.push({
    machineId: probe.machineId,
    reaction: normalizeReaction(state.draft.enjoyment),
    source: probe.probeType === "exact" ? "real-play-exact" : probe.probeType === "proxy" ? "real-play-proxy" : "real-play-nearby",
    weight: probe.probeType === "exact" ? 2.5 : probe.probeType === "proxy" ? 1.8 : 1.5,
    likedAspect: state.draft.fun,
    concern: state.draft.friction === "none" ? "just-right" : state.draft.friction === "too-hard" ? "too-complex" : state.draft.friction === "too-easy" ? "too-simple" : state.draft.friction,
    replay: state.draft.replay
  });

  resetDraft();
  state.screen = "results";
  trackEvent("post_play_feedback_submit", { machineId: probe.machineId, probeType: probe.probeType });
  render();
}

async function handleSourcingSubmit(form) {
  const machine = sourcingMachine();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  payload.machine = machine?.name || payload.machine;
  payload.source = "pinball-scout-sourcing";

  try {
    await submitLead(payload);
    state.sourcingState = {
      submitting: false,
      submitted: true,
      message: leadCaptureConfig.successMessage
    };
    trackEvent("sourcing_submit", { machine: payload.machine, budget: payload.budget });
  } catch (error) {
    console.error(error);
    state.sourcingState = {
      submitting: false,
      submitted: false,
      message: error.name === "LeadCaptureConfigError" ? error.message : leadCaptureConfig.errorMessage
    };
  }

  render();
}

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
    if (key === "travelWillingness") {
      state.locationSearch.maxMiles = defaultRadiusForTravel(value);
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
  if (action === "start-discovery") return void startDiscovery();
  if (action === "start-calibration") return void startCalibration();
  if (action === "open-nearby") return void openNearbyPlan();
  if (action === "submit-post-play") return void submitPostPlayFeedback();
  if (action === "back-to-results") {
    state.screen = "results";
    resetDraft();
    render();
    return;
  }
  if (action === "close-nearest-modal") {
    state.activeNearestMachineId = "";
    render();
    return;
  }
  if (action === "close-video-modal") {
    state.activeVideo = null;
    render();
    return;
  }

  if (action?.startsWith("log-play:")) {
    state.activeProbeId = action.split(":")[1];
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

  if (action?.startsWith("open-sourcing:")) {
    state.sourcingMachineId = action.split(":")[1];
    state.sourcingState = { submitting: false, submitted: false, message: "" };
    state.screen = "sourcing";
    render();
    return;
  }

  if (action === "restart") {
    state.screen = "entry";
    state.mode = null;
    state.context = defaultContext();
    state.selectedPlayedMachines = [];
    state.deck = [];
    state.deckIndex = 0;
    state.reactions = [];
    state.nearbySuggestions = [];
    state.nearbyCatalogSuggestions = [];
    state.nearbyExternalSuggestions = [];
    state.activeNearestMachineId = "";
    state.activeVideo = null;
    state.locationSearch = { zip: "", maxMiles: "50", locations: [], hasSearched: false, error: "", machineLocationIndex: new Map() };
    state.activeProbeId = "";
    state.sourcingMachineId = "";
    state.sourcingState = { submitting: false, submitted: false, message: "" };
    resetDraft();
    render();
    return;
  }

  const reaction = event.target.closest("[data-reaction]")?.dataset.reaction;
  if (reaction) {
    advanceReaction(reaction);
  }
});

root?.addEventListener("submit", (event) => {
  const nearbyForm = event.target.closest("#nearby-search-form");
  if (nearbyForm) {
    event.preventDefault();
    searchNearbyLocations(nearbyForm);
    return;
  }

  const form = event.target.closest("#sourcing-form");
  if (!form) return;
  event.preventDefault();
  handleSourcingSubmit(form);
});

root?.addEventListener("input", (event) => {
  const zipInput = event.target.closest("#context-zip");
  if (!zipInput) return;

  const normalizedZip = String(zipInput.value || "").replace(/\D/g, "").slice(0, 5);
  zipInput.value = normalizedZip;
  state.context.zip = normalizedZip;
  state.locationSearch.zip = state.context.zip;

  const discoveryReady = Boolean(
    state.context.budget &&
    state.context.condition &&
    state.context.playAccess &&
    state.context.travelWillingness &&
    state.context.timeline &&
    normalizedZip.length === 5
  );

  const calibrationReady = Boolean(
    state.context.budget &&
    state.context.condition &&
    state.context.travelWillingness &&
    state.context.timeline &&
    state.selectedPlayedMachines.length &&
    normalizedZip.length === 5
  );

  const discoveryButton = root.querySelector('[data-action="start-discovery"]');
  if (discoveryButton) {
    discoveryButton.disabled = !discoveryReady;
  }

  const calibrationButton = root.querySelector('[data-action="start-calibration"]');
  if (calibrationButton) {
    calibrationButton.disabled = !calibrationReady;
  }
});

render();
updateCompareCount();
