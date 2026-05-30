import { REFINEMENT_NEGATIVE_PROMPTS, REFINEMENT_POSITIVE_PROMPTS, TRAIT_KEYS, mergeTraitSignals } from "../data/refinement-model.js";

export const EXPERIENCE_WEIGHTS = {
  questionnaire: 1,
  preview: 1,
  video: 0.6,
  played: 1.6,
  external: 1.0
};

export function experienceWeightFor(type = "") {
  return EXPERIENCE_WEIGHTS[type] ?? 1;
}

export function emptyTraitSignals() {
  return Object.fromEntries(TRAIT_KEYS.map((key) => [key, 0]));
}

export function buildTraitSignalsFromPromptIds(ids = [], prompts = []) {
  const signals = ids
    .map((id) => prompts.find((prompt) => prompt.id === id))
    .filter(Boolean)
    .map((prompt) => prompt.traitSignals);
  return mergeTraitSignals(signals);
}

export function buildTraitSignalsFromRefinement({ liked = [], disliked = [] } = {}) {
  const likedSignals = buildTraitSignalsFromPromptIds(liked, REFINEMENT_POSITIVE_PROMPTS);
  const dislikedSignals = buildTraitSignalsFromPromptIds(disliked, REFINEMENT_NEGATIVE_PROMPTS);
  return mergeTraitSignals([likedSignals, dislikedSignals]);
}

const tasteAnswerTraitMap = {
  "learning-curve": {
    "quick-start": { beginner_friendly: 1.2, rules_depth: -0.6 },
    "deep-discovery": { rules_depth: 1.2, replayability: 0.6 }
  },
  "pace-feel": {
    "fast-smooth": { pace: 1.2, replayability: 0.4 },
    "controlled": { pace: -0.8, rules_depth: 0.6 }
  },
  "theme-pull": {
    "theme-first": { theme_integration: 1.2, wow_factor: 0.4 },
    "gameplay-first": { shot_satisfaction: 0.6, theme_integration: -0.4 }
  },
  "challenge-level": {
    "forgiving": { beginner_friendly: 1.1 },
    "demanding": { rules_depth: 0.6, beginner_friendly: -0.3 }
  },
  "replay-itch": {
    "instant-replay": { pace: 0.7, replayability: 0.8 },
    "longer-progress": { rules_depth: 0.9, replayability: 0.6 }
  },
  "ownership-style": {
    "safe": { beginner_friendly: 0.6 },
    "specific": { wow_factor: 0.6 }
  }
};

export function buildTraitSignalsFromTasteAnswers(tasteAnswers = {}) {
  const signals = emptyTraitSignals();

  Object.entries(tasteAnswers || {}).forEach(([promptId, value]) => {
    const mapping = tasteAnswerTraitMap[promptId];
    if (!mapping) return;
    const entry = mapping[value];
    if (!entry) return;
    Object.entries(entry).forEach(([key, amount]) => {
      if (!(key in signals)) return;
      signals[key] += Number(amount || 0);
    });
  });

  return signals;
}

export function buildTraitSignalsFromReactionEntry({ likedAspect = "", concern = "", replay = "" } = {}) {
  const signals = emptyTraitSignals();

  if (likedAspect === "theme") signals.theme_integration += 1.1;
  if (likedAspect === "shots") signals.shot_satisfaction += 1.1;
  if (likedAspect === "speed") signals.pace += 1.1;
  if (likedAspect === "depth") signals.rules_depth += 1.1;
  if (likedAspect === "spectacle") {
    signals.wow_factor += 0.8;
    signals.chaos_level += 0.6;
  }

  if (concern === "too-fast") signals.pace -= 1.1;
  if (concern === "too-slow") signals.pace += 0.8;
  if (concern === "too-complex") {
    signals.beginner_friendly += 0.8;
    signals.rules_depth -= 0.6;
  }
  if (concern === "too-simple") signals.rules_depth += 0.8;
  if (concern === "too-chaotic") signals.chaos_level -= 1.1;
  if (concern === "just-right") signals.beginner_friendly += 0.5;

  if (replay === "yes") signals.replayability += 0.9;
  if (replay === "no") signals.replayability -= 0.7;

  return signals;
}
