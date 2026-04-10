import { machines } from "../data/machines.js";
import { discoveryMachineIndex } from "../data/discovery-machines.js";
import { initGlossary } from "./glossary.js";
import { renderGlossaryTrigger } from "../data/glossary.js";
import { buyerFitSummary, compareStore, formatConditionLabel, formatCurrency, machineDisplayTitle, showSiteMessage, trackEvent, updateCompareCount } from "./utils.js";
import { initNav } from "./nav.js";
import { loadDecisionState, saveDecisionState } from "./decision-state.js";
import { readMachinePlanState } from "./decision-plan.js";
import { blockerProgress, blockersForPath, readinessFromBlockers } from "./required-checks.js";
import { applyTieBreakerAdjustment, selectTieBreakerQuestions, tieBreakerRationale } from "./tie-breaker.js";
import { initDecisionBar } from "./decision-bar.js";
import { ANALYTICS_EVENTS, trackAnalytics, trackAnalyticsOnce } from "./analytics-events.js";
import * as utils from "./utils.js";

const root = document.querySelector("#compare-content");
const trackedTooCloseKeys = new Set();
const STICKY_HEADER_OFFSET = 84;
initNav();

function scrollToTop() {
  const section = root?.closest("main");
  const target = section || root;
  if (!target) return;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - STICKY_HEADER_OFFSET);
  window.scrollTo({ top, behavior: "smooth" });
}

const PRESET_LABELS = {
  balanced: "Balanced",
  "lowest-regret": "Lowest regret",
  "most-excitement": "Most excitement",
  "easiest-ownership": "Easiest ownership"
};

const PRESET_EXPLANATIONS = {
  balanced: "Balanced mode slightly favors beginner safety and ownership stability.",
  "lowest-regret": "Lowest regret prioritizes resale protection and predictable ownership.",
  "most-excitement": "Most excitement gives more weight to theme pull and gameplay depth.",
  "easiest-ownership": "Easiest ownership emphasizes lower upkeep and smoother first-owner ramp."
};

