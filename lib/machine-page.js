import { machines } from "../data/machines.js";
import { discoveryMachineIndex } from "../data/discovery-machines.js";
import { buildPinsideMarketUrl } from "./services/pinside-market.js";
import { getMachineMedia, mergeMachineMedia } from "./services/media/media-library.js";
import { renderGlossaryAwareTag, renderMachineGlossaryTerms, initGlossary } from "./glossary.js";
import { renderVideoAction, renderVideoModal } from "./video.js";
import { initNav } from "./nav.js";
import {
  attachCompareButtons,
  attachImageFallbacks,
  buyerFitSummary,
  compareStore,
  decisionTradeoff,
  formatConditionLabel,
  formatCurrency,
  pricePositionSummary,
  renderMachineImage,
  renderSplitCard,
  ownershipSummary,
  scoreLabel,
  trackEvent,
  updateCompareCount
} from "./utils.js";
import * as utils from "./utils.js";
import { attachOutboundTracking, buildAffiliateUrl } from "./outbound.js";

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
const MAX_LIST_ITEMS = 3;
initNav();

function renderAccordion({ title, body, isOpen = false }) {
  if (!body) return "";
  return `
    <details class="accordion"${isOpen ? " open" : ""}>
      <summary>${title}</summary>
      <div class="accordion__body">${body}</div>
    </details>
  `;
}

