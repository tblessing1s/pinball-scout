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
  },

  // ── Challenger personas ────────────────────────────────────────────────────

  readyToBuyReturner: {
    id: "ready-to-buy-returner",
    name: "The Ready-to-Buy Returner",
    profile: "Has played pinball at bars and leagues. Knows what they like, has a clear budget and short timeline. Uses the calibration path to skip the basics and get straight to a shortlist.",
    tendencies: ["decisive reactions", "skips educational content", "wants a shortlist fast"],
    expectations: ["calibration path leverages real machine knowledge", "shortlist reflects actual play experience", "buying plan is immediately actionable without extra hand-holding"],
    entry: "yes",
    context: {
      budget: "9000to12000",
      condition: "used",
      travelWillingness: "regional",
      timeline: "soon"
    },
    playedMachineIds: ["iron-maiden-pro"],
    taste: {
      "learning-curve": "deep-discovery",
      "pace-feel": "fast-smooth",
      "theme-pull": "gameplay-first",
      "challenge-level": "demanding",
      "replay-itch": "longer-progress",
      "ownership-style": "specific"
    },
    reactionSequence: ["liked-it", "liked-it", "not-sure", "liked-it", "not-for-me", "liked-it"],
    likedAspectSequence: ["depth", "shots", "speed", "depth", "shots", "depth"],
    concernSequence: ["too-simple", "just-right", "too-fast", "too-simple", "too-complex", "just-right"],
    preferredBuyPath: "used"
  },

  onTheFenceResearcher: {
    id: "on-the-fence-researcher",
    name: "The On-the-Fence Researcher",
    profile: "Has been researching for months. Mixed reactions across the deck, struggles to commit. Expects the tool to surface a clear low-confidence signal and a concrete path forward.",
    tendencies: ["over-researches", "rarely gives a strong reaction", "gets stuck before committing"],
    expectations: ["low or medium confidence result with actionable next steps", "no dead-end at results screen", "refinement path or compare is clearly offered"],
    entry: "no",
    context: {
      budget: "7000to9000",
      condition: "either",
      playAccess: "some",
      travelWillingness: "regional",
      timeline: "researching"
    },
    taste: {
      "learning-curve": "quick-start",
      "pace-feel": "controlled",
      "theme-pull": "gameplay-first",
      "challenge-level": "forgiving",
      "replay-itch": "instant-replay",
      "ownership-style": "safe"
    },
    reactionSequence: ["not-sure", "not-sure", "not-sure", "looks-fun", "not-sure", "not-sure"],
    likedAspectSequence: ["shots", "theme", "depth", "shots", "theme", "shots"],
    concernSequence: ["too-complex", "too-fast", "too-complex", "just-right", "too-complex", "too-slow"],
    preferredBuyPath: "used"
  },

  pinballEnthusiast: {
    id: "pinball-enthusiast",
    name: "The Pinball Enthusiast",
    profile: "Veteran player who has logged time on 30+ machines. Strong opinions, low tolerance for obvious generic picks. Will immediately notice if the shortlist is lazy or crowd-pleasing.",
    tendencies: ["strongly polarized reactions", "deep-dive taste choices", "expects specificity not safety"],
    expectations: ["shortlist reflects demanding taste signal not just safe defaults", "calibration path uses real machine history", "results feel earned — not the same three machines everyone else gets"],
    entry: "yes",
    context: {
      budget: "9000to12000",
      condition: "either",
      travelWillingness: "overnight",
      timeline: "1to3months"
    },
    playedMachineIds: ["godzilla-pro", "foo-fighters-pro"],
    taste: {
      "learning-curve": "deep-discovery",
      "pace-feel": "fast-smooth",
      "theme-pull": "theme-first",
      "challenge-level": "demanding",
      "replay-itch": "longer-progress",
      "ownership-style": "specific"
    },
    reactionSequence: ["liked-it", "not-for-me", "not-for-me", "liked-it", "not-for-me", "liked-it"],
    likedAspectSequence: ["depth", "spectacle", "shots", "depth", "spectacle", "shots"],
    concernSequence: ["too-simple", "too-simple", "too-chaotic", "too-simple", "too-simple", "just-right"],
    preferredBuyPath: "used"
  },

  theContrarian: {
    id: "the-contrarian",
    name: "The Contrarian",
    profile: "Dismisses most machines. Tests whether the engine degrades gracefully with minimal positive signal — does it crash, return nothing, or still find a usable shortlist?",
    tendencies: ["rejects most machines outright", "very high bar for approval", "extreme taste preference edges"],
    expectations: ["engine should not crash or return an empty shortlist", "fallback logic should produce at least one recommendation", "results screen should still offer a workable path forward"],
    entry: "no",
    context: {
      budget: "9000to12000",
      condition: "either",
      playAccess: "lots",
      travelWillingness: "regional",
      timeline: "1to3months"
    },
    taste: {
      "learning-curve": "deep-discovery",
      "pace-feel": "fast-smooth",
      "theme-pull": "gameplay-first",
      "challenge-level": "demanding",
      "replay-itch": "longer-progress",
      "ownership-style": "specific"
    },
    reactionSequence: ["not-for-me", "not-for-me", "not-for-me", "looks-fun", "not-for-me", "not-for-me"],
    likedAspectSequence: ["depth", "shots", "depth", "shots", "depth", "shots"],
    concernSequence: ["too-simple", "too-chaotic", "too-simple", "just-right", "too-simple", "too-chaotic"],
    preferredBuyPath: "used"
  }
};
