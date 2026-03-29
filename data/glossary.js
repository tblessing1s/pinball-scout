const entries = [
  {
    id: "flow",
    label: "Flow",
    short: "How smoothly the ball moves from one shot to the next without awkward stops.",
    why: "Good flow usually makes a game feel fast, satisfying, and easy to replay.",
    aliases: ["flow", "high flow"],
    media: {
      src: "assets/glossary/flow.png",
      alt: "Attack from Mars playfield used as a real-image example of flow",
      caption: "A fan layout can help create smooth, connected flow."
    }
  },
  {
    id: "stop-and-go",
    label: "Stop-and-go",
    short: "A style where the game pauses the pace with controlled shots, traps, or staged decisions.",
    why: "These games can feel more deliberate than flow-heavy machines.",
    aliases: ["stop-and-go", "stop and go"]
  },
  {
    id: "code",
    label: "Code",
    short: "The software rules that decide what shots do, how modes work, and how scoring progresses.",
    why: "Better code often means clearer objectives and more to discover over time.",
    aliases: ["code", "software rules"]
  },
  {
    id: "multiball",
    label: "Multiball",
    short: "A mode where more than one ball is in play at the same time.",
    why: "Multiball usually raises the excitement and can change scoring strategy.",
    aliases: ["multiball", "multi-ball"],
    media: {
      src: "assets/glossary/multiball.jpg",
      alt: "CSI centrifuge multiball example",
      caption: "Multiball means more than one ball is active at the same time."
    }
  },
  {
    id: "modes",
    label: "Modes",
    short: "Short gameplay objectives or mini-missions with their own goals and scoring rules.",
    why: "Modes give a machine structure and help players feel progress.",
    aliases: ["modes", "mode"]
  },
  {
    id: "ramps",
    label: "Ramps",
    short: "Raised paths the ball travels up and around the playfield.",
    why: "Ramps often shape how smooth, fast, or satisfying a game feels.",
    aliases: ["ramps", "ramp"],
    media: {
      src: "assets/glossary/ramps.jpg",
      alt: "The Walking Dead ramp entrance example",
      caption: "Ramps are raised shot paths that guide the ball upward and across the playfield."
    }
  },
  {
    id: "toys",
    label: "Toys",
    short: "Physical playfield features that move, react, or stand out visually.",
    why: "Toys can make a machine feel more memorable, theme-driven, and mechanical.",
    aliases: ["toys", "toy"]
  },
  {
    id: "callouts",
    label: "Callouts",
    short: "Voice lines or audio clips that react to gameplay and theme moments.",
    why: "Strong callouts can add humor, personality, and long-term charm.",
    aliases: ["callouts", "callout", "voice lines"]
  },
  {
    id: "rules-depth",
    label: "Rules depth",
    short: "How much there is to learn, progress through, and optimize over repeated plays.",
    why: "More rules depth can keep a game interesting longer, but may be harder for beginners.",
    aliases: ["rules depth", "deep rules", "rules complexity", "depth"]
  },
  {
    id: "layout",
    label: "Layout",
    short: "The overall arrangement of shots, ramps, lanes, and features on the playfield.",
    why: "Layout strongly affects difficulty, pacing, and what a game feels like to shoot.",
    aliases: ["layout", "playfield layout"],
    media: {
      src: "assets/glossary/layout.png",
      alt: "Labeled playfield diagram showing common playfield parts",
      caption: "A labeled playfield helps beginners understand layout."
    }
  },
  {
    id: "shots",
    label: "Shots",
    short: "The main targets you aim for, like ramps, loops, lanes, and scoops.",
    why: "When players praise a game’s shots, they usually mean it is fun to aim and repeat.",
    aliases: ["shots", "shot making", "shotmaker", "shotmaker's", "shotmaker’s"]
  },
  {
    id: "feeds",
    label: "Feeds",
    short: "Where the ball returns after hitting a shot and how controllable that return feels.",
    why: "Clean feeds can make a game feel fairer and more skill-based.",
    aliases: ["feeds", "feed"],
    media: {
      src: "assets/glossary/feeds.jpg",
      alt: "Metallica left flipper feed example",
      caption: "Feeds describe how the ball returns back to the flippers."
    }
  },
  {
    id: "risk-reward",
    label: "Risk / reward",
    short: "When a harder or more dangerous choice can pay off with better scoring or progress.",
    why: "Risk / reward decisions make a machine feel more strategic.",
    aliases: ["risk reward", "risk/reward", "risk-reward"]
  },
  {
    id: "stackable-modes",
    label: "Stackable modes",
    short: "Modes or features you can run at the same time to combine scoring opportunities.",
    why: "Stacking usually adds depth and gives advanced players more strategy.",
    aliases: ["stackable modes", "stacking", "stack modes"]
  },
  {
    id: "bash-toy",
    label: "Bash toy",
    short: "A physical target or toy you repeatedly hit to start features, score points, or advance progress.",
    why: "A bash toy can make a game feel more tactile and theme-driven.",
    aliases: ["bash toy", "bash target"],
    media: {
      src: "assets/glossary/bash-toy.jpg",
      alt: "The Walking Dead Well Walker bash toy example",
      caption: "A bash toy is a physical target meant to be hit directly by the ball."
    }
  }
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const glossaryEntries = entries.map((entry) => ({
  ...entry,
  aliases: [...new Set([entry.label, ...(entry.aliases || [])])]
}));

const glossaryIndex = new Map();

glossaryEntries.forEach((entry) => {
  glossaryIndex.set(entry.id, entry);
  entry.aliases.forEach((alias) => {
    glossaryIndex.set(normalizeText(alias), entry);
  });
});

export function getGlossaryTerm(key) {
  return glossaryIndex.get(key) || glossaryIndex.get(normalizeText(key)) || null;
}

export function findGlossaryTermsInText(...values) {
  const haystack = normalizeText(values.filter(Boolean).join(" "));

  return glossaryEntries.filter((entry) =>
    entry.aliases.some((alias) => haystack.includes(normalizeText(alias)))
  );
}

export function renderGlossaryTrigger(key, options = {}) {
  const entry = getGlossaryTerm(key);
  if (!entry) return escapeHtml(options.label || key);

  const {
    label = entry.label,
    ariaLabel = `Explain ${label}`,
    className = "",
    variant = "inline"
  } = options;

  return `
    <button
      class="glossary-term glossary-term--${variant}${className ? ` ${className}` : ""}"
      type="button"
      data-glossary-term="${entry.id}"
      aria-label="${escapeHtml(ariaLabel)}"
    >${escapeHtml(label)}</button>
  `;
}
