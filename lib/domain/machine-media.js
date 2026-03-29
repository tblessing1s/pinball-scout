export const IMAGE_SOURCES = {
  PINSIDE: "PINSIDE",
  IPDB: "IPDB",
  MANUAL: "MANUAL",
  LOCAL: "LOCAL",
  UNKNOWN: "UNKNOWN"
};

export const MEDIA_STATUSES = {
  RESOLVED: "resolved",
  OVERRIDDEN: "overridden",
  PARTIAL: "partial",
  UNMATCHED: "unmatched",
  ERROR: "error"
};

function uniqueUrls(values = []) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length))];
}

export function createMachineMediaRecord(record = {}) {
  const imageUrls = uniqueUrls(record.imageUrls || []);
  const primaryImageUrl = record.primaryImageUrl || imageUrls[0] || "";

  return {
    id: record.id || `${record.machineSlug || "unknown"}-media`,
    machineSlug: record.machineSlug || "",
    primaryImageUrl,
    imageUrls: uniqueUrls([primaryImageUrl, ...imageUrls]),
    imageSource: record.imageSource || IMAGE_SOURCES.UNKNOWN,
    attributionText: record.attributionText || "",
    sourcePageUrl: record.sourcePageUrl || "",
    sourceMachineId: record.sourceMachineId || "",
    sourcePriority: Number.isFinite(record.sourcePriority) ? record.sourcePriority : 999,
    status: record.status || MEDIA_STATUSES.RESOLVED,
    lastSyncedAt: record.lastSyncedAt || "",
    notes: record.notes || ""
  };
}
