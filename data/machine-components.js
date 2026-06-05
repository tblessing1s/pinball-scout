/**
 * Component taxonomy for machine-to-machine connections.
 *
 * Each component represents a physical or structural feature of a pinball machine.
 * tasteHints map to the same trait IDs used in refinement-model.js so component
 * signals feed directly into the existing scoring pipeline.
 */

export const COMPONENT_CATEGORIES = {
  layout:    "Playfield Layout",
  shots:     "Shot Profile",
  mechs:     "Mechanical Features",
  multiball: "Multiball Style",
  rules:     "Rules & Modes"
};

export const COMPONENTS = [
  // ── Layout ─────────────────────────────────────────────────────────────
  {
    id: "flowing_ramps",
    label: "Flowing Ramps",
    category: "layout",
    description: "Smooth continuous ramps that reward combo shots and create flow-state play",
    tasteHints: { pace: 0.7, shot_satisfaction: 0.6, replayability: 0.3 }
  },
  {
    id: "orbit_shots",
    label: "Orbit Shots",
    category: "layout",
    description: "Left/right full-orbit shots that loop the ball around the playfield",
    tasteHints: { pace: 0.5, shot_satisfaction: 0.4 }
  },
  {
    id: "upper_playfield",
    label: "Upper Playfield",
    category: "layout",
    description: "Secondary mini-playfield area with its own shots and rules",
    tasteHints: { rules_depth: 0.5, wow_factor: 0.5 }
  },
  {
    id: "wide_open_layout",
    label: "Wide Open Layout",
    category: "layout",
    description: "Forgiving, open playfield design that's easier for newer players to navigate",
    tasteHints: { beginner_friendly: 0.8, pace: 0.3 }
  },

  // ── Shots ───────────────────────────────────────────────────────────────
  {
    id: "loop_combos",
    label: "Loop / Combo Shots",
    category: "shots",
    description: "Looping or chaining combo shots that build streaks",
    tasteHints: { pace: 0.8, shot_satisfaction: 0.7, replayability: 0.4 }
  },
  {
    id: "spinner_shot",
    label: "Spinner",
    category: "shots",
    description: "Spinning disc or spinner lane that adds scoring momentum",
    tasteHints: { pace: 0.5, replayability: 0.3 }
  },
  {
    id: "captive_ball",
    label: "Captive Ball",
    category: "shots",
    description: "Captive or caged ball shot requiring precision to advance",
    tasteHints: { shot_satisfaction: 0.5, rules_depth: 0.3 }
  },
  {
    id: "drop_targets",
    label: "Drop Targets",
    category: "shots",
    description: "Banks of targets that reset after being knocked down",
    tasteHints: { shot_satisfaction: 0.6, rules_depth: 0.4 }
  },

  // ── Mechanical Features ─────────────────────────────────────────────────
  {
    id: "interactive_toy",
    label: "Interactive Toy / Mech",
    category: "mechs",
    description: "Large interactive mechanical feature tied to theme (T-Rex, crane, etc.)",
    tasteHints: { wow_factor: 0.9, theme_integration: 0.7 }
  },
  {
    id: "magnet_effects",
    label: "Magnet Effects",
    category: "mechs",
    description: "Playfield magnets that redirect or grab the ball unpredictably",
    tasteHints: { chaos_level: 0.6, wow_factor: 0.4 }
  },
  {
    id: "physical_lock",
    label: "Physical Ball Lock",
    category: "mechs",
    description: "Physical mechanism that holds balls until multiball release",
    tasteHints: { replayability: 0.5, wow_factor: 0.4 }
  },

  // ── Multiball Style ─────────────────────────────────────────────────────
  {
    id: "frequent_multiball",
    label: "Frequent Multiball",
    category: "multiball",
    description: "Multiple multiball modes that trigger often throughout play",
    tasteHints: { chaos_level: 0.9, wow_factor: 0.7, pace: 0.4 }
  },
  {
    id: "focused_multiball",
    label: "Focused Multiball",
    category: "multiball",
    description: "One well-designed multiball moment to build toward and master",
    tasteHints: { replayability: 0.6, shot_satisfaction: 0.5, wow_factor: 0.3 }
  },

  // ── Rules & Modes ───────────────────────────────────────────────────────
  {
    id: "story_modes",
    label: "Story Modes",
    category: "rules",
    description: "Narrative-driven mode progression tied to the machine's theme",
    tasteHints: { theme_integration: 0.9, rules_depth: 0.6, replayability: 0.5 }
  },
  {
    id: "simple_ruleset",
    label: "Simple Clear Rules",
    category: "rules",
    description: "Accessible rules with an obvious main objective — easy to pick up",
    tasteHints: { beginner_friendly: 1.0 }
  },
  {
    id: "stacking_modes",
    label: "Stackable Modes",
    category: "rules",
    description: "Multiple scoring modes that run simultaneously, rewarding juggling",
    tasteHints: { rules_depth: 0.9, chaos_level: 0.4, replayability: 0.6 }
  },
  {
    id: "wizard_mode",
    label: "Wizard Mode Goal",
    category: "rules",
    description: "A grand finale mode to chase across many sessions — long-term goal",
    tasteHints: { rules_depth: 0.7, replayability: 0.8 }
  },
  {
    id: "jackpot_structure",
    label: "Jackpot / Super Jackpot",
    category: "rules",
    description: "Classic build-and-collect jackpot scoring loop",
    tasteHints: { replayability: 0.5, wow_factor: 0.3 }
  }
];