const PRESET_WEIGHTS = {
  balanced: {
    beginner_fit: 0.26,
    resale_strength: 0.18,
    maintenance_ease: 0.2,
    theme_pull: 0.1,
    gameplay_depth: 0.1,
    price_certainty: 0.16
  },
  "lowest-regret": {
    beginner_fit: 0.2,
    resale_strength: 0.3,
    maintenance_ease: 0.25,
    theme_pull: 0.03,
    gameplay_depth: 0.02,
    price_certainty: 0.2
  },
  "most-excitement": {
    beginner_fit: 0.1,
    resale_strength: 0.07,
    maintenance_ease: 0.08,
    theme_pull: 0.35,
    gameplay_depth: 0.3,
    price_certainty: 0.1
  },
  "easiest-ownership": {
    beginner_fit: 0.25,
    resale_strength: 0.15,
    maintenance_ease: 0.35,
    theme_pull: 0.04,
    gameplay_depth: 0.03,
    price_certainty: 0.18
  }
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function compareStateFromDecision(decisionState) {
  return decisionState.compareState || {
    presetMode: "balanced",
    compareMode: "pick-one-now",
    tooClose: false,
    tieBreakerResponses: {},
    tieBreakerStartedAt: "",
    selectedSlugs: [],
    temporaryPrimaryCandidate: ""
  };
}

function machineBySlug(slug) {
  return machines.find((machine) => machine.slug === slug) || null;
}

function selectedMachinesFromSlugs(slugs = []) {
  return slugs.map((slug) => machineBySlug(slug)).filter(Boolean);
}

function canonicalSelection(decisionState) {
  const compareState = compareStateFromDecision(decisionState);
  const storeSlugs = compareStore.get().filter((slug) => machineBySlug(slug));
  const stateSlugs = (compareState.selectedSlugs || []).filter((slug) => machineBySlug(slug));
  const decisionSlugs = [decisionState.frontRunnerSlug, ...(decisionState.backupSlugs || [])]
    .filter(Boolean)
    .filter((slug, index, list) => list.indexOf(slug) === index)
    .filter((slug) => machineBySlug(slug));

  const chosen = decisionSlugs.length >= 2
    ? decisionSlugs
    : stateSlugs.length >= 2
      ? stateSlugs
      : storeSlugs.length >= 2
        ? storeSlugs
        : decisionSlugs.length
          ? decisionSlugs
          : stateSlugs.length
            ? stateSlugs
            : storeSlugs;
  return chosen.slice(0, 3);
}

function syncDecisionStateFromCompare(selected, patchCompare = {}) {
  const current = loadDecisionState();
  const compareState = compareStateFromDecision(current);
  const selectedSlugs = selected.map((machine) => machine.slug);
  const frontRunnerSlug = selectedSlugs.includes(current.frontRunnerSlug) ? current.frontRunnerSlug : selectedSlugs[0] || current.frontRunnerSlug;
  const backupSlugs = selectedSlugs.filter((slug) => slug !== frontRunnerSlug).slice(0, 2);
  const nextCompare = {
    ...compareState,
    selectedSlugs,
    ...patchCompare
  };

  const unchanged =
    frontRunnerSlug === current.frontRunnerSlug &&
    JSON.stringify(backupSlugs) === JSON.stringify(current.backupSlugs || []) &&
    JSON.stringify(nextCompare) === JSON.stringify(compareState);
  if (unchanged) return;

  saveDecisionState({
    frontRunnerSlug,
    backupSlugs,
    compareState: nextCompare
  });
}

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

function derivedResaleStrength(machine, discoveryMachine) {
  if (discoveryMachine?.resaleStrength) return clamp(discoveryMachine.resaleStrength / 5);
  let score = 3;
  if (machine.condition_availability === "both") score += 1;
  if (machine.tags?.includes("popular") || machine.tags?.includes("first-home contender")) score += 1;
  if (machine.condition_availability === "new") score -= 0.3;
  return clamp(score / 5);
}

function derivedThemePull(machine, discoveryMachine) {
  if (discoveryMachine?.themeStrength) return discoveryMachine.themeStrength / 5;
  let score = 0.55;
  if (machine.tags?.some((tag) => tag.includes("theme") || tag.includes("licensed") || tag.includes("music"))) score += 0.2;
  if (machine.family_friendliness >= 4) score += 0.08;
  return clamp(score);
}

function priceCertainty(machine, discoveryMachine) {
  const max = Number(machine.estimated_price_max || 0);
  const min = Number(machine.estimated_price_min || 0);
  const ratio = max > min && max > 0 ? (max - min) / max : 0.22;
  let score = 1 - clamp(ratio * 2.1);
  if (machine.condition_availability === "both") score += 0.08;
  if (machine.condition_availability === "new") score -= 0.08;
  if (discoveryMachine?.findabilityScore) score += ((discoveryMachine.findabilityScore - 3) / 10);
  return clamp(score);
}

function normalizedFactors(machine) {
  const discoveryMachine = discoveryMachineIndex.get(machine.slug);
  return {
    beginner_fit: clamp((discoveryMachine?.beginnerFriendly || machine.beginner_friendliness || 3) / 5),
    resale_strength: derivedResaleStrength(machine, discoveryMachine),
    maintenance_ease: clamp((6 - (discoveryMachine?.maintenanceComplexity || machine.maintenance_difficulty || 3)) / 5),
    theme_pull: derivedThemePull(machine, discoveryMachine),
    gameplay_depth: clamp((discoveryMachine?.gameplayDepth || machine.rules_complexity || 3) / 5),
    price_certainty: priceCertainty(machine, discoveryMachine)
  };
}

function scoreMachine(machine, presetMode) {
  const weights = PRESET_WEIGHTS[presetMode] || PRESET_WEIGHTS.balanced;
  const factors = normalizedFactors(machine);
  const weighted = Object.entries(weights).reduce((acc, [key, weight]) => {
    acc[key] = (factors[key] || 0) * weight;
    return acc;
  }, {});
  const score = Object.values(weighted).reduce((sum, value) => sum + value, 0);
  return { factors, weighted, score };
}

function readinessForMachine(machine, decisionState) {
  const plan = readMachinePlanState(decisionState, machine.slug, "");
  const blockers = blockersForPath(plan.selectedPathType, false);
  const progress = blockerProgress(blockers, plan.requiredChecks || {});
  const readiness = readinessFromBlockers({
    pathType: plan.selectedPathType,
    blockers,
    requiredChecks: plan.requiredChecks || {},
    currentPlanStep: plan.currentPlanStep,
    workingPickConfirmed: plan.workingPickConfirmed
  });
  return { readiness, progress, plan };
}

function readinessBand(label = "") {
  if (label === "Ready to proceed") return "ready";
  if (label === "Near-ready") return "near";
  if (label === "Near-ready, blocked") return "blocked";
  return "not-ready";
}

function pairTradeoffSummary(left, right) {
  const saferScoreLeft = left.factors.beginner_fit + left.factors.maintenance_ease + left.factors.resale_strength + left.factors.price_certainty;
  const saferScoreRight = right.factors.beginner_fit + right.factors.maintenance_ease + right.factors.resale_strength + right.factors.price_certainty;
  const excitingScoreLeft = left.factors.theme_pull + left.factors.gameplay_depth;
  const excitingScoreRight = right.factors.theme_pull + right.factors.gameplay_depth;
  return {
    saferSlug: saferScoreLeft >= saferScoreRight ? left.machine.slug : right.machine.slug,
    excitingSlug: excitingScoreLeft >= excitingScoreRight ? left.machine.slug : right.machine.slug
  };
}

function computePairOutcome(ranked, readinessBySlug) {
  if (ranked.length < 2) {
    return { tooClose: false, delta: 1, bothReady: false, sameReadinessBand: false, tradeoff: { saferSlug: "", excitingSlug: "" } };
  }

  const [top, second] = ranked;
  const delta = top.score - second.score;
  const topReadiness = readinessBySlug[top.machine.slug]?.readiness?.label || "";
  const secondReadiness = readinessBySlug[second.machine.slug]?.readiness?.label || "";
  const sameReadinessBand = readinessBand(topReadiness) === readinessBand(secondReadiness);
  const bothReady = topReadiness === "Ready to proceed" && secondReadiness === "Ready to proceed";
  const tradeoff = pairTradeoffSummary(top, second);
  const unresolvedTradeoff = tradeoff.saferSlug !== tradeoff.excitingSlug;
  const bothStrong = top.score >= 0.55 && second.score >= 0.5;
  const tooClose = delta < 0.06 || (delta < 0.1 && sameReadinessBand && bothStrong && unresolvedTradeoff);

  return { tooClose, delta, bothReady, sameReadinessBand, tradeoff };
}

function compareReasonLine(baseRanked, activeRanked, presetMode) {
  const baseWinner = baseRanked[0];
  const activeWinner = activeRanked[0];
  if (!baseWinner || !activeWinner) return "";
  if (presetMode === "balanced") return "Balanced mode favors beginner safety and predictable ownership.";
  if (baseWinner.machine.slug === activeWinner.machine.slug) return "Winner unchanged in this mode.";

  const activeRunnerUp = activeRanked[1];
  const winnerContrib = Object.entries(activeWinner.weighted).sort((a, b) => b[1] - a[1])[0]?.[0] || "beginner_fit";
  const loserContrib = Object.entries(activeRunnerUp?.weighted || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || winnerContrib;
  const labels = {
    beginner_fit: "beginner fit",
    resale_strength: "regret protection",
    maintenance_ease: "easier ownership",
    theme_pull: "theme excitement",
    gameplay_depth: "gameplay depth",
    price_certainty: "price certainty"
  };
  return `${machineDisplayTitle(activeWinner.machine)} now leads on ${labels[winnerContrib]} over ${labels[loserContrib]}.`;
}

function deepRows() {
  return [
    ["Who this is best for", (machine) => machine.best_for],
    ["Beginner confidence / safety", (machine) => buyerFitSummary(machine)],
    ["Ownership effort", (machine) => machine.maintenance_difficulty >= 4 ? "Higher ownership effort" : machine.maintenance_difficulty >= 3 ? "Moderate ownership effort" : "Lower ownership effort"],
    ["Replay depth", (machine) => machine.rules_complexity >= 4 ? "Deeper rules" : machine.rules_complexity >= 3 ? "Balanced depth" : "Lighter rules depth", "rules-depth"],
    ["Availability", (machine) => formatConditionLabel(machine.condition_availability)],
    ["Estimated price", (machine) => pricingSummary(machine).estimated.rangeText],
    ["Typical used range", (machine) => pricingSummary(machine).used?.rangeText || "No imported used-market range"]
  ];
}

function renderRowLabel(label, glossaryKey) {
  if (!glossaryKey) return label;
  return `<span class="compare-label-with-term"><span>${label}</span>${renderGlossaryTrigger(glossaryKey, { label: "?", ariaLabel: `Explain ${label}`, variant: "icon" })}</span>`;
}

function autoAddTopTwoFromDecision() {
  const decisionState = loadDecisionState();
  const seed = [decisionState.frontRunnerSlug, ...(decisionState.backupSlugs || [])]
    .filter(Boolean)
    .filter((slug, index, list) => list.indexOf(slug) === index)
    .slice(0, 2);
  if (seed.length < 2) return false;
  compareStore.set(seed);
  syncDecisionStateFromCompare(selectedMachinesFromSlugs(seed), {
    selectedSlugs: seed,
    compareMode: "pick-one-now"
  });
  return true;
}

function renderUnderfilled(selected, decisionState) {
  const canAutoAdd = [decisionState.frontRunnerSlug, ...(decisionState.backupSlugs || [])].filter(Boolean).length >= 2;
  root.innerHTML = `
    <div class="panel empty-state compare-empty-state">
      <h3>Compare needs two strong candidates</h3>
      <p class="muted">Pick One Now works best with your front-runner and one backup.</p>
      ${selected.length ? `<div class="selected-strip">${selected.map((machine) => `<div class="selected-pill"><span>${machineDisplayTitle(machine)}</span><button class="chip-button compare-remove" data-slug="${machine.slug}" type="button">Remove</button></div>`).join("")}</div>` : ""}
      <div class="hero-actions compare-empty-actions">
        <a class="btn btn-primary" href="help.html?resume=1">Return to shortlist</a>
        <button class="btn btn-secondary" type="button" data-action="compare-auto-add" ${canAutoAdd ? "" : "disabled"}>Auto-add top 2 recommendations</button>
      </div>
    </div>
  `;
}

function render() {
  const decisionState = loadDecisionState();
  const compareState = compareStateFromDecision(decisionState);
  const selectionSlugs = canonicalSelection(decisionState);
  compareStore.set(selectionSlugs);
  const selected = selectedMachinesFromSlugs(selectionSlugs);
  const comparePatch = { selectedSlugs: selectionSlugs };
  if (selected.length < 2) {
    comparePatch.tooClose = false;
    comparePatch.tieBreakerResponses = {};
    comparePatch.tieBreakerStartedAt = "";
    comparePatch.temporaryPrimaryCandidate = "";
  }
  syncDecisionStateFromCompare(selected, comparePatch);
  updateCompareCount();

  if (selected.length < 2) {
    const underfilledKey = `underfilled:${selectionSlugs.join(",")}`;
    trackAnalyticsOnce(ANALYTICS_EVENTS.COMPARE_VIEWED, underfilledKey, {
      pair_count: selected.length,
      preset_mode: compareState.presetMode || "balanced",
      too_close: false
    });
    renderUnderfilled(selected, decisionState);
    bindCommonHandlers();
    return;
  }

  const presetMode = PRESET_WEIGHTS[compareState.presetMode] ? compareState.presetMode : "balanced";
  const compareMode = compareState.compareMode === "deep-details" ? "deep-details" : "pick-one-now";
  const scored = selected.map((machine) => {
    const scoreModel = scoreMachine(machine, presetMode);
    return {
      machine,
      ...scoreModel
    };
  });
  const balancedRanked = [...selected].map((machine) => ({ machine, ...scoreMachine(machine, "balanced") }))
    .sort((left, right) => right.score - left.score);

  const readinessBySlug = Object.fromEntries(selected.map((machine) => [machine.slug, readinessForMachine(machine, decisionState)]));
  const tiePair = scored.slice(0, 2);
  const factorDeltas = tiePair.length === 2
    ? Object.keys(tiePair[0].factors).reduce((acc, factor) => {
      acc[factor] = (tiePair[0].factors[factor] || 0) - (tiePair[1].factors[factor] || 0);
      return acc;
    }, {})
    : {};

  const tieQuestions = selectTieBreakerQuestions({
    presetMode,
    factorDeltas,
    readinessA: readinessBySlug[tiePair[0]?.machine.slug]?.readiness?.label || "",
    readinessB: readinessBySlug[tiePair[1]?.machine.slug]?.readiness?.label || ""
  });
  const tieResponses = compareState.tieBreakerResponses || {};
  const answeredCount = tieQuestions.filter((question) => Boolean(tieResponses[question.id])).length;
  const tieBreakerStarted = Boolean(compareState.tieBreakerStartedAt);

  const rankedBeforeTie = [...scored].sort((left, right) => right.score - left.score);
  let ranked = [...rankedBeforeTie];
  if (tiePair.length === 2 && answeredCount > 0) {
    const adjusted = applyTieBreakerAdjustment({
      baseScores: { a: tiePair[0].score, b: tiePair[1].score },
      questions: tieQuestions,
      responses: tieResponses
    });
    const adjustedMap = {
      [tiePair[0].machine.slug]: adjusted.a,
      [tiePair[1].machine.slug]: adjusted.b
    };
    ranked = [...scored]
      .map((item) => ({
        ...item,
        score: adjustedMap[item.machine.slug] ?? item.score
      }))
      .sort((left, right) => right.score - left.score);
  }

  const pairOutcome = computePairOutcome(ranked, readinessBySlug);
  const compareViewKey = `${selectionSlugs.join(",")}:${presetMode}:${pairOutcome.tooClose}`;
  trackAnalyticsOnce(ANALYTICS_EVENTS.COMPARE_VIEWED, compareViewKey, {
    pair_count: selected.length,
    preset_mode: presetMode,
    too_close: pairOutcome.tooClose
  });
  const tooCloseKey = `${presetMode}:${ranked[0]?.machine.slug || ""}:${ranked[1]?.machine.slug || ""}:${pairOutcome.delta.toFixed(3)}:${pairOutcome.bothReady}`;
  if (pairOutcome.tooClose && !trackedTooCloseKeys.has(tooCloseKey)) {
    trackedTooCloseKeys.add(tooCloseKey);
    trackAnalytics(ANALYTICS_EVENTS.TOO_CLOSE_TRIGGERED, {
      mode: presetMode,
      score_delta: Number(pairOutcome.delta.toFixed(4)),
      machine_a: ranked[0]?.machine.slug || "",
      machine_b: ranked[1]?.machine.slug || "",
      both_ready: pairOutcome.bothReady
    });
  }

  syncDecisionStateFromCompare(selected, {
    presetMode,
    compareMode,
    tooClose: pairOutcome.tooClose
  });

  const winner = ranked[0];
  const runnerUp = ranked[1];
  const reasonLine = compareReasonLine(balancedRanked, ranked, presetMode);
  const temporaryBanner = !pairOutcome.tooClose && decisionState.temporaryPrimary && decisionState.frontRunnerSlug
    ? `<article class="panel compare-reco-banner is-neutral"><h3>Temporary front-runner: ${machineDisplayTitle(machineBySlug(decisionState.frontRunnerSlug) || { name: decisionState.frontRunnerSlug, title: decisionState.frontRunnerSlug })}</h3><p class="muted">Tie-breaker unresolved. Recheck after next validation.</p><a class="btn btn-secondary small" href="help.html?resume=1">Continue buying plan</a></article>`
    : "";

  const closeCallPanel = pairOutcome.tooClose ? (() => {
    const safer = pairOutcome.bothReady && winner && runnerUp
      ? (pairOutcome.tradeoff.saferSlug === winner.machine.slug ? winner.machine : runnerUp.machine)
      : null;
    const exciting = pairOutcome.bothReady && winner && runnerUp
      ? (pairOutcome.tradeoff.excitingSlug === winner.machine.slug ? winner.machine : runnerUp.machine)
      : null;

    return `
      <article class="panel compare-reco-banner is-neutral tie-breaker-panel">
        <h3>${decisionState.temporaryPrimary ? `Temporary front-runner: ${machineDisplayTitle(machineBySlug(decisionState.frontRunnerSlug) || { name: decisionState.frontRunnerSlug, title: decisionState.frontRunnerSlug })}` : "Too close to call right now"}</h3>
        <p class="muted">${tieBreakerStarted ? tieBreakerRationale(tieQuestions) : "Both options are still strong. Run the tie-breaker to resolve the final gap."}</p>
        ${pairOutcome.bothReady && safer && exciting ? `<p class="muted"><strong>Both are ready:</strong> safer pick is <strong>${machineDisplayTitle(safer)}</strong>; more exciting pick is <strong>${machineDisplayTitle(exciting)}</strong>.</p>` : ""}
        ${tieBreakerStarted ? `
          <div class="tie-question-stack">
            ${tieQuestions.map((question) => `
              <article class="tie-question">
                <p><strong>${question.text}</strong></p>
                <div class="mini-chip-row">
                  <button class="chip-button${tieResponses[question.id] === "a" ? " is-selected" : ""}" type="button" data-action="tie-answer:${question.id}:a">${question.options.a}</button>
                  <button class="chip-button${tieResponses[question.id] === "both" ? " is-selected" : ""}" type="button" data-action="tie-answer:${question.id}:both">${question.options.both}</button>
                  <button class="chip-button${tieResponses[question.id] === "b" ? " is-selected" : ""}" type="button" data-action="tie-answer:${question.id}:b">${question.options.b}</button>
                </div>
              </article>
            `).join("")}
          </div>
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="tie-breaker-apply" ${answeredCount === 3 ? "" : "disabled"}>Apply tie-breaker</button>
            ${winner && runnerUp ? `<button class="btn btn-secondary" type="button" data-action="set-temporary-primary:${winner.machine.slug}:${runnerUp.machine.slug}">Set temporary primary</button>` : ""}
          </div>
        ` : `
          <div class="discovery-actions">
            <button class="btn btn-primary" type="button" data-action="tie-breaker-start">Start tie-breaker</button>
            ${winner && runnerUp ? `<button class="btn btn-secondary" type="button" data-action="set-temporary-primary:${winner.machine.slug}:${runnerUp.machine.slug}">Set temporary primary</button>` : ""}
          </div>
        `}
      </article>
    `;
  })() : "";
  const winnerBanner = pairOutcome.tooClose
    ? ""
    : `<article class="panel compare-reco-banner"><h3>Current pick: ${machineDisplayTitle(winner.machine)}</h3><p class="muted">${reasonLine}</p></article>`;

  const cards = ranked.map((item) => {
    const readiness = readinessBySlug[item.machine.slug]?.readiness?.label || "Not ready";
    const pricing = pricingSummary(item.machine);
    const isTemporary = decisionState.temporaryPrimary && decisionState.frontRunnerSlug === item.machine.slug;
    return `
      <article class="panel compare-decision-card">
        <div class="badge-row">
          <span class="badge">Rank ${ranked.indexOf(item) + 1}</span>
          <span class="badge">${readiness}</span>
          ${isTemporary ? `<span class="badge">Temporary</span>` : ""}
        </div>
        <h3>${machineDisplayTitle(item.machine)}</h3>
        <p class="muted"><strong>Best for your situation:</strong> ${item.machine.best_for}</p>
        <p class="muted"><strong>Main downside:</strong> ${item.machine.considerations}</p>
        <p class="muted"><strong>What to confirm before buying:</strong> ${discoveryMachineIndex.get(item.machine.slug)?.validationPlan || "Confirm one focused real-world validation step before final commit."}</p>
        <p class="muted"><strong>Estimated price band:</strong> ${pricing.estimated.rangeText}</p>
        <div class="card-actions">
          <button class="btn btn-primary small" type="button" data-action="choose-front-runner:${item.machine.slug}">Set as front-runner</button>
          <a class="btn btn-secondary small" href="help.html?resume=1">Continue buying plan</a>
        </div>
      </article>
    `;
  }).join("");

  const rows = deepRows();
  root.innerHTML = `
    <div class="compare-page-stack">
      <article class="panel compare-intro">
        <p class="eyebrow">Pick One Now</p>
        <h2>Choose your current winner, then continue the plan.</h2>
        <p class="muted">Use one priority mode, make a choice, and move back into buying-plan validation.</p>
      </article>

      <article class="panel compare-priority-panel">
        <div class="section-head compact">
          <h3>Decision priority</h3>
          <span class="badge">Mode: ${PRESET_LABELS[presetMode]}</span>
        </div>
        <div class="mini-chip-row">
          ${Object.entries(PRESET_LABELS).map(([value, label]) => `
            <button class="chip-button${presetMode === value ? " is-selected" : ""}" type="button" data-action="compare-set-preset:${value}">${label}</button>
          `).join("")}
        </div>
        <p class="muted"><strong>Current read:</strong> ${reasonLine}</p>
      </article>

      ${temporaryBanner}
      ${winnerBanner}
      ${closeCallPanel}

      <div class="feature-grid compare-decision-grid">
        ${cards}
      </div>

      <details class="accordion" id="compare-deep-details" ${compareMode === "deep-details" ? "open" : ""}>
        <summary>Need Deep Details?</summary>
        <div class="accordion__body">
          <p class="muted">Open this only if you still need more confirmation after choosing a current winner.</p>
          <div class="compare-table-wrap">
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
      </details>
    </div>
  `;

  bindCommonHandlers();
  initGlossary(root);
}

function bindCommonHandlers() {
  root.querySelectorAll(".compare-remove").forEach((button) => {
    button.addEventListener("click", () => {
      const slug = button.dataset.slug;
      const decisionState = loadDecisionState();
      const baseSelection = canonicalSelection(decisionState);
      const nextSelection = baseSelection.filter((item) => item !== slug).slice(0, 3);
      compareStore.set(nextSelection);
      if (!nextSelection.length) {
        const compareState = compareStateFromDecision(decisionState);
        saveDecisionState({
          frontRunnerSlug: "",
          backupSlugs: [],
          temporaryPrimary: false,
          temporaryPrimaryReason: "",
          compareState: {
            ...compareState,
            selectedSlugs: [],
            tooClose: false,
            tieBreakerResponses: {},
            tieBreakerStartedAt: "",
            temporaryPrimaryCandidate: ""
          }
        });
      } else {
        syncDecisionStateFromCompare(selectedMachinesFromSlugs(nextSelection), { selectedSlugs: nextSelection });
      }
      trackEvent("compare_remove", { slug, source: "compare-page" });
      scrollToTop();
      render();
    });
  });

  const details = root.querySelector("#compare-deep-details");
  if (details && details.dataset.bound !== "true") {
    details.dataset.bound = "true";
    details.addEventListener("toggle", () => {
      const decisionState = loadDecisionState();
      const compareState = compareStateFromDecision(decisionState);
      saveDecisionState({
        compareState: {
          ...compareState,
          compareMode: details.open ? "deep-details" : "pick-one-now"
        }
      });
      trackEvent("compare_deep_details_toggled", { open: details.open });
    });
  }
}

root?.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;

  if (action === "compare-auto-add") {
    if (autoAddTopTwoFromDecision()) {
      scrollToTop();
      render();
    }
    return;
  }

  if (action.startsWith("compare-set-preset:")) {
    const mode = action.split(":")[1];
    if (!PRESET_WEIGHTS[mode]) return;
    const decisionState = loadDecisionState();
    const compareState = compareStateFromDecision(decisionState);
    const selected = canonicalSelection(decisionState).map((slug) => machineBySlug(slug)).filter(Boolean);
    const rankedBefore = selected.length
      ? [...selected].map((machine) => ({ machine, ...scoreMachine(machine, compareState.presetMode || "balanced") })).sort((left, right) => right.score - left.score)
      : [];
    const rankedAfter = selected.length
      ? [...selected].map((machine) => ({ machine, ...scoreMachine(machine, mode) })).sort((left, right) => right.score - left.score)
      : [];
    saveDecisionState({
      compareState: {
        ...compareState,
        presetMode: mode,
        tieBreakerResponses: {},
        tieBreakerStartedAt: ""
      }
    });
    trackAnalytics(ANALYTICS_EVENTS.COMPARE_PRESET_CHANGED, {
      from_mode: compareState.presetMode || "balanced",
      to_mode: mode,
      winner_before: rankedBefore[0]?.machine.slug || "",
      winner_after: rankedAfter[0]?.machine.slug || ""
    });
    scrollToTop();
    render();
    return;
  }

  if (action === "tie-breaker-start") {
    const decisionState = loadDecisionState();
    const compareState = compareStateFromDecision(decisionState);
    const selected = canonicalSelection(decisionState).slice(0, 2);
    saveDecisionState({
      compareState: {
        ...compareState,
        tieBreakerStartedAt: new Date().toISOString(),
        tieBreakerResponses: {}
      }
    });
    trackAnalytics(ANALYTICS_EVENTS.TIE_BREAKER_STARTED, {
      mode: compareState.presetMode || "balanced",
      machine_a: selected[0] || "",
      machine_b: selected[1] || ""
    });
    scrollToTop();
    render();
    return;
  }

  if (action.startsWith("tie-answer:")) {
    const [, questionId, choice] = action.split(":");
    if (!questionId || !["a", "b", "both"].includes(choice)) return;
    const decisionState = loadDecisionState();
    const compareState = compareStateFromDecision(decisionState);
    saveDecisionState({
      compareState: {
        ...compareState,
        tieBreakerResponses: {
          ...(compareState.tieBreakerResponses || {}),
          [questionId]: choice
        }
      }
    });
    render();
    return;
  }

  if (action === "tie-breaker-apply") {
    const decisionState = loadDecisionState();
    const selected = canonicalSelection(decisionState).map((slug) => machineBySlug(slug)).filter(Boolean);
    if (selected.length < 2) return;
    const compareState = compareStateFromDecision(decisionState);
    const scored = selected.map((machine) => ({ machine, ...scoreMachine(machine, compareState.presetMode || "balanced") }));
    const pair = scored.slice(0, 2);
    const factorDeltas = Object.keys(pair[0].factors).reduce((acc, factor) => {
      acc[factor] = (pair[0].factors[factor] || 0) - (pair[1].factors[factor] || 0);
      return acc;
    }, {});
    const readinessA = readinessForMachine(pair[0].machine, decisionState).readiness.label;
    const readinessB = readinessForMachine(pair[1].machine, decisionState).readiness.label;
    const questions = selectTieBreakerQuestions({
      presetMode: compareState.presetMode || "balanced",
      factorDeltas,
      readinessA,
      readinessB
    });
    const adjusted = applyTieBreakerAdjustment({
      baseScores: { a: pair[0].score, b: pair[1].score },
      questions,
      responses: compareState.tieBreakerResponses || {}
    });
    const deltaAfter = Math.abs(adjusted.a - adjusted.b);
    const winner = adjusted.a >= adjusted.b ? pair[0].machine.slug : pair[1].machine.slug;
    const startedAt = Date.parse(compareState.tieBreakerStartedAt || "");
    const durationSec = Number.isFinite(startedAt) ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : 0;
    trackAnalytics(ANALYTICS_EVENTS.TIE_BREAKER_COMPLETED, {
      winner,
      delta_after: Number(deltaAfter.toFixed(4)),
      duration_sec: durationSec
    });
    scrollToTop();
    render();
    return;
  }

  if (action.startsWith("set-temporary-primary:")) {
    const [, slug, otherSlug] = action.split(":");
    if (!slug || !otherSlug) return;
    const decisionState = loadDecisionState();
    const compareState = compareStateFromDecision(decisionState);
    saveDecisionState({
      frontRunnerSlug: slug,
      frontRunnerLastChangedAt: new Date().toISOString(),
      backupSlugs: [otherSlug, ...decisionState.backupSlugs.filter((item) => item !== slug && item !== otherSlug)].slice(0, 2),
      temporaryPrimary: true,
      temporaryPrimaryReason: "tie_breaker_unresolved",
      compareState: {
        ...compareState,
        temporaryPrimaryCandidate: slug,
        tooClose: true
      }
    });
    compareStore.set([slug, otherSlug, ...decisionState.backupSlugs.filter((item) => item !== slug && item !== otherSlug)].slice(0, 3));
    trackAnalytics(ANALYTICS_EVENTS.TEMPORARY_PRIMARY_SET, {
      machine_slug: slug,
      other_machine_slug: otherSlug,
      reason: "tie_breaker_unresolved"
    });
    trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, {
      from_slug: decisionState.frontRunnerSlug || "",
      to_slug: slug,
      source: "compare_temporary"
    });
    showSiteMessage(`${machineDisplayTitle(machineBySlug(slug) || { name: slug, title: slug })} is now your temporary front-runner. Your other machine stays saved with progress.`);
    scrollToTop();
    render();
    return;
  }

  if (action.startsWith("choose-front-runner:")) {
    const slug = action.split(":")[1];
    const decisionState = loadDecisionState();
    const selected = selectedMachinesFromSlugs(canonicalSelection(decisionState));
    const chosen = selected.find((machine) => machine.slug === slug);
    if (!chosen) return;
    const backups = selected.map((machine) => machine.slug).filter((item) => item !== slug).slice(0, 2);
    const compareState = compareStateFromDecision(decisionState);
    saveDecisionState({
      frontRunnerSlug: slug,
      frontRunnerLastChangedAt: new Date().toISOString(),
      backupSlugs: backups,
      temporaryPrimary: false,
      temporaryPrimaryReason: "",
      finalPrimaryLocked: true,
      compareState: {
        ...compareState,
        temporaryPrimaryCandidate: "",
        tooClose: false
      }
    });
    compareStore.set([slug, ...backups].slice(0, 3));
    trackEvent("compare_front_runner_chosen", { machine_slug: slug, backups });
    trackAnalytics(ANALYTICS_EVENTS.FRONT_RUNNER_SWITCHED, {
      from_slug: decisionState.frontRunnerSlug || "",
      to_slug: slug,
      source: "compare_choose"
    });
    showSiteMessage(`${machineDisplayTitle(chosen)} is now your front-runner. Your previous machine remains saved with its progress.`);
    scrollToTop();
    render();
    return;
  }
});

window.addEventListener("compare-updated", render);
initDecisionBar({
  page: "compare",
  getViewState: () => ({ screen: "compare" }),
  handlers: {
    continuePlan: () => {
      window.location.href = "help.html?resume=1";
    },
    fixBlockers: () => {
      window.location.href = "help.html?resume=1";
    }
  }
});
render();
