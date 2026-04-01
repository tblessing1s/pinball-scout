import { getMachineMedia, resolveMachineImageSources } from "./services/media/media-library.js";
import { marketPricingIndex } from "../data/market-pricing.generated.js";
import { machineVersionProfiles } from "../data/machine-version-profiles.js";
import { machineVideoOverrideIndex } from "../data/machine-video-overrides.js";
import { renderVideoAction } from "./video.js";
import { youtubeSearchUrl } from "./url-utils.js";

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const VERSION_PRICE_WEIGHTS = {
  Original: 1,
  Standard: 1,
  Pro: 1,
  Premium: 1.22,
  "Special Edition": 1.14,
  LE: 1.42,
  "Limited Edition": 1.3,
  "Collector's Edition": 1.42,
  "Royal Edition": 1.28
};

const VERSION_COMPARE_COPY = {
  Pro: "Keeps the core game layout and usually lands at the cleanest entry price in the family.",
  Premium: "Adds mechs and presentation upgrades that push theme immersion higher than the base trim.",
  LE: "Adds limited-run finish details and collector appeal on top of the higher-feature trim.",
  Standard: "Covers the core package without the step-up collector or feature premium.",
  "Special Edition": "Steps up from the baseline with extra finish or hardware touches.",
  "Limited Edition": "Pushes further into collector packaging and rarer production than the lower trim.",
  "Collector's Edition": "Sits at the top of the family with the strongest cosmetic and collector emphasis.",
  "Royal Edition": "Represents the most premium remake package in the line.",
  Original: "Keeps the original production identity instead of a remake or reissue package."
};

