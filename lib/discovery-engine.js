import { discoveryMachineIndex, discoveryMachines } from "../data/discovery-machines.js";

const positiveAttributes = ["beginnerFriendly", "resaleStrength", "themeStrength", "gameplayDepth", "broadAppeal"];
const signalKeys = [
  "fast_flowy",
  "strategic_deeper_rules",
  "beginner_friendly",
  "theme_first",
  "family_friendly",
  "chaotic_multiball_heavy",
  "classic_straightforward",
  "modern_immersive"
];

function attributeSignal(machine, key) {
  if (key === "maintenanceComplexity") {
    return (3 - machine[key]) / 2;
  }

  return (machine[key] - 3) / 2;
}

function reactionFactor(reaction) {
  if (reaction === "looks-fun") return 2;
  if (reaction === "not-for-me") return -1.6;
  return 0.35;
}

function reactionWeight(reactionEntry) {
  return reactionEntry.weight || 1;
}

function applyExtraSignalHints(profile, reactionEntry) {
  const { likedAspect, concern, replay } = reactionEntry;

  if (likedAspect === "theme") profile.signalWeights.theme_first += 1.4;
  if (likedAspect === "shots") profile.signalWeights.fast_flowy += 1.2;
  if (likedAspect === "speed") profile.signalWeights.fast_flowy += 1.5;
  if (likedAspect === "depth") profile.signalWeights.strategic_deeper_rules += 1.5;
  if (likedAspect === "spectacle") profile.signalWeights.chaotic_multiball_heavy += 1.3;

  if (concern === "too-fast") profile.signalWeights.fast_flowy -= 1.1;
  if (concern === "too-slow") profile.signalWeights.fast_flowy += 0.5;
  if (concern === "too-complex") profile.signalWeights.strategic_deeper_rules -= 1.2;
  if (concern === "too-simple") profile.signalWeights.strategic_deeper_rules += 1;
  if (concern === "too-chaotic") profile.signalWeights.chaotic_multiball_heavy -= 1.5;
  if (concern === "just-right") profile.signalWeights.beginner_friendly += 0.8;

  if (replay === "yes") {
    profile.signalWeights.fast_flowy += 0.5;
    profile.signalWeights.strategic_deeper_rules += 0.5;
  }

  if (replay === "no") {
    profile.signalWeights.beginner_friendly -= 0.2;
  }
}

function matchesBudget(machine, budget) {
  const avgPrice = (machine.priceRange.min + machine.priceRange.max) / 2;

  if (budget === "under7000") return avgPrice <= 7200;
  if (budget === "7000to9000") return avgPrice >= 6500 && avgPrice <= 9300;
  if (budget === "9000to12000") return avgPrice >= 8500 && avgPrice <= 12000;
  return true;
}

function matchesCondition(machine, condition) {
  if (!condition || condition === "either") return true;
  if (condition === "new") return machine.new_or_used_availability === "New" || machine.new_or_used_availability === "Either";
  if (condition === "used") return machine.new_or_used_availability === "Used" || machine.new_or_used_availability === "Either";
  return true;
}

function baseContextScore(machine, context) {
  let score = 0;

  score += machine.beginnerFriendly * 1.8;
  score += machine.broadAppeal * 1.3;
  score += machine.resaleStrength * 1.4;
  score += machine.themeStrength * 0.9;
  score += machine.gameplayDepth * 0.8;
  score -= machine.maintenanceComplexity * 0.9;

  if (context.firstPin !== "no") {
    score += machine.beginnerFriendly * 0.9;
    score += machine.resaleStrength * 0.6;
  }

  if (context.playAccess === "very-little") {
    score += machine.beginnerFriendly * 1.2;
    score += machine.resaleStrength * 1.1;
    score += machine.broadAppeal * 0.8;
  }

  if (context.playAccess === "lots") {
    score += machine.gameplayDepth * 0.8;
    score += machine.themeStrength * 0.4;
  }

  if (context.buyingStyle === "safe") {
    score += machine.resaleStrength * 1.5;
    score += machine.broadAppeal * 1.1;
  }

  if (context.buyingStyle === "specific") {
    score += machine.themeStrength * 1.1;
    score += machine.gameplayDepth * 0.9;
  }

  if (context.condition === "new" && machine.new_or_used_availability === "Used") {
    score -= 4;
  }

  if (context.condition === "used" && machine.new_or_used_availability === "New") {
    score -= 4;
  }

  return score;
}

