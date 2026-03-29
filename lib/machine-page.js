import { machines } from "../data/machines.js";
import { discoveryMachineIndex } from "../data/discovery-machines.js";
import { buildPinsideMarketUrl } from "./services/pinside-market.js";
import { getMachineMedia, mergeMachineMedia } from "./services/media/media-library.js";
import { renderGlossaryAwareTag, renderMachineGlossaryTerms, initGlossary } from "./glossary.js";
import { renderVideoAction, renderVideoModal } from "./video.js";
import {
  attachCompareButtons,
  attachImageFallbacks,
  buyerFitSummary,
  compareStore,
  decisionTradeoff,
  formatConditionLabel,
  formatCurrency,
  machineCard,
  pricePositionSummary,
  renderMachineImage,
  ownershipSummary,
  scoreLabel,
  trackEvent,
  updateCompareCount
} from "./utils.js";
import * as utils from "./utils.js";

const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");
const machine = machines.find((m) => m.slug === slug);
const machineWithMedia = machine ? mergeMachineMedia(machine) : null;
const discoveryMachine = discoveryMachineIndex.get(slug) || null;
const media = machine ? getMachineMedia(machine) : null;
const detail = document.querySelector("#machine-detail");
const similar = document.querySelector("#similar-machines");
let activeVideo = null;
let showVersionDifferences = false;

function pricingSummary(machineRecord) {
  if (typeof utils.machinePricingSummary === "function") {
    return utils.machinePricingSummary(machineRecord);
  }

  return {
    estimated: {
      label: "Estimated price",
      rangeText: `${formatCurrency(machineRecord.estimated_price_min)}–${formatCurrency(machineRecord.estimated_price_max)}`,
      detailText: "Seeded catalog estimate"
    },
    used: null,
    marketPricing: null
  };
}

function pricingRecord(machineRecord) {
  if (typeof utils.getMarketPricing === "function") {
    return utils.getMarketPricing(machineRecord);
  }

  return null;
}

function displayTitleFor(machineRecord) {
  if (typeof utils.machineDisplayTitle === "function") {
    return utils.machineDisplayTitle(machineRecord);
  }

  return machineRecord?.name || machineRecord?.title || "";
}

function versionSummariesFor(machineRecord) {
  if (typeof utils.machineVersionSummaries === "function") {
    return utils.machineVersionSummaries(machineRecord);
  }

  return Array.isArray(machineRecord?.versions)
    ? machineRecord.versions.map((version) => ({
      version,
      summary: "Different trim of the same game family.",
      tradeoff: "Worth comparing if trim-level features or collector value matter to you."
    }))
    : [];
}

function versionPricingFor(machineRecord) {
  if (typeof utils.machineVersionPricing === "function") {
    return utils.machineVersionPricing(machineRecord);
  }

  return Array.isArray(machineRecord?.versions)
    ? machineRecord.versions.map((version) => ({
      version,
      estimatedRange: {
        min: machineRecord.estimated_price_min,
        max: machineRecord.estimated_price_max,
        rangeText: `${formatCurrency(machineRecord.estimated_price_min)}–${formatCurrency(machineRecord.estimated_price_max)}`
      },
      usedRange: null,
      priceDeltaText: "Version-specific price differences are not available.",
      comparisonText: "Changes the trim package more than the game family itself."
    }))
    : [];
}