function detectVersionFromText(text, versions = []) {
  const source = String(text || "").trim();
  if (!source) return "";

  const direct = [...versions].sort((left, right) => right.length - left.length)
    .find((version) => source.toLowerCase().endsWith(version.toLowerCase()));
  if (direct) return direct;

  if (/collector'?s edition$/i.test(source)) return "Collector's Edition";
  if (/\bpro$/i.test(source)) return "Pro";
  if (/\bpremium$/i.test(source)) return "Premium";
  if (/\ble$/i.test(source)) return "LE";
  if (/\blimited edition$/i.test(source)) return "Limited Edition";
  if (/\bspecial edition$/i.test(source)) return "Special Edition";
  if (/\broyal edition$/i.test(source)) return "Royal Edition";
  if (/\bstandard$/i.test(source)) return "Standard";
  if (/\boriginal$/i.test(source)) return "Original";

  return "";
}

function versionPriceWeight(version, fallbackWeight = 1) {
  return VERSION_PRICE_WEIGHTS[version] || fallbackWeight;
}

function roundPrice(value) {
  return Math.round(value / 50) * 50;
}

export function getMarketPricing(machineOrSlug) {
  const slug = typeof machineOrSlug === "string" ? machineOrSlug : machineOrSlug?.slug;
  return slug ? marketPricingIndex.get(slug) || null : null;
}

export function machineCurrentVersion(machine) {
  return detectVersionFromText(machine?.name || machine?.title || "", machine?.versions);
}

export function machineDisplayTitle(machine) {
  const name = String(machine?.name || machine?.title || "").trim();
  const currentVersion = machineCurrentVersion(machine);
  if (!name || !currentVersion) return name;

  return name.replace(new RegExp(`\\s+${currentVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
}

export function machineVersionSummaries(machine) {
  const versions = Array.isArray(machine?.versions) ? machine.versions : [];

  return versions.map((version) => ({
    version,
    summary: machineVersionProfiles[version]?.summary || "Different trim of the same game family.",
    tradeoff: machineVersionProfiles[version]?.tradeoff || "Worth comparing if trim-level features or collector value matter to you."
  }));
}

export function machineBaselineVersion(machine) {
  const versions = Array.isArray(machine?.versions) ? machine.versions : [];
  const directVersion = machineCurrentVersion(machine);
  if (directVersion) return directVersion;

  const pricingTitleVersion = detectVersionFromText(getMarketPricing(machine)?.title || "", versions);
  if (pricingTitleVersion) return pricingTitleVersion;

  return versions[0] || "";
}

export function machineVersionPricing(machine) {
  const versions = Array.isArray(machine?.versions) ? machine.versions : [];
  const pricing = getMarketPricing(machine);
  const baselineVersion = machineBaselineVersion(machine);
  const fallbackWeight = versionPriceWeight(versions[0] || "", 1);
  const baselineWeight = versionPriceWeight(baselineVersion, fallbackWeight);

  return versions.map((version) => {
    const versionWeight = versionPriceWeight(version, fallbackWeight);
    const multiplier = versionWeight / baselineWeight;
    const estimatedMin = roundPrice(machine.estimated_price_min * multiplier);
    const estimatedMax = roundPrice(machine.estimated_price_max * multiplier);
    const exactMarketMatch = Boolean(pricing?.usedRange?.min && pricing?.usedRange?.max && version === baselineVersion);
    const usedRange = pricing?.usedRange?.min && pricing?.usedRange?.max
      ? {
        min: roundPrice(pricing.usedRange.min * multiplier),
        max: roundPrice(pricing.usedRange.max * multiplier),
        median: pricing.usedRange.median ? roundPrice(pricing.usedRange.median * multiplier) : null,
        sourceType: exactMarketMatch ? "market" : "derived-market"
      }
      : null;
    const deltaPercent = Math.round((multiplier - 1) * 100);
    const deltaText = !baselineVersion || version === baselineVersion
      ? "Baseline for the current family pricing."
      : deltaPercent > 0
        ? `About ${deltaPercent}% above ${baselineVersion}.`
        : `About ${Math.abs(deltaPercent)}% below ${baselineVersion}.`;

    return {
      version,
      estimatedRange: {
        min: estimatedMin,
        max: estimatedMax,
        rangeText: `${formatCurrency(estimatedMin)}–${formatCurrency(estimatedMax)}`
      },
      usedRange: usedRange
        ? {
          ...usedRange,
          rangeText: `${formatCurrency(usedRange.min)}–${formatCurrency(usedRange.max)}`
        }
        : null,
      priceDeltaText: deltaText,
      comparisonText: VERSION_COMPARE_COPY[version] || "Changes the trim package more than the game family itself."
    };
  });
}

export function machineVideoProfile(machine, discoveryMachine = null) {
  const override = machineVideoOverrideIndex.get(machine?.slug) || {};
  const machineName = String(machine?.name || machine?.title || "").trim();

  const overviewUrl = discoveryMachine?.overview_video_url || override.overviewUrl || youtubeSearchUrl(`${machineName} pinball overview`);
  const gameplayUrl = discoveryMachine?.gameplay_video_url || override.gameplayUrl || youtubeSearchUrl(`${machineName} pinball gameplay walkthrough`);

  return {
    overview: {
      url: overviewUrl,
      label: discoveryMachine?.overview_video_label || override.overviewLabel || "Watch overview",
      title: override.overviewTitle || `${machineName} overview`
    },
    gameplay: {
      url: gameplayUrl,
      label: discoveryMachine?.gameplay_video_label || override.gameplayLabel || "Watch gameplay",
      title: override.gameplayTitle || `${machineName} gameplay`
    }
  };
}

export function machineEstimatedFamilyBounds(machine) {
  const versionPricing = machineVersionPricing(machine);
  if (!versionPricing.length) {
    return {
      min: machine.estimated_price_min,
      max: machine.estimated_price_max
    };
  }

  return {
    min: Math.min(...versionPricing.map((item) => item.estimatedRange.min)),
    max: Math.max(...versionPricing.map((item) => item.estimatedRange.max))
  };
}

export function machinePriceRange(machine) {
  const versionPricing = machineVersionPricing(machine);
  if (versionPricing.length > 1) {
    const { min, max } = machineEstimatedFamilyBounds(machine);

    return {
      label: "Estimated family range",
      rangeText: `${formatCurrency(min)}–${formatCurrency(max)}`,
      detailText: "Across listed versions",
      sourceType: "estimate"
    };
  }

  return {
    label: "Estimated price",
    rangeText: `${formatCurrency(machine.estimated_price_min)}–${formatCurrency(machine.estimated_price_max)}`,
    detailText: "Seeded catalog estimate",
    sourceType: "estimate"
  };
}

export function machinePricingSummary(machine) {
  const pricing = getMarketPricing(machine);
  const usedRange = pricing?.usedRange;
  const estimated = machinePriceRange(machine);
  const versionPricing = machineVersionPricing(machine);
  const usedVersionRanges = versionPricing
    .map((item) => item.usedRange)
    .filter((range) => range?.min && range?.max);
  const hasMultipleVersions = versionPricing.length > 1;
  const used = usedRange?.min && usedRange?.max
    ? hasMultipleVersions && usedVersionRanges.length
      ? {
        label: "Typical used range",
        rangeText: `${formatCurrency(Math.min(...usedVersionRanges.map((range) => range.min)))}–${formatCurrency(Math.max(...usedVersionRanges.map((range) => range.max)))}`,
        detailText: `Across versions · market guide updated ${pricing.lastObservedMonth}${pricing.confidence ? ` · ${pricing.confidence} confidence` : ""}`,
        sourceType: "market"
      }
      : {
        label: "Typical used range",
        rangeText: `${formatCurrency(usedRange.min)}–${formatCurrency(usedRange.max)}`,
        detailText: `Market guide updated ${pricing.lastObservedMonth}${pricing.confidence ? ` · ${pricing.confidence} confidence` : ""}`,
        sourceType: "market"
      }
    : null;

  return {
    estimated,
    used,
    marketPricing: pricing
  };
}

export const formatConditionLabel = (condition) => {
  if (condition === "both") return "New or used";
  if (condition === "new") return "New only";
  if (condition === "used") return "Used only";
  return "Any";
};

export const scoreLabel = (score) => {
  if (score >= 4) return { text: `${score}/5 strong`, className: "score-strong" };
  if (score >= 3) return { text: `${score}/5 moderate`, className: "score-mid" };
  return { text: `${score}/5 niche`, className: "" };
};

export const analytics = {
  track(eventName, properties = {}) {
    const payload = { eventName, properties, path: window.location.pathname, at: new Date().toISOString() };

    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...properties });
    }

    if (typeof window.plausible === "function") {
      window.plausible(eventName, { props: properties });
    }

    if (window.umami?.track) {
      window.umami.track(eventName, properties);
    }

    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.debug("[Pinball Scout trackEvent]", payload);
    }

    window.dispatchEvent(new CustomEvent("pinball-scout:track", { detail: payload }));
  }
};

export const trackEvent = analytics.track.bind(analytics);

export function showSiteMessage(message, type = "info") {
  let root = document.querySelector("#site-message");
  if (!root) {
    root = document.createElement("div");
    root.id = "site-message";
    root.className = "site-message";
    document.body.appendChild(root);
  }

  root.textContent = message;
  root.className = `site-message is-visible ${type}`;
  window.clearTimeout(root.dismissTimer);
  root.dismissTimer = window.setTimeout(() => {
    root.classList.remove("is-visible");
  }, 2800);
}

export const compareStore = {
  key: "pinballScoutCompare",
  maxItems: 3,
  get() {
    try {
      const items = JSON.parse(localStorage.getItem(this.key) || "[]");
      return Array.isArray(items) ? items.slice(0, this.maxItems) : [];
    } catch {
      return [];
    }
  },
  set(items) {
    const nextItems = [...new Set(items)].slice(0, this.maxItems);
    localStorage.setItem(this.key, JSON.stringify(nextItems));
    return nextItems;
  },
  add(slug) {
    const items = this.get();
    if (items.includes(slug)) return { ok: true, reason: "exists", items };
    if (items.length >= this.maxItems) return { ok: false, reason: "max", items };
    return { ok: true, reason: "added", items: this.set([...items, slug]) };
  },
  remove(slug) {
    return this.set(this.get().filter((item) => item !== slug));
  },
  has(slug) {
    return this.get().includes(slug);
  }
};

export function compareButtonLabel(slug) {
  return compareStore.has(slug) ? "Remove from compare" : "Add to compare";
}

export function updateCompareButtons(root = document) {
  root.querySelectorAll(".compare-toggle").forEach((button) => {
    const selected = compareStore.has(button.dataset.slug);
    button.textContent = selected ? "Selected for compare" : "Add to compare";
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

export function updateCompareCount() {
  document.querySelectorAll("#compare-count").forEach((el) => {
    el.textContent = String(compareStore.get().length);
  });
}

export function renderMachineImage(machine, options = {}) {
  const { className = "", eager = false } = options;
  const media = getMachineMedia(machine);
  const sources = resolveMachineImageSources(machine);
  const primarySrc = sources[0] || "";
  const sourceList = sources.join("|");
  const placeholderLabel = machine.image || machine.title || machine.name || "Machine image";
  const sourceLabel = media?.imageSource ? `Image source: ${media.imageSource}` : "Image placeholder";

  return `
    <div class="machine-image-frame ${className}" data-image-sources="${sourceList}" data-image-source="${sourceLabel}">
      <img
        class="machine-image"
        src="${primarySrc}"
        alt="${machine.title || machine.name}"
        loading="${eager ? "eager" : "lazy"}"
        decoding="async"
      />
      <div class="card-image image-fallback">
        <span>${placeholderLabel}</span>
      </div>
    </div>
  `;
}

export function renderSplitCard({
  className = "",
  mediaClassName = "",
  bodyClassName = "",
  imageHtml = "",
  bodyHtml = "",
  overlayHtml = ""
} = {}) {
  const articleClass = ["panel", "split-card", className].filter(Boolean).join(" ");
  const mediaClass = ["split-card__media", mediaClassName].filter(Boolean).join(" ");
  const contentClass = ["split-card__body", bodyClassName].filter(Boolean).join(" ");
  return `
    <article class="${articleClass}">
      ${overlayHtml}
      <div class="${mediaClass}">
        ${imageHtml}
      </div>
      <div class="${contentClass}">
        ${bodyHtml}
      </div>
    </article>
  `;
}

export function attachImageFallbacks(root = document) {
  root.querySelectorAll(".machine-image-frame").forEach((frame) => {
    const img = frame.querySelector(".machine-image");
    if (!img) return;

    const sources = (frame.dataset.imageSources || "").split("|").filter(Boolean);
    let sourceIndex = sources.findIndex((src) => src === img.getAttribute("src"));
    if (sourceIndex < 0) sourceIndex = 0;

    const markLoaded = () => frame.classList.add("has-image");
    const tryNextSource = () => {
      sourceIndex += 1;
      if (sourceIndex < sources.length) {
        img.src = sources[sourceIndex];
        frame.classList.add("has-image");
      } else {
        frame.classList.remove("has-image");
        img.removeAttribute("src");
      }
    };

    img.onerror = tryNextSource;
    img.onload = markLoaded;

    if (img.getAttribute("src")) {
      frame.classList.add("has-image");
    }

    if (img.decode) {
      img.decode().then(markLoaded).catch(() => {});
    }

    if (img.complete && (img.naturalWidth > 0 || img.currentSrc?.endsWith(".svg"))) {
      markLoaded();
    } else if (!img.getAttribute("src")) {
      frame.classList.remove("has-image");
    }
  });
}

export function ownershipSummary(machine) {
  const complexity = machine.rules_complexity >= 4 ? "deeper rules" : "easy rules";
  const maintenance = machine.maintenance_difficulty >= 4 ? "higher upkeep" : machine.maintenance_difficulty >= 3 ? "moderate upkeep" : "easier upkeep";
  const audience = machine.beginner_friendliness >= 4
    ? "friendly for first-time owners"
    : machine.family_friendliness >= 4
      ? "works well in a mixed-skill home"
      : "better for a more opinionated buyer";

  return `${audience}, with ${complexity} and ${maintenance}.`;
}

export function pricePositionSummary(machine) {
  const familyBounds = machineEstimatedFamilyBounds(machine);
  const avgPrice = (familyBounds.min + familyBounds.max) / 2;

  if (avgPrice < 6500) return "One of the more reachable options in this dataset.";
  if (avgPrice <= 8500) return "Sits in the core home-buyer budget band.";
  if (avgPrice <= 10500) return "Usually a step-up buy for shoppers stretching beyond entry pricing.";
  return "Positioned more like a premium purchase than a casual first buy.";
}

export function buyerFitSummary(machine) {
  if (machine.beginner_friendliness >= 5 && machine.family_friendliness >= 5 && machine.rules_complexity <= 2) {
    return "Strong fit if you want an easy yes for mixed-skill home play.";
  }

  if (machine.beginner_friendliness >= 5 && machine.family_friendliness >= 4) {
    return "Strong fit if you want a safe first-home-machine recommendation.";
  }

  if (machine.rules_complexity >= 4 && machine.beginner_friendliness <= 3) {
    return "Better fit if you want depth and don’t need the easiest first-owner ramp.";
  }

  if (machine.family_friendliness >= 5) {
    return "Best fit if multiple people in the house need to enjoy it quickly.";
  }

  if (machine.beginner_friendliness >= 4 && machine.maintenance_difficulty <= 2) {
    return "Great fit for a first owner who wants less friction after the purchase.";
  }

  if (machine.condition_availability === "new") {
    return "Best fit if you want a newer-market title and are comfortable shopping near current pricing.";
  }

  if (machine.condition_availability === "used") {
    return "Best fit if you are open to the used market to stretch value or access classics.";
  }

  return "Good all-around fit if you want a balanced machine without a major tradeoff dominating the decision.";
}

export function decisionTradeoff(machine) {
  if (machine.rules_complexity >= 4 && machine.beginner_friendliness <= 3) {
    return "You trade easier onboarding for longer-term depth.";
  }

  if (machine.family_friendliness >= 5 && machine.rules_complexity <= 2) {
    return "You get broad instant appeal, but not the deepest rules package.";
  }

  if (machine.condition_availability === "used" && machine.maintenance_difficulty >= 4) {
    return "You get classic appeal, but ownership risk is more real than with newer titles.";
  }

  if (machine.condition_availability === "new") {
    return "You get current-market availability, but less price certainty than mature used titles.";
  }

  return "The main tradeoff is choosing between theme pull, depth, and ease of ownership.";
}

export function machineCard(machine) {
  const beginner = scoreLabel(machine.beginner_friendliness);
  const family = scoreLabel(machine.family_friendliness);
  const pricing = machinePricingSummary(machine);
  const displayTitle = machineDisplayTitle(machine);
  const videos = machineVideoProfile(machine);
  return renderSplitCard({
    className: "machine-card",
    mediaClassName: "machine-card__media",
    imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image", eager: true }),
    bodyHtml: `
      <div class="badge-row">
        <span class="badge">${machine.manufacturer}</span>
        <span class="badge">${machine.year}</span>
        <span class="badge">${machine.theme}</span>
        ${machine.versions?.length > 1 ? `<span class="badge">${machine.versions.length} versions</span>` : ""}
      </div>
      <h3>${displayTitle}</h3>
      <p class="muted">${machine.description}</p>
      <p class="fit-summary"><strong>Buyer fit:</strong> ${buyerFitSummary(machine)}</p>
      <p class="muted">${pricePositionSummary(machine)}</p>
      <p><strong>${pricing.estimated.rangeText}</strong></p>
      <p class="muted"><strong>${pricing.estimated.label}:</strong> ${pricing.estimated.detailText}</p>
      ${pricing.used ? `<p class="muted"><strong>${pricing.used.label}:</strong> ${pricing.used.rangeText} · ${pricing.used.detailText}</p>` : ""}
      <div class="badge-row">
        <span class="badge ${beginner.className}">Beginner: ${beginner.text}</span>
        <span class="badge ${family.className}">Family: ${family.text}</span>
      </div>
      <div class="card-actions">
        ${renderVideoAction({ url: videos.overview.url, label: videos.overview.label, title: videos.overview.title })}
        ${renderVideoAction({ url: videos.gameplay.url, label: videos.gameplay.label, title: videos.gameplay.title })}
        <a class="btn btn-secondary small" href="machine.html?slug=${machine.slug}">View details</a>
        <button class="btn btn-primary small compare-toggle" data-slug="${machine.slug}" type="button">
          ${compareButtonLabel(machine.slug)}
        </button>
      </div>
    `
  });
}

export function attachCompareButtons(root = document, options = {}) {
  const { onLimit } = options;

  root.querySelectorAll(".compare-toggle").forEach((button) => {
    if (button.dataset.compareBound === "true") return;
    button.dataset.compareBound = "true";

    button.addEventListener("click", () => {
      const slug = button.dataset.slug;

      if (compareStore.has(slug)) {
        compareStore.remove(slug);
        trackEvent("compare_remove", { slug, source: window.location.pathname });
      } else {
        const result = compareStore.add(slug);
        if (!result.ok && result.reason === "max") {
          const message = "You can compare up to 3 machines. Remove one before adding another.";
          if (typeof onLimit === "function") onLimit(message);
          showSiteMessage(message, "warning");
          return;
        }
        trackEvent("compare_add", { slug, source: window.location.pathname });
      }

      updateCompareButtons(document);
      updateCompareCount();
      window.dispatchEvent(new CustomEvent("compare-updated"));
    });
  });

  updateCompareButtons(root);
}
