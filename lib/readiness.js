import { recommendationConfidence } from "./discovery-engine.js";

const BAND = {
  STRONG: "Strong",
  MODERATE: "Moderate",
  LOWER: "Lower"
};

const bandMemory = new Map();

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function baseBand(score) {
  if (score >= 0.67) return BAND.STRONG;
  if (score >= 0.4) return BAND.MODERATE;
  return BAND.LOWER;
}

function stableBand(key, score) {
  const previous = bandMemory.get(key);
  if (!previous) {
    const next = baseBand(score);
    bandMemory.set(key, next);
    return next;
  }

  let next = previous;
  if (previous === BAND.STRONG && score < 0.58) next = baseBand(score);
  if (previous === BAND.MODERATE && (score >= 0.74 || score <= 0.32)) next = baseBand(score);
  if (previous === BAND.LOWER && score >= 0.46) next = baseBand(score);

  bandMemory.set(key, next);
  return next;
}

function action(target, label, blockerId = "") {
  return { target, label, blockerId };
}

function toneFromBand(band) {
  if (band === BAND.STRONG) return "strong";
  if (band === BAND.MODERATE) return "moderate";
  return "lower";
}

function tasteSignal({ machineSlug, reactions = [], recommendations = [], context = {} }) {
  const uniqueReactions = new Set(reactions.map((reaction) => reaction.machineId)).size;
  const confidence = recommendationConfidence(context, reactions, recommendations);
  const topGap = (recommendations[0]?.recommendationScore || 0) - (recommendations[1]?.recommendationScore || 0);
  const reactionScore = uniqueReactions >= 6 ? 1 : uniqueReactions >= 4 ? 0.75 : uniqueReactions >= 2 ? 0.48 : 0.22;
  const gapScore = topGap >= 2 ? 1 : topGap >= 1 ? 0.7 : topGap >= 0.4 ? 0.45 : 0.25;
  const confidenceScore = confidence.level === "high" ? 1 : confidence.level === "medium" ? 0.65 : 0.35;
  const score = clamp01((reactionScore * 0.45) + (gapScore * 0.3) + (confidenceScore * 0.25));
  const band = stableBand(`${machineSlug}:taste`, score);

  let description = "Your preference direction is clear enough to keep moving.";
  if (band === BAND.MODERATE) description = "You have a useful preference direction, but one more signal helps confirm it.";
  if (band === BAND.LOWER) description = "Your taste signal is still early. Add one more round before finalizing.";

  let nextAction = null;
  if (uniqueReactions < 5) {
    nextAction = action("reactions", "Add one more reaction round");
  } else if (topGap < 1) {
    nextAction = action("nearby", "Log one real-world play");
  }

  return {
    id: "taste",
    title: "Taste Signal",
    band,
    tone: toneFromBand(band),
    description,
    nextAction
  };
}

function practicalSignal({ machineSlug, context = {}, pathType = "still-deciding" }) {
  const coreRequired = ["budget", "condition", "timeline", "playAccess", "travelWillingness"];
  const coreComplete = coreRequired.filter((key) => Boolean(context[key])).length;
  const coreScore = coreComplete / coreRequired.length;
  const pathScore = pathType === "used" || pathType === "new" ? 1 : 0.35;
  const zip = String(context.zip || "").trim();
  const zipNeeded = context.playAccess === "very-little" || context.playAccess === "none" || context.travelWillingness === "local-only";
  const zipScore = zip.length === 5 ? 1 : zipNeeded ? 0.25 : 0.7;
  const score = clamp01((coreScore * 0.5) + (pathScore * 0.3) + (zipScore * 0.2));
  const band = stableBand(`${machineSlug}:practical`, score);

  let description = "Your practical constraints are complete enough for a confident decision flow.";
  if (band === BAND.MODERATE) description = "Your practical setup is mostly complete, with one detail still worth confirming.";
  if (band === BAND.LOWER) description = "Complete practical basics first so recommendations stay realistic.";

  let nextAction = null;
  if (pathType === "still-deciding") {
    nextAction = action("path-step", "Choose buy path");
  } else if (zipNeeded && zip.length !== 5) {
    nextAction = action("nearby", "Add ZIP for local validation");
  } else if (coreComplete < coreRequired.length) {
    nextAction = action("practical-setup", "Review practical basics");
  }

  return {
    id: "practical",
    title: "Practical Signal",
    band,
    tone: toneFromBand(band),
    description,
    nextAction
  };
}

function validationSignal({
  machineSlug,
  pathType = "still-deciding",
  reactions = [],
  requiredCheckProgress = { total: 0, completeCount: 0, blockedCount: 0, statusById: {} },
  firstUnresolvedBlockerId = ""
}) {
  const total = requiredCheckProgress.total || 0;
  const complete = requiredCheckProgress.completeCount || 0;
  const blockerRatio = total ? complete / total : 0;
  const realPlayCount = reactions.filter((reaction) => String(reaction.source || "").startsWith("real-play")).length;
  const realPlayScore = realPlayCount >= 1 ? 1 : 0.35;
  let score = clamp01((blockerRatio * 0.75) + (realPlayScore * 0.25));
  if (pathType === "still-deciding") score = Math.min(score, 0.3);
  const band = stableBand(`${machineSlug}:validation`, score);

  let description = total
    ? `${complete}/${total} required checks are complete.`
    : "Choose your buy path to activate required checks.";
  if (band === BAND.MODERATE && total) description = `${complete}/${total} required checks are complete. Finish remaining validation items.`;
  if (band === BAND.LOWER && total) description = "Validation is still early. Required checks need more completion.";

  let nextAction = null;
  if (pathType === "still-deciding") {
    nextAction = action("path-step", "Choose buy path");
  } else if ((requiredCheckProgress.blockedCount || 0) > 0) {
    nextAction = action("required-checks", "Complete required checks", firstUnresolvedBlockerId);
  } else if (realPlayCount < 1) {
    nextAction = action("nearby", "Log one real-world play");
  }

  return {
    id: "validation",
    title: "Validation Signal",
    band,
    tone: toneFromBand(band),
    description,
    nextAction
  };
}

export function buildReadinessModel({
  machine,
  context = {},
  reactions = [],
  recommendations = [],
  pathType = "still-deciding",
  requiredCheckProgress,
  overallReadiness,
  firstUnresolvedBlockerId = ""
} = {}) {
  const machineSlug = machine?.slug || "unknown";
  const cards = [
    tasteSignal({ machineSlug, reactions, recommendations, context }),
    practicalSignal({ machineSlug, context, pathType }),
    validationSignal({ machineSlug, pathType, reactions, requiredCheckProgress, firstUnresolvedBlockerId })
  ];

  const summaryText = overallReadiness?.label === "Near-ready, blocked"
    ? `Near-ready, blocked: ${requiredCheckProgress?.blockedCount || 0} required check${(requiredCheckProgress?.blockedCount || 0) === 1 ? "" : "s"} remaining.`
    : overallReadiness?.label === "Ready to proceed"
      ? "Ready to proceed based on required checks. Continue with normal ownership-risk review."
      : overallReadiness?.label === "Near-ready"
        ? "Near-ready: required checks are complete; finish final review steps."
        : "Not ready: complete missing practical setup and validation signals first.";

  return {
    cards,
    overallState: overallReadiness,
    summaryText
  };
}
