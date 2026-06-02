import { state } from "../state.js";
import { renderProgress } from "../components.js";
import { TASTE_SCALES, PLAYER_ARCHETYPES } from "../../../data/player-archetypes.js";
import { TASTE_PIVOT_PAIRS } from "../../../data/taste-pivot-pairs.js";
import { discoveryMachines, discoveryMachineIndex } from "../../../data/discovery-machines.js";
import { discoveryTastePrompts } from "../../../data/discovery-flow.js";
import { machineDisplayTitle, renderMachineImage } from "../../utils.js";
import { recommendMachines } from "../../discovery-engine.js";
import { renderTasteSummary } from "./setup.js";

export function renderTasteScale(scale, score, compact = false) {
  const isSet = score !== 0;
  const clampedPct = Math.max(6, Math.min(94, Math.round(((score + 6) / 12) * 100)));
  const leftActive = score < -0.5;
  const rightActive = score > 0.5;

  if (compact) {
    return `
      <div class="taste-scale taste-scale--compact">
        <span class="taste-scale-label taste-scale-label--left${leftActive ? " is-active" : ""}">${scale.left}</span>
        <div class="taste-scale-track">
          <div class="taste-scale-needle${isSet ? "" : " is-neutral"}" style="left: ${clampedPct}%"></div>
        </div>
        <span class="taste-scale-label taste-scale-label--right${rightActive ? " is-active" : ""}">${scale.right}</span>
      </div>
    `;
  }

  return `
    <div class="taste-scale">
      <div class="taste-scale-labels">
        <span class="${leftActive ? "scale-label-active" : ""}">${scale.left}</span>
        <span class="${rightActive ? "scale-label-active" : ""}">${scale.right}</span>
      </div>
      <div class="taste-scale-track">
        <div class="taste-scale-needle${isSet ? "" : " is-neutral"}" style="left: ${clampedPct}%"></div>
      </div>
    </div>
  `;
}

export function buildPlayerArchetype(scores) {
  let best = PLAYER_ARCHETYPES[0];
  let bestDot = -Infinity;
  for (const archetype of PLAYER_ARCHETYPES) {
    let dot = 0;
    for (const [dim, weight] of Object.entries(archetype.vector)) {
      dot += (scores[dim] || 0) * weight;
    }
    if (dot > bestDot) {
      bestDot = dot;
      best = archetype;
    }
  }
  return best;
}

export function deriveTasteAnswers(scores) {
  return {
    "learning-curve": (scores["learning-curve"] || 0) < 0 ? "quick-start" : "deep-discovery",
    "pace-feel": (scores["pace-feel"] || 0) < 0 ? "fast-smooth" : "controlled",
    "theme-pull": (scores["theme-pull"] || 0) > 0 ? "theme-first" : "gameplay-first",
    "challenge-level": (scores["challenge"] || 0) < 0 ? "forgiving" : "demanding",
    "replay-itch": (scores["replay"] || 0) < 0 ? "instant-replay" : "longer-progress",
    "ownership-style": (scores["ownership"] || 0) < 0 ? "safe" : "specific"
  };
}

