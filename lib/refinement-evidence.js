import { TRAIT_KEYS, traitLabelMap } from "../data/refinement-model.js";
import { buildTraitSignalsFromReactionEntry, experienceWeightFor } from "./refinement-helpers.js";

function entryWeight(entry = {}) {
  return (entry.weight || 1) * experienceWeightFor(entry.experienceType);
}

export function buildEvidenceModel(reactions = [], refinementSignals = []) {
  const entries = [...reactions, ...refinementSignals].map((entry) => {
    const weight = entryWeight(entry);
    const traitSignals = {
      ...buildTraitSignalsFromReactionEntry(entry),
      ...(entry.traitSignals || {})
    };
    return {
      reaction: entry.reaction || "not-sure",
      experienceType: entry.experienceType || "preview",
      weight,
      traitSignals
    };
  });

  const totals = Object.fromEntries(TRAIT_KEYS.map((key) => [key, { pos: 0, neg: 0, net: 0 }]));
  const counts = { played: 0, video: 0, external: 0, preview: 0 };

  entries.forEach((entry) => {
    counts[entry.experienceType] = (counts[entry.experienceType] || 0) + 1;
    Object.entries(entry.traitSignals || {}).forEach(([key, value]) => {
      if (!(key in totals)) return;
      const delta = Number(value || 0) * entry.weight;
      totals[key].net += delta;
      if (delta >= 0) totals[key].pos += delta;
      else totals[key].neg += Math.abs(delta);
    });
  });

  const conflicts = Object.entries(totals)
    .filter(([, value]) => value.pos >= 0.9 && value.neg >= 0.9)
    .map(([key]) => key);

  const strongPositives = Object.entries(totals)
    .filter(([, value]) => value.net >= 1.2)
    .sort((a, b) => b[1].net - a[1].net)
    .slice(0, 3)
    .map(([key]) => key);

  const strongNegatives = Object.entries(totals)
    .filter(([, value]) => value.net <= -1.2)
    .sort((a, b) => a[1].net - b[1].net)
    .slice(0, 3)
    .map(([key]) => key);

  return {
    entries,
    totals,
    counts,
    conflicts,
    strongPositives,
    strongNegatives
  };
}

export function mismatchSignalsFor(machine, evidenceModel) {
  if (!machine || !evidenceModel) return [];
  const labelMap = traitLabelMap();
  return evidenceModel.strongNegatives
    .filter((key) => (machine.trait_profile?.[key] || 0) >= 4)
    .map((key) => labelMap[key] || key)
    .slice(0, 2);
}

export function labelTraitList(keys = []) {
  const labelMap = traitLabelMap();
  return keys.map((key) => labelMap[key] || key);
}
