/**
 * Taste scale axis definitions — used to render the preference sliders
 * that show the player's emerging taste profile.
 */
export const TASTE_SCALES = [
  { id: "learning-curve", left: "Easy to pick up", right: "Deep & rewarding" },
  { id: "pace-feel",      left: "Fast & flowing",  right: "Deliberate & precise" },
  { id: "theme-pull",     left: "Gameplay-first",  right: "Theme-first" },
  { id: "challenge",      left: "Forgiving",        right: "Demanding" },
  { id: "replay",         left: "Quick sessions",   right: "Long goals" },
  { id: "ownership",      left: "Safe first buy",   right: "Bold pick" }
];

/**
 * Player archetypes derived from the taste-pivot answers.
 * Each archetype has a vector that maps taste-scale IDs to expected score
 * directions — used to find the closest matching archetype.
 */
export const PLAYER_ARCHETYPES = [
  {
    id: "easy-rider",
    name: "The Easy Rider",
    summary: "You want to sit down and have fun right away. Games that click within the first few balls are your sweet spot — no homework required.",
    lookFor: "Approachable machines with clear goals, satisfying shots, and rules that feel good before you've read anything.",
    tags: ["Quick to enjoy", "Flow-focused", "Accessible"],
    vector: { "learning-curve": -3, "challenge": -2, "pace-feel": -1, "replay": -2 }
  },
  {
    id: "theme-collector",
    name: "The Theme Collector",
    summary: "The world and characters matter as much as the shots. You want to own something you love, not just something that plays well.",
    lookFor: "Strong licensed themes with recognizable characters — machines that feel like bringing the film or show home.",
    tags: ["Theme-first", "Collector instinct", "Broad appeal"],
    vector: { "theme-pull": 3, "ownership": -1 }
  },
  {
    id: "serious-player",
    name: "The Serious Player",
    summary: "Deep rules, high skill ceiling, and months of mastery ahead. You're drawn to machines that reward hundreds of games, not dozens.",
    lookFor: "Complex rule sets, multi-ball stacking, and machines with a skill gap you can close over time.",
    tags: ["Skill-driven", "Deep rules", "Long-term replay"],
    vector: { "learning-curve": 3, "challenge": 2, "replay": 2, "pace-feel": 1 }
  },
  {
    id: "flow-chaser",
    name: "The Flow Chaser",
    summary: "Fast shots, smooth flow, and that satisfying feeling when everything clicks. You care about how it feels more than what it unlocks.",
    lookFor: "Wide-open layouts, fast ramps, and machines that reward a natural flowing shooting style.",
    tags: ["Fast & flowing", "Shot-focused", "Immediate fun"],
    vector: { "pace-feel": -3, "replay": -1, "theme-pull": -1 }
  },
  {
    id: "safe-starter",
    name: "The Safe Starter",
    summary: "Low regret, broad appeal, and easy to share. You want a machine that works for everyone in the house and holds its value long-term.",
    lookFor: "Strong resale, easy rules, and crowd-pleasing machines that guests can enjoy on game one.",
    tags: ["Low-regret", "Family-friendly", "Resale-safe"],
    vector: { "ownership": -3, "challenge": -2, "learning-curve": -1 }
  },
  {
    id: "deep-explorer",
    name: "The Deep Explorer",
    summary: "Strategic depth and big objectives. You like setting up shots deliberately and chasing missions that build across weeks of play.",
    lookFor: "Multi-layered rules, wizard modes to chase, and machines that keep revealing new goals the deeper you dig.",
    tags: ["Strategic", "Goal-driven", "Patient"],
    vector: { "learning-curve": 2, "replay": 3, "pace-feel": 1, "challenge": 1 }
  }
];
