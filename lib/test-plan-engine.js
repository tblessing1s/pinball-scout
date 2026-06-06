import { discoveryMachineIndex, discoveryMachines } from "../data/discovery-machines.js";
import { componentsForMachine, componentConnectionReason, findRelatedMachines, COMPONENT_MACHINE_NAMES } from "../data/machine-components.js";

function componentMachineRecord(slug) {
  const name = COMPONENT_MACHINE_NAMES[slug] || slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { id: slug, slug, name, title: name };
}

function mergeSuggestionsByMachineId(suggestions, recommendations) {
  const map = new Map();
  for (const s of suggestions) {
    if (map.has(s.machineId)) {
      const existing = map.get(s.machineId);
      for (const id of s.targetIds) {
        if (!existing.targetIds.includes(id)) existing.targetIds.push(id);
      }
      if ((s.sharedComponentScore || 0) > (existing.sharedComponentScore || 0)) {
        existing.sharedComponentScore = s.sharedComponentScore;
      }
    } else {
      map.set(s.machineId, { ...s, targetIds: [...s.targetIds] });
    }
  }
  return [...map.values()].map((s) => {
    if (s.targetIds.length <= 1) return s;
    const targetNames = s.targetIds.map((id) => recommendations.find((r) => r?.id === id)?.name).filter(Boolean);
    return {
      ...s,
      reason: `${s.machine?.name || s.machineId} is a useful proxy for ${targetNames.join(" and ")} — playing it helps validate the play style for both machines.`,
      reveals: `Tests characteristics that matter for ${targetNames.join(" and ")}.`
    };
  });
}

function probeReason(target, probe, probeType) {
  if (probeType === "exact") {
    return `If you can find ${probe.name} nearby, it is the cleanest way to validate whether this shortlist favorite really clicks in person.`;
  }

  return `${probe.name} is a proxy for ${target.name}. It can help reveal whether you like this general play style before you chase the exact title.`;
}

function revealText(target, probe) {
  const notes = [];

  if (probe.flow_score >= 4) notes.push("whether you enjoy faster, smoother shot flow");
  if (probe.rules_depth_score >= 4) notes.push("whether deeper progression keeps you engaged");
  if (probe.chaos_score >= 4) notes.push("whether you enjoy more chaos and spectacle");
  if (probe.family_friendliness_score >= 4) notes.push("whether you want a broader home-friendly feel");
  if (probe.theme_integration_score >= 4) notes.push("how much theme immersion matters to you");

  return notes.length
    ? `This test can help reveal ${notes.slice(0, 2).join(" and ")}.`
    : `This test can help confirm whether ${target.name} is the right direction.`;
}

export function buildTasteProbeSuggestions(recommendations, context, machineLocationIndex = new Map()) {
  const suggestions = [];
  const exactSeen = new Set();

  recommendations.forEach((target) => {
    if (!target) return;

    if (!exactSeen.has(target.id)) {
      suggestions.push({
        machineId: target.id,
        targetIds: [target.id],
        probeType: "exact",
        reason: probeReason(target, target, "exact"),
        reveals: revealText(target, target)
      });
      exactSeen.add(target.id);
    }

    // Allow up to 3 tag proxies per machine; same proxy may appear for multiple targets (merged later)
    (target.proxy_machine_ids || []).slice(0, 3).forEach((proxyId) => {
      const proxy = discoveryMachineIndex.get(proxyId);
      if (!proxy) return;

      suggestions.push({
        machineId: proxy.id,
        targetIds: [target.id],
        probeType: "proxy",
        reason: probeReason(target, proxy, "proxy"),
        reveals: revealText(target, proxy)
      });
    });
  });

  const withMachine = suggestions
    .map((item) => ({
      ...item,
      machine: discoveryMachineIndex.get(item.machineId),
      locationMatches: machineLocationIndex.get(item.machineId) || []
    }))
    .filter((item) => item.machine);

  // Merge cross-target proxies (same nearby machine that fits multiple shortlist machines)
  const merged = mergeSuggestionsByMachineId(withMachine, recommendations);

  const byDistance = (a, b) => (a.locationMatches[0]?.distanceMiles ?? 999) - (b.locationMatches[0]?.distanceMiles ?? 999);

  const exacts = merged.filter((item) => item.probeType === "exact").sort(byDistance);
  const proxies = merged
    .filter((item) => item.probeType !== "exact" && item.locationMatches.length)
    .sort(byDistance);

  return [...exacts, ...proxies];
}

export function buildComponentProxySuggestions(recommendations, machineLocationIndex, options = {}) {
  const { maxPerTarget = 3, maxTotal = 6 } = options;
  const recommendedIds = new Set(
    recommendations.flatMap((m) => [m?.id, ...(m?.proxy_machine_ids || [])]).filter(Boolean)
  );
  const nearbyMachineSlugs = [...machineLocationIndex.keys()].filter((id) => !recommendedIds.has(id));

  const results = [];

  for (const target of recommendations) {
    if (!target?.id || !componentsForMachine(target.id).length) continue;
    const related = findRelatedMachines(target.id, nearbyMachineSlugs);
    let addedForTarget = 0;

    for (const { slug, score } of related) {
      if (addedForTarget >= maxPerTarget) break;
      if (score < 2) continue;
      const machine = discoveryMachineIndex.get(slug) ?? componentMachineRecord(slug);
      const connectionReason = componentConnectionReason(target.id, slug);
      if (!connectionReason) continue;
      addedForTarget++;
      results.push({
        machineId: slug,
        targetIds: [target.id],
        probeType: "component-proxy",
        reason: `${machine.name} shares ${connectionReason} with ${target.name} — playing it will help validate whether this style fits you.`,
        reveals: `Tests the same physical characteristics that make ${target.name} interesting to you.`,
        machine,
        locationMatches: (machineLocationIndex.get(slug) || []).slice().sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999)),
        sharedComponentScore: score
      });
    }
  }

  // Merge cross-target proxies (same machine that aligns with multiple shortlist machines)
  const merged = mergeSuggestionsByMachineId(results, recommendations);

  return merged
    .sort((a, b) =>
      (b.targetIds.length - a.targetIds.length) || // shared proxies surface first
      (b.sharedComponentScore - a.sharedComponentScore) ||
      ((a.locationMatches[0]?.distanceMiles ?? 999) - (b.locationMatches[0]?.distanceMiles ?? 999))
    )
    .slice(0, maxTotal);
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
