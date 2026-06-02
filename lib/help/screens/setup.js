import { state } from "../state.js";
import { renderProgress, renderChoiceGroup } from "../components.js";
import { discoveryContextQuestions, discoveryTastePrompts } from "../../../data/discovery-flow.js";
import { discoveryMachines } from "../../../data/discovery-machines.js";
import { machineDisplayTitle, renderMachineImage } from "../../utils.js";

export function renderDiscoverySetup() {
  const requiredIds = ["budget", "condition", "playAccess", "travelWillingness", "timeline"];
  const complete = requiredIds.every((id) => Boolean(state.context[id]));

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 1: Practical guardrails",
        "Answer a few practical questions first so recommendations stay realistic for your situation. You can add your ZIP later when you want nearby test planning.",
        20
      )}
      <div class="discovery-question-stack">
        ${requiredIds.map((id) => renderChoiceGroup(discoveryContextQuestions.find((q) => q.id === id), state.context[id])).join("")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-discovery" ${complete ? "" : "disabled"}>Build my taste profile</button>
      </div>
    </section>
  `;
}

export function renderBudgetCheck() {
  const budgetQ = discoveryContextQuestions.find((q) => q.id === "budget");
  return `
    <section class="discovery-shell">
      ${renderProgress(
        "What's your budget?",
        "One tap — we'll filter to what's actually within reach.",
        15
      )}
      <div class="choice-grid budget-grid">
        ${budgetQ.choices.map((c) => `
          <button class="choice-card${state.context.budget === c.value ? " is-selected" : ""}"
            type="button"
            data-context-choice="budget:${c.value}">
            <strong>${c.label}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderPlayedSelector(machine) {
  const selected = state.selectedPlayedMachines.includes(machine.id);
  const displayTitle = machineDisplayTitle(machine);

  return `
    <button class="played-machine-card${selected ? " is-selected" : ""}" type="button" data-toggle-played="${machine.id}">
      ${renderMachineImage(machine, { className: "machine-image-frame--thumb played-machine-card__image" })}
      <strong>${displayTitle}</strong>
      <span>${machine.beginner_summary}</span>
    </button>
  `;
}

export function renderCalibrationSetup() {
  const complete = Boolean(state.context.budget && state.context.condition && state.context.travelWillingness && state.context.timeline && state.selectedPlayedMachines.length);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 1: Practical guardrails + calibration",
        "Set budget and timeline, then calibrate from games you already know. You can add your ZIP later for nearby test planning.",
        20,
        `${state.selectedPlayedMachines.length} selected`
      )}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "budget"), state.context.budget)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "condition"), state.context.condition)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "travelWillingness"), state.context.travelWillingness)}
      ${renderChoiceGroup(discoveryContextQuestions.find((question) => question.id === "timeline"), state.context.timeline)}
      <article class="panel discovery-question">
        <p class="eyebrow">Played before</p>
        <h3>Which of these machines have you played?</h3>
        <p class="muted">You only need one, but more gives the system a better starting read.</p>
        <div class="played-grid">
          ${discoveryMachines.map((machine) => renderPlayedSelector(machine)).join("")}
        </div>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-calibration" ${complete ? "" : "disabled"}>Build my taste profile</button>
      </div>
    </section>
  `;
}

export function renderTastePrompt(prompt, selectedValue) {
  return `
    <article class="panel discovery-question taste-card">
      <p class="eyebrow">${prompt.eyebrow}</p>
      <h3>${prompt.title}</h3>
      <div class="choice-grid taste-grid">
        ${prompt.options.map((option) => `
          <button
            class="choice-card${selectedValue === option.value ? " is-selected" : ""}"
            type="button"
            data-taste-choice="${prompt.id}:${option.value}"
          >
            <strong>${option.label}</strong>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

export function renderTasteSummary() {
  const isDiscovery = state.mode !== "calibration";
  const selections = discoveryTastePrompts
    .map((prompt) => {
      const selectedValue = state.tasteAnswers[prompt.id];
      const option = prompt.options.find((item) => item.value === selectedValue);
      return option ? option.label : "";
    })
    .filter(Boolean);

  return `
    <article class="panel taste-summary">
      <p class="eyebrow">Pinball taste profile</p>
      <h3>Your preferences</h3>
      <p class="muted">${isDiscovery ? "These picks refine your shortlist based on the machines you just reacted to." : "These quick choices shape the first round of machine previews."}</p>
      <div class="taste-chip-row">
        ${selections.length ? selections.map((label) => `<span class="badge">${label}</span>`).join("") : `<span class="muted">Make a few picks to sharpen the shortlist.</span>`}
      </div>
    </article>
  `;
}
