import { state } from "../state.js";
import { loadDecisionState } from "../../decision-state.js";
import { machines } from "../../../data/machines.js";
import { machineDisplayTitle } from "../../utils.js";
import { formatSavedSessionTimestamp, machineBySlug } from "../helpers.js";

export function renderEntryScreen() {
  const decisionBrief = loadDecisionState().decisionBrief;
  const briefMachine = decisionBrief?.machineSlug ? machineBySlug(decisionBrief.machineSlug) : null;
  const savedAtLabel = formatSavedSessionTimestamp(state.savedSessionUpdatedAt);
  const comparedMachines = state.compareContext?.machineTitles?.length
    ? state.compareContext.machineTitles
    : (state.compareContext?.selectedSlugs || [])
      .map((slug) => machines.find((m) => m.slug === slug))
      .filter(Boolean)
      .map((m) => machineDisplayTitle(m));
  const hasContinueOptions = state.hasSavedSession || decisionBrief?.machineSlug || comparedMachines?.length;
  const continuePrimaryAction = decisionBrief?.machineSlug
    ? `<button class="btn btn-primary" type="button" data-action="open-decision-brief">Open Decision Brief</button>`
    : state.hasSavedSession
      ? `<button class="btn btn-primary" type="button" data-action="resume-saved">Continue plan</button>`
      : comparedMachines?.length
        ? `<a class="btn btn-primary" href="compare.html">Continue compare</a>`
        : "";
  const continueCard = hasContinueOptions
    ? `
      <article class="panel">
        <p class="eyebrow">Continue where you left off</p>
        <h3>${briefMachine ? `${machineDisplayTitle(briefMachine)} plan is ready` : "Your progress is saved"}</h3>
        <p class="muted">
          ${decisionBrief?.machineSlug
            ? "Your Decision Brief is saved with a clear action plan."
            : state.hasSavedSession
              ? `Resume your guided shortlist flow.${savedAtLabel ? ` Last saved ${savedAtLabel}.` : ""}`
              : `You were comparing ${comparedMachines.join(" vs ")}. Continue with a focused tie-break decision.`}
        </p>
        <div class="card-actions">
          ${continuePrimaryAction}
          ${state.hasSavedSession ? `<button class="btn btn-secondary" type="button" data-action="discard-saved">Start fresh</button>` : ""}
          ${decisionBrief?.machineSlug ? `<button class="btn btn-secondary" type="button" data-action="open-shortlist">Open shortlist</button>` : ""}
          ${comparedMachines?.length ? `<a class="btn btn-secondary" href="compare.html">Open compare</a>` : ""}
        </div>
      </article>
    `
    : "";

  return `
    <section class="discovery-shell">
      <div class="panel entry-intro">
        <p class="eyebrow">First-pin discovery</p>
        <h2>Pick your starting path</h2>
        <p class="muted">Takes about 5 minutes. We'll narrow down machines that fit your budget, taste, and situation.</p>
      </div>
      ${continueCard}
      <div class="entry-path-grid">
        <button class="entry-path-card panel" type="button" data-entry="no">
          <div class="entry-path-header">
            <span class="entry-path-number">A</span>
            <h3>I'm new to pinball</h3>
          </div>
          <p class="muted">Guide me through budget, taste, and machine reactions — I'll build a shortlist from scratch.</p>
          <span class="entry-path-cta btn btn-primary">Start here →</span>
        </button>
        <button class="entry-path-card panel" type="button" data-entry="yes">
          <div class="entry-path-header">
            <span class="entry-path-number">B</span>
            <h3>I've played before</h3>
          </div>
          <p class="muted">Skip the basics — calibrate using machines you've already played to dial in your taste profile.</p>
          <span class="entry-path-cta btn btn-secondary">Calibrate instead →</span>
        </button>
      </div>
    </section>
  `;
}
