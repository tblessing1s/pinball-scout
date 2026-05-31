import { machines } from "./machines.js";
import { machineMediaIndex } from "./machine-media.generated.js";
import { buildPinsideMachineUrl, buildPinsideMarketUrl, buildPinsidePricingUrl } from "../lib/services/pinside-market.js";
import { machineVideoOverrideIndex } from "./machine-video-overrides.js";
import { indexBy } from "../lib/collection-utils.js";
import { searchLink, youtubeSearchUrl } from "../lib/url-utils.js";

const machineIndex = indexBy(machines, "slug");

function buildVideoProfile(machine) {
  const override = machineVideoOverrideIndex.get(machine.slug) || {};
  const defaultOverviewUrl = youtubeSearchUrl(`${machine.name} pinball overview`);
  const defaultGameplayUrl = youtubeSearchUrl(`${machine.name} pinball gameplay walkthrough`);

  const overview = {
    url: override.overviewUrl || defaultOverviewUrl,
    label: override.overviewLabel || "Watch overview",
    creatorName: override.overviewCreatorName || "Curated YouTube search",
    videoTitle: override.overviewTitle || `${machine.name} overview`,
    type: "overview",
    priority: 1
  };

  const gameplay = {
    url: override.gameplayUrl || defaultGameplayUrl,
    label: override.gameplayLabel || "Watch gameplay",
    creatorName: override.gameplayCreatorName || "Curated YouTube search",
    videoTitle: override.gameplayTitle || `${machine.name} gameplay`,
    type: "gameplay",
    priority: 2
  };

  return {
    overview,
    gameplay,
    recommendedVideos: [overview, gameplay]
  };
}

function buildRecommendationSignals(base, config) {
  const isClassic = config.tags.includes("classic");
  const isModern = config.tags.includes("modern");
  const isFlowy = config.tags.includes("flow") || config.tags.includes("fast") || config.tags.includes("shot-driven");
  const isThemeFirst = config.tags.includes("licensed") || config.tags.includes("theme-first") || config.tags.includes("personality");
  const isChaotic = config.tags.includes("spectacle") || config.tags.includes("showpiece");

  return {
    fast_flowy: isFlowy ? 1 : Math.max(0.2, config.gameplayDepth / 5),
    strategic_deeper_rules: Math.max(0.2, config.gameplayDepth / 5),
    beginner_friendly: config.beginnerFriendly / 5,
    theme_first: isThemeFirst ? 1 : config.themeStrength / 5,
    family_friendly: config.broadAppeal / 5,
    chaotic_multiball_heavy: isChaotic ? 0.8 : 0.25,
    classic_straightforward: isClassic ? 1 : 0.15,
    modern_immersive: isModern ? 1 : 0.15
  };
}

function availabilityLabel(value) {
  if (value === "both") return "Either";
  if (value === "new") return "New";
  if (value === "used") return "Used";
  return "Either";
}

function flowScoreFromTags(tags) {
  if (tags.includes("flow") || tags.includes("fast")) return 5;
  if (tags.includes("shot-driven")) return 4;
  return 3;
}

function machineTypeLabel(base) {
  return Number(base.year) >= 2016 ? "Modern LCD" : "Classic solid-state";
}

function findabilityScoreFor(base, config) {
  const availabilityBoost = base.condition_availability === "both" ? 1 : base.condition_availability === "new" ? 0.8 : 0.6;
  return Math.max(2, Math.min(5, Math.round(((config.resaleStrength / 5) + availabilityBoost) * 2.5)));
}

function rarityLabelFor(findabilityScore) {
  if (findabilityScore >= 4) return "Common enough";
  if (findabilityScore >= 3) return "Uncommon";
  return "Harder to find";
}

function validationDifficultyFor(findabilityScore) {
  if (findabilityScore >= 4) return "Easy to validate";
  if (findabilityScore >= 3) return "Moderate to validate";
  return "Harder to validate";
}

