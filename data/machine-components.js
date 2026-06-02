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
    tasteHints: { pace: 0.7, shot_satisfaction: 0.6, replayability: 0.3 },
    tasteNote: "Notice whether the shot flow between ramps feels continuous and natural.",
    archetypePro: "Flowing ramps — exactly the smooth, continuous style you enjoy",
    archetypeCon: "Ramp-heavy flow can feel one-dimensional if you want more shot variety"
  },
  {
    id: "orbit_shots",
    label: "Orbit Shots",
    category: "layout",
    description: "Left/right full-orbit shots that loop the ball around the playfield",
    tasteHints: { pace: 0.5, shot_satisfaction: 0.4 },
    tasteNote: "Notice whether chaining the orbit shots feels satisfying and rewarding.",
    archetypePro: "Orbit loops reward natural shot rhythm and feel great to chain",
    archetypeCon: "Orbit-heavy machines can feel repetitive if that's all they offer"
  },
  {
    id: "upper_playfield",
    label: "Upper Playfield",
    category: "layout",
    description: "Secondary mini-playfield area with its own shots and rules",
    tasteHints: { rules_depth: 0.5, wow_factor: 0.5 },
    tasteNote: "Notice whether the secondary area adds variety or feels like a distraction.",
    archetypePro: "Secondary playfield area adds strategic variety and depth to explore",
    archetypeCon: "Upper playfield breaks flow and adds complexity to track"
  },
  {
    id: "wide_open_layout",
    label: "Wide Open Layout",
    category: "layout",
    description: "Forgiving, open playfield design that's easier for newer players to navigate",
    tasteHints: { beginner_friendly: 0.8, pace: 0.3 },
    tasteNote: "Notice whether the open layout makes you feel in control of where the ball goes.",
    archetypePro: "Open layout — easy to navigate and enjoy from the first game",
    archetypeCon: "Wide-open design means a lower skill ceiling to grow into over time"
  },

  // ── Shots ───────────────────────────────────────────────────────────────
  {
    id: "loop_combos",
    label: "Loop / Combo Shots",
    category: "shots",
    description: "Looping or chaining combo shots that build streaks",
    tasteHints: { pace: 0.8, shot_satisfaction: 0.7, replayability: 0.4 },
    tasteNote: "Notice whether chaining shots together feels exciting — does each combo land with impact?",
    archetypePro: "Combo chains are fast, skill-rewarding, and deeply satisfying to nail",
    archetypeCon: "Combo focus means scoring variety can feel narrow over many games"
  },
  {
    id: "spinner_shot",
    label: "Spinner",
    category: "shots",
    description: "Spinning disc or spinner lane that adds scoring momentum",
    tasteHints: { pace: 0.5, replayability: 0.3 },
    tasteNote: "Notice whether the spinner lane feels like a fun momentum builder or just filler.",
    archetypePro: "Spinner adds quick momentum and immediate scoring gratification",
    archetypeCon: "Spinner-heavy designs lean toward simpler, less varied scoring loops"
  },
  {
    id: "captive_ball",
    label: "Captive Ball",
    category: "shots",
    description: "Captive or caged ball shot requiring precision to advance",
    tasteHints: { shot_satisfaction: 0.5, rules_depth: 0.3 },
    tasteNote: "Notice whether the precision shot feels satisfying when you nail it.",
    archetypePro: "Precision captive shot rewards deliberate, skillful aiming",
    archetypeCon: "Captive ball requires exact aim — can frustrate before the skill clicks"
  },
  {
    id: "drop_targets",
    label: "Drop Targets",
    category: "shots",
    description: "Banks of targets that reset after being knocked down",
    tasteHints: { shot_satisfaction: 0.6, rules_depth: 0.4 },
    tasteNote: "Notice whether clearing a target bank gives you a clear sense of progress.",
    archetypePro: "Drop banks give clear objectives and satisfying completion moments",
    archetypeCon: "Repeated target clearing can feel routine across long ownership"
  },

  // ── Mechanical Features ─────────────────────────────────────────────────
  {
    id: "interactive_toy",
    label: "Interactive Toy / Mech",
    category: "mechs",
    description: "Large interactive mechanical feature tied to theme (T-Rex, crane, etc.)",
    tasteHints: { wow_factor: 0.9, theme_integration: 0.7 },
    tasteNote: "Notice whether the physical toy makes big moments feel more exciting or just theatrical.",
    archetypePro: "Physical toy creates memorable, theme-immersive moments that wow guests",
    archetypeCon: "Toy-focused moments can interrupt shooting flow and feel theatrical after a while"
  },
  {
    id: "magnet_effects",
    label: "Magnet Effects",
    category: "mechs",
    description: "Playfield magnets that redirect or grab the ball unpredictably",
    tasteHints: { chaos_level: 0.6, wow_factor: 0.4 },
    tasteNote: "Notice whether the magnet surprises feel fun or frustrating for your play style.",
    archetypePro: "Magnet deflections add unpredictable excitement and chaos you enjoy",
    archetypeCon: "Magnet effects feel random — hard to account for with deliberate play"
  },
  {
    id: "physical_lock",
    label: "Physical Ball Lock",
    category: "mechs",
    description: "Physical mechanism that holds balls until multiball release",
    tasteHints: { replayability: 0.5, wow_factor: 0.4 },
    tasteNote: "Notice whether building toward the lock release feels like a satisfying payoff.",
    archetypePro: "Ball lock builds anticipation toward a satisfying multiball release",
    archetypeCon: "Building to the lock delays the payoff — can feel slow early on"
  },

  // ── Multiball Style ─────────────────────────────────────────────────────
  {
    id: "frequent_multiball",
    label: "Frequent Multiball",
    category: "multiball",
    description: "Multiple multiball modes that trigger often throughout play",
    tasteHints: { chaos_level: 0.9, wow_factor: 0.7, pace: 0.4 },
    tasteNote: "Notice whether having multiple balls in play at once feels exciting or too chaotic.",
    archetypePro: "Frequent multiball keeps intensity high — big chaotic moments you love",
    archetypeCon: "Multiple balls in play often feels overwhelming rather than fun"
  },
  {
    id: "focused_multiball",
    label: "Focused Multiball",
    category: "multiball",
    description: "One well-designed multiball moment to build toward and master",
    tasteHints: { replayability: 0.6, shot_satisfaction: 0.5, wow_factor: 0.3 },
    tasteNote: "Notice whether the main multiball moment feels like a satisfying climax worth chasing.",
    archetypePro: "One well-crafted multiball moment to build toward and master",
    archetypeCon: "Only one multiball means fewer big chaotic moments per game"
  },

  // ── Rules & Modes ───────────────────────────────────────────────────────
  {
    id: "story_modes",
    label: "Story Modes",
    category: "rules",
    description: "Narrative-driven mode progression tied to the machine's theme",
    tasteHints: { theme_integration: 0.9, rules_depth: 0.6, replayability: 0.5 },
    tasteNote: "Notice whether the mode progression makes you feel like you are working toward something meaningful.",
    archetypePro: "Narrative mode progression keeps you engaged — always something to chase",
    archetypeCon: "Story modes take several games to understand before they click"
  },
  {
    id: "simple_ruleset",
    label: "Simple Clear Rules",
    category: "rules",
    description: "Accessible rules with an obvious main objective — easy to pick up",
    tasteHints: { beginner_friendly: 1.0 },
    tasteNote: "Notice whether you always know what to shoot for — is the objective clear without reading a manual?",
    archetypePro: "Clear immediate objectives — fun from the very first ball",
    archetypeCon: "Simple rules have a lower skill ceiling — less to grow into long-term"
  },
  {
    id: "stacking_modes",
    label: "Stackable Modes",
    category: "rules",
    description: "Multiple scoring modes that run simultaneously, rewarding juggling",
    tasteHints: { rules_depth: 0.9, chaos_level: 0.4, replayability: 0.6 },
    tasteNote: "Notice whether running multiple modes at once feels rewarding or overwhelming.",
    archetypePro: "Stacking modes rewards strategic multitasking — layers you can keep discovering",
    archetypeCon: "Running multiple modes simultaneously is complex to manage and track"
  },
  {
    id: "wizard_mode",
    label: "Wizard Mode Goal",
    category: "rules",
    description: "A grand finale mode to chase across many sessions — long-term goal",
    tasteHints: { rules_depth: 0.7, replayability: 0.8 },
    tasteNote: "Notice whether knowing there is a long-term goal motivates you to keep improving.",
    archetypePro: "Long-term wizard mode goal keeps you motivated and improving for months",
    archetypeCon: "Wizard mode can feel unreachable for a long time — payoff requires commitment"
  },
  {
    id: "jackpot_structure",
    label: "Jackpot / Super Jackpot",
    category: "rules",
    description: "Classic build-and-collect jackpot scoring loop",
    tasteHints: { replayability: 0.5, wow_factor: 0.3 },
    tasteNote: "Notice whether building up a jackpot and collecting it feels like a satisfying scoring loop.",
    archetypePro: "Classic jackpot loop — build it up, collect it, repeat with instant satisfaction",
    archetypeCon: "Jackpot structure is straightforward — less to discover across many sessions"
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

/**
 * Infers component IDs from a curatedConfig object when no manual entry exists.
 * Uses tags and numeric fields (gameplayDepth, beginnerFriendly, themeStrength).
 * Accuracy is ~75% — good enough for proxy ranking and tasting notes.
 */
export function inferComponentsFromMeta(config) {
  const tags = config.tags || [];
  const depth = config.gameplayDepth || 3;
  const beginner = config.beginnerFriendly || 3;
  const theme = config.themeStrength || 3;
  const components = new Set();

  // Layout
  if (tags.some((t) => ["flow", "fast"].includes(t))) {
    components.add("flowing_ramps");
    components.add("loop_combos");
  }
  if (tags.includes("shot-driven")) {
    components.add("loop_combos");
    components.add("orbit_shots");
  }
  if (!tags.includes("classic")) {
    components.add("orbit_shots");
  }
  if (beginner >= 4) {
    components.add("wide_open_layout");
  }
  if (depth >= 4 && !tags.includes("classic")) {
    components.add("upper_playfield");
  }

  // Shots
  if (depth >= 3) {
    components.add("drop_targets");
  }
  if (depth >= 4) {
    components.add("captive_ball");
  }
  if (tags.includes("classic") || beginner <= 3) {
    components.add("spinner_shot");
  }

  // Mechanical features
  const isThemeDriven = theme >= 4 || tags.some((t) => ["spectacle", "showpiece", "licensed", "personality"].includes(t));
  if (isThemeDriven) {
    components.add("interactive_toy");
  }
  if (tags.some((t) => ["spectacle", "chaotic"].includes(t))) {
    components.add("magnet_effects");
  }
  if (depth >= 4) {
    components.add("physical_lock");
  }

  // Multiball
  if (tags.some((t) => ["spectacle", "chaotic"].includes(t)) || depth >= 4) {
    components.add("frequent_multiball");
  } else {
    components.add("focused_multiball");
  }

  // Rules
  if (depth >= 4) {
    components.add("story_modes");
    components.add("stacking_modes");
    components.add("wizard_mode");
  } else if (depth >= 3) {
    components.add("story_modes");
    components.add("jackpot_structure");
  } else {
    components.add("simple_ruleset");
    components.add("jackpot_structure");
  }
  if (beginner >= 4 && depth <= 3) {
    components.add("simple_ruleset");
  }

  return [...components];
}

/**
 * Returns 1-2 actionable tasting notes explaining why a proxy machine is useful
 * for validating a target machine, based on their shared components.
 * Returns null when no component data exists for either machine.
 */
export function proxyConnectionHint(targetSlug, probeSlug) {
  const targetComponents = new Set(componentsForMachine(targetSlug));
  const probeComponents = componentsForMachine(probeSlug);

  if (targetComponents.size === 0 || probeComponents.length === 0) return null;

  const sharedNotes = probeComponents
    .filter((id) => targetComponents.has(id))
    .map((id) => COMPONENT_INDEX.get(id))
    .filter((c) => c?.tasteNote);

  if (sharedNotes.length === 0) return null;

  return sharedNotes.slice(0, 2).map((c) => c.tasteNote);
}
