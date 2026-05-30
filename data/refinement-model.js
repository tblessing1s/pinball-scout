export const TRAIT_DEFINITIONS = [
  {
    id: "pace",
    label: "Fast and exciting",
    description: "Quick, energetic ball movement."
  },
  {
    id: "shot_satisfaction",
    label: "Satisfying shots",
    description: "Feels good to nail the main shots."
  },
  {
    id: "rules_depth",
    label: "Deep / lots to discover",
    description: "Layers of goals that unfold over time."
  },
  {
    id: "theme_integration",
    label: "Theme pulled me in",
    description: "Story, world, or characters feel immersive."
  },
  {
    id: "chaos_level",
    label: "Chaotic / wild",
    description: "Big multiball and unpredictable moments."
  },
  {
    id: "beginner_friendly",
    label: "Easy to understand",
    description: "Comfortable learning curve for newer players."
  },
  {
    id: "replayability",
    label: "Keeps me coming back",
    description: "Feels replayable without getting stale."
  },
  {
    id: "wow_factor",
    label: "Wow factor",
    description: "Big moments or standout presentation."
  }
];

export const TRAIT_KEYS = TRAIT_DEFINITIONS.map((trait) => trait.id);

export const REFINEMENT_POSITIVE_PROMPTS = [
  { id: "fast_exciting", label: "Fast and exciting", traitSignals: { pace: 1.2, replayability: 0.6 } },
  { id: "satisfying_shots", label: "Satisfying shots", traitSignals: { shot_satisfaction: 1.2 } },
  { id: "fun_ramps", label: "Fun ramps", traitSignals: { shot_satisfaction: 0.7, pace: 0.4 } },
  { id: "easy_to_understand", label: "Easy to understand", traitSignals: { beginner_friendly: 1.2 } },
  { id: "deep_discovery", label: "Deep / lots to discover", traitSignals: { rules_depth: 1.2, replayability: 0.6 } },
  { id: "theme_pull", label: "Theme pulled me in", traitSignals: { theme_integration: 1.2, wow_factor: 0.6 } }
];

export const REFINEMENT_NEGATIVE_PROMPTS = [
  { id: "felt_repetitive", label: "Felt repetitive", traitSignals: { replayability: -1.1, rules_depth: -0.6 } },
  { id: "too_chaotic", label: "Too chaotic", traitSignals: { chaos_level: -1.2 } },
  { id: "too_slow", label: "Too slow", traitSignals: { pace: -1.2 } },
  { id: "too_complicated", label: "Too complicated", traitSignals: { beginner_friendly: -1.1, rules_depth: -0.4 } }
];

export function traitLabelMap() {
  return Object.fromEntries(TRAIT_DEFINITIONS.map((trait) => [trait.id, trait.label]));
}

export function mergeTraitSignals(signalList = []) {
  return signalList.reduce((acc, item) => {
    Object.entries(item || {}).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + value;
    });
    return acc;
  }, {});
}