const curatedConfigs = [
  {
    slug: "godzilla-pro",
    shortDescription: "Big theme moments, satisfying shots, and enough depth to stay interesting for a long time.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 4,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 5,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["modern", "spectacle", "safe-pick", "licensed", "depth", "showpiece"],
    starterRecommendationReason: "A strong all-around first modern pin if you want something exciting now and still rewarding later.",
    cautionNote: "It is popular enough that pricing can stay firm."
  },
  {
    slug: "deadpool-pro",
    shortDescription: "Funny, easy to click with, and one of the cleanest first-home recommendations in modern Sterns.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 5,
    resaleStrength: 5,
    themeStrength: 4,
    gameplayDepth: 4,
    broadAppeal: 4,
    maintenanceComplexity: 2,
    tags: ["modern", "humor", "safe-pick", "easy-start", "replayable", "comic"],
    starterRecommendationReason: "One of the safest first-pin choices when you want fast fun without a steep learning curve.",
    cautionNote: "The humor and comic-book theme are stronger fits for some households than others."
  },
  {
    slug: "jurassic-park-pro",
    shortDescription: "A more challenging modern pick with strong theme integration and a satisfying sense of progression.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 3,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 5,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["modern", "adventure", "challenge", "licensed", "depth", "shot-driven"],
    starterRecommendationReason: "A compelling first-machine shortlist option if you want something you can grow into.",
    cautionNote: "It is less instantly forgiving than the easiest beginner picks."
  },
  {
    slug: "foo-fighters-pro",
    shortDescription: "Bright, approachable, and energetic, with a playful feel that works well in a home setting.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 3,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["modern", "music", "approachable", "colorful", "home-friendly", "personality"],
    starterRecommendationReason: "A strong choice if you want a modern machine that feels lively without being intimidating.",
    cautionNote: "Theme connection matters more here than on a broader crowd-pleaser."
  },
  {
    slug: "avengers-infinity-quest-pro",
    shortDescription: "Dense rules and lots to explore for buyers who want a machine with plenty to learn over time.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 5,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["modern", "marvel", "depth", "strategy", "dense", "enthusiast-leaning"],
    starterRecommendationReason: "Worth shortlisting if your idea of a good first pin is something you can study and keep uncovering.",
    cautionNote: "It can feel like a lot if you want instant simplicity."
  },
  {
    slug: "iron-maiden-pro",
    shortDescription: "Fast, skill-driven, and highly respected if your taste leans more toward shooting and mastery.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 4,
    broadAppeal: 3,
    maintenanceComplexity: 2,
    tags: ["modern", "music", "flow", "skill", "competitive", "fast"],
    starterRecommendationReason: "A great shortlist candidate if your reactions lean toward cleaner, faster, skill-focused games.",
    cautionNote: "It is more of a player-first pick than a universal family pick."
  },
  {
    slug: "stranger-things-pro",
    shortDescription: "A recognizable theme with straightforward goals and strong home-use appeal.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 3,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["modern", "tv", "licensed", "safe-pick", "theme-first", "home-friendly"],
    starterRecommendationReason: "A sensible first shortlist option if theme attachment is part of what will make ownership feel worth it.",
    cautionNote: "Gameplay-first buyers may end up preferring stronger pure-shooting titles."
  },
  {
    slug: "mandalorian-pro",
    shortDescription: "A broadly recognizable, approachable pick that makes sense for shared household play.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 3,
    broadAppeal: 5,
    maintenanceComplexity: 3,
    tags: ["modern", "star-wars", "family", "licensed", "approachable", "shared-play"],
    starterRecommendationReason: "A good first-pin candidate when you want something easy to share with other people at home.",
    cautionNote: "Some buyers may want more long-term gameplay depth at the same price."
  },
  {
    slug: "attack-from-mars-remake",
    shortDescription: "Simple to understand, easy to enjoy quickly, and one of the most reliable beginner shortlist recommendations.",
    priceTier: "$7.5k-$9.5k",
    beginnerFriendly: 5,
    resaleStrength: 5,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 5,
    maintenanceComplexity: 2,
    tags: ["classic", "safe-pick", "family", "easy-start", "broad-appeal", "remake"],
    starterRecommendationReason: "An excellent first shortlist pick when you want a machine that is easy to feel good about buying.",
    cautionNote: "It is not the best fit if you want deep modern rules."
  },
  {
    slug: "fish-tales",
    shortDescription: "A simpler, lower-cost classic with fast rules pickup and a straightforward ownership proposition.",
    priceTier: "$4k-$6k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 3,
    gameplayDepth: 1,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["classic", "budget", "easy-start", "used-market", "simple", "value"],
    starterRecommendationReason: "A sensible shortlist option if your first priority is getting into ownership without jumping straight into modern pricing.",
    cautionNote: "It is fun and direct, but not nearly as deep as most modern machines."
  },
  {
    slug: "funhouse",
    shortDescription: "An older classic with huge personality and a more reachable entry price than many premium beginner picks.",
    priceTier: "$5k-$7.2k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 4,
    maintenanceComplexity: 4,
    tags: ["classic", "budget", "personality", "used-market", "iconic", "character"],
    starterRecommendationReason: "Worth considering if you want a memorable first machine without stretching into the more expensive remake tier.",
    cautionNote: "It is older, so the ownership side can be more hands-on than a newer machine."
  },
  {
    slug: "medieval-madness-remake",
    shortDescription: "Funny, accessible, and one of the strongest all-around crowd-pleasers for a first home machine.",
    priceTier: "$8.5k-$11k",
    beginnerFriendly: 5,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 2,
    broadAppeal: 5,
    maintenanceComplexity: 2,
    tags: ["classic", "safe-pick", "family", "humor", "broad-appeal", "remake"],
    starterRecommendationReason: "A top-tier first-pin shortlist option if you want broad confidence, easy onboarding, and long-term charm.",
    cautionNote: "It tends to cost more than simpler beginner-friendly alternatives."
  },
  {
    slug: "venom-pro",
    shortDescription: "A fast, progression-driven modern pin with fresh mechanics and a Marvel edge that rewards repeat play.",
    priceTier: "$7k-$8.5k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 4,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["modern", "fast", "comic", "progression-heavy", "superhero", "speed"],
    starterRecommendationReason: "A solid shortlist option if you want something modern with fast energy and a different progression feel than most Sterns.",
    cautionNote: "The theme leans more enthusiast than family, and the resale market is still maturing."
  },
  {
    slug: "jaws-pro",
    shortDescription: "A recent release with immersive theme integration, strong production polish, and genuine excitement on the new-to-used market.",
    priceTier: "$7k-$9k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 4,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["modern", "movie", "theme-first", "recent release", "licensed", "immersive"],
    starterRecommendationReason: "Worth shortlisting if you want a current-market machine with strong theme immersion and modern production quality.",
    cautionNote: "Used pricing is still settling — you may pay a freshness premium over equivalent-depth machines."
  },
  {
    slug: "monster-bash-remake",
    shortDescription: "One of the friendliest, most broadly charming home pins available — great theme, easy rules, and strong family fit.",
    priceTier: "$8.5k-$10.5k",
    beginnerFriendly: 5,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 2,
    broadAppeal: 5,
    maintenanceComplexity: 2,
    tags: ["classic", "family", "safe-pick", "humor", "easy-start", "remake"],
    starterRecommendationReason: "A top-tier first-home shortlist pick for buyers who want broad charm and easy ownership without rules complexity.",
    cautionNote: "Pricing is firm and rules are light — not the right fit if you want deep modern gameplay."
  },
  {
    slug: "theatre-of-magic",
    shortDescription: "A classic 90s machine with strong home charm, easy-to-follow goals, and a magical theme that holds up well across ages.",
    priceTier: "$6.5k-$8.5k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 5,
    maintenanceComplexity: 3,
    tags: ["classic", "family", "magic theme", "easy-start", "used-market", "personality"],
    starterRecommendationReason: "A good shortlist option for buyers open to a 90s machine with genuine warmth and easy approachability.",
    cautionNote: "Older components mean more potential ownership work — inspect the trunk toy and magnet mechs carefully."
  },
  {
    slug: "monster-bash-original",
    shortDescription: "The beloved original — higher collector value, genuine classic status, and all the charm of the remake at a higher ownership responsibility.",
    priceTier: "$9k-$12k",
    beginnerFriendly: 5,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 2,
    broadAppeal: 5,
    maintenanceComplexity: 4,
    tags: ["classic", "collector", "family", "original-classic", "home-favorite", "used-market"],
    starterRecommendationReason: "Worth shortlisting if you specifically want the original Williams version and are comfortable with classic-machine ownership realities.",
    cautionNote: "Commands a collector premium and requires more maintenance than the remake — not ideal as a worry-free first machine."
  },
  {
    slug: "arabian-nights",
    shortDescription: "A visually stunning 90s classic with immersive theme atmosphere, broad appeal, and one of the most beautiful playfields of its era.",
    priceTier: "$8k-$11k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 2,
    broadAppeal: 5,
    maintenanceComplexity: 4,
    tags: ["classic", "collector", "theme-first", "fantasy theme", "immersive", "used-market"],
    starterRecommendationReason: "A compelling shortlist pick for buyers who prioritize theme atmosphere and want a machine that looks as good as it plays.",
    cautionNote: "Older mechanics and collector-level pricing mean you need to be comfortable with used-machine inspection and maintenance."
  },
  {
    slug: "godfather-ce",
    shortDescription: "A high-end, spectacle-first modern machine packed with features, deep rules, and premium fit-and-finish at a luxury price.",
    priceTier: "$11k-$13.5k",
    beginnerFriendly: 2,
    resaleStrength: 3,
    themeStrength: 5,
    gameplayDepth: 5,
    broadAppeal: 2,
    maintenanceComplexity: 4,
    tags: ["premium", "deep rules", "showpiece", "licensed", "high-end", "enthusiast-leaning"],
    starterRecommendationReason: "A shortlist candidate only if budget is not the main constraint and you want a statement machine with serious depth.",
    cautionNote: "The price, complexity, and maintenance overhead make this a poor choice for most first-time buyers."
  },
  {
    slug: "elvira-house-of-horrors",
    shortDescription: "A bold, personality-driven machine with strong character and deeper rules — made for buyers who want something distinct over something safe.",
    priceTier: "$8.5k-$11k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 4,
    broadAppeal: 2,
    maintenanceComplexity: 3,
    tags: ["modern", "horror", "personality", "niche-theme", "theme-first", "home-collection"],
    starterRecommendationReason: "Worth shortlisting if you want a machine with a strong identity and don't need it to be a universal household fit.",
    cautionNote: "The horror-comedy theme is not suitable for every household, and the price is on the higher end for its breadth of appeal."
  },
  {
    slug: "addams-family",
    shortDescription: "The best-selling pinball ever — instantly recognizable, broadly loved, and a genuine piece of pop culture history.",
    priceTier: "$4.5k-$7.5k",
    beginnerFriendly: 4,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 3,
    broadAppeal: 5,
    maintenanceComplexity: 3,
    tags: ["classic", "iconic", "family", "tv theme", "crowd-pleaser", "used-market"],
    starterRecommendationReason: "One of the most recognizable pins ever made — hard to go wrong if you want a classic with broad appeal.",
    cautionNote: "Condition varies widely on the used market — inspect carefully and budget for potential restoration work."
  },
  {
    slug: "twilight-zone",
    shortDescription: "A deep, toy-laden collector favorite with legendary status and rules that keep enthusiasts busy for years.",
    priceTier: "$5.5k-$9k",
    beginnerFriendly: 2,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 5,
    broadAppeal: 3,
    maintenanceComplexity: 4,
    tags: ["collector", "deep rules", "classic", "enthusiast-pick", "90s", "toys"],
    starterRecommendationReason: "A top pick for enthusiasts who want one of the deepest classics ever made and are comfortable with used-machine complexity.",
    cautionNote: "Not a great first machine — complex mechs and collector pricing make this better as a second or third pin."
  },
  {
    slug: "whitewater",
    shortDescription: "A ramp-heavy flow classic with a distinctive waterfall centerpiece and satisfying medium-depth rules.",
    priceTier: "$4.5k-$7k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 3,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["classic", "flow", "90s", "ramp-shots", "family-theme", "used-market"],
    starterRecommendationReason: "A great shortlist option if you want a satisfying flow machine with character and a reachable used-market price.",
    cautionNote: "The foam waterfall piece commonly needs replacement on older examples."
  },
  {
    slug: "scared-stiff",
    shortDescription: "Elvira's lighter, more approachable pin — witty humor, easy rules, and a fun social personality.",
    priceTier: "$4k-$6.5k",
    beginnerFriendly: 5,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["classic", "humor", "accessible", "bar-staple", "easy-rules", "90s"],
    starterRecommendationReason: "A fun, approachable classic for buyers who want humor, easy rules, and a good bar-style experience at home.",
    cautionNote: "The adult humor theme isn't ideal for households with young children."
  },
  {
    slug: "bride-of-pinbot",
    shortDescription: "A classic transformation-themed pin with clear goals, an iconic robot toy, and an entry-friendly price.",
    priceTier: "$3.2k-$5.5k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["classic", "budget", "simple-rules", "90s", "iconic-toy", "used-market"],
    starterRecommendationReason: "A good entry point if budget is a priority and you want a classic with a memorable visual centerpiece.",
    cautionNote: "Older electronics need inspection — the transformation mechanism in particular can require attention."
  },
  {
    slug: "acdc-pro",
    shortDescription: "The bar-staple Stern classic — great soundtrack, satisfying shots, and one of the most findable used machines around.",
    priceTier: "$4.5k-$6.5k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 3,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["music", "classic-stern", "bar-staple", "used-market", "band-theme", "accessible-depth"],
    starterRecommendationReason: "A proven, widely available used-market machine — good value if you want a reliable Stern with strong music energy.",
    cautionNote: "Route-worn examples are common — inspect carefully for playfield and cabinet wear."
  },
  {
    slug: "metallica-pro",
    shortDescription: "A punishing but rewarding music pin with skull targets, coffin multiball, and deep rules for serious players.",
    priceTier: "$4.8k-$7k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 4,
    broadAppeal: 2,
    maintenanceComplexity: 3,
    tags: ["music", "classic-stern", "skill-driven", "band-theme", "depth", "used-market"],
    starterRecommendationReason: "A strong pick for metal fans or serious players who want depth and a machine that rewards mastery.",
    cautionNote: "The aggressive theme limits household-wide appeal, and the skill curve is steeper than most beginner picks."
  },
  {
    slug: "walking-dead-pro",
    shortDescription: "A widely available TV-licensed machine with accessible zombie-survival modes and good used-market value.",
    priceTier: "$3.8k-$5.8k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 3,
    broadAppeal: 2,
    maintenanceComplexity: 3,
    tags: ["tv-theme", "used-market", "accessible", "bar-staple", "classic-stern", "horror"],
    starterRecommendationReason: "A practical used-market choice if you like the show and want clear mode progression at a reasonable price.",
    cautionNote: "Zombie violence limits family-friendly use, and the theme has less universal appeal than broader licenses."
  },
  {
    slug: "game-of-thrones-pro",
    shortDescription: "A house-selection mode machine with decent depth and very common availability on the used market.",
    priceTier: "$4k-$6k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 3,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["tv-theme", "used-market", "accessible", "classic-stern", "fantasy-theme", "mode-based"],
    starterRecommendationReason: "A sensible used-market option for fans of the show who want accessible rules and a solid value proposition.",
    cautionNote: "Resale trajectory may be affected by the show's cooled cultural standing."
  },
  {
    slug: "star-wars-pro",
    shortDescription: "Maximum recognizability, accessible rules, and one of the most family-friendly home machines available.",
    priceTier: "$5.5k-$7.5k",
    beginnerFriendly: 5,
    resaleStrength: 5,
    themeStrength: 5,
    gameplayDepth: 3,
    broadAppeal: 5,
    maintenanceComplexity: 3,
    tags: ["family", "popular", "accessible", "broad-appeal", "licensed-theme", "used-market"],
    starterRecommendationReason: "A top family-friendly shortlist pick — the license and approachability make it easy to recommend to almost anyone.",
    cautionNote: "Rules depth is moderate — players who want a more demanding game may find it too easy long-term."
  },
  {
    slug: "guardians-of-the-galaxy-pro",
    shortDescription: "Humor, great music, and infectious fun — one of the most feel-good home machines Stern has made.",
    priceTier: "$5.5k-$7.5k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 3,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["music", "humor", "family", "popular", "accessible", "marvel"],
    starterRecommendationReason: "A strong shortlist pick if you want something fun across all skill levels with a great soundtrack.",
    cautionNote: "Theme is Marvel-specific — not quite the universal crowd-pleaser of a pure classic."
  },
  {
    slug: "aerosmith-pro",
    shortDescription: "A band-tour progression machine with solid rules and very common availability at a practical price point.",
    priceTier: "$4.5k-$6.5k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 3,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["music", "used-market", "band-theme", "accessible-depth", "classic-stern", "mode-based"],
    starterRecommendationReason: "A practical option if you want a used-market music machine with clear mode progression and good findability.",
    cautionNote: "Theme strength is tied closely to being an Aerosmith fan."
  },
  {
    slug: "black-knight-sword-of-rage-pro",
    shortDescription: "A fast, aggressive modern machine with an original non-licensed theme and intense multi-level shot demands.",
    priceTier: "$5.5k-$7.5k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 3,
    gameplayDepth: 3,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["modern", "fast", "action", "original-theme", "skill-driven", "non-licensed"],
    starterRecommendationReason: "Worth shortlisting if you want a punchy, non-licensed modern machine that rewards precise shooting.",
    cautionNote: "Less forgiving than most beginner picks — the action-heavy theme skews toward players over families."
  },
  {
    slug: "munsters-pro",
    shortDescription: "A charming, approachable modern machine with a classic TV personality and simple rules that welcome all skill levels.",
    priceTier: "$5.5k-$7.5k",
    beginnerFriendly: 4,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["tv-theme", "humor", "approachable", "family", "modern", "easy-rules"],
    starterRecommendationReason: "A good shortlist option if you want a modern machine that feels light, charming, and easy to share.",
    cautionNote: "Rules are lighter than most modern Sterns — deeper gameplay seekers may want something denser."
  },
  {
    slug: "led-zeppelin-pro",
    shortDescription: "Outstanding audio, deeper-than-average rules, and collector-quality presentation — built for fans who want to go deep.",
    priceTier: "$6k-$8k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 4,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["music", "modern", "depth", "band-theme", "collector", "enthusiast-pick"],
    starterRecommendationReason: "A strong shortlist pick for music fans who want meaningful depth and genuinely phenomenal sound design.",
    cautionNote: "Theme strength depends heavily on being a Led Zeppelin fan."
  },
  {
    slug: "rush-pro",
    shortDescription: "Deep rules, progressive rock energy, and a machine built for players who want to keep uncovering layers.",
    priceTier: "$6.5k-$8.5k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 4,
    gameplayDepth: 4,
    broadAppeal: 3,
    maintenanceComplexity: 3,
    tags: ["music", "modern", "deep-rules", "band-theme", "progressive", "enthusiast-pick"],
    starterRecommendationReason: "Worth shortlisting if you want a modern music machine with serious rule depth and strong long-term replay ceiling.",
    cautionNote: "The rule density can feel overwhelming early on and the theme is a narrower fit."
  },
  {
    slug: "spider-man-vault",
    shortDescription: "Extremely common, easy to love, and one of the most findable used machines — great gateway pin.",
    priceTier: "$4.5k-$6.5k",
    beginnerFriendly: 5,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 2,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["comic", "accessible", "family", "bar-staple", "used-market", "broad-appeal"],
    starterRecommendationReason: "A solid first-pin shortlist pick if you want something broadly loved and easy to find at a practical price.",
    cautionNote: "Location-worn examples are very common — thorough inspection is essential before buying."
  },
  {
    slug: "ghostbusters-pro",
    shortDescription: "An incredible theme with deep rules, but notoriously finicky hardware that demands patient, hands-on ownership.",
    priceTier: "$5.5k-$8k",
    beginnerFriendly: 3,
    resaleStrength: 4,
    themeStrength: 5,
    gameplayDepth: 4,
    broadAppeal: 4,
    maintenanceComplexity: 5,
    tags: ["movie-theme", "used-market", "deep-rules", "high-maintenance", "theme-first", "finicky"],
    starterRecommendationReason: "Only shortlist if you love the theme and are genuinely comfortable being hands-on with maintenance — it rewards dedicated owners.",
    cautionNote: "Widely considered one of the most maintenance-intensive machines ever made. Budget significant time and money for upkeep."
  },
  {
    slug: "batman-dark-knight",
    shortDescription: "A common, affordable Nolan-era Batman with accessible rules and very strong findability at entry-level prices.",
    priceTier: "$3k-$5k",
    beginnerFriendly: 4,
    resaleStrength: 3,
    themeStrength: 4,
    gameplayDepth: 2,
    broadAppeal: 4,
    maintenanceComplexity: 3,
    tags: ["budget", "movie-theme", "accessible", "bar-staple", "used-market", "entry-price"],
    starterRecommendationReason: "A practical entry-level shortlist option if budget is the top priority and you want a recognizable, easy-to-enjoy machine.",
    cautionNote: "Rules are shallow by modern standards and most examples carry heavy location mileage."
  }
];

