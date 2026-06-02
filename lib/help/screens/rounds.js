import { state } from "../state.js";
import { renderProgress, renderSignalPicker } from "../components.js";
import {
  calibrationReactionOptions,
  concernOptions,
  discoveryReactionOptions,
  likedAspectOptions
} from "../../../data/discovery-flow.js";
import { machineDisplayTitle, renderMachineImage, renderSplitCard } from "../../utils.js";
import { renderVideoAction } from "../../video.js";

export function renderPreferenceReflection(buildPreferenceReflection) {
  const notes = buildPreferenceReflection();

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Preference reflection before results",
        "Here is the reasoning lens we will use before showing recommendations.",
        68,
        "Trust check"
      )}
      <article class="panel">
        <p class="eyebrow">What we learned so far</p>
        <h3>Your buyer profile in plain English</h3>
        <ul class="result-list">
          ${notes.map((note) => `<li>${note}</li>`).join("")}
        </ul>
        <p class="muted">Next, results will be framed by buying decision type, not just a generic top-3 list.</p>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="back-to-reactions">Back</button>
        <button class="btn btn-primary" type="button" data-action="show-recommendations">Show my recommendations</button>
      </div>
    </section>
  `;
}

export function renderReactionCard(machine, options, modeLabel) {
  const displayTitle = machineDisplayTitle(machine);

  return `
    ${renderSplitCard({
      className: "discovery-machine-card",
      mediaClassName: "discovery-machine-card__media",
      bodyClassName: "discovery-machine-copy",
      imageHtml: renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb split-card__image discovery-machine-image" }),
      bodyHtml: `
        <div class="badge-row">
          <span class="badge">${machine.budget_band}</span>
          <span class="badge">${machine.theme}</span>
        </div>
        <h2>${displayTitle}</h2>
        <p class="hero-copy">${machine.beginner_summary}</p>
        <div class="card-actions">
          ${renderVideoAction({ url: machine.overview_video_url, label: machine.overview_video_label || "Watch overview", title: `${machine.name} overview` })}
          <a class="btn btn-secondary small" href="machine.html?slug=${machine.slug}">Tell me more</a>
        </div>
      `
    })}
    <div class="reaction-actions">
      <span class="muted reaction-prompt">${modeLabel}</span>
      ${options.map((option) => `
        <button class="btn ${option.value === options[0].value ? "btn-primary" : "btn-secondary"} reaction-btn" type="button" data-reaction="${option.value}">
          ${option.label}
        </button>
      `).join("")}
    </div>
    <details class="reaction-signals">
      <summary>Refine this reaction <span class="muted">(optional)</span></summary>
      ${renderSignalPicker("What stands out most in a good way?", likedAspectOptions, state.draft.likedAspect, "likedAspect")}
      ${renderSignalPicker("Any immediate concern?", concernOptions, state.draft.concern, "concern")}
    </details>
  `;
}

export function renderDiscoveryRound(currentMachine) {
  const machine = currentMachine();
  if (!machine) return "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 3: Guided machine reactions",
        "Review one machine, then react. Keep moving with your first impression.",
        30 + Math.round(((state.deckIndex + 1) / state.deck.length) * 30),
        `Machine ${state.deckIndex + 1} of ${state.deck.length}`
      )}
      ${renderReactionCard(machine, discoveryReactionOptions, "Does this look fun?")}
    </section>
  `;
}

export function renderCalibrationRound(currentMachine) {
  const machine = currentMachine();
  if (!machine) return "";

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 3: Calibration reactions",
        "Use your memory of this machine and give a quick reaction.",
        35 + Math.round(((state.deckIndex + 1) / state.deck.length) * 25),
        `Machine ${state.deckIndex + 1} of ${state.deck.length}`
      )}
      ${renderReactionCard(machine, calibrationReactionOptions, "How did this one land for you?")}
    </section>
  `;
}

export const proxyTraitPrompts = [
  { key: "pace", high: "Do you enjoy how fast and exciting it feels?", low: "Does the pace feel too slow or too frantic?" },
  { key: "shot_satisfaction", high: "Do the shots feel satisfying when you hit them?", low: "Do the shots feel awkward or unrewarding?" },
  { key: "rules_depth", high: "Does it feel like there is enough to discover over time?", low: "Does it feel too simple or too hard to follow?" },
  { key: "beginner_friendly", high: "Can you understand what to do without getting overwhelmed?", low: "Does it feel confusing too quickly?" },
  { key: "theme_integration", high: "Does the theme pull you in while you play?", low: "Does the theme feel flat or distracting?" },
  { key: "chaos_level", high: "Do you enjoy the bigger chaotic moments?", low: "Do the bigger moments feel messy or stressful?" },
  { key: "replayability", high: "Does it make you want to hit Start again?", low: "Does it feel repetitive after a game or two?" }
];
