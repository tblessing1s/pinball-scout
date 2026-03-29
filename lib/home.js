import { discoveryMachines } from "../data/discovery-machines.js";
import { attachImageFallbacks, renderMachineImage, trackEvent, updateCompareCount } from "./utils.js";

const featured = discoveryMachines.slice(0, 3);
const root = document.querySelector("#starter-preview-grid");

function previewCard(machine) {
  return `
    <article class="panel starter-preview-card">
      ${renderMachineImage(machine, { className: "machine-image-frame--thumb starter-preview-card__image" })}
      <p class="eyebrow">Starter machine</p>
      <h3>${machine.name}</h3>
      <p class="muted">${machine.shortDescription}</p>
      <p class="fit-summary"><strong>Why beginners shortlist it:</strong> ${machine.starterRecommendationReason}</p>
      <a class="text-link" href="machine.html?slug=${machine.slug}">See machine detail</a>
    </article>
  `;
}

if (root) {
  root.innerHTML = featured.map((machine) => previewCard(machine)).join("");
  attachImageFallbacks(root);
}

updateCompareCount();

document.querySelectorAll("[data-track]").forEach((link) => {
  link.addEventListener("click", () => {
    trackEvent(link.dataset.track, { location: "homepage" });
  });
});

window.addEventListener("compare-updated", () => {
  updateCompareCount();
});
