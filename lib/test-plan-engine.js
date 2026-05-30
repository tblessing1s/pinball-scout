import { discoveryMachineIndex, discoveryMachines } from "../data/discovery-machines.js";
import { traitLabelMap } from "../data/refinement-model.js";

function probeReason(target, probe, probeType) {
  if (probeType === "exact") {
    return `If you can find ${probe.name} nearby, it is the cleanest way to validate whether this shortlist favorite really clicks in person.`;
  }

  return `${probe.name} is a proxy for ${target.name}. It can help reveal whether you like this general play style before you chase the exact title.`;
}

function revealText(target, probe) {
  const notes = [];
  const labelMap = traitLabelMap();
  const traitProfile = probe.trait_profile || {};

  if ((traitProfile.pace || 0) >= 4) notes.push(`whether you enjoy ${labelMap.pace?.toLowerCase() || "faster play"}`);
  if ((traitProfile.rules_depth || 0) >= 4) notes.push(`whether ${labelMap.rules_depth?.toLowerCase() || "deeper progression"} keeps you engaged`);
  if ((traitProfile.chaos_level || 0) >= 4) notes.push(`whether ${labelMap.chaos_level?.toLowerCase() || "more chaos"} feels fun`);
  if ((traitProfile.beginner_friendly || 0) >= 4) notes.push("whether you want an easier learning curve");
  if ((traitProfile.theme_integration || 0) >= 4) notes.push("how much theme immersion matters to you");
  if ((traitProfile.shot_satisfaction || 0) >= 4) notes.push("whether satisfying shots are a big part of the fun");

  return notes.length
    ? `This test can help reveal ${notes.slice(0, 2).join(" and ")}.`
    : `This test can help confirm whether ${target.name} is the right direction.`;
}

export function buildTasteProbeSuggestions(recommendations, context, machineLocationIndex = new Map()) {
  const suggestions = [];
  const seen = new Set();

  recommendations.forEach((target) => {
    if (!target) return;

    if (!seen.has(target.id)) {
      suggestions.push({
        machineId: target.id,
        targetIds: [target.id],
        probeType: "exact",
        reason: probeReason(target, target, "exact"),
        reveals: revealText(target, target)
      });
      seen.add(target.id);
    }

    (target.proxy_machine_ids || []).slice(0, 2).forEach((proxyId) => {
      const proxy = discoveryMachineIndex.get(proxyId);
      if (!proxy || seen.has(proxy.id)) return;

      suggestions.push({
        machineId: proxy.id,
        targetIds: [target.id],
        probeType: "proxy",
        reason: probeReason(target, proxy, "proxy"),
        reveals: revealText(target, proxy)
      });
      seen.add(proxy.id);
    });
  });

  const maxSuggestions = context.travelWillingness === "local-only" ? 3 : context.travelWillingness === "regional" ? 4 : 5;

  return suggestions
    .map((item) => ({
      ...item,
      machine: discoveryMachineIndex.get(item.machineId),
      locationMatches: machineLocationIndex.get(item.machineId) || []
    }))
    .filter((item) => item.machine && item.locationMatches.length)
    .sort((a, b) => {
      const aDistance = a.locationMatches[0]?.distanceMiles ?? 999;
      const bDistance = b.locationMatches[0]?.distanceMiles ?? 999;
      return aDistance - bDistance;
    })
    .slice(0, maxSuggestions);
}

export function buildNearbyCatalogSuggestions(recommendations, machineLocationIndex = new Map(), options = {}) {
  const { maxSuggestions = 8 } = options;
  const recommendedIds = new Set(recommendations.flatMap((machine) => [machine?.id, ...(machine?.proxy_machine_ids || [])]).filter(Boolean));

  return [...machineLocationIndex.entries()]
    .map(([machineId, locationMatches]) => ({
      machineId,
      machine: discoveryMachineIndex.get(machineId),
      locationMatches: (locationMatches || []).slice().sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999))
    }))
    .filter((item) => item.machine && !recommendedIds.has(item.machineId) && item.locationMatches.length)
    .sort((a, b) => {
      const aDistance = a.locationMatches[0]?.distanceMiles ?? 999;
      const bDistance = b.locationMatches[0]?.distanceMiles ?? 999;
      return aDistance - bDistance;
    })
    .slice(0, maxSuggestions)
    .map((item) => ({
      machineId: item.machineId,
      targetIds: [],
      probeType: "nearby",
      reason: `${item.machine.name} is close by and worth trying even though it is not one of your top shortlist validation targets.`,
      reveals: "This can still sharpen your taste and help confirm what style you want to own.",
      ...item
    }));
}

export function buildNearbyExternalMachineSuggestions(locations = [], options = {}) {
  const { maxSuggestions = 12 } = options;
  const machineMap = new Map();

  locations.forEach((location) => {
    (location.externalMachineNames || []).forEach((machineName) => {
      const key = machineName.toLowerCase();
      const existing = machineMap.get(key) || {
        machineName,
        locations: []
      };
      existing.locations.push(location);
      machineMap.set(key, existing);
    });
  });

  return [...machineMap.values()]
    .map((item) => ({
      ...item,
      locations: item.locations
        .slice()
        .sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999))
    }))
    .sort((a, b) => (a.locations[0]?.distanceMiles ?? 999) - (b.locations[0]?.distanceMiles ?? 999))
    .slice(0, maxSuggestions);
}

export function findSuggestionByMachineId(machineId) {
  return discoveryMachines.find((machine) => machine.id === machineId) || null;
}
