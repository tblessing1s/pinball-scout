export const discoveryContextQuestions = [
  {
    id: "budget",
    eyebrow: "Budget",
    title: "What budget band feels realistic?",
    description: "We will keep the shortlist inside a believable first-buy range.",
    choices: [
      { value: "under7000", label: "Under $7k", hint: "Tighter shortlist, leaning used market." },
      { value: "7000to9000", label: "$7k-$9k", hint: "The core modern first-home range." },
      { value: "9000to12000", label: "$9k-$12k", hint: "More room for premium safe picks." }
    ]
  },
  {
    id: "condition",
    eyebrow: "New or used",
    title: "Are you open to new, used, or either?",
    description: "This affects which machines are realistic and which sourcing path makes sense later.",
    choices: [
      { value: "either", label: "Either", hint: "Best for keeping your options open." },
      { value: "new", label: "New only", hint: "Bias toward current-production style options." },
      { value: "used", label: "Used only", hint: "More value and more classics." }
    ]
  },
  {
    id: "playAccess",
    eyebrow: "Access",
    title: "How easy is it for you to try machines in person?",
    description: "If you cannot test much locally, we will bias toward safer first-buy confidence picks.",
    choices: [
      { value: "very-little", label: "Very little", hint: "Lean toward confidence-building options." },
      { value: "some", label: "Some access", hint: "Balanced between safety and taste." },
      { value: "lots", label: "Lots of access", hint: "More room to validate and refine." }
    ]
  },
  {
    id: "travelWillingness",
    eyebrow: "Testing",
    title: "How far are you willing to travel to test games?",
    description: "Many buyers are willing to travel a bit if it helps avoid buying the wrong machine.",
    choices: [
      { value: "local-only", label: "Keep it local", hint: "Prefer a nearby test plan." },
      { value: "regional", label: "A reasonable drive", hint: "Open to a longer day-trip test." },
      { value: "overnight", label: "Weekend drive trip", hint: "Open to a bigger road trip if it helps test the right machine." }
    ]
  },
  {
    id: "timeline",
    eyebrow: "Timeline",
    title: "When do you think you may buy?",
    description: "This helps frame how much validation versus action the product should emphasize.",
    choices: [
      { value: "researching", label: "Just researching", hint: "More exploration, less urgency." },
      { value: "1to3months", label: "1-3 months", hint: "Enough time to test and narrow." },
      { value: "soon", label: "Soon", hint: "Move more quickly toward a confident shortlist." }
    ]
  }
];

