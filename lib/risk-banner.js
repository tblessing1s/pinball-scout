import { shouldApplyRemoteOverlay } from "./required-checks.js";

const TIE_BREAK_ORDER = ["logistics", "ownership", "liquidity", "price"];

function riskScore(risk) {
  return (risk.severity || 0) * (risk.confidence || 0) * (risk.impact || 0);
}

function tieOrder(type = "") {
  const index = TIE_BREAK_ORDER.indexOf(type);
  return index === -1 ? 99 : index;
}

function rangeWidthRatio(machine = {}) {
  const min = Number(machine?.estimated_price_min || machine?.priceRange?.min || 0);
  const max = Number(machine?.estimated_price_max || machine?.priceRange?.max || 0);
  if (!min || !max || max <= min) return 0;
  return (max - min) / max;
}

function logisticsRisk(context = {}, pathType = "") {
  if (!pathType || pathType === "still-deciding" || !shouldApplyRemoteOverlay(context)) return null;
  return {
    type: "logistics",
    title: "Ready to proceed, with higher delivery risk.",
    body: "Required checks are complete, but shipping and handoff risk remain higher than local purchase paths.",
    ctaLabel: "Recheck shipping terms",
    ctaId: "recheck_shipping_terms",
    ctaTarget: "required-checks",
    severity: 0.92,
    confidence: 0.82,
    impact: 0.94
  };
}

function ownershipRisk(machine = {}) {
  const complexity = Number(machine.maintenanceComplexity || 0);
  if (complexity < 3.5) return null;
  return {
    type: "ownership",
    title: "Ready to proceed, with higher ownership effort.",
    body: "Required checks are complete, but this machine may need more upkeep than typical first-time buys.",
    ctaLabel: "Review upkeep expectations",
    ctaId: "review_upkeep",
    ctaTarget: "fit-risk-step",
    severity: complexity >= 4.5 ? 0.9 : 0.65,
    confidence: 0.78,
    impact: 0.84
  };
}

function liquidityRisk(machine = {}) {
  const resale = Number(machine.resaleStrength || 0);
  const appeal = Number(machine.broadAppeal || 0);
  if (resale > 3 && appeal > 3) return null;
  return {
    type: "liquidity",
    title: "Ready to proceed, with higher regret risk.",
    body: "Required checks are complete, but resale demand may be narrower than your backup option.",
    ctaLabel: "Review backup once",
    ctaId: "review_backup_once",
    ctaTarget: "working-pick-step",
    severity: resale <= 2 ? 0.9 : 0.68,
    confidence: 0.72,
    impact: 0.82
  };
}

function priceRisk(machine = {}) {
  const widthRatio = rangeWidthRatio(machine);
  const rarity = String(machine.rarityLabel || "");
  const rarityPenalty = rarity === "Harder to find" ? 0.22 : rarity === "Uncommon" ? 0.1 : 0;
  const signal = widthRatio + rarityPenalty;
  if (signal < 0.26) return null;

  return {
    type: "price",
    title: "Ready to proceed, with higher price uncertainty.",
    body: "Required checks are complete, but current pricing is less stable than comparable options.",
    ctaLabel: "Re-verify current price",
    ctaId: "reverify_price",
    ctaTarget: "required-checks",
    severity: signal >= 0.45 ? 0.8 : 0.62,
    confidence: 0.7,
    impact: 0.76
  };
}

export function buildRiskBannerModel({
  machine,
  context = {},
  pathType = "",
  overallReadinessLabel = "",
  blockedCount = 0
} = {}) {
  const canShow = (overallReadinessLabel === "Ready to proceed" || overallReadinessLabel === "Near-ready") && blockedCount === 0;
  if (!machine || !canShow) {
    return {
      primary: null,
      secondary: []
    };
  }

  const active = [
    logisticsRisk(context, pathType),
    ownershipRisk(machine),
    liquidityRisk(machine),
    priceRisk(machine)
  ].filter(Boolean);

  if (!active.length) {
    return {
      primary: null,
      secondary: []
    };
  }

  const sorted = [...active].sort((left, right) => {
    const scoreDelta = riskScore(right) - riskScore(left);
    if (Math.abs(scoreDelta) > 0.01) return scoreDelta;
    return tieOrder(left.type) - tieOrder(right.type);
  });

  return {
    primary: sorted[0],
    secondary: sorted.slice(1, 2),
    totalActive: sorted.length
  };
}
