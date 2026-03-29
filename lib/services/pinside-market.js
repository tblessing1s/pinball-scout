const PINSIDE_MACHINE_PATHS = {
  "godzilla-pro": "godzilla-pro",
  "deadpool-pro": "deadpool-pro",
  "foo-fighters-pro": "foo-fighters-pro",
  "avengers-infinity-quest-pro": "avengers-infinity-quest-pro",
  "jurassic-park-pro": "jurassic-park-pro",
  "venom-pro": "venom-pro",
  "mandalorian-pro": "stern-the-mandalorian-pro",
  "iron-maiden-pro": "iron-maiden-legacy-of-the-beast-pro",
  "jaws-pro": "jaws-pro",
  "stranger-things-pro": "stranger-things-pro",
  "attack-from-mars-remake": "attack-from-mars-remake-special",
  "medieval-madness-remake": "medieval-madness-remake-special",
  "monster-bash-remake": "monster-bash-remake-special",
  "fish-tales": "fish-tales",
  "funhouse": "funhouse",
  "theatre-of-magic": "theatre-of-magic",
  "arabian-nights": "tales-of-the-arabian-nights",
  "godfather-ce": "the-godfather-collectors-edition",
  "elvira-house-of-horrors": "elviras-house-of-horrors-premium"
};

function searchLink(baseUrl, query) {
  return `${baseUrl}${encodeURIComponent(query)}`;
}

export function getPinsideMachinePath(machineOrSlug) {
  const slug = typeof machineOrSlug === "string" ? machineOrSlug : machineOrSlug?.slug;
  return slug ? PINSIDE_MACHINE_PATHS[slug] || "" : "";
}

export function buildPinsideMachineUrl(machine) {
  if (machine?.pinsideUrl) return machine.pinsideUrl;

  const machinePath = getPinsideMachinePath(machine);
  if (machinePath) {
    return `https://pinside.com/pinball/machine/${machinePath}`;
  }

  return searchLink("https://pinside.com/pinball/machine?query=", machine?.title || machine?.name || "");
}

export function buildPinsideMarketUrl(machine) {
  if (machine?.pinsideMarketUrl) return machine.pinsideMarketUrl;

  const machinePath = getPinsideMachinePath(machine);
  if (machinePath) {
    return `https://pinside.com/pinball/machine/${machinePath}/market`;
  }

  return buildPinsideMachineUrl(machine);
}

export function buildPinsidePricingUrl(machine) {
  const machineUrl = buildPinsideMachineUrl(machine);
  return machineUrl.includes("/pinball/machine/") ? machineUrl : buildPinsideMarketUrl(machine);
}
