import { state } from "../state.js";
import { renderProgress } from "../components.js";
import { discoveryMachineIndex } from "../../../data/discovery-machines.js";
import { machineDisplayTitle, renderMachineImage, renderSplitCard } from "../../utils.js";
import { renderVideoAction } from "../../video.js";
import { buildEvidenceModel, labelTraitList } from "../../refinement-evidence.js";
import {
  currentRecommendations,
  buildRefinementSignals,
  topTraitSignals,
  hasPlayedMachine,
  traitAlignmentList
} from "../helpers.js";

export function renderFinals() {
  const recommendations = currentRecommendations();
  if (!recommendations.length) return "";
  const topThree = recommendations.slice(0, 3);
  const topTraits = topTraitSignals();
  const evidenceModel = buildEvidenceModel(state.reactions, buildRefinementSignals());
  const conflictTraits = labelTraitList(evidenceModel.conflicts || []);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 6: Final shortlist focus",
        "Pick what feels most exciting, replayable, and overall right. We will highlight the best fit even if you have not played it yet.",
        95,
        "Finals"
      )}
      <article class="panel">
        <p class="eyebrow">Finals check</p>
        <h3>Lock in your top 3 direction</h3>
        <p class="muted">Choose the winner for each prompt. This does not lock your final decision yet.</p>
        ${topTraits.length ? `<p class="muted"><strong>Signals you seem to like:</strong> ${topTraits.join(" · ")}</p>` : ""}
        ${conflictTraits.length ? `<p class="muted"><strong>Still mixed on:</strong> ${conflictTraits.join(" · ")}</p>` : ""}
      </article>
      <article class="panel">
        <div class="detail-list-block">
          <p><strong>Most exciting</strong></p>
          <div class="mini-chip-row">
            ${topThree.map((machine) => `
              <button class="chip-button${state.finals.mostExciting === machine.id ? " is-selected" : ""}" type="button" data-finals-choice="mostExciting:${machine.id}">
                ${machineDisplayTitle(machine)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="detail-list-block">
          <p><strong>Most replayable</strong></p>
          <div class="mini-chip-row">
            ${topThree.map((machine) => `
              <button class="chip-button${state.finals.mostReplayable === machine.id ? " is-selected" : ""}" type="button" data-finals-choice="mostReplayable:${machine.id}">
                ${machineDisplayTitle(machine)}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="detail-list-block">
          <p><strong>Best overall match</strong></p>
          <div class="mini-chip-row">
            ${topThree.map((machine) => `
              <button class="chip-button${state.finals.bestMatch === machine.id ? " is-selected" : ""}" type="button" data-finals-choice="bestMatch:${machine.id}">
                ${machineDisplayTitle(machine)}
              </button>
            `).join("")}
          </div>
        </div>
      </article>
      <div class="discovery-results-grid">
        ${topThree.map((machine) => {
          const alignment = traitAlignmentList(machine);
          const playedLabel = hasPlayedMachine(machine.id) ? "Played" : "Not played yet";
          const videoFeedback = state.videoFeedback?.[machine.id]?.reaction || "";
          const mismatchSignals = Array.isArray(machine.mismatchSignals) ? machine.mismatchSignals : [];
          const playedIds = state.reactions.filter((r) => r.experienceType === "played").map((r) => r.machineId);
          const proxyPlayed = (machine.proxy_machine_ids || []).find((id) => playedIds.includes(id)) || "";
          const proxyName = proxyPlayed ? machineDisplayTitle(discoveryMachineIndex.get(proxyPlayed) || { name: proxyPlayed, title: proxyPlayed }) : "";
          const evidenceLine = hasPlayedMachine(machine.id)
            ? "Based on your real-world play feedback."
            : videoFeedback
              ? "Based on your video reactions."
              : "Based on your broader taste signals so far.";
          const whyStillHere = alignment.length
            ? `It lines up with ${alignment.slice(0, 2).join(" and ").toLowerCase()}.`
            : "It matches the overall direction of your feedback so far.";
          const uncertaintyLine = mismatchSignals.length
            ? `Potential mismatch: ${mismatchSignals.join(" and ")} may not feel right in person.`
            : hasPlayedMachine(machine.id)
              ? "Main uncertainty: confirm this still holds up over longer play sessions."
              : "Main uncertainty: you have not played it in person yet.";
          const tieBreakLine = hasPlayedMachine(machine.id)
            ? "If it is still close, compare it side-by-side with your top alternative."
            : "A focused play session or one more video will help break the tie.";
          const deepDiveNote = !hasPlayedMachine(machine.id) && alignment.length
            ? `If you liked ${alignment.slice(0, 2).join(" and ")}, this still looks like a strong fit.`
            : "";
          return renderSplitCard({
            className: "recommendation-card",
            mediaClassName: "recommendation-card__media",
            bodyClassName: "recommendation-card__body",
            overlayHtml: `<div class="recommendation-rank">Finals</div>`,
            imageHtml: renderMachineImage(machine, { className: "machine-image-frame--thumb split-card__image recommendation-card__image", eager: true }),
            bodyHtml: `
              <div class="badge-row">
                <span class="badge">${playedLabel}</span>
                <span class="badge">${machine.budget_band}</span>
              </div>
              <h3>${machineDisplayTitle(machine)}</h3>
              <p class="muted">${machine.beginner_summary}</p>
              <p class="muted">${evidenceLine}</p>
              ${alignment.length ? `
                <p><strong>Why it matches your taste</strong></p>
                <ul class="result-list">
                  ${alignment.map((item) => `<li>${item}</li>`).join("")}
                </ul>
              ` : `<p class="muted">Use your video + play feedback to judge this fit.</p>`}
              <p><strong>Why it is still here</strong></p>
              <p class="muted">${whyStillHere}</p>
              <p><strong>What to validate</strong></p>
              <p class="muted">${uncertaintyLine}</p>
              ${proxyName ? `
                <p><strong>Proxy evidence</strong></p>
                <p class="muted">You played ${proxyName}, which is a good proxy for this style.</p>
              ` : ""}
              <p><strong>What would break the tie</strong></p>
              <p class="muted">${tieBreakLine}</p>
              ${deepDiveNote ? `<p class="muted">${deepDiveNote}</p>` : ""}
              <div class="card-actions">
                ${renderVideoAction({ url: machine.overview_video_url, label: "Watch overview", title: `${machine.name} overview` })}
                ${renderVideoAction({ url: machine.gameplay_video_url, label: "Watch gameplay", title: `${machine.name} gameplay` })}
                <button class="btn btn-secondary small" type="button" data-action="open-sourcing:${machine.id}">Open buying plan</button>
              </div>
            `
          });
        }).join("")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="back-to-results">Back to shortlist</button>
        <button class="btn btn-primary" type="button" data-action="open-sourcing:${topThree[0]?.id || ""}">Continue with top fit</button>
      </div>
    </section>
  `;
}
