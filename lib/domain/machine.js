function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeMachineTitle(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’.:!?,()/]+/g, "")
    .replace(/\b(the|pinball|edition|collectors|collector|standard|special|limited|premium|pro|le|se|remake|original)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildMachineTitleVariants(machine) {
  const title = normalizeWhitespace(machine.title || machine.name);
  const variants = new Set([
    title,
    normalizeMachineTitle(title)
  ]);

  const noLeadingThe = title.replace(/^the\s+/i, "").trim();
  if (noLeadingThe) {
    variants.add(noLeadingThe);
    variants.add(normalizeMachineTitle(noLeadingThe));
  }

  if (title.includes(":")) {
    const noColon = title.replace(/:/g, " ").trim();
    variants.add(noColon);
    variants.add(normalizeMachineTitle(noColon));
  }

  if (title.includes("'")) {
    const noApostrophe = title.replace(/['’]/g, "").trim();
    variants.add(noApostrophe);
    variants.add(normalizeMachineTitle(noApostrophe));
  }

  return [...variants].filter(Boolean);
}

export function createMachineRecord(machine = {}) {
  const title = normalizeWhitespace(machine.title || machine.name);

  return {
    ...machine,
    id: machine.id || machine.slug,
    slug: machine.slug || "",
    title,
    name: machine.name || title,
    manufacturer: normalizeWhitespace(machine.manufacturer),
    year: Number(machine.year) || null,
    ipdbId: machine.ipdbId || null,
    pinsideUrl: machine.pinsideUrl || "",
    pinsideMarketUrl: machine.pinsideMarketUrl || "",
    ipdbUrl: machine.ipdbUrl || "",
    titleVariants: buildMachineTitleVariants({ ...machine, title })
  };
}