export function renderTastePivot() {
  const pairIndex = state.tastePivotIndex || 0;
  const pair = TASTE_PIVOT_PAIRS[pairIndex];
  if (!pair) return "";

  const leftMachine = discoveryMachineIndex.get(pair.left.machineId);
  const rightMachine = discoveryMachineIndex.get(pair.right.machineId);
  if (!leftMachine || !rightMachine) return "";

  const progress = Math.round(((pairIndex + 1) / (TASTE_PIVOT_PAIRS.length + 1)) * 100);
  const hasAnyScore = Object.values(state.tasteScores).some((s) => s !== 0);

  const leftPlayed = state.selectedPlayedMachines.includes(leftMachine.id);
  const rightPlayed = state.selectedPlayedMachines.includes(rightMachine.id);

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Build your taste profile",
        pair.question,
        progress,
        `${pairIndex + 1} of ${TASTE_PIVOT_PAIRS.length}`
      )}
      <div class="taste-pivot-grid">
        <article class="taste-pivot-card panel" data-action="taste-pivot-details:${pairIndex}:left">
          ${leftPlayed ? `<span class="played-badge">You've played this</span>` : ""}
          ${renderMachineImage(leftMachine, { eager: true, className: "machine-image-frame--thumb" })}
          <div class="taste-pivot-body">
            <h3>${machineDisplayTitle(leftMachine)}</h3>
            <p class="taste-pivot-hint">Tap to see why</p>
          </div>
        </article>
        <div class="taste-pivot-or"><span>or</span></div>
        <article class="taste-pivot-card panel" data-action="taste-pivot-details:${pairIndex}:right">
          ${rightPlayed ? `<span class="played-badge">You've played this</span>` : ""}
          ${renderMachineImage(rightMachine, { eager: true, className: "machine-image-frame--thumb" })}
          <div class="taste-pivot-body">
            <h3>${machineDisplayTitle(rightMachine)}</h3>
            <p class="taste-pivot-hint">Tap to see why</p>
          </div>
        </article>
      </div>
      ${hasAnyScore ? `
        <article class="panel taste-scales-preview">
          <p class="eyebrow">Your taste profile — forming</p>
          <div class="taste-scales taste-scales--compact">
            ${TASTE_SCALES.map((scale) => renderTasteScale(scale, state.tasteScores[scale.id] || 0, true)).join("")}
          </div>
        </article>
      ` : ""}
    </section>
  `;
}

export function renderPlayedCatalogGroup(eraLabel, machines) {
  return `
    <div class="played-era-group">
      <h4 class="played-era-label">${eraLabel}</h4>
      <div class="played-machine-grid">
        ${machines.map((machine) => {
          const isPlayed = state.selectedPlayedMachines.includes(machine.id);
          const isOwned = state.ownedMachines.includes(machine.id);
          return `
            <button
              class="played-machine-btn${isPlayed || isOwned ? " is-selected" : ""}"
              type="button"
              data-toggle-played="${machine.id}"
            >
              ${renderMachineImage(machine, { eager: false, className: "machine-image-frame--micro" })}
              <span class="played-machine-name">${machineDisplayTitle(machine)}</span>
              ${isOwned ? `<span class="owned-badge-sm">Owned</span>` : isPlayed ? `<span class="played-badge-sm">Played</span>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function renderTastePlayedMachines() {
  const eras = ["2020s", "2010s", "2000s", "1990s"];
  const byEra = new Map(eras.map((e) => [e, []]));
  discoveryMachines.forEach((m) => {
    const era = m.era_category || m.era || "Other";
    if (!byEra.has(era)) byEra.set(era, []);
    byEra.get(era).push(m);
  });

  const totalSelected = state.selectedPlayedMachines.length + state.ownedMachines.length;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Games you've played or own",
        "Log any machines from our catalog. We'll use these to sharpen your taste comparisons.",
        90
      )}
      ${totalSelected > 0 ? `<p class="played-tally">${totalSelected} machine${totalSelected === 1 ? "" : "s"} logged</p>` : ""}
      ${[...byEra.entries()]
        .filter(([, ms]) => ms.length > 0)
        .map(([era, ms]) => renderPlayedCatalogGroup(era, ms))
        .join("")}
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="taste-played-done">Done</button>
      </div>
    </section>
  `;
}

export function renderNarrowToOne(buildMachineArchetypeReason) {
  const archetype = buildPlayerArchetype(state.tasteScores);
  const candidates = state.narrowCandidates || [];
  const round = state.narrowRound || 0;
  const totalRounds = candidates.length >= 3 ? 2 : 1;
  const isLastRound = round >= totalRounds - 1;

  const leftId = round === 0 ? candidates[0] : state.narrowWinner;
  const rightId = round === 0 ? candidates[1] : candidates[2];
  const leftMachine = discoveryMachineIndex.get(leftId);
  const rightMachine = discoveryMachineIndex.get(rightId);
  if (!leftMachine || !rightMachine) return "";

  const pickLabel = isLastRound ? "This is my machine" : "This one";
  const subtitle = round === 0
    ? "Two machines that match your profile — which feels more like you?"
    : "Final pick — does your first choice hold up?";

  const formatPrice = (m) =>
    (m.estimated_price_min && m.estimated_price_max)
      ? `$${m.estimated_price_min.toLocaleString()} – $${m.estimated_price_max.toLocaleString()}`
      : "";

  const renderNarrowCard = (machine, side) => `
    <article class="taste-pivot-card panel narrow-card">
      ${renderMachineImage(machine, { eager: true, className: "machine-image-frame--thumb" })}
      <div class="taste-pivot-body">
        <h3>${machineDisplayTitle(machine)}</h3>
        <p class="narrow-reason">${buildMachineArchetypeReason(machine, archetype, state.tasteScores)}</p>
        ${formatPrice(machine) ? `<p class="narrow-price muted">${formatPrice(machine)}</p>` : ""}
      </div>
      <button class="btn btn-primary" type="button" data-action="narrow-pick:${machine.id}">${pickLabel}</button>
    </article>
  `;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Pick your machine",
        subtitle,
        98,
        `Round ${round + 1} of ${totalRounds}`
      )}
      <div class="taste-pivot-grid">
        ${renderNarrowCard(leftMachine, "left")}
        <div class="taste-pivot-or"><span>or</span></div>
        ${renderNarrowCard(rightMachine, "right")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-secondary small" type="button" data-action="back-to-profile">Back to my profile</button>
      </div>
    </section>
  `;
}

export function renderTasteProfileReveal(currentContext, buildMachineArchetypeReason, renderProgress) {
  const archetype = buildPlayerArchetype(state.tasteScores);
  const recs = recommendMachines(currentContext(), [], 3, {
    machineLocationIndex: state.locationSearch.machineLocationIndex
  });

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Your player profile",
        "Here's how you play — and the machines that match.",
        96,
        archetype.name
      )}
      ${state.revalSignal === "major" ? `
        <div class="panel reval-signal reval-signal--major">
          <p class="eyebrow">Your top pick shifted</p>
          <h3>Machines you logged updated your #1 recommendation</h3>
          <p class="muted">Playing those machines gave your profile new signal. Re-run the bracket to find your new champion.</p>
          <div class="card-actions">
            <button class="btn btn-primary small" type="button" data-action="start-bracket">Re-run the bracket</button>
            <button class="btn btn-secondary small" type="button" data-action="reval-dismiss">Dismiss</button>
          </div>
        </div>
      ` : state.revalSignal === "minor" ? `
        <div class="panel reval-signal reval-signal--minor">
          <p class="eyebrow">Profile updated</p>
          <h3>Your top pick held — but a few more comparisons will sharpen it</h3>
          <p class="muted">Your rankings shifted slightly. A few more this-vs-that rounds will tighten your profile.</p>
          <div class="card-actions">
            <button class="btn btn-primary small" type="button" data-action="taste-continue">Dial in more</button>
            <button class="btn btn-secondary small" type="button" data-action="reval-dismiss">Skip</button>
          </div>
        </div>
      ` : ""}
      <article class="panel archetype-reveal-card">
        <p class="eyebrow">Player type</p>
        <h2 class="archetype-name">${archetype.name}</h2>
        <p>${archetype.summary}</p>
        <p class="muted"><strong>What to look for:</strong> ${archetype.lookFor}</p>
        <div class="badge-row">
          ${archetype.tags.map((t) => `<span class="badge">${t}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary small" type="button" data-action="share-profile">Share my profile</button>
        </div>
      </article>
      <article class="panel">
        <p class="eyebrow">Taste profile</p>
        <h3>Where you lean</h3>
        <div class="taste-scales">
          ${TASTE_SCALES.map((scale) => renderTasteScale(scale, state.tasteScores[scale.id] || 0, false)).join("")}
        </div>
      </article>
      ${recs.length > 0 ? `
        <article class="panel">
          <p class="eyebrow">Top seeds</p>
          <h3>Your top 3 — enter the bracket to find #1</h3>
          <div class="profile-recs">
            ${recs.map((machine) => `
              <div class="profile-rec-card">
                ${renderMachineImage(machine, { className: "machine-image-frame--thumb" })}
                <div class="profile-rec-body">
                  <strong>${machineDisplayTitle(machine)}</strong>
                  <p>${buildMachineArchetypeReason(machine, archetype, state.tasteScores)}</p>
                </div>
              </div>
            `).join("")}
          </div>
        </article>
      ` : ""}
      <article class="panel profile-actions-panel">
        <p class="eyebrow">Your profile</p>
        <h3>What would you like to do?</h3>
        <div class="profile-action-list">
          <button class="profile-action-btn" type="button" data-action="taste-continue">
            <span class="profile-action-icon">🎯</span>
            <div>
              <strong>Dial in your taste more</strong>
              <p>Run another round of comparisons to sharpen your profile</p>
            </div>
          </button>
          <button class="profile-action-btn" type="button" data-action="taste-track-played">
            <span class="profile-action-icon">🕹️</span>
            <div>
              <strong>Track games I've played</strong>
              <p>Mark machines you've played — they'll be prioritized in future comparisons</p>
            </div>
          </button>
          <button class="profile-action-btn" type="button" data-action="taste-rebuild">
            <span class="profile-action-icon">🔄</span>
            <div>
              <strong>Rebuild my taste profile</strong>
              <p>Start the comparisons over from scratch</p>
            </div>
          </button>
        </div>
      </article>
      <div class="discovery-actions">
        <button class="btn btn-primary" type="button" data-action="start-bracket">Enter the Bracket 🏆</button>
        <button class="btn btn-secondary small" type="button" data-action="show-recommendations">Browse all recommendations</button>
      </div>
    </section>
  `;
}

export function renderTasteProfile(discoveryTastePrompts, renderTastePrompt, renderProgress) {
  const complete = discoveryTastePrompts.every((prompt) => Boolean(state.tasteAnswers[prompt.id]));
  const progress = state.mode === "calibration" ? 28 : 30;

  return `
    <section class="discovery-shell">
      ${renderProgress(
        "Stage 2: Preference prompts",
        "These are simple, beginner-friendly tradeoffs. There are no wrong answers.",
        progress
      )}
      ${renderTasteSummary()}
      <div class="discovery-question-stack">
        ${discoveryTastePrompts.map((prompt) => renderTastePrompt(prompt, state.tasteAnswers[prompt.id])).join("")}
      </div>
      <div class="discovery-actions">
        <button class="btn btn-secondary" type="button" data-action="back-to-setup">Back</button>
        <button class="btn btn-primary" type="button" data-action="begin-reactions" ${complete ? "" : "disabled"}>Continue to machine previews</button>
      </div>
    </section>
  `;
}
