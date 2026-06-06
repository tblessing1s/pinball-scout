import { state } from "../state.js";
import { renderProgress } from "../components.js";
import { discoveryMachineIndex } from "../../../data/discovery-machines.js";
import { machineDisplayTitle, renderMachineImage, renderSplitCard } from "../../utils.js";
import { getBracketFinalThree, renderBracketTestGroup } from "./bracket.js";
import { proxyTraitPrompts } from "./rounds.js";
import { likedAspectOptions } from "../../../data/discovery-flow.js";

export function rankedProxyTraitChecks(machine, limit = 4) {
  const profile = machine?.trait_profile || {};
  const ranked = proxyTraitPrompts
    .map((item) => ({ ...item, score: Number(profile[item.key] || 3) }))
    .sort((a, b) => b.score - a.score);

  return [...ranked.slice(0, 3).map((item) => ({ ...item, prompt: item.high, positive: true })), ...ranked.slice(-1).map((item) => ({ ...item, prompt: item.low, positive: false }))]
    .slice(0, limit);
}

export function proxyChecklistItems(suggestion) {
  const checks = rankedProxyTraitChecks(suggestion.machine, suggestion.probeType === "proxy" ? 4 : 3);
  return checks.map((item) => item.prompt);
}

export function renderProbeCard(suggestion) {
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
      : suggestion.probeType === "component-proxy"
        ? "Best available proxy"
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
        ${suggestion.machine.new_or_used_availability ? `<span class="badge">${suggestion.machine.new_or_used_availability}</span>` : ""}
        ${suggestion.machine.budget_band ? `<span class="badge">${suggestion.machine.budget_band}</span>` : ""}
        ${(suggestion.machine.versions?.length || 0) > 1 ? `<span class="badge">${suggestion.machine.versions.length} versions</span>` : ""}
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
        ${suggestion.machine.gameplay_video_url ? `<a class="btn btn-secondary small" href="${suggestion.machine.gameplay_video_url}" target="_blank" rel="noreferrer">Preview before you go</a>` : ""}
        <button class="btn btn-primary small" type="button" data-action="log-play:${suggestion.machineId}">I played this</button>
      </div>
    `
  });
}

export function postPlayQuestionsFor(probe) {
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

export function isPostPlayComplete(probe) {
  const questions = postPlayQuestionsFor(probe);
  return questions.every((question) => Boolean(state.draft[question.id]));
}

export function renderNearbyTestPlan(renderExternalMachineCard, sourcingMachine, currentRecommendations) {
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
          ${bracketMachines.map((m, i) => renderBracketTestGroup(m, i, state.nearbySuggestions, rankedProxyTraitChecks)).join("")}
        </div>
        ${state.locationSearch.hasSearched && state.locationSearch.error === "" && !state.nearbySuggestions.length ? `
          <div class="panel empty-state">
            <h3>No playable matches found nearby</h3>
            <p class="muted">Pinball Map didn't find any of your bracket machines or their proxies within ${state.locationSearch.maxMiles} miles of ${state.locationSearch.zip}. Try a larger search radius, or log a game you've already played using the button above.</p>
          </div>
        ` : ""}
        ${(() => {
          const bracketPlayedCount = bracketMachines.filter((m) =>
            (state.reactions || []).some((r) => r.machineId === m.id && String(r.source || "").startsWith("real-play"))
          ).length;
          return bracketMachines.length > 0 && bracketPlayedCount >= bracketMachines.length ? `
            <div class="panel results-next-step">
              <p class="eyebrow">You've played all your bracket machines</p>
              <h3>See your updated shortlist</h3>
              <p class="muted">Your play history has been factored in. Check whether your rankings shifted.</p>
              <div class="card-actions">
                <button class="btn btn-primary" type="button" data-action="go-to-results">View updated shortlist</button>
              </div>
            </div>
          ` : "";
        })()}
      ` : `
        <div class="discovery-results-grid">
          ${state.nearbySuggestions.length
            ? state.nearbySuggestions.map((suggestion) => renderProbeCard(suggestion)).join("")
            : state.locationSearch.hasSearched && hasLiveLocations
              ? `<div class="panel empty-state"><h3>No nearby preference matches yet</h3><p class="muted">Pinball Map returned nearby locations for ${state.locationSearch.zip}, but none of the close-by machines matched your current shortlist or proxy validation targets.</p></div>`
              : state.locationSearch.hasSearched
                ? `<div class="panel empty-state"><h3>No Pinball Map locations found nearby</h3><p class="muted">No mapped public locations in the live Pinball Map results were within ${state.locationSearch.maxMiles} miles of ${state.locationSearch.zip}. Try a larger radius.</p></div>`
              : `<div class="panel empty-state"><h3>Start with your zip code</h3><p class="muted">We'll use live Pinball Map location data to suggest nearby exact matches and proxy machines worth trying.</p></div>`
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

export function renderPostPlayFeedback(probeById, mergeTraitSignals) {
  const probe = probeById();
  if (!probe) return "";
  const questions = postPlayQuestionsFor(probe);
  const probeBadge = probe.probeType === "exact" ? "Exact probe" : probe.probeType === "proxy" ? "Proxy probe" : "Nearby machine";
  const progressBadge = probe.probeType === "exact" ? "Exact machine played" : probe.probeType === "proxy" ? "Proxy machine played" : "Nearby machine played";
  const displayTitle = machineDisplayTitle(probe.machine);
  const targetMachine = probe.targetIds?.[0] ? discoveryMachineIndex.get(probe.targetIds[0]) : null;
  const focusPoints = targetMachine ? rankedProxyTraitChecks(targetMachine, 3).map((c) => c.prompt) : [];

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
          ${focusPoints.length ? `
            <div class="detail-list-block">
              <p class="muted"><strong>What you were testing for:</strong> ${focusPoints.join(" · ")}</p>
            </div>
          ` : ""}
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