function emptyProfile() {
  return {
    machineScores: {},
    attributeWeights: {
      beginnerFriendly: 0,
      resaleStrength: 0,
      themeStrength: 0,
      gameplayDepth: 0,
      broadAppeal: 0,
      maintenanceComplexity: 0
    },
    signalWeights: Object.fromEntries(signalKeys.map((key) => [key, 0])),
    tagWeights: {}
  };
}

function buildProfile(reactions) {
  const profile = emptyProfile();

  reactions.forEach((reactionEntry) => {
    const { machineId, reaction } = reactionEntry;
    const machine = discoveryMachineIndex.get(machineId);
    if (!machine) return;

    const factor = reactionFactor(reaction) * reactionWeight(reactionEntry);
    profile.machineScores[machineId] = (profile.machineScores[machineId] || 0) + (reaction === "looks-fun" ? 4 : reaction === "not-for-me" ? -4 : 0.6) * reactionWeight(reactionEntry);

    [...positiveAttributes, "maintenanceComplexity"].forEach((key) => {
      profile.attributeWeights[key] += factor * attributeSignal(machine, key);
    });

    signalKeys.forEach((key) => {
      profile.signalWeights[key] += factor * (machine.recommendation_signals[key] || 0);
    });

    machine.tags.forEach((tag) => {
      profile.tagWeights[tag] = (profile.tagWeights[tag] || 0) + factor;
    });

    applyExtraSignalHints(profile, reactionEntry);
  });

  return profile;
}

function profileScore(machine, profile) {
  let score = profile.machineScores[machine.id] || 0;

  [...positiveAttributes, "maintenanceComplexity"].forEach((key) => {
    score += profile.attributeWeights[key] * attributeSignal(machine, key) * 1.2;
  });

  signalKeys.forEach((key) => {
    score += profile.signalWeights[key] * (machine.recommendation_signals[key] || 0) * 1.1;
  });

  machine.tags.forEach((tag) => {
    score += (profile.tagWeights[tag] || 0) * 0.8;
  });

  return score;
}

function shortlistReason(machine, context, reactions) {
  const directReaction = reactions.find((item) => item.machineId === machine.id && item.reaction === "looks-fun");
  const reasons = [];

  if (directReaction) reasons.push("You reacted positively to this one directly.");
  if (context.playAccess === "very-little" && machine.beginnerFriendly >= 4) reasons.push("It is an easier first buy to feel good about when you cannot play a lot locally.");
  if (context.buyingStyle === "safe" && machine.resaleStrength >= 4) reasons.push("It is one of the safer shortlist options if you care about resale strength and demand.");
  if (context.buyingStyle === "specific" && machine.themeStrength >= 4) reasons.push("It has enough personality to feel like a deliberate taste pick, not just the safest answer.");
  if (machine.broadAppeal >= 4) reasons.push("It tends to work well as a first home machine because newer players click with it quickly.");
  if (machine.gameplayDepth >= 4 && context.playAccess !== "very-little") reasons.push("It has enough depth to stay rewarding after the first few months of ownership.");
  reasons.push(machine.starterRecommendationReason);

  return [...new Set(reasons)].slice(0, 3);
}

function confidenceBlurb(machine, context) {
  if (context.playAccess === "very-little" && machine.resaleStrength >= 4) {
    return "This is the kind of shortlist candidate that helps reduce regret when you cannot test a lot in person.";
  }

  if (machine.beginnerFriendly >= 5 && machine.broadAppeal >= 4) {
    return "This is a strong confidence-building first shortlist pick because it is easy to understand and easy to share.";
  }

  if (machine.gameplayDepth >= 4) {
    return "This is a good confidence pick if you want room to grow into the machine instead of outgrowing it quickly.";
  }

  return "This is a credible first-machine shortlist option, not just a random database suggestion.";
}

function nearestLocationSummary(machine, machineLocationIndex = new Map()) {
  const nearbyLocations = machineLocationIndex.get(machine.id) || [];

  return {
    nearbyLocations,
    nearestLocation: nearbyLocations[0] || null,
    nearestDistance: nearbyLocations[0]?.distanceMiles ?? null
  };
}

