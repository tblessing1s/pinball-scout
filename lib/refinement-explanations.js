import { buildEvidenceModel, labelTraitList } from "./refinement-evidence.js";

export function buildTasteInsightLines(reactions = [], refinementSignals = []) {
  const evidence = buildEvidenceModel(reactions, refinementSignals);
  const positives = labelTraitList(evidence.strongPositives);
  const negatives = labelTraitList(evidence.strongNegatives);
  const conflicts = labelTraitList(evidence.conflicts);
  const lines = [];

  if (positives.length) {
    const readable = positives.slice(0, 2).join(" and ");
    lines.push(`You seem to prefer games that feel ${readable.toLowerCase()}.`);
  }

  if (negatives.length) {
    const readable = negatives.slice(0, 2).join(" and ");
    lines.push(`You seem less excited by ${readable.toLowerCase()} so far.`);
  }

  if (conflicts.length) {
    const readable = conflicts.slice(0, 2).join(" and ");
    lines.push(`Some feedback is mixed on ${readable.toLowerCase()}.`);
  }

  if (!lines.length) {
    lines.push("Your feedback is still early, but we are starting to see a direction.");
  }

  return lines;
}
