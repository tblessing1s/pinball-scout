const COMPARE_CONTEXT_KEY = "pinballScoutCompareContextV1";
const COMPARE_CONTEXT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3;

function safeLocalStorage(action, fallback = null) {
  try {
    return action();
  } catch {
    return fallback;
  }
}

function validSlugList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((slug) => String(slug || "").trim())
    .filter(Boolean);
}

function validTitleList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((title) => String(title || "").trim())
    .filter(Boolean);
}

function isFresh(createdAt) {
  const createdAtMs = Date.parse(createdAt || "");
  if (!Number.isFinite(createdAtMs)) return false;
  return Date.now() - createdAtMs <= COMPARE_CONTEXT_MAX_AGE_MS;
}

function validateContext(raw) {
  if (!raw || typeof raw !== "object") return null;

  const selectedSlugs = validSlugList(raw.selectedSlugs);
  if (selectedSlugs.length < 2) return null;
  if (!isFresh(raw.createdAt)) return null;

  const machineTitles = validTitleList(raw.machineTitles).slice(0, selectedSlugs.length);
  return {
    selectedSlugs: selectedSlugs.slice(0, 3),
    machineTitles,
    source: String(raw.source || "compare-page"),
    createdAt: new Date(raw.createdAt).toISOString()
  };
}

export function saveCompareContext(context) {
  const valid = validateContext(context);
  if (!valid) return false;
  safeLocalStorage(() => localStorage.setItem(COMPARE_CONTEXT_KEY, JSON.stringify(valid)));
  return true;
}

export function loadCompareContext() {
  const raw = safeLocalStorage(() => localStorage.getItem(COMPARE_CONTEXT_KEY), null);
  if (!raw) return null;

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearCompareContext();
    return null;
  }

  const valid = validateContext(parsed);
  if (!valid) {
    clearCompareContext();
    return null;
  }

  return valid;
}

export function clearCompareContext() {
  safeLocalStorage(() => localStorage.removeItem(COMPARE_CONTEXT_KEY));
}

