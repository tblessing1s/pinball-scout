import { state } from "../state.js";
import { renderProgress } from "../components.js";
import { loadDecisionState } from "../../decision-state.js";
import { machineDisplayTitle } from "../../utils.js";
import { buildAffiliateUrl } from "../../outbound.js";
import { currentRecommendations, machineBySlug, formatSavedSessionTimestamp } from "../helpers.js";

export function renderDecisionBrief() {
  const decisionState = loadDecisionState();
  const brief = decisionState.decisionBrief;
  if (!brief?.machineSlug) {
    return `
      <section class="discovery-shell">
        ${renderProgress(
          "Decision Brief",
          "Finish your buying-plan flow to generate a clear decision brief.",
          92,
          "Not saved yet"
        )}
        <article class="panel">
          <h3>No saved Decision Brief yet</h3>
          <p class="muted">Continue from your shortlist and complete the buying plan to create a reusable action brief.</p>
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="back-to-results">Back to shortlist</button>
          </div>
        </article>
      </section>
    `;
  }

  const machine = currentRecommendations().find((item) => item.slug === brief.machineSlug) || machineBySlug(brief.machineSlug);
  const displayTitle = machine ? machineDisplayTitle(machine) : brief.machineSlug;
  const backupLabels = (brief.backupSlugs || [])
    .map((slug) => machineBySlug(slug))
    .filter(Boolean)
    .map((item) => machineDisplayTitle(item));
  const confidenceTone = brief.confidenceLevel === "high" ? "Strong signal" : brief.confidenceLevel === "medium" ? "Developing signal" : "Early signal";
  const savedAt = formatSavedSessionTimestamp(brief.updatedAt || brief.createdAt);
  const machineId = state.sourcingMachineId || "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Decision Brief",
        "Your first-pin decision is now translated into a clear, persistent action plan.",
        100,
        "Plan saved"
      )}
      <article class="panel">
        <p class="eyebrow">Current front-runner</p>
        <h3>${displayTitle}</h3>
        <p class="muted">${savedAt ? `Last updated ${savedAt}.` : "Saved in this session."}</p>
        <div class="badge-row">
          <span class="badge">${confidenceTone}</span>
          <span class="badge">${brief.readinessLabel || "Readiness pending"}</span>
        </div>
        ${brief.readinessReason ? `<p class="muted"><strong>Readiness summary:</strong> ${brief.readinessReason}</p>` : ""}
      </article>

      <article class="panel">
        <h3>Why this fits you</h3>
        <ul class="result-list">
          ${(brief.whyItFits || []).map((item) => `<li>${item}</li>`).join("") || "<li>Based on your guided reactions and practical constraints.</li>"}
        </ul>
      </article>

      ${(brief.refinementInsights || []).length ? `
        <article class="panel">
          <h3>What your feedback consistently pointed toward</h3>
          <ul class="result-list">
            ${(brief.refinementInsights || []).map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </article>
      ` : ""}

      ${brief.refinementMismatch?.length ? `
        <article class="panel">
          <h3>What still needs validation</h3>
          <p class="muted">${brief.refinementMismatch.join(" and ")} may still be a potential mismatch. A focused play test will confirm.</p>
          ${brief.refinementNextStep ? `<p class="muted"><strong>Best next step:</strong> ${brief.refinementNextStep}</p>` : ""}
        </article>
      ` : ""}

      ${brief.refinementBackupReason ? `
        <article class="panel">
          <h3>Best backup if your top pick falls through</h3>
          <p class="muted">${brief.refinementBackupReason}</p>
        </article>
      ` : ""}

      <article class="panel">
        <h3>Backups you can fall back to</h3>
        <p class="muted">${backupLabels.length ? backupLabels.join(", ") : "No backups saved yet."}</p>
      </article>

      <div class="feature-grid">
        <article class="panel">
          <h3>Completed blockers</h3>
          ${(brief.completedBlockers || []).length
            ? `<ul class="result-list">${brief.completedBlockers.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : `<p class="muted">No required checks marked complete yet.</p>`
          }
        </article>
        <article class="panel">
          <h3>Outstanding blockers</h3>
          ${(brief.outstandingBlockers || []).length
            ? `<ul class="result-list">${brief.outstandingBlockers.map((item) => `<li>${item}</li>`).join("")}</ul>`
            : `<p class="muted">No outstanding blockers. You are clear to proceed.</p>`
          }
        </article>
      </div>

      <article class="panel">
        <h3>Exact next 3 actions</h3>
        <ol class="steps">
          ${(brief.nextActions || []).slice(0, 3).map((item) => `<li>${item}</li>`).join("")}
        </ol>
        <div class="card-actions">
          ${brief.links?.machineDetail ? `<a class="btn btn-secondary" href="${brief.links.machineDetail}">View machine detail</a>` : ""}
          ${brief.links?.market ? `<a class="btn btn-secondary" href="${buildAffiliateUrl(brief.links.market, { machineSlug: brief.machineSlug, placement: "decision-brief" })}" target="_blank" rel="noreferrer" data-outbound-track data-outbound-label="Open used listings" data-outbound-slug="${brief.machineSlug ?? ""}" data-outbound-placement="decision-brief">Open used listings</a>` : ""}
          ${brief.links?.compare ? `<a class="btn btn-secondary" href="${brief.links.compare}">Compare backups</a>` : ""}
          ${machineId ? `<button class="btn btn-primary" type="button" data-action="open-sourcing:${machineId}">Continue buying plan</button>` : `<button class="btn btn-primary" type="button" data-action="back-to-results">Back to shortlist</button>`}
        </div>
      </article>
    </section>
  `;
}