function renderLimitedList(items = [], limit = MAX_LIST_ITEMS) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const primary = list.slice(0, limit);
  const extra = list.slice(limit);

  const primaryList = primary.length
    ? `<ul class="result-list">${primary.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : `<p class="muted">No notes yet.</p>`;

  if (!extra.length) return primaryList;

  return `
    ${primaryList}
    ${renderAccordion({
      title: `Show ${extra.length} more`,
      body: `<ul class="result-list">${extra.map((item) => `<li>${item}</li>`).join("")}</ul>`
    })}
  `;
}

function compactMachineCard(machine) {
  const displayTitle = displayTitleFor(machine);
  return renderSplitCard({
    className: "compact-machine-card",
    mediaClassName: "compact-machine-card__media",
    imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image compact-machine-card__image" }),
    bodyHtml: `
      <div>
        <h3>${displayTitle}</h3>
        <p class="muted">${buyerFitSummary(machine)}</p>
        <div class="card-actions">
          <a class="btn btn-secondary small" href="machine.html?slug=${machine.slug}">View details</a>
          <button class="btn btn-primary small compare-toggle" data-slug="${machine.slug}" type="button">
            ${compareStore.has(machine.slug) ? "Selected for compare" : "Add to compare"}
          </button>
        </div>
      </div>
    `
  });
}

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
  const externalPinsideUrl = buildAffiliateUrl(discoveryMachine?.externalLinks?.pinside || machineWithMedia.pinsideUrl || "", { machineSlug: machineWithMedia.slug, placement: "machine-detail" });
  const externalPinsideMarketUrl = buildAffiliateUrl(discoveryMachine?.externalLinks?.pinsideMarket || machineWithMedia.pinsideMarketUrl || buildPinsideMarketUrl(machineWithMedia), { machineSlug: machineWithMedia.slug, placement: "machine-detail" });
  const externalIpdbUrl = discoveryMachine?.externalLinks?.ipdb || machineWithMedia.ipdbUrl || "";
  const whyBeginnersLikeIt = discoveryMachine?.why_people_like_it || [machineWithMedia.why_like_it];
  const whySkipIt = discoveryMachine?.what_to_know || [machineWithMedia.considerations];
  const confirmInPerson = discoveryMachine?.what_to_know_before_buying || [machineWithMedia.considerations, "Confirm ball feel, shot comfort, and maintenance condition in person before buying."];

  detail.innerHTML = `
    ${renderSplitCard({
      className: "machine-card detail-card",
      mediaClassName: "detail-card__media",
      imageHtml: renderMachineImage(machineWithMedia, { className: "machine-image-frame--thumb split-card__image", eager: true }),
      bodyHtml: `
      <div class="badge-row">
        <span class="badge">${machineWithMedia.manufacturer}</span>
        <span class="badge">${machineWithMedia.year}</span>
        <span class="badge">${machineWithMedia.theme}</span>
        <span class="badge">${formatConditionLabel(machineWithMedia.condition_availability)}</span>
      </div>
      <h1 class="detail-title">${displayTitle}</h1>
      <p class="hero-copy">${discoveryMachine?.beginner_summary || machineWithMedia.description}</p>
      <p class="fit-summary"><strong>Should this be your first pin?</strong> ${buyerFitSummary(machineWithMedia)}</p>
      <div class="card-actions">
        ${renderVideoAction({ url: videoProfile.overview.url, label: videoProfile.overview.label, title: videoProfile.overview.title })}
        ${renderVideoAction({ url: videoProfile.gameplay.url, label: videoProfile.gameplay.label, title: videoProfile.gameplay.title })}
        <button class="btn btn-secondary compare-toggle" data-slug="${machineWithMedia.slug}" type="button">
          ${compareStore.has(machineWithMedia.slug) ? "Selected for compare" : "Add to compare"}
        </button>
      </div>
      `
    })}

    <section class="section-inner">
      <div class="discovery-question-stack">
        <article class="panel">
          <h3>1. Should this be your first pin?</h3>
          <p class="muted">${buyerFitSummary(machineWithMedia)}</p>
          <p class="muted"><strong>Main tradeoff:</strong> ${decisionTradeoff(machineWithMedia)}</p>
        </article>
        <article class="panel">
          <h3>2. Who it is best for</h3>
          <p class="muted">${machineWithMedia.best_for}</p>
        </article>
        <article class="panel">
          <h3>3. Why beginners like it</h3>
          ${renderLimitedList(whyBeginnersLikeIt)}
        </article>
        <article class="panel">
          <h3>4. Why some buyers skip it</h3>
          ${renderLimitedList(whySkipIt)}
        </article>
        <article class="panel">
          <h3>5. Ownership considerations</h3>
          <p class="muted">${ownershipSummary(machineWithMedia)}</p>
          <div class="badge-row">
            <span class="badge ${beginner.className}">Beginner: ${beginner.text}</span>
            <span class="badge ${complexity.className}">Rules: ${complexity.text}</span>
            <span class="badge ${maintenance.className}">Maintenance: ${maintenance.text}</span>
            <span class="badge ${family.className}">Family: ${family.text}</span>
          </div>
        </article>
        <article class="panel">
          <h3>6. Used price guidance and resale outlook</h3>
          <p class="muted"><strong>${pricing.estimated.label}:</strong> ${pricing.estimated.rangeText} · ${pricing.estimated.detailText}</p>
          ${pricing.used ? `<p class="muted"><strong>${pricing.used.label}:</strong> ${pricing.used.rangeText} · ${pricing.used.detailText}</p>` : ""}
          <p class="muted"><strong>Price position:</strong> ${pricePositionSummary(machineWithMedia)}</p>
          ${marketPricing?.sampleSize ? `<p class="muted"><strong>Observed sales:</strong> ${marketPricing.sampleSize} records${marketPricing.lastObservedMonth ? ` · updated ${marketPricing.lastObservedMonth}` : ""}</p>` : ""}
        </article>
        <article class="panel">
          <h3>7. What to test in person before buying</h3>
          ${renderLimitedList(confirmInPerson)}
        </article>
        ${versionSummaries.length ? `
          <article class="panel">
            <div class="section-head compact version-compare-head">
              <h3>8. Version differences to compare</h3>
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
                </article>
              `).join("")}
            </div>
          </article>
        ` : ""}
        <article class="panel">
          <h3>9. Supporting videos and reference links</h3>
          <div class="card-actions">
            ${renderVideoAction({ url: videoProfile.overview.url, label: videoProfile.overview.label, title: videoProfile.overview.title })}
            ${renderVideoAction({ url: videoProfile.gameplay.url, label: videoProfile.gameplay.label, title: videoProfile.gameplay.title })}
            ${externalPinsideMarketUrl ? `<a class="btn btn-primary small" href="${externalPinsideMarketUrl}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Used listings on Pinside" data-outbound-slug="${machineWithMedia.slug}" data-outbound-placement="machine-detail">Used listings on Pinside</a>` : ""}
            ${externalPinsideUrl ? `<a class="btn btn-secondary small" href="${externalPinsideUrl}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Pinside" data-outbound-slug="${machineWithMedia.slug}" data-outbound-placement="machine-detail">Pinside</a>` : ""}
            ${externalIpdbUrl ? `<a class="btn btn-secondary small" href="${externalIpdbUrl}" target="_blank" rel="noreferrer">IPDB</a>` : ""}
          </div>
          ${media ? `<p class="muted"><strong>Image source:</strong> ${media.imageSource}${media.attributionText ? ` · ${media.attributionText}` : ""}</p>` : ""}
        </article>
        <article class="panel">
          <h3>10. Optional glossary help</h3>
          <p class="muted">Tap any term for a plain-English explanation while you compare decisions.</p>
          ${renderMachineGlossaryTerms(machineWithMedia)}
          <div class="badge-row">${machineWithMedia.tags.map((tag) => renderGlossaryAwareTag(tag)).join("")}</div>
        </article>
      </div>
    </section>
    ${renderVideoModal(activeVideo)}
  `;

  const similarMachines = machines
    .filter((m) => m.slug !== machineWithMedia.slug && (m.theme === machineWithMedia.theme || m.manufacturer === machineWithMedia.manufacturer))
    .slice(0, 3);

  similar.innerHTML = similarMachines.map((item) => compactMachineCard(item)).join("");
  attachCompareButtons(document);
  attachImageFallbacks(document);
  initGlossary(detail);
  updateCompareCount();
  if (machineWithMedia) {
    document.title = `${machineWithMedia.name} | Pinball Scout`;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", machineWithMedia.name);
    document.querySelector('meta[name="description"]')?.setAttribute("content", machineWithMedia.description || `Buying guide for ${machineWithMedia.name}.`);
    if (media?.primaryImageUrl) {
      document.querySelector('meta[property="og:image"]')?.setAttribute("content", media.primaryImageUrl);
    }
  }
}

if (!machineWithMedia) {
  renderDetail();
} else {
  trackEvent("machine_detail_view", { slug: machineWithMedia.slug, name: machineWithMedia.name });
  renderDetail();
}
attachOutboundTracking();

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