function videoProfileFor(machineRecord, discoveryRecord) {
  if (typeof utils.machineVideoProfile === "function") {
    return utils.machineVideoProfile(machineRecord, discoveryRecord);
  }

  const machineName = machineRecord?.name || machineRecord?.title || "";
  return {
    overview: {
      url: discoveryRecord?.overview_video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${machineName} pinball overview`)}`,
      label: discoveryRecord?.overview_video_label || "Watch overview",
      title: `${machineName} overview`
    },
    gameplay: {
      url: discoveryRecord?.gameplay_video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(`${machineName} pinball gameplay walkthrough`)}`,
      label: discoveryRecord?.gameplay_video_label || "Watch gameplay",
      title: `${machineName} gameplay`
    }
  };
}

function renderDetail() {
  if (!machineWithMedia) {
    detail.innerHTML = `<div class="panel empty-state"><h2>Machine not found</h2><p class="muted">Go back to the directory and try another machine.</p></div>`;
    return;
  }

  const beginner = scoreLabel(machineWithMedia.beginner_friendliness);
  const family = scoreLabel(machineWithMedia.family_friendliness);
  const complexity = scoreLabel(machineWithMedia.rules_complexity);
  const maintenance = scoreLabel(machineWithMedia.maintenance_difficulty);
  const marketPricing = pricingRecord(machineWithMedia);
  const pricing = pricingSummary(machineWithMedia);
  const displayTitle = displayTitleFor(machineWithMedia);
  const versionSummaries = versionSummariesFor(machineWithMedia);
  const versionPricing = versionPricingFor(machineWithMedia);
  const videoProfile = videoProfileFor(machineWithMedia, discoveryMachine);
  const externalPinsideUrl = discoveryMachine?.externalLinks?.pinside || machineWithMedia.pinsideUrl || "";
  const externalPinsideMarketUrl = discoveryMachine?.externalLinks?.pinsideMarket || machineWithMedia.pinsideMarketUrl || buildPinsideMarketUrl(machineWithMedia);
  const externalIpdbUrl = discoveryMachine?.externalLinks?.ipdb || machineWithMedia.ipdbUrl || "";

  detail.innerHTML = `
    <section class="machine-header">
      <div>
        <article class="panel machine-card detail-card">
          ${renderMachineImage(machineWithMedia, { eager: true })}
          <div class="badge-row">
            <span class="badge">${machineWithMedia.manufacturer}</span>
            <span class="badge">${machineWithMedia.year}</span>
            <span class="badge">${machineWithMedia.theme}</span>
            <span class="badge">${formatConditionLabel(machineWithMedia.condition_availability)}</span>
            ${machineWithMedia.versions.length > 1 ? `<span class="badge">${machineWithMedia.versions.length} versions</span>` : ""}
          </div>
          <h1 class="detail-title">${displayTitle}</h1>
          <p class="hero-copy">${discoveryMachine?.beginner_summary || machineWithMedia.description}</p>
          <p class="fit-summary"><strong>Buyer fit:</strong> ${buyerFitSummary(machineWithMedia)}</p>
          <p class="muted"><strong>Price position:</strong> ${pricePositionSummary(machineWithMedia)}</p>
          <p><strong>${pricing.estimated.rangeText}</strong></p>
          <p class="muted"><strong>${pricing.estimated.label}:</strong> ${pricing.estimated.detailText}</p>
          ${pricing.used ? `<p class="muted"><strong>${pricing.used.label}:</strong> ${pricing.used.rangeText} · ${pricing.used.detailText}</p>` : ""}
          ${media ? `<p class="muted"><strong>Image source:</strong> ${media.imageSource}${media.attributionText ? ` · ${media.attributionText}` : ""}</p>` : ""}
          <div class="card-actions">
            ${renderVideoAction({ url: videoProfile.overview.url, label: videoProfile.overview.label, title: videoProfile.overview.title })}
            ${renderVideoAction({ url: videoProfile.gameplay.url, label: videoProfile.gameplay.label, title: videoProfile.gameplay.title })}
          </div>
        </article>
        <div class="hero-actions detail-cta-row">
          <a class="btn btn-primary" href="help.html">Find your first pin</a>
          <button class="btn btn-secondary compare-toggle" data-slug="${machineWithMedia.slug}" type="button">
            ${compareStore.has(machineWithMedia.slug) ? "Selected for compare" : "Add to compare"}
          </button>
          <a class="text-link" href="machines.html?manufacturer=${encodeURIComponent(machineWithMedia.manufacturer)}">Browse similar machines</a>
        </div>
      </div>
      <aside class="detail-sidebar">
        <div class="panel">
          <h3>At a glance</h3>
          <div class="kv-grid">
            <div class="kv"><small>${pricing.estimated.label}</small><strong>${pricing.estimated.rangeText}</strong></div>
            ${pricing.used ? `<div class="kv"><small>${pricing.used.label}</small><strong>${pricing.used.rangeText}</strong></div>` : ""}
            <div class="kv"><small>Availability</small><strong>${formatConditionLabel(machineWithMedia.condition_availability)}</strong></div>
            <div class="kv"><small>Versions</small><strong>${machineWithMedia.versions.join(" · ")}</strong></div>
            <div class="kv"><small>Best ownership fit</small><strong>${ownershipSummary(machineWithMedia)}</strong></div>
            <div class="kv"><small>Beginner friendliness</small><span class="badge ${beginner.className}">${beginner.text}</span></div>
            <div class="kv"><small>Family friendliness</small><span class="badge ${family.className}">${family.text}</span></div>
            <div class="kv"><small>Rules complexity</small><span class="badge ${complexity.className}">${complexity.text}</span></div>
            <div class="kv"><small>Maintenance difficulty</small><span class="badge ${maintenance.className}">${maintenance.text}</span></div>
            ${marketPricing?.sampleSize ? `<div class="kv"><small>Pricing sample</small><strong>${marketPricing.sampleSize} observed sales</strong></div>` : ""}
            ${marketPricing?.lastObservedMonth ? `<div class="kv"><small>Pricing updated</small><strong>${marketPricing.lastObservedMonth}</strong></div>` : ""}
            ${media ? `<div class="kv"><small>Media sync</small><strong>${media.status}</strong></div>` : ""}
          </div>
        </div>
        <div class="panel decision-panel">
          <h3>Decision guidance</h3>
          <p class="muted"><strong>Buyer fit:</strong> ${buyerFitSummary(machineWithMedia)}</p>
          <p class="muted"><strong>Main tradeoff:</strong> ${decisionTradeoff(machineWithMedia)}</p>
          <p class="muted"><strong>${pricing.estimated.label}:</strong> ${pricing.estimated.rangeText}</p>
          ${pricing.used ? `<p class="muted"><strong>${pricing.used.label}:</strong> ${pricing.used.rangeText}</p>` : ""}
          <p class="muted"><strong>Best for:</strong> ${machineWithMedia.best_for}</p>
          <p class="muted"><strong>Watch-out:</strong> ${machineWithMedia.considerations}</p>
          ${discoveryMachine ? `<p class="muted"><strong>Findability:</strong> ${discoveryMachine.rarityLabel} · ${discoveryMachine.validationDifficulty}</p>` : ""}
          ${media?.sourcePageUrl ? `<p class="muted"><strong>Image reference:</strong> <a class="text-link" href="${media.sourcePageUrl}" target="_blank" rel="noreferrer">Open source page</a></p>` : ""}
          <p class="muted"><a class="text-link" href="glossary.html">New to pinball terms? Open the glossary.</a></p>
        </div>
      </aside>
    </section>

    <section class="section-inner">
      <div class="kv-grid">
        <div class="panel">
          <h3>Why buyers shortlist it</h3>
          ${discoveryMachine
            ? `<ul class="result-list">${discoveryMachine.why_people_like_it.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : `<p class="muted">${machineWithMedia.why_like_it}</p>`
          }
        </div>
        <div class="panel"><h3>Ownership feel</h3><p class="muted">${ownershipSummary(machineWithMedia)}</p></div>
        <div class="panel">
          <h3>What to know before buying</h3>
          ${discoveryMachine
            ? `<ul class="result-list">${discoveryMachine.what_to_know.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : `<p class="muted">${decisionTradeoff(machineWithMedia)}</p>`
          }
        </div>
        <div class="panel"><h3>Who it tends to fit</h3><p class="muted">${machineWithMedia.best_for}</p></div>
        ${versionSummaries.length ? `
          <div class="panel">
            <div class="section-head compact version-compare-head">
              <div>
                <h3>Version comparison</h3>
                <p class="muted">This page treats ${displayTitle} as one game family. Compare the trims here before you buy.</p>
              </div>
              <button class="btn btn-secondary small" type="button" data-action="toggle-version-differences">
                ${showVersionDifferences ? "Show all notes" : "Highlight differences"}
              </button>
            </div>
            <div class="discovery-question-stack">
              ${versionSummaries.map((item, index) => `
                <article class="panel nearest-location-card">
                  <div class="badge-row">
                    <span class="badge">${item.version}</span>
                    <span class="badge">${versionPricing[index]?.estimatedRange.rangeText || pricing.estimated.rangeText}</span>
                  </div>
                  <p class="muted">${showVersionDifferences ? versionPricing[index]?.comparisonText || item.summary : item.summary}</p>
                  <p class="muted"><strong>Tradeoff:</strong> ${item.tradeoff}</p>
                  <p class="muted"><strong>Estimated price range:</strong> ${versionPricing[index]?.estimatedRange.rangeText || pricing.estimated.rangeText}</p>
                  ${versionPricing[index]?.usedRange ? `<p class="muted"><strong>${versionPricing[index].usedRange.sourceType === "market" ? "Typical used range" : "Approximate used range"}:</strong> ${versionPricing[index].usedRange.rangeText}</p>` : ""}
                  <p class="muted"><strong>Difference:</strong> ${versionPricing[index]?.priceDeltaText || "Version-specific price differences are not available."}</p>
                </article>
              `).join("")}
            </div>
          </div>
        ` : ""}
        ${(discoveryMachine?.recommendedVideos?.length) ? `
          <div class="panel">
            <h3>Recommended videos</h3>
            <div class="card-actions">
              ${discoveryMachine.recommendedVideos.map((video) => renderVideoAction({
                url: video.url,
                label: video.label || (video.type === "overview" ? "Overview" : "Gameplay"),
                title: `${machineWithMedia.name} ${video.type}`
              })).join("")}
            </div>
            <p class="muted">Use overview and gameplay videos to validate feel before you drive to try one.</p>
          </div>
        ` : ""}
        ${(externalPinsideMarketUrl || externalPinsideUrl || externalIpdbUrl) ? `
          <div class="panel">
            <h3>External references</h3>
            <div class="card-actions">
              ${externalPinsideMarketUrl ? `<a class="btn btn-primary small" href="${externalPinsideMarketUrl}" target="_blank" rel="noreferrer">Used listings on Pinside</a>` : ""}
              ${externalPinsideUrl ? `<a class="btn btn-secondary small" href="${externalPinsideUrl}" target="_blank" rel="noreferrer">Pinside</a>` : ""}
              ${externalIpdbUrl ? `<a class="btn btn-secondary small" href="${externalIpdbUrl}" target="_blank" rel="noreferrer">IPDB</a>` : ""}
            </div>
          </div>
        ` : ""}
        <div class="panel">
          <h3>Pinball terms that show up here</h3>
          <p class="muted">Tap a term for a quick plain-English definition.</p>
          ${renderMachineGlossaryTerms(machineWithMedia)}
        </div>
        <div class="panel"><h3>Tags</h3><div class="badge-row">${machineWithMedia.tags.map((tag) => renderGlossaryAwareTag(tag)).join("")}</div></div>
      </div>
    </section>
  ${renderVideoModal(activeVideo)}
  `;

  const similarMachines = machines
    .filter((m) => m.slug !== machineWithMedia.slug && (m.theme === machineWithMedia.theme || m.manufacturer === machineWithMedia.manufacturer))
    .slice(0, 3);

  similar.innerHTML = similarMachines.map((item) => machineCard(item)).join("");
  attachCompareButtons(document);
  attachImageFallbacks(document);
  initGlossary(detail);
  updateCompareCount();
}

if (!machineWithMedia) {
  renderDetail();
} else {
  trackEvent("machine_detail_view", { slug: machineWithMedia.slug, name: machineWithMedia.name });
  renderDetail();
}

detail?.addEventListener("click", (event) => {
  const videoButton = event.target.closest("[data-video-url]");
  if (videoButton) {
    activeVideo = {
      url: videoButton.dataset.videoUrl,
      title: videoButton.dataset.videoTitle || "Pinball video"
    };
    renderDetail();
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "toggle-version-differences") {
    showVersionDifferences = !showVersionDifferences;
    renderDetail();
    return;
  }
  if (action === "close-video-modal") {
    activeVideo = null;
    renderDetail();
  }
});

similar?.addEventListener("click", (event) => {
  const videoButton = event.target.closest("[data-video-url]");
  if (!videoButton) return;

  activeVideo = {
    url: videoButton.dataset.videoUrl,
    title: videoButton.dataset.videoTitle || "Pinball video"
  };
  renderDetail();
});
