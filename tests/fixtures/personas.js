export const personas = {
  overwhelmedNovice: {
    id: "overwhelmed-novice",
    name: "The Overwhelmed Novice",
    profile: "New buyer, easily overloaded, needs obvious next actions and low-friction progression.",
    tendencies: ["hesitates when too many parallel actions appear", "prefers safe defaults", "avoids advanced side paths early"],
    expectations: ["a clear primary CTA on each major screen", "no dead-end after shortlist", "simple path into buying plan"],
    entry: "no",
    context: {
      budget: "7000to9000",
      condition: "either",
      playAccess: "very-little",
      travelWillingness: "local-only",
      timeline: "1to3months"
    },
    taste: {
      "learning-curve": "quick-start",
      "pace-feel": "controlled",
      "theme-pull": "gameplay-first",
      "challenge-level": "forgiving",
      "replay-itch": "instant-replay",
      "ownership-style": "safe"
    },
    reactionSequence: ["looks-fun", "not-sure", "looks-fun", "not-sure", "not-for-me", "looks-fun"],
    likedAspectSequence: ["shots", "speed", "theme", "shots", "speed", "theme"],
    concernSequence: ["too-complex", "too-chaotic", "just-right", "too-fast", "too-complex", "just-right"],
    preferredBuyPath: "used"
  },
  practicalBuyer: {
    id: "practical-low-regret-buyer",
    name: "The Practical / Low-Regret Buyer",
    profile: "Wants a safe beginner-friendly option with clear readiness and blocker guidance.",
    tendencies: ["optimizes for lower regret", "cares about readiness confidence", "prefers concrete action plans"],
    expectations: ["blockers should be actionable", "readiness states should be understandable", "plan should end in concrete next actions"],
    entry: "no",
    context: {
      budget: "9000to12000",
      condition: "used",
      playAccess: "some",
      travelWillingness: "regional",
      timeline: "soon"
    },
    taste: {
      "learning-curve": "quick-start",
      "pace-feel": "controlled",
      "theme-pull": "gameplay-first",
      "challenge-level": "forgiving",
      "replay-itch": "longer-progress",
      "ownership-style": "safe"
    },
    reactionSequence: ["looks-fun", "looks-fun", "not-sure", "looks-fun", "not-sure", "not-for-me"],
    likedAspectSequence: ["depth", "shots", "speed", "depth", "shots", "theme"],
    concernSequence: ["just-right", "too-simple", "too-fast", "just-right", "too-simple", "too-chaotic"],
    preferredBuyPath: "used"
  },
  themeDrivenBuyer: {
    id: "theme-driven-buyer",
    name: "The Theme-Driven Buyer",
    profile: "Responds to world/theme pull and needs help translating attraction into a usable decision.",
    tendencies: ["reacts quickly to theme fit", "accepts some complexity for excitement", "needs compare to resolve close choices"],
    expectations: ["theme-first path should feel natural", "compare should clarify choice", "front-runner should persist on resume"],
    entry: "no",
    context: {
      budget: "9000to12000",
      condition: "either",
      playAccess: "some",
      travelWillingness: "regional",
      timeline: "1to3months"
    },
    taste: {
      "learning-curve": "deep-discovery",
      "pace-feel": "fast-smooth",
      "theme-pull": "theme-first",
      "challenge-level": "demanding",
      "replay-itch": "longer-progress",
      "ownership-style": "specific"
    },
    reactionSequence: ["looks-fun", "looks-fun", "not-sure", "looks-fun", "not-for-me", "looks-fun"],
    likedAspectSequence: ["theme", "spectacle", "speed", "theme", "depth", "spectacle"],
    concernSequence: ["too-simple", "just-right", "too-slow", "too-simple", "too-fast", "just-right"],
    preferredBuyPath: "new"
  }
};
