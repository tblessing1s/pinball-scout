import { machines } from "../data/machines.js";
import { attachCompareButtons, attachImageFallbacks, compareStore, machineCard, machineEstimatedFamilyBounds, trackEvent, updateCompareCount } from "./utils.js";
import { renderVideoModal } from "./video.js";
import { initNav } from "./nav.js";

const els = {
  search: document.querySelector("#search"),
  budget: document.querySelector("#budget"),
  theme: document.querySelector("#theme"),
  beginnerSafety: document.querySelector("#beginner-safety"),
  manufacturer: document.querySelector("#manufacturer"),
  condition: document.querySelector("#condition"),
  era: document.querySelector("#era"),
  family: document.querySelector("#family"),
  complexity: document.querySelector("#complexity"),
  maintenance: document.querySelector("#maintenance"),
  sort: document.querySelector("#sort"),
  results: document.querySelector("#machine-results"),
  count: document.querySelector("#results-count"),
  clear: document.querySelector("#clear-filters"),
  active: document.querySelector("#active-filters"),
  advanced: document.querySelector("#advanced-filters")
};

const filterKeys = ["search", "budget", "theme", "beginnerSafety", "manufacturer", "condition", "era", "complexity", "maintenance", "sort"];
let lastTrackedState = "";
let activeVideo = null;
const dismissedSlugs = new Set();
initNav();

const modalRoot = document.createElement("div");
modalRoot.id = "video-modal-root";
document.body.appendChild(modalRoot);

function syncVideoModal() {
  modalRoot.innerHTML = renderVideoModal(activeVideo);
}

function uniqueValues(key) {
  return [...new Set(machines.map((m) => m[key]))].sort();
}

function fillSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function normalizeBeginnerSafety(rawValue) {
  if (rawValue === "safer" || rawValue === "safest") return rawValue;
  return "any";
}

function beginnerSafetyFromState(state) {
  if (state.beginnerSafety) return normalizeBeginnerSafety(state.beginnerSafety);
  const legacyBeginner = state.beginner === true || state.beginner === "true" || state.beginner === "1";
  return legacyBeginner ? "safer" : "any";
}

function currentState() {
  return {
    search: els.search.value.trim(),
    budget: els.budget.value,
    theme: els.theme.value,
    beginnerSafety: normalizeBeginnerSafety(els.beginnerSafety.value),
    manufacturer: els.manufacturer.value,
    condition: els.condition.value,
    era: els.era.value,
    family: els.family.checked,
    complexity: els.complexity.value,
    maintenance: els.maintenance.value,
    sort: els.sort.value
  };
}

function applyState(state) {
  els.search.value = state.search || "";
  els.budget.value = state.budget || "";
  els.theme.value = state.theme || "";
  els.beginnerSafety.value = beginnerSafetyFromState(state);
  els.manufacturer.value = state.manufacturer || "";
  els.condition.value = state.condition || "";
  els.era.value = state.era || "";
  els.family.checked = state.family === true || state.family === "true" || state.family === "1";
  els.complexity.value = state.complexity || "";
  els.maintenance.value = state.maintenance || "";
  els.sort.value = state.sort || "featured";
}

function stateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("search") || "",
    budget: params.get("budget") || "",
    theme: params.get("theme") || "",
    beginnerSafety: normalizeBeginnerSafety(params.get("beginnerSafety") || (params.get("beginner") ? "safer" : "any")),
    manufacturer: params.get("manufacturer") || "",
    condition: params.get("condition") || "",
    era: params.get("era") || "",
    family: params.get("family") || "",
    complexity: params.get("complexity") || "",
    maintenance: params.get("maintenance") || "",
    sort: params.get("sort") || "featured"
  };
}

