import { buildMachineTitleVariants, createMachineRecord, normalizeMachineTitle } from "../../domain/machine.js";

export function scoreCandidateMatch(machineInput, candidateInput) {
  const machine = createMachineRecord(machineInput);
  const candidate = createMachineRecord(candidateInput);
  const machineVariants = new Set(buildMachineTitleVariants(machine));
  const candidateVariants = new Set(buildMachineTitleVariants(candidate));
  const machineNormalized = normalizeMachineTitle(machine.title);
  const candidateNormalized = normalizeMachineTitle(candidate.title);

  let score = 0;

  if (machine.title === candidate.title) score += 100;
  if (machineNormalized && machineNormalized === candidateNormalized) score += 70;

  for (const variant of machineVariants) {
    if (candidateVariants.has(variant)) {
      score += 40;
      break;
    }
  }

  if (machine.manufacturer && candidate.manufacturer && machine.manufacturer.toLowerCase() === candidate.manufacturer.toLowerCase()) {
    score += 15;
  }

  if (machine.year && candidate.year) {
    const gap = Math.abs(Number(machine.year) - Number(candidate.year));
    if (gap === 0) score += 20;
    else if (gap === 1) score += 8;
    else if (gap > 2) score -= 12;
  }

  if (machineNormalized && candidateNormalized && (machineNormalized.includes(candidateNormalized) || candidateNormalized.includes(machineNormalized))) {
    score += 10;
  }

  return score;
}

export function sortCandidateMatches(candidates = []) {
  return [...candidates].sort((left, right) => {
    if ((right.matchScore || 0) !== (left.matchScore || 0)) {
      return (right.matchScore || 0) - (left.matchScore || 0);
    }

    return (left.sourcePriority || 999) - (right.sourcePriority || 999);
  });
}

export function chooseBestCandidate(candidates = []) {
  const sorted = sortCandidateMatches(candidates);
  return {
    best: sorted[0] || null,
    alternatives: sorted.slice(1)
  };
}

export function isAmbiguousMatch(best, alternatives = []) {
  if (!best || !alternatives.length) return false;
  return Math.abs((best.matchScore || 0) - (alternatives[0].matchScore || 0)) <= 5;
}
