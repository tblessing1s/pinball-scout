import { machines } from "../data/machines.js";
import { initGlossary } from "./glossary.js";
import { renderGlossaryTrigger } from "../data/glossary.js";
import { buyerFitSummary, compareStore, decisionTradeoff, formatConditionLabel, formatCurrency, machineDisplayTitle, trackEvent, updateCompareCount } from "./utils.js";
import * as utils from "./utils.js";

const root = document.querySelector("#compare-content");
let hasTrackedView = false;

function pricingSummary(machine) {
  if (typeof utils.machinePricingSummary === "function") {
    return utils.machinePricingSummary(machine);
  }

  return {
    estimated: {
      rangeText: `${formatCurrency(machine.estimated_price_min)}–${formatCurrency(machine.estimated_price_max)}`
    },
    used: null
  };
}

function renderRowLabel(label, glossaryKey) {
  if (!glossaryKey) return label;
  return `
    <span class="compare-label-with-term">
      <span>${label}</span>
      ${renderGlossaryTrigger(glossaryKey, { label: "?", ariaLabel: `Explain ${label}`, variant: "icon" })}
    </span>
  `;
}

function render() {
  const selected = compareStore.get().map((slug) => machines.find((machine) => machine.slug === slug)).filter(Boolean);
  updateCompareCount();
  if (!hasTrackedView) {
    trackEvent("compare_page_view", { selected: selected.map((machine) => machine.slug) });
    hasTrackedView = true;
  }

  if (selected.length < 2) {
    root.innerHTML = `
      <div class="panel empty-state">
        <h3>Add at least 2 machines to compare</h3>
        <p class="muted">Use compare from the directory or a machine detail page, then come back here for the side-by-side decision view.</p>
        ${selected.length ? `<div class="selected-strip">${selected.map((machine) => `<div class="selected-pill"><span>${machineDisplayTitle(machine)}</span><button class="chip-button compare-remove" data-slug="${machine.slug}" type="button">Remove</button></div>`).join("")}</div>` : ""}
        <div class="hero-actions compare-empty-actions">
          <a class="btn btn-primary" href="machines.html">Browse machines</a>
          <a class="btn btn-secondary" href="help.html">Get help choosing</a>
        </div>
      </div>
    `;
    bindRemoveButtons();
    return;
  }

  const rows = [
    ["Manufacturer", (machine) => machine.manufacturer],
    ["Year", (machine) => machine.year],
    ["Theme", (machine) => machine.theme],
    ["Estimated price", (machine) => pricingSummary(machine).estimated.rangeText],
    ["Typical used range", (machine) => pricingSummary(machine).used?.rangeText || "No imported used-market range"],
    ["Availability", (machine) => formatConditionLabel(machine.condition_availability)],
    ["Buyer fit", (machine) => buyerFitSummary(machine)],
    ["Main tradeoff", (machine) => decisionTradeoff(machine), "risk-reward"],
    ["Beginner friendliness", (machine) => `${machine.beginner_friendliness}/5`],
    ["Family friendliness", (machine) => `${machine.family_friendliness}/5`],
    ["Rules complexity", (machine) => `${machine.rules_complexity}/5`, "rules-depth"],
    ["Maintenance difficulty", (machine) => `${machine.maintenance_difficulty}/5`],
    ["Best for", (machine) => machine.best_for],
    ["Why shortlist it", (machine) => machine.why_like_it],
    ["Considerations", (machine) => machine.considerations],
    ["Versions", (machine) => machine.versions.join(", ")]
  ];

  root.innerHTML = `
    <div class="compare-page-stack">
      <div class="panel compare-cta">
        <div>
          <p class="eyebrow">Need a tie-breaker?</p>
          <h2>Get help choosing between these machines</h2>
          <p class="muted">Send your shortlist, budget, and use case and turn the comparison into a concrete recommendation.</p>
        </div>
        <a class="btn btn-primary" href="help.html?compare=${selected.map((machine) => machine.slug).join(",")}">Get help choosing</a>
      </div>

      <div class="compare-table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              ${selected.map((machine) => `
                <th>
                  <div class="compare-head-cell">
                    <strong>${machineDisplayTitle(machine)}</strong>
                    <a class="text-link" href="machine.html?slug=${machine.slug}">View detail</a>
                    <button class="chip-button compare-remove" data-slug="${machine.slug}" type="button">Remove</button>
                  </div>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map(([label, renderField, glossaryKey]) => `<tr><th>${renderRowLabel(label, glossaryKey)}</th>${selected.map((machine) => `<td>${renderField(machine)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  bindRemoveButtons();
  initGlossary(root);
}

function bindRemoveButtons() {
  root.querySelectorAll(".compare-remove").forEach((button) => {
    button.addEventListener("click", () => {
      compareStore.remove(button.dataset.slug);
      trackEvent("compare_remove", { slug: button.dataset.slug, source: "compare-page" });
      render();
    });
  });
}

window.addEventListener("compare-updated", render);
render();
