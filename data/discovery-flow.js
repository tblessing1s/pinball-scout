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
    title: "How much access do you have to nearby playable machines?",
    description: "This helps decide how strongly to favor safer first buys versus taste-forward picks.",
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
  { value: "theme", label: "Theme / immersion" },
  { value: "shots", label: "Shots / layout" },
  { value: "speed", label: "Speed / flow" },
  { value: "depth", label: "Rules / progression" },
  { value: "spectacle", label: "Spectacle / wow factor" }
];

export const concernOptions = [
  { value: "too-fast", label: "Too fast" },
  { value: "too-slow", label: "Too slow" },
  { value: "too-complex", label: "Too complex" },
  { value: "too-simple", label: "Too simple" },
  { value: "too-chaotic", label: "Too chaotic" },
  { value: "just-right", label: "Just right" }
];

export const postPlayQuestions = [
  {
    id: "enjoyment",
    title: "Did you enjoy it?",
    choices: [
      { value: "liked-it", label: "Yes, I liked it" },
      { value: "not-sure", label: "Mixed / not sure" },
      { value: "not-for-me", label: "No, not for me" }
    ]
  },
  {
    id: "fun",
    title: "What felt most fun?",
    choices: likedAspectOptions
  },
  {
    id: "friction",
    title: "What felt most frustrating?",
    choices: [
      { value: "too-hard", label: "Too hard" },
      { value: "too-easy", label: "Too easy" },
      { value: "too-chaotic", label: "Too chaotic" },
      { value: "too-slow", label: "Too slow" },
      { value: "theme-miss", label: "Theme did not hook me" },
      { value: "none", label: "Nothing major" }
    ]
  },
  {
    id: "replay",
    title: "Did it make you want another game immediately?",
    choices: [
      { value: "yes", label: "Yes" },
      { value: "maybe", label: "Maybe" },
      { value: "no", label: "No" }
    ]
  }
];
