/**
 * Shared UI render utilities for the discovery flow.
 * All functions are pure: they take data and return HTML strings.
 */

/**
 * Renders the progress bar panel shown at the top of each discovery screen.
 */
export function renderProgress(title, description, progress, badgeText = "") {
  return `
    <div class="panel discovery-progress">
      <div class="progress-label-row">
        <div>
          <p class="eyebrow">Pinball Scout</p>
          <h2>${title}</h2>
          <p class="muted">${description}</p>
        </div>
        ${badgeText ? `<span class="badge">${badgeText}</span>` : ""}
      </div>
      <div class="progress-bar" aria-hidden="true">
        <span class="progress-bar-fill" style="width: ${progress}%"></span>
      </div>
    </div>
  `;
}

/**
 * Renders a multiple-choice question card with selectable answer buttons.
 * question: { id, eyebrow, title, description, choices: [{ value, label, hint }] }
 */
export function renderChoiceGroup(question, selectedValue) {
  return `
    <article class="panel discovery-question">
      <p class="eyebrow">${question.eyebrow}</p>
      <h3>${question.title}</h3>
      <p class="muted">${question.description}</p>
      <div class="choice-grid">
        ${question.choices.map((choice) => `
          <button
            class="choice-card${selectedValue === choice.value ? " is-selected" : ""}"
            type="button"
            data-context-choice="${question.id}:${choice.value}"
          >
            <strong>${choice.label}</strong>
            <span>${choice.hint || ""}</span>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

/**
 * Renders a compact chip-row picker (used for draft fields like likedAspect, concern).
 */
export function renderSignalPicker(title, options, selectedValue, dataKey) {
  return `
    <div class="detail-list-block">
      <p><strong>${title}</strong></p>
      <div class="mini-chip-row">
        ${options.map((option) => `
          <button
            class="chip-button${selectedValue === option.value ? " is-selected" : ""}"
            type="button"
            data-draft-choice="${dataKey}:${option.value}"
          >
            ${option.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Renders a multi-select refinement chip row (used for liked/disliked signal chips).
 */
export function renderRefinementChips(title, prompts, selectedValues, dataKey, dataAttr, contextId) {
  return `
    <div class="detail-list-block">
      <p><strong>${title}</strong></p>
      <div class="mini-chip-row">
        ${prompts.map((prompt) => `
          <button
            class="chip-button${selectedValues.includes(prompt.id) ? " is-selected" : ""}"
            type="button"
            data-${dataAttr}="${contextId}:${dataKey}:${prompt.id}"
          >
            ${prompt.label}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}