function syncUrl(state) {
  const params = new URLSearchParams();
  filterKeys.forEach((key) => {
    const value = state[key];
    if (value && key !== "beginnerSafety") params.set(key, value);
  });

  if (state.beginnerSafety && state.beginnerSafety !== "any") {
    params.set("beginner", "1");
    params.set("beginnerSafety", state.beginnerSafety);
  }
  if (state.family) params.set("family", "1");

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function inBudget(machine, budget) {
  if (!budget) return true;
  const familyBounds = machineEstimatedFamilyBounds(machine);
  const avg = (familyBounds.min + familyBounds.max) / 2;
  if (budget === "under7000") return avg < 7000;
  if (budget === "7000to9000") return avg >= 7000 && avg <= 9000;
  if (budget === "9000to12000") return avg > 9000 && avg <= 12000;
  if (budget === "over12000") return avg > 12000;
  return true;
}

function matchesSearch(machine, query) {
  if (!query) return true;
  const haystack = [machine.name, machine.manufacturer, machine.theme, machine.description, ...machine.tags]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function sortMachines(list, sort) {
  const copy = [...list];
  switch (sort) {
    case "lowestCost":
      return copy.sort((a, b) => machineEstimatedFamilyBounds(a).min - machineEstimatedFamilyBounds(b).min);
    case "bestValue":
      return copy.sort((a, b) => {
        const aMin = machineEstimatedFamilyBounds(a).min;
        const bMin = machineEstimatedFamilyBounds(b).min;
        return (b.beginner_friendliness + b.family_friendliness - bMin / 4000) - (a.beginner_friendliness + a.family_friendliness - aMin / 4000);
      });
    case "beginner":
      return copy.sort((a, b) => b.beginner_friendliness - a.beginner_friendliness);
    case "family":
      return copy.sort((a, b) => b.family_friendliness - a.family_friendliness);
    case "ownership":
      return copy.sort((a, b) => a.maintenance_difficulty - b.maintenance_difficulty);
    default:
      return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }
}

function renderActiveFilters(state) {
  const labels = [];
  if (state.budget) labels.push(`Budget: ${els.budget.selectedOptions[0].textContent}`);
  if (state.theme) labels.push(`Vibe: ${state.theme}`);
  if (state.beginnerSafety !== "any") labels.push(state.beginnerSafety === "safest" ? "Most beginner-safe" : "Safer first buys");
  if (state.search) labels.push(`Search: ${state.search}`);
  if (state.manufacturer) labels.push(`Maker: ${state.manufacturer}`);
  if (state.condition) labels.push(`Availability: ${els.condition.selectedOptions[0].textContent}`);
  if (state.era) labels.push(`Era: ${state.era}`);
  if (state.family) labels.push("Great family pick");
  if (state.complexity) labels.push(`Rules: ${els.complexity.selectedOptions[0].textContent}`);
  if (state.maintenance) labels.push(`Maintenance: ${els.maintenance.selectedOptions[0].textContent}`);
  if (dismissedSlugs.size) labels.push(`Not for me hidden: ${dismissedSlugs.size}`);

  els.active.innerHTML = labels.length
    ? labels.map((label) => `<span class="badge">${label}</span>`).join("")
    : `<span class="muted">No filters applied yet. Start with budget, vibe, and beginner-safe level.</span>`;
}

function maybeTrackState(state) {
  const comparableState = JSON.stringify(state);
  if (comparableState === lastTrackedState) return;
  lastTrackedState = comparableState;

  trackEvent("directory_filter_change", state);
  if (state.search) {
    trackEvent("search_usage", { query: state.search, resultsPage: "machines" });
  }
}

function applyDirectoryDecisionLanguage() {
  els.results.querySelectorAll('a[href^="machine.html?slug="]').forEach((link) => {
    link.textContent = "View guide";
  });

  els.results.querySelectorAll(".compare-toggle").forEach((button) => {
    const selected = compareStore.has(button.dataset.slug);
    button.textContent = selected ? "Shortlisted" : "Shortlist";
  });

  els.results.querySelectorAll(".machine-card .card-actions").forEach((actions) => {
    if (actions.querySelector("[data-dismiss-slug]")) return;
    const compareButton = actions.querySelector(".compare-toggle");
    if (!compareButton?.dataset.slug) return;
    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.className = "btn btn-secondary small";
    dismissButton.dataset.dismissSlug = compareButton.dataset.slug;
    dismissButton.textContent = "Not for me";
    actions.appendChild(dismissButton);
  });
}

function render() {
  const state = currentState();

  let filtered = machines.filter((machine) => {
    if (dismissedSlugs.has(machine.slug)) return false;
    if (!matchesSearch(machine, state.search)) return false;
    if (!inBudget(machine, state.budget)) return false;
    if (state.theme && machine.theme !== state.theme) return false;
    if (state.beginnerSafety === "safer" && machine.beginner_friendliness < 4) return false;
    if (state.beginnerSafety === "safest" && machine.beginner_friendliness < 5) return false;
    if (state.manufacturer && machine.manufacturer !== state.manufacturer) return false;
    if (state.condition && machine.condition_availability !== state.condition && machine.condition_availability !== "both") return false;
    if (state.era && machine.era !== state.era) return false;
    if (state.family && machine.family_friendliness < 4) return false;
    if (state.complexity && machine.rules_complexity < Number(state.complexity)) return false;
    if (state.maintenance && machine.maintenance_difficulty < Number(state.maintenance)) return false;
    return true;
  });

  filtered = sortMachines(filtered, state.sort);
  syncUrl(state);
  renderActiveFilters(state);
  maybeTrackState(state);

  els.count.textContent = `${filtered.length} machine${filtered.length === 1 ? "" : "s"} in the directory`;

  if (!filtered.length) {
    els.results.innerHTML = `
      <div class="panel empty-state">
        <h3>No machines matched</h3>
        <p class="muted">Try widening budget or vibe filters first. If you are still broadly exploring, the guided discovery flow may work better.</p>
        <div class="hero-actions compare-empty-actions">
          <a class="btn btn-primary" href="help.html">Go to discovery</a>
          <button id="reset-directory-empty" class="btn btn-secondary" type="button">Clear filters</button>
        </div>
      </div>
    `;
    document.querySelector("#reset-directory-empty")?.addEventListener("click", () => {
      dismissedSlugs.clear();
      applyState({ sort: "featured", beginnerSafety: "any" });
      render();
    });
    return;
  }

  els.results.innerHTML = filtered.map((machine) => machineCard(machine)).join("");
  attachCompareButtons(els.results);
  attachImageFallbacks(els.results);
  applyDirectoryDecisionLanguage();
  updateCompareCount();
  syncVideoModal();
}

fillSelect(els.theme, uniqueValues("theme"));
fillSelect(els.manufacturer, uniqueValues("manufacturer"));
fillSelect(els.era, uniqueValues("era"));
applyState(stateFromUrl());

Object.values(els).forEach((el) => {
  if (el instanceof HTMLSelectElement) el.addEventListener("change", render);
});

document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
  checkbox.addEventListener("change", render);
});

els.search.addEventListener("input", render);

els.clear.addEventListener("click", () => {
  dismissedSlugs.clear();
  applyState({ sort: "featured", beginnerSafety: "any" });
  render();
});

els.advanced?.addEventListener("toggle", () => {
  trackEvent("directory_advanced_filters_toggled", { open: els.advanced.open });
});

window.addEventListener("compare-updated", render);
els.results?.addEventListener("click", (event) => {
  const dismiss = event.target.closest("[data-dismiss-slug]");
  if (dismiss) {
    const slug = dismiss.dataset.dismissSlug;
    dismissedSlugs.add(slug);
    trackEvent("directory_not_for_me", { slug, source: "machines-directory" });
    render();
    return;
  }

  const videoButton = event.target.closest("[data-video-url]");
  if (!videoButton) return;

  activeVideo = {
    url: videoButton.dataset.videoUrl,
    title: videoButton.dataset.videoTitle || "Pinball video"
  };
  syncVideoModal();
});

modalRoot.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action !== "close-video-modal") return;

  activeVideo = null;
  syncVideoModal();
});

render();
