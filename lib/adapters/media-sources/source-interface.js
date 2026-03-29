import { IMAGE_SOURCES, createMachineMediaRecord } from "../../domain/machine-media.js";

export class MediaSourceAdapter {
  constructor({ source, priority = 100, seedRecords = [], fetchText } = {}) {
    this.source = source || IMAGE_SOURCES.UNKNOWN;
    this.priority = priority;
    this.seedRecords = Array.isArray(seedRecords) ? seedRecords : [];
    this.fetchText = fetchText || null;
  }

  async searchMachineByName() {
    throw new Error(`${this.constructor.name} must implement searchMachineByName().`);
  }

  async getMachineImages(machineIdentifier) {
    return machineIdentifier?.imageUrls || [];
  }

  normalizeMachineRecord(record = {}) {
    return {
      ...record,
      source: record.source || this.source,
      sourcePriority: Number.isFinite(record.sourcePriority) ? record.sourcePriority : this.priority,
      imageUrls: Array.isArray(record.imageUrls) ? record.imageUrls : [],
      attributionText: record.attributionText || "",
      sourcePageUrl: record.sourcePageUrl || "",
      sourceMachineId: record.sourceMachineId || record.id || ""
    };
  }

  mapToInternalMedia(machine, candidate, options = {}) {
    const { assetMode = "remote-only", now = new Date().toISOString() } = options;
    const normalized = this.normalizeMachineRecord(candidate);
    const imageUrls = Array.isArray(normalized.imageUrls) ? normalized.imageUrls : [];
    const primaryImageUrl = normalized.primaryImageUrl || imageUrls[0] || "";
    const resolvedUrls = assetMode === "local-cache"
      ? [normalized.cachedPrimaryImageUrl || primaryImageUrl, ...(normalized.cachedImageUrls || []), ...imageUrls].filter(Boolean)
      : [primaryImageUrl, ...imageUrls].filter(Boolean);

    return createMachineMediaRecord({
      machineSlug: machine.slug,
      primaryImageUrl: resolvedUrls[0] || "",
      imageUrls: resolvedUrls,
      imageSource: normalized.source || this.source,
      attributionText: normalized.attributionText,
      sourcePageUrl: normalized.sourcePageUrl,
      sourceMachineId: normalized.sourceMachineId,
      sourcePriority: normalized.sourcePriority,
      status: resolvedUrls.length ? "resolved" : "partial",
      lastSyncedAt: now,
      notes: normalized.notes || `Resolved via ${this.constructor.name}.`
    });
  }
}
