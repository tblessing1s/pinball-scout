import { machines } from "./machines.js";
import { machineMediaIndex } from "./machine-media.generated.js";
import { buildPinsideMachineUrl, buildPinsideMarketUrl, buildPinsidePricingUrl } from "../lib/services/pinside-market.js";
import { machineVideoOverrideIndex } from "./machine-video-overrides.js";
import { indexBy } from "../lib/collection-utils.js";
import { searchLink, youtubeSearchUrl } from "../lib/url-utils.js";
import { TRAIT_KEYS } from "./refinement-model.js";

const machineIndex = indexBy(machines, "slug");

const manualTraitOverrides = {
  "godzilla-pro": { wow_factor: 5, rules_depth: 5, theme_integration: 5 },
  "deadpool-pro": { beginner_friendly: 5, shot_satisfaction: 4, replayability: 4 },
  "jurassic-park-pro": { rules_depth: 5, beginner_friendly: 3, shot_satisfaction: 5 },
  "foo-fighters-pro": { pace: 4, shot_satisfaction: 4, beginner_friendly: 4 },
  "iron-maiden-pro": { pace: 5, shot_satisfaction: 5, beginner_friendly: 3 },
  "avengers-infinity-quest-pro": { rules_depth: 5, beginner_friendly: 3, replayability: 5 },
  "attack-from-mars-remake": { beginner_friendly: 5, rules_depth: 2, replayability: 4 },
  "medieval-madness-remake": { beginner_friendly: 5, theme_integration: 5, replayability: 4 },
  "fish-tales": { beginner_friendly: 4, rules_depth: 1, replayability: 3 },
  "funhouse": { theme_integration: 4, beginner_friendly: 4, replayability: 3 }
};

const manualProxyOverrides = {
  "godzilla-pro": ["foo-fighters-pro", "jurassic-park-pro"],
  "jurassic-park-pro": ["godzilla-pro", "avengers-infinity-quest-pro"],
  "deadpool-pro": ["foo-fighters-pro", "attack-from-mars-remake"],
  "iron-maiden-pro": ["foo-fighters-pro", "jurassic-park-pro"],
  "attack-from-mars-remake": ["medieval-madness-remake", "deadpool-pro"],
  "medieval-madness-remake": ["attack-from-mars-remake", "deadpool-pro"]
};

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

function clampScore(value, min = 1, max = 5) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function buildTraitProfile(base, config, recommendationSignals, flowScore) {
  const pace = clampScore(flowScore);
  const shotSatisfaction = clampScore(
    config.tags.includes("shot-driven") ? 5 : config.tags.includes("flow") ? 4 : 3
  );
  const rulesDepth = clampScore(base.rules_complexity || config.gameplayDepth);
  const themeIntegration = clampScore(config.themeStrength);
  const chaosLevel = clampScore(recommendationSignals.chaotic_multiball_heavy * 5);
  const beginnerFriendly = clampScore(config.beginnerFriendly);
  const replayability = clampScore((config.gameplayDepth + flowScore) / 2);
  const wowFactor = clampScore(
    config.tags.includes("spectacle") || config.tags.includes("showpiece")
      ? 5
      : (config.themeStrength + config.gameplayDepth) / 2
  );

  const baseProfile = {
    pace,
    shot_satisfaction: shotSatisfaction,
    rules_depth: rulesDepth,
    theme_integration: themeIntegration,
    chaos_level: chaosLevel,
    beginner_friendly: beginnerFriendly,
    replayability,
    wow_factor: wowFactor
  };

  if (config.traitBoosts && typeof config.traitBoosts === "object") {
    Object.entries(config.traitBoosts).forEach(([key, value]) => {
      if (!(key in baseProfile)) return;
      baseProfile[key] = clampScore(baseProfile[key] + Number(value || 0));
    });
  }

  const manualOverrides = manualTraitOverrides[config.slug] || null;
  if (manualOverrides) {
    Object.entries(manualOverrides).forEach(([key, value]) => {
      if (!(key in baseProfile)) return;
      baseProfile[key] = clampScore(value);
    });
  }

  return baseProfile;
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
  const traitProfile = buildTraitProfile(base, config, recommendationSignals, flowScore);

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
    trait_profile: traitProfile,
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
  const traitSimilarity = TRAIT_KEYS.reduce((acc, key) => {
    const aValue = machine.trait_profile?.[key];
    const bValue = candidate.trait_profile?.[key];
    if (!Number.isFinite(aValue) || !Number.isFinite(bValue)) return acc;
    return acc + (5 - Math.abs(aValue - bValue));
  }, 0);

  return sharedTags * 1.6 + traitSimilarity;
}

export const discoveryMachines = baseDiscoveryMachines.map((machine) => ({
  ...machine,
  proxy_machine_ids: [
    ...((manualProxyOverrides[machine.slug] || []).filter(Boolean)),
    ...baseDiscoveryMachines
    .filter((candidate) => candidate.id !== machine.id)
    .sort((a, b) => proxySimilarity(machine, b) - proxySimilarity(machine, a))
    .slice(0, 6)
    .map((candidate) => candidate.id)
  ]
    .filter((id, index, list) => list.indexOf(id) === index && id !== machine.id)
    .slice(0, 3)
}));

export const discoveryMachineIndex = indexBy(discoveryMachines, "id");