export const discoveryTastePrompts = [
  {
    id: "learning-curve",
    eyebrow: "Learning style",
    title: "How do you want the game to feel at home?",
    description: "Pick the one that feels more exciting, not the one that sounds impressive.",
    options: [
      {
        value: "quick-start",
        label: "Easy to understand fast",
        detail: "I want to feel good within the first few games.",
        weights: {
          attributes: { beginnerFriendly: 1.4, gameplayDepth: -0.6 },
          signals: { classic_straightforward: 1.2, beginner_friendly: 1.1 }
        }
      },
      {
        value: "deep-discovery",
        label: "Keeps unfolding over time",
        detail: "New missions and strategies keep showing up months later.",
        weights: {
          attributes: { gameplayDepth: 1.5, beginnerFriendly: -0.4 },
          signals: { strategic_deeper_rules: 1.4, modern_immersive: 0.6 }
        }
      }
    ]
  },
  {
    id: "pace-feel",
    eyebrow: "Pace",
    title: "Which pace sounds more fun to you?",
    description: "This is about how the ball moves from shot to shot.",
    options: [
      {
        value: "fast-smooth",
        label: "Fast and smooth",
        detail: "I want quick, flowing shots with momentum.",
        weights: {
          signals: { fast_flowy: 1.6, chaotic_multiball_heavy: 0.4 }
        }
      },
      {
        value: "controlled",
        label: "Deliberate and controlled",
        detail: "I want to set up shots and play more strategically.",
        weights: {
          signals: { strategic_deeper_rules: 0.9, classic_straightforward: 0.6, fast_flowy: -0.7 }
        }
      }
    ]
  },
  {
    id: "theme-pull",
    eyebrow: "Theme connection",
    title: "How much does the theme or world matter?",
    description: "Think about owning it at home, not just playing once.",
    options: [
      {
        value: "theme-first",
        label: "I want to love the theme",
        detail: "The story, characters, or world should hook me.",
        weights: {
          attributes: { themeStrength: 1.5 },
          signals: { theme_first: 1.3, modern_immersive: 0.6 }
        }
      },
      {
        value: "gameplay-first",
        label: "Gameplay matters more",
        detail: "I care more about how it plays than the theme.",
        weights: {
          attributes: { themeStrength: -0.4 },
          signals: { fast_flowy: 0.5, strategic_deeper_rules: 0.5 }
        }
      }
    ]
  },
  {
    id: "challenge-level",
    eyebrow: "Challenge",
    title: "What kind of challenge feels right?",
    description: "No wrong answer. This just shapes the shortlist.",
    options: [
      {
        value: "forgiving",
        label: "Forgiving and approachable",
        detail: "I want a game that does not punish me too hard.",
        weights: {
          attributes: { beginnerFriendly: 1.3 },
          signals: { beginner_friendly: 1.1 }
        }
      },
      {
        value: "demanding",
        label: "Demanding and skill-building",
        detail: "I like a game that pushes me to improve.",
        weights: {
          attributes: { gameplayDepth: 0.8, beginnerFriendly: -0.4 },
          signals: { strategic_deeper_rules: 0.9 }
        }
      }
    ]
  },
  {
    id: "replay-itch",
    eyebrow: "Replay vibe",
    title: "After one good game, you want to...",
    description: "This hints at what keeps a machine exciting long-term.",
    options: [
      {
        value: "instant-replay",
        label: "Hit start again right away",
        detail: "Short, energetic games that make me want another go.",
        weights: {
          signals: { fast_flowy: 1.0, chaotic_multiball_heavy: 0.6 }
        }
      },
      {
        value: "longer-progress",
        label: "Chase longer goals",
        detail: "I like bigger objectives that build across games.",
        weights: {
          attributes: { gameplayDepth: 1.0 },
          signals: { strategic_deeper_rules: 1.1 }
        }
      }
    ]
  },
  {
    id: "ownership-style",
    eyebrow: "Ownership style",
    title: "Which ownership style sounds better?",
    description: "This affects how safe vs bold the first shortlist should be.",
    options: [
      {
        value: "safe",
        label: "Low-regret first buy",
        detail: "I want something easy to resell or share if I change my mind.",
        context: { buyingStyle: "safe" },
        weights: {
          attributes: { resaleStrength: 1.4, broadAppeal: 1.1, maintenanceComplexity: 0.8 },
          signals: { family_friendly: 0.8 }
        }
      },
      {
        value: "specific",
        label: "Taste-first pick",
        detail: "I would rather choose something bold that fits me.",
        context: { buyingStyle: "specific" },
        weights: {
          attributes: { themeStrength: 0.9, gameplayDepth: 0.6 },
          signals: { modern_immersive: 0.6, theme_first: 0.6 }
        }
      }
    ]
  }
];

export const discoveryReactionOptions = [
  { value: "looks-fun", label: "Looks fun" },
  { value: "not-sure", label: "Not sure" },
  { value: "not-for-me", label: "Not for me" }
];

export const calibrationReactionOptions = [
  { value: "liked-it", label: "Liked it" },
  { value: "not-sure", label: "Not sure" },
  { value: "not-for-me", label: "Not for me" }
];

export const likedAspectOptions = [
  { value: "theme", label: "Theme / world" },
  { value: "shots", label: "Shots / layout feel" },
  { value: "speed", label: "Speed / smoothness" },
  { value: "depth", label: "Progression / strategy" },
  { value: "spectacle", label: "Big moments / wow factor" }
];

export const concernOptions = [
  { value: "too-fast", label: "Too fast to keep up" },
  { value: "too-slow", label: "Too slow / plodding" },
  { value: "too-complex", label: "Too complex to track" },
  { value: "too-simple", label: "Too simple / shallow" },
  { value: "too-chaotic", label: "Too chaotic / messy" },
  { value: "just-right", label: "Felt just right" }
];