export const COMPONENT_INDEX = new Map(COMPONENTS.map((c) => [c.id, c]));

/**
 * Per-machine component lists.
 * Each entry is an array of component IDs from COMPONENTS above.
 */
export const MACHINE_COMPONENTS = {
  "godzilla-pro": [
    "flowing_ramps", "interactive_toy", "frequent_multiball",
    "story_modes", "stacking_modes", "wizard_mode", "physical_lock", "captive_ball"
  ],
  "deadpool-pro": [
    "loop_combos", "orbit_shots", "drop_targets",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "jurassic-park-pro": [
    "interactive_toy", "drop_targets", "captive_ball",
    "focused_multiball", "story_modes", "magnet_effects", "wizard_mode", "jackpot_structure"
  ],
  "foo-fighters-pro": [
    "flowing_ramps", "orbit_shots", "loop_combos",
    "story_modes", "focused_multiball", "drop_targets", "wizard_mode"
  ],
  "avengers-infinity-quest-pro": [
    "flowing_ramps", "orbit_shots", "stacking_modes",
    "story_modes", "frequent_multiball", "wizard_mode"
  ],
  "iron-maiden-pro": [
    "upper_playfield", "loop_combos", "orbit_shots",
    "stacking_modes", "frequent_multiball", "physical_lock", "wizard_mode"
  ],
  "stranger-things-pro": [
    "interactive_toy", "magnet_effects", "captive_ball",
    "focused_multiball", "story_modes", "wizard_mode"
  ],
  "mandalorian-pro": [
    "interactive_toy", "flowing_ramps", "drop_targets",
    "focused_multiball", "story_modes", "simple_ruleset"
  ],
  "attack-from-mars-remake": [
    "wide_open_layout", "orbit_shots", "interactive_toy",
    "spinner_shot", "frequent_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "fish-tales": [
    "wide_open_layout", "orbit_shots", "spinner_shot",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "funhouse": [
    "wide_open_layout", "interactive_toy",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "medieval-madness-remake": [
    "wide_open_layout", "orbit_shots", "interactive_toy",
    "drop_targets", "frequent_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "venom-pro": [
    "orbit_shots", "loop_combos", "drop_targets",
    "focused_multiball", "story_modes", "wizard_mode"
  ],
  "jaws-pro": [
    "interactive_toy", "captive_ball", "orbit_shots",
    "focused_multiball", "story_modes", "simple_ruleset", "jackpot_structure"
  ],
  "monster-bash-remake": [
    "wide_open_layout", "interactive_toy", "drop_targets",
    "frequent_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "theatre-of-magic": [
    "interactive_toy", "magnet_effects", "wide_open_layout",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "monster-bash-original": [
    "wide_open_layout", "interactive_toy", "drop_targets",
    "frequent_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "arabian-nights": [
    "flowing_ramps", "orbit_shots", "spinner_shot",
    "focused_multiball", "wide_open_layout", "jackpot_structure"
  ],
  "godfather-ce": [
    "interactive_toy", "drop_targets", "physical_lock",
    "stacking_modes", "story_modes", "frequent_multiball", "wizard_mode"
  ],
  "elvira-house-of-horrors": [
    "interactive_toy", "orbit_shots", "drop_targets",
    "focused_multiball", "story_modes", "jackpot_structure"
  ],
  "addams-family": [
    "interactive_toy", "magnet_effects", "upper_playfield",
    "stacking_modes", "frequent_multiball", "wizard_mode", "jackpot_structure"
  ],
  "twilight-zone": [
    "interactive_toy", "magnet_effects", "captive_ball",
    "stacking_modes", "frequent_multiball", "wizard_mode", "flowing_ramps"
  ],
  "whitewater": [
    "flowing_ramps", "interactive_toy", "loop_combos",
    "focused_multiball", "jackpot_structure"
  ],
  "scared-stiff": [
    "interactive_toy", "drop_targets",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "bride-of-pinbot": [
    "wide_open_layout", "orbit_shots", "interactive_toy",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "acdc-pro": [
    "loop_combos", "orbit_shots", "drop_targets",
    "story_modes", "frequent_multiball", "wizard_mode", "jackpot_structure"
  ],
  "metallica-pro": [
    "interactive_toy", "drop_targets", "loop_combos",
    "story_modes", "focused_multiball", "jackpot_structure"
  ],
  "walking-dead-pro": [
    "drop_targets", "physical_lock", "captive_ball",
    "focused_multiball", "story_modes", "simple_ruleset", "jackpot_structure"
  ],
  "game-of-thrones-pro": [
    "orbit_shots", "loop_combos", "stacking_modes",
    "frequent_multiball", "wizard_mode", "jackpot_structure"
  ],
  "star-wars-pro": [
    "interactive_toy", "orbit_shots", "loop_combos",
    "focused_multiball", "story_modes", "jackpot_structure"
  ],
  "guardians-of-the-galaxy-pro": [
    "interactive_toy", "orbit_shots", "drop_targets",
    "focused_multiball", "story_modes", "jackpot_structure"
  ],
  "aerosmith-pro": [
    "loop_combos", "orbit_shots", "interactive_toy",
    "focused_multiball", "story_modes", "jackpot_structure"
  ],
  "black-knight-sword-of-rage-pro": [
    "upper_playfield", "orbit_shots", "drop_targets",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "munsters-pro": [
    "interactive_toy", "wide_open_layout", "orbit_shots",
    "focused_multiball", "simple_ruleset", "jackpot_structure"
  ],
  "led-zeppelin-pro": [
    "flowing_ramps", "orbit_shots", "loop_combos",
    "story_modes", "focused_multiball", "jackpot_structure"
  ],
  "rush-pro": [
    "upper_playfield", "loop_combos", "orbit_shots",
    "story_modes", "focused_multiball", "wizard_mode"
  ],
  "spider-man-vault": [
    "interactive_toy", "orbit_shots", "loop_combos",
    "drop_targets", "focused_multiball", "story_modes"
  ],
  "ghostbusters-pro": [
    "interactive_toy", "drop_targets", "physical_lock",
    "stacking_modes", "story_modes", "frequent_multiball", "wizard_mode"
  ],
  "batman-dark-knight": [
    "interactive_toy", "orbit_shots", "loop_combos",
    "focused_multiball", "story_modes", "jackpot_structure"
  ]
};

/**
 * Display names for machines that appear in MACHINE_COMPONENTS but not in the
 * primary machines.js catalog. Used by Pinball Map name-matching and UI rendering.
 */
export const COMPONENT_MACHINE_NAMES = {
  "addams-family": "The Addams Family",
  "twilight-zone": "The Twilight Zone",
  "whitewater": "White Water",
  "scared-stiff": "Scared Stiff",
  "bride-of-pinbot": "Bride of Pin*Bot",
  "acdc-pro": "AC/DC",
  "metallica-pro": "Metallica",
  "walking-dead-pro": "The Walking Dead",
  "game-of-thrones-pro": "Game of Thrones",
  "star-wars-pro": "Star Wars",
  "guardians-of-the-galaxy-pro": "Guardians of the Galaxy",
  "aerosmith-pro": "Aerosmith",
  "black-knight-sword-of-rage-pro": "Black Knight: Sword of Rage",
  "munsters-pro": "The Munsters",
  "led-zeppelin-pro": "Led Zeppelin",
  "rush-pro": "Rush",
  "spider-man-vault": "Spider-Man",
  "ghostbusters-pro": "Ghostbusters",
  "batman-dark-knight": "Batman"
};

/**
 * Returns the component IDs for a machine slug, or [] if unknown.
 */
export function componentsForMachine(slug) {
  return MACHINE_COMPONENTS[slug] || [];
}

/**
 * Returns a sorted list of { slug, sharedComponents, score } for machines
 * most similar to the given slug based on component overlap.
 * candidateSlugs should exclude the source machine.
 */
export function findRelatedMachines(slug, candidateSlugs = []) {
  const source = new Set(componentsForMachine(slug));
  if (source.size === 0) return [];

  return candidateSlugs
    .filter((s) => s !== slug)
    .map((s) => {
      const shared = componentsForMachine(s).filter((c) => source.has(c));
      return { slug: s, sharedComponents: shared, score: shared.length };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Returns a plain-English summary of why two machines are similar.
 * Used in UI callouts like "These machines share…"
 */
export function componentConnectionReason(slugA, slugB) {
  const aComponents = new Set(componentsForMachine(slugA));
  const bComponents = componentsForMachine(slugB);
  const shared = bComponents.filter((c) => aComponents.has(c));
  if (shared.length === 0) return null;

  const labels = shared
    .map((id) => COMPONENT_INDEX.get(id)?.label)
    .filter(Boolean)
    .slice(0, 3);

  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels[0]}, ${labels[1]}, and ${labels[2]}`;
}

/**
 * Builds aggregate trait signals from a list of played machine slugs.
 * Components that appear across multiple played machines get a higher weight.
 * Returns an object keyed by trait ID (pace, shot_satisfaction, etc.)
 */
export function buildTraitSignalsFromPlayedMachines(slugs = []) {
  if (slugs.length === 0) return {};

  const componentCounts = {};
  slugs.forEach((slug) => {
    componentsForMachine(slug).forEach((compId) => {
      componentCounts[compId] = (componentCounts[compId] || 0) + 1;
    });
  });

  const signals = {};
  Object.entries(componentCounts).forEach(([compId, count]) => {
    const component = COMPONENT_INDEX.get(compId);
    if (!component?.tasteHints) return;
    const weight = count / slugs.length;
    Object.entries(component.tasteHints).forEach(([trait, value]) => {
      signals[trait] = (signals[trait] || 0) + value * weight;
    });
  });

  return signals;
}