const baseDiscoveryMachines = curatedConfigs.map((config) => {
  const base = machineIndex.get(config.slug);
  const videoProfile = base ? buildVideoProfile(base) : null;

  if (!base) {
    throw new Error(`Missing machine data for discovery slug: ${config.slug}`);
  }

  const media = machineMediaIndex.get(config.slug) || null;
  const recommendationSignals = buildRecommendationSignals(base, config);
  const flowScore = flowScoreFromTags(config.tags);
  const findabilityScore = findabilityScoreFor(base, config);

  return {
    ...base,
    id: config.slug,
    title: base.name,
    machineType: machineTypeLabel(base),
    imageUrl: media?.primaryImageUrl || "",
    imageSource: media?.imageSource || "Machine media library",
    era_category: base.era,
    beginner_summary: config.shortDescription,
    shortDescription: config.shortDescription,
    priceTier: config.priceTier,
    budget_band: config.priceTier,
    priceRange: {
      min: base.estimated_price_min,
      max: base.estimated_price_max
    },
    why_people_like_it: [
      base.why_like_it,
      config.starterRecommendationReason
    ],
    what_to_know: [
      base.considerations,
      `Typical shopping band: ${config.priceTier}.`
    ],
    what_to_know_before_buying: [
      base.considerations,
      `Typical shopping band: ${config.priceTier}.`
    ],
    fit_tags: config.tags.slice(0, 4),
    play_experience_summary: `${config.shortDescription} ${base.best_for}`,
    beginnerFriendly: config.beginnerFriendly,
    beginner_friendliness: config.beginnerFriendly,
    beginner_friendliness_score: config.beginnerFriendly,
    resaleStrength: config.resaleStrength,
    themeStrength: config.themeStrength,
    gameplayDepth: config.gameplayDepth,
    complexity: base.rules_complexity,
    rules_depth_score: base.rules_complexity,
    flow_score: flowScore,
    chaos_score: Math.round(recommendationSignals.chaotic_multiball_heavy * 5),
    strategy_score: config.gameplayDepth,
    theme_integration_score: config.themeStrength,
    familyFriendly: config.broadAppeal,
    broadAppeal: config.broadAppeal,
    family_friendliness_score: config.broadAppeal,
    maintenanceComplexity: config.maintenanceComplexity,
    intensity_score: Math.max(2, Math.round(((flowScore / 5) + recommendationSignals.chaotic_multiball_heavy) * 2.5)),
    forgiveness_score: config.beginnerFriendly,
    new_or_used_availability: availabilityLabel(base.condition_availability),
    findabilityScore,
    rarityLabel: rarityLabelFor(findabilityScore),
    validationDifficulty: validationDifficultyFor(findabilityScore),
    energy_style_tags: config.tags,
    style_tags: config.tags,
    likely_fit_tags: config.tags.slice(0, 4),
    tags: config.tags,
    starterRecommendationReason: config.starterRecommendationReason,
    cautionNote: config.cautionNote,
    overview_video_url: videoProfile.overview.url,
    overview_video_label: videoProfile.overview.label,
    gameplay_video_url: videoProfile.gameplay.url,
    gameplay_video_label: videoProfile.gameplay.label,
    recommendedVideos: videoProfile?.recommendedVideos || [],
    externalLinks: {
      pinside: buildPinsideMachineUrl(base),
      pinsideMarket: buildPinsideMarketUrl(base),
      pinsidePricing: buildPinsidePricingUrl(base),
      ipdb: searchLink("https://www.ipdb.org/search.pl?any=", base.name)
    },
    recommendation_signals: recommendationSignals,
    recommendation_weights: recommendationSignals
  };
});

function proxySimilarity(machine, candidate) {
  if (machine.id === candidate.id) return -1;

  const sharedTags = machine.style_tags.filter((tag) => candidate.style_tags.includes(tag)).length;
  const flowGap = 5 - Math.abs(machine.flow_score - candidate.flow_score);
  const depthGap = 5 - Math.abs(machine.rules_depth_score - candidate.rules_depth_score);
  const themeGap = 5 - Math.abs(machine.theme_integration_score - candidate.theme_integration_score);

  return sharedTags * 2 + flowGap + depthGap + themeGap;
}

export const discoveryMachines = baseDiscoveryMachines.map((machine) => ({
  ...machine,
  proxy_machine_ids: baseDiscoveryMachines
    .filter((candidate) => candidate.id !== machine.id)
    .sort((a, b) => proxySimilarity(machine, b) - proxySimilarity(machine, a))
    .slice(0, 3)
    .map((candidate) => candidate.id)
}));

export const discoveryMachineIndex = indexBy(discoveryMachines, "id");
