import { findGlossaryTermsInText, getGlossaryTerm, glossaryEntries, renderGlossaryTrigger } from "../data/glossary.js";
import { trackEvent, updateCompareCount } from "./utils.js";
import { initNav } from "./nav.js";

let glossaryRoot = null;
let activeButton = null;
initNav();

function renderGlossaryMedia(entry, variant = "card") {
  if (!entry.media?.src) return "";

  const captionClass = variant === "popover"
    ? "glossary-media__caption glossary-media__caption--popover"
    : "glossary-media__caption";

  return `
    <figure class="glossary-media glossary-media--${variant}">
      <img class="glossary-media__image" src="${entry.media.src}" alt="${entry.media.alt || entry.label}" loading="lazy" decoding="async" />
      ${entry.media.caption ? `<figcaption class="${captionClass}">${entry.media.caption}</figcaption>` : ""}
    </figure>
  `;
}

function ensurePopover() {
  if (glossaryRoot) return glossaryRoot;

  glossaryRoot = document.createElement("div");
  glossaryRoot.className = "glossary-popover";
  glossaryRoot.hidden = true;
  glossaryRoot.setAttribute("role", "tooltip");
  glossaryRoot.innerHTML = `
    <div class="glossary-popover__inner">
      <p class="eyebrow glossary-popover__eyebrow">Pinball term</p>
      <h3 class="glossary-popover__title"></h3>
      <div class="glossary-popover__media"></div>
      <p class="glossary-popover__body"></p>
      <p class="glossary-popover__why"></p>
    </div>
  `;
  document.body.appendChild(glossaryRoot);

  document.addEventListener("click", (event) => {
    if (glossaryRoot.hidden) return;
    if (glossaryRoot.contains(event.target)) return;
    if (event.target.closest?.("[data-glossary-term]")) return;
    closeGlossaryPopover();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || glossaryRoot.hidden) return;
    const lastButton = activeButton;
    closeGlossaryPopover();
    lastButton?.focus();
  });

  window.addEventListener("resize", () => {
    if (!glossaryRoot.hidden && activeButton) positionPopover(activeButton);
  });

  window.addEventListener("scroll", () => {
    if (!glossaryRoot.hidden && activeButton) positionPopover(activeButton);
  }, true);

  return glossaryRoot;
}

function positionPopover(button) {
  const popover = ensurePopover();
  if (window.innerWidth <= 720) {
    popover.style.left = "1rem";
    popover.style.top = "auto";
    return;
  }

  const rect = button.getBoundingClientRect();
  const popoverWidth = Math.min(320, window.innerWidth - 32);
  let left = rect.left + window.scrollX;
  const maxLeft = window.scrollX + window.innerWidth - popoverWidth - 16;
  left = Math.max(window.scrollX + 16, Math.min(left, maxLeft));

  popover.style.left = `${left}px`;
  popover.style.top = `${rect.bottom + window.scrollY + 10}px`;
}

export function closeGlossaryPopover() {
  const popover = ensurePopover();
  popover.hidden = true;
  activeButton?.setAttribute("aria-expanded", "false");
  activeButton = null;
}

export function openGlossaryPopover(button) {
  const entry = getGlossaryTerm(button.dataset.glossaryTerm);
  if (!entry) return;

  const popover = ensurePopover();
  const title = popover.querySelector(".glossary-popover__title");
  const media = popover.querySelector(".glossary-popover__media");
  const body = popover.querySelector(".glossary-popover__body");
  const why = popover.querySelector(".glossary-popover__why");

  if (activeButton === button && !popover.hidden) {
    closeGlossaryPopover();
    return;
  }

  activeButton?.setAttribute("aria-expanded", "false");
  activeButton = button;
  activeButton.setAttribute("aria-expanded", "true");

  title.textContent = entry.label;
  media.innerHTML = renderGlossaryMedia(entry, "popover");
  body.textContent = entry.short;
  why.textContent = entry.why;

  popover.hidden = false;
  positionPopover(button);
  trackEvent("glossary_term_opened", { term: entry.id, label: entry.label });
}

export function initGlossary(root = document) {
  ensurePopover();

  root.querySelectorAll("[data-glossary-term]").forEach((button) => {
    if (button.dataset.glossaryBound === "true") return;
    button.dataset.glossaryBound = "true";
    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {
      openGlossaryPopover(button);
    });
  });
}

export function renderGlossaryPageCards() {
  return glossaryEntries.map((entry) => `
    <article class="panel glossary-card" id="${entry.id}">
      <div class="section-head compact glossary-card__head">
        <div>
          <p class="eyebrow">Pinball term</p>
          <h2>${entry.label}</h2>
        </div>
      </div>
      ${renderGlossaryMedia(entry)}
      <p>${entry.short}</p>
      <p class="muted"><strong>Why it matters:</strong> ${entry.why}</p>
    </article>
  `).join("");
}

export function renderMachineGlossaryTerms(machine) {
  const matchedTerms = findGlossaryTermsInText(
    machine.description,
    machine.why_like_it,
    machine.considerations,
    machine.best_for,
    machine.tags.join(" ")
  );

  const selected = matchedTerms.length
    ? matchedTerms.slice(0, 5)
    : ["layout", "shots", "rules-depth"].map((id) => getGlossaryTerm(id));

  return `
    <div class="glossary-chip-row">
      ${selected.map((entry) => renderGlossaryTrigger(entry.id, { label: entry.label, variant: "chip" })).join("")}
    </div>
  `;
}

export function renderGlossaryAwareTag(tag) {
  const entry = getGlossaryTerm(tag);
  if (!entry) {
    return `<span class="badge">${tag}</span>`;
  }

  return renderGlossaryTrigger(entry.id, { label: tag, variant: "chip" });
}

const glossaryPageRoot = document.querySelector("#glossary-list");

if (glossaryPageRoot) {
  glossaryPageRoot.innerHTML = renderGlossaryPageCards();
  initGlossary(glossaryPageRoot);
  updateCompareCount();
}