function easierAlternative(machine, pool) {
  return (machine.proxy_machine_ids || [])
    .map((id) => pool.find((candidate) => candidate.id === id))
    .filter(Boolean)
    .find((candidate) => candidate.findabilityScore > machine.findabilityScore || candidate.validationDifficulty === "Easy to validate") || null;
}

function practicalScore(machine, context, machineLocationIndex = new Map()) {
  let score = 0;

  score += (machine.findabilityScore || 3) * 1.2;

  if (machine.rarityLabel === "Harder to find") score -= 1.5;
  if (machine.validationDifficulty === "Easy to validate") score += 1.2;

  const nearbyLocations = machineLocationIndex.get(machine.id) || [];
  if (nearbyLocations.length) {
    const nearestDistance = nearbyLocations[0].distanceMiles || 0;
    score += Math.max(0, 4 - nearestDistance / 20);
  } else if (context.travelWillingness === "local-only") {
    score -= 1.4;
  } else if (context.travelWillingness === "regional") {
    score -= 0.5;
  }

  return score;
}

function practicalSummary(machine, machineLocationIndex, pool) {
  const { nearbyLocations, nearestLocation, nearestDistance } = nearestLocationSummary(machine, machineLocationIndex);
  const alternative = easierAlternative(machine, pool);

  if (nearestLocation) {
    return {
      nearbyLocations,
      nearestLocation,
      nearestDistance,
      alternative,
      practicalFitSummary: `You can validate this one in person at ${nearestLocation.name}, about ${nearestDistance} miles away.`,
      validationPlan: `Try the exact machine nearby before you buy if you can.`
    };
  }

  if (machine.validationDifficulty === "Harder to validate" && alternative) {
    return {
      nearbyLocations,
      nearestLocation: null,
      nearestDistance: null,
      alternative,
      practicalFitSummary: `${machine.name} looks like a strong fit, but it may take more effort to find and test.`,
      validationPlan: `Start with ${alternative.name} as an easier-to-find proxy, then decide if the harder chase is worth it.`
    };
  }

  if (machine.validationDifficulty === "Moderate to validate") {
    return {
      nearbyLocations,
      nearestLocation: null,
      nearestDistance: null,
      alternative,
      practicalFitSummary: `This looks practical enough for a first shortlist, but you may need to be deliberate about where you test it.`,
      validationPlan: `Use videos first, then plan one focused test trip rather than browsing aimlessly.`
    };
  }

  return {
    nearbyLocations,
    nearestLocation: null,
    nearestDistance: null,
    alternative,
    practicalFitSummary: `This is relatively realistic to find, validate, and move toward buying.`,
    validationPlan: `Use videos to confirm first impressions, then try the nearest equivalent you can reach.`
  };
}

export function buildDiscoveryPool(context) {
  const filtered = discoveryMachines.filter((machine) => matchesBudget(machine, context.budget) && matchesCondition(machine, context.condition));
  const pool = filtered.length ? filtered : discoveryMachines;

  return [...pool].sort((a, b) => baseContextScore(b, context) - baseContextScore(a, context));
}

export function buildReactionDeck(context, count = 6) {
  const pool = buildDiscoveryPool(context);
  return pool.slice(0, Math.min(count, pool.length));
}

export function recommendMachines(context, reactions, limit = 3, options = {}) {
  const pool = buildDiscoveryPool(context);
  const profile = buildProfile(reactions);
  const machineLocationIndex = options.machineLocationIndex || new Map();

  const ranked = pool
    .map((machine) => {
      const practical = practicalSummary(machine, machineLocationIndex, pool);

      return {
        ...machine,
        ...practical,
        recommendationScore: baseContextScore(machine, context) + profileScore(machine, profile) + practicalScore(machine, context, machineLocationIndex),
        whyItFits: shortlistReason(machine, context, reactions),
        confidenceBlurb: confidenceBlurb(machine, context)
      };
    })
    .filter((machine) => (profile.machineScores[machine.id] || 0) > -3.5)
    .sort((a, b) => b.recommendationScore - a.recommendationScore);

  return (ranked.length ? ranked : pool
    .map((machine) => ({
      ...machine,
      recommendationScore: baseContextScore(machine, context) + practicalScore(machine, machineLocationIndex),
      whyItFits: shortlistReason(machine, context, reactions),
      confidenceBlurb: confidenceBlurb(machine, context)
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
  ).slice(0, limit);
}
