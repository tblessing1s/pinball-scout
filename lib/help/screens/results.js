import { state } from "../state.js";
import { renderProgress } from "../components.js";
import { discoveryTastePrompts } from "../../../data/discovery-flow.js";
import { machineDisplayTitle, renderMachineImage, renderSplitCard } from "../../utils.js";
import { buildPlayerArchetype } from "./taste.js";
import { buildAffiliateUrl } from "../../outbound.js";
import { budgetLabel, choiceLabel } from "../helpers.js";

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

export function renderPreferenceReflection(buildPreferenceReflection) {
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

export function renderResults(
  currentRecommendationState,
  framedRecommendations,
  buildTasteInsightLines,
  buildRefinementSignals,
  pricingSummary,
  buildPinsideMarketUrl,
  loadDecisionState
) {
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
      ${state.revalSignal === "major" ? `
        <div class="panel reval-signal reval-signal--major">
          <p class="eyebrow">Your top pick shifted</p>
          <h3>Your play history updated your #1 recommendation</h3>
          <p class="muted">Machines you've played are now factored into your rankings.</p>
          <div class="card-actions">
            <button class="btn btn-secondary small" type="button" data-action="reval-dismiss">Got it</button>
          </div>
        </div>
      ` : state.revalSignal === "minor" ? `
        <div class="panel reval-signal reval-signal--minor">
          <p class="eyebrow">Rankings updated</p>
          <h3>Your top pick held — play history added to your profile</h3>
          <p class="muted">Your shortlist shifted slightly based on machines you've played.</p>
          <div class="card-actions">
            <button class="btn btn-secondary small" type="button" data-action="reval-dismiss">Got it</button>
          </div>
        </div>
      ` : ""}
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
        <p class="eyebrow">Next step</p>
        <h3>Turn your shortlist into a buying plan</h3>
        <p class="muted">Use a structured decision closure checklist before opening listings or deep detail pages.</p>
        <div class="card-actions">
          <button class="btn btn-primary" type="button" data-action="open-sourcing:${topRecommendation?.id || ""}">Continue buying plan</button>
          <button class="btn btn-secondary" type="button" data-action="open-nearby">Find a place to test</button>
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
