import { createMachineRecord } from "../../domain/machine.js";
import { IMAGE_SOURCES, MEDIA_STATUSES, createMachineMediaRecord } from "../../domain/machine-media.js";
import { chooseBestCandidate, isAmbiguousMatch } from "./media-matcher.js";
import { MEDIA_ASSET_MODES, MEDIA_LOG_EVENTS } from "./media-types.js";

function hasUsableImages(candidate) {
  return Boolean(candidate?.primaryImageUrl || (Array.isArray(candidate?.imageUrls) && candidate.imageUrls.length));
}

function isLocalAssetUrl(value) {
  return typeof value === "string" && value.startsWith("assets/");
}

function createLogger(log) {
  const entries = [];

  return {
    entries,
    push(level, event, payload) {
      const entry = {
        level,
        event,
        at: new Date().toISOString(),
        ...payload
      };

      entries.push(entry);
      if (typeof log === "function") {
        log(entry);
      }
    }
  };
}

export class MediaResolutionService {
  constructor({
    adapters = [],
    manualOverrides = [],
    localFallbackMedia = [],
    assetMode = MEDIA_ASSET_MODES.REMOTE_ONLY,
    log
  } = {}) {
    this.adapters = adapters;
    this.assetMode = assetMode;
    this.overrideMap = new Map(
      manualOverrides
        .filter((item) => item?.machineSlug)
        .map((item) => [item.machineSlug, item])
    );
    this.localFallbackMap = new Map(
      localFallbackMedia
        .filter((item) => item?.machineSlug)
        .map((item) => [item.machineSlug, createMachineMediaRecord(item)])
    );
    this.logger = createLogger(log);
  }

  async resolveMachines(machines = []) {
    const resolved = [];
    const unresolved = [];

    for (const machineInput of machines) {
      const result = await this.resolveMachine(machineInput);
      resolved.push(result.media);

      if (result.media.status === MEDIA_STATUSES.UNMATCHED || result.media.status === MEDIA_STATUSES.ERROR) {
        unresolved.push({
          machineSlug: result.machine.slug,
          title: result.machine.title,
          manufacturer: result.machine.manufacturer,
          year: result.machine.year,
          reason: result.reason,
          candidatesTried: result.candidatesTried
        });
      }
    }

    return {
      media: resolved,
      unresolved,
      logs: this.logger.entries
    };
  }

  async resolveMachine(machineInput) {
    const machine = createMachineRecord(machineInput);
    const override = this.overrideMap.get(machine.slug);

    if (override) {
      this.logger.push("info", MEDIA_LOG_EVENTS.OVERRIDE_APPLIED, {
        machineSlug: machine.slug,
        title: machine.title
      });

      return {
        machine,
        reason: "manual_override",
        candidatesTried: [],
        media: createMachineMediaRecord({
          machineSlug: machine.slug,
          primaryImageUrl: override.forcedPrimaryImageUrl || "",
          imageUrls: [override.forcedPrimaryImageUrl].filter(Boolean),
          imageSource: override.forcedSource || IMAGE_SOURCES.MANUAL,
          attributionText: override.attributionText || "Manual override",
          sourcePageUrl: override.sourcePageUrl || "",
          sourceMachineId: override.sourceMachineId || machine.slug,
          sourcePriority: 0,
          status: MEDIA_STATUSES.OVERRIDDEN,
          lastSyncedAt: new Date().toISOString(),
          notes: override.notes || ""
        })
      };
    }

    const candidatesTried = [];

    for (const adapter of this.adapters) {
      try {
        const matches = await adapter.searchMachineByName(machine.title, machine.manufacturer, machine.year);
        const { best, alternatives } = chooseBestCandidate(matches);

        if (!best) {
          continue;
        }

        candidatesTried.push({
          adapter: adapter.constructor.name,
          title: best.title,
          sourcePageUrl: best.sourcePageUrl || "",
          matchScore: best.matchScore || 0
        });

        if (isAmbiguousMatch(best, alternatives)) {
          this.logger.push("warning", MEDIA_LOG_EVENTS.AMBIGUOUS_MATCH, {
            machineSlug: machine.slug,
            title: machine.title,
            source: adapter.source,
            topScore: best.matchScore || 0,
            secondScore: alternatives[0]?.matchScore || 0
          });
        }

        const imageUrls = await adapter.getMachineImages(best);
        const media = adapter.mapToInternalMedia(machine, {
          ...best,
          primaryImageUrl: best.primaryImageUrl || imageUrls[0] || "",
          imageUrls: best.imageUrls?.length ? best.imageUrls : imageUrls
        }, {
          assetMode: this.assetMode
        });

        if (hasUsableImages(media)) {
          return {
            machine,
            reason: "adapter_match",
            candidatesTried,
            media
          };
        }

        this.logger.push("warning", MEDIA_LOG_EVENTS.MISSING_IMAGES, {
          machineSlug: machine.slug,
          title: machine.title,
          source: adapter.source
        });
      } catch (error) {
        this.logger.push("error", MEDIA_LOG_EVENTS.PARSING_FAILURE, {
          machineSlug: machine.slug,
          title: machine.title,
          source: adapter.source,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const localFallback = this.localFallbackMap.get(machine.slug);
    const canUseLocalFallback = localFallback?.primaryImageUrl && (
      this.assetMode === MEDIA_ASSET_MODES.LOCAL_CACHE || !isLocalAssetUrl(localFallback.primaryImageUrl)
    );

    if (canUseLocalFallback) {
      this.logger.push("info", MEDIA_LOG_EVENTS.LOCAL_FALLBACK, {
        machineSlug: machine.slug,
        title: machine.title
      });

      return {
        machine,
        reason: "local_fallback",
        candidatesTried,
        media: createMachineMediaRecord({
          ...localFallback,
          machineSlug: machine.slug,
          status: MEDIA_STATUSES.RESOLVED,
          lastSyncedAt: localFallback.lastSyncedAt || new Date().toISOString()
        })
      };
    }

    this.logger.push("warning", MEDIA_LOG_EVENTS.UNMATCHED_MACHINE, {
      machineSlug: machine.slug,
      title: machine.title
    });

    return {
      machine,
      reason: "unmatched",
      candidatesTried,
      media: createMachineMediaRecord({
        machineSlug: machine.slug,
        imageSource: IMAGE_SOURCES.UNKNOWN,
        status: MEDIA_STATUSES.UNMATCHED,
        notes: "No matching image record found."
      })
    };
  }
}
