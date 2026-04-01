const LEGACY_DISCOVERY_STATE_KEY = "pinballScoutDiscoveryStateV2";
const LEGACY_COMPARE_STATE_KEY = "pinballScoutCompare";

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeSlug(value, validSlugs) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (validSlugs.has(trimmed)) return trimmed;

  const alt = trimmed.replaceAll("_", "-");
  if (validSlugs.has(alt)) return alt;
  return "";
}

function readLegacyDiscovery(validSlugs) {
  const saved = safeJsonParse(localStorage.getItem(LEGACY_DISCOVERY_STATE_KEY) || "null", null);
  if (!saved || typeof saved !== "object") {
    return { hasSavedDiscovery: false, candidateSlug: "" };
  }

  const hasSavedDiscovery = Boolean(
    saved.screen ||
    (Array.isArray(saved.reactions) && saved.reactions.length) ||
    (saved.tasteAnswers && Object.values(saved.tasteAnswers).some(Boolean))
  );

  const candidates = [
    saved.sourcingMachineId,
    saved.activeProbeId,
    Array.isArray(saved.reactions) ? saved.reactions[0]?.machineId : "",
    Array.isArray(saved.deck) ? saved.deck[0] : ""
  ];
  const candidateSlug = candidates.map((value) => normalizeSlug(value, validSlugs)).find(Boolean) || "";

  return { hasSavedDiscovery, candidateSlug };
}

function readLegacyCompare(validSlugs) {
  const compare = safeJsonParse(localStorage.getItem(LEGACY_COMPARE_STATE_KEY) || "[]", []);
  if (!Array.isArray(compare)) return [];
  return compare
    .map((slug) => normalizeSlug(slug, validSlugs))
    .filter(Boolean);
}

export function migrateLegacyDecisionState(validSlugs) {
  const compareSlugs = readLegacyCompare(validSlugs);
  const discovery = readLegacyDiscovery(validSlugs);
  const frontRunnerSlug = compareSlugs[0] || discovery.candidateSlug || "";
  const backupSlugs = compareSlugs.filter((slug) => slug !== frontRunnerSlug).slice(0, 2);

  if (!frontRunnerSlug && !backupSlugs.length && !discovery.hasSavedDiscovery) {
    return null;
  }

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    frontRunnerSlug,
    backupSlugs,
    temporaryPrimary: false,
    hasLegacyDiscovery: discovery.hasSavedDiscovery,
    migrationCompleted: true
  };
}

