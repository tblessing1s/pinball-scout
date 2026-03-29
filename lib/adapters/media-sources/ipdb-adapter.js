import { createMachineRecord, normalizeMachineTitle } from "../../domain/machine.js";
import { IMAGE_SOURCES } from "../../domain/machine-media.js";
import { scoreCandidateMatch, sortCandidateMatches } from "../../services/media/media-matcher.js";
import { MediaSourceAdapter } from "./source-interface.js";

export class IpdbAdapter extends MediaSourceAdapter {
  constructor(options = {}) {
    super({
      source: IMAGE_SOURCES.IPDB,
      priority: 20,
      ...options
    });
  }

  async searchMachineByName(title, manufacturer, year) {
    const machine = createMachineRecord({ title, manufacturer, year });
    const matches = this.seedRecords
      .map((record) => this.normalizeMachineRecord(record))
      .map((record) => ({
        ...record,
        matchScore: scoreCandidateMatch(machine, record)
      }))
      .filter((record) => record.matchScore > 0);

    return sortCandidateMatches(matches);
  }

  async getMachineImages(machineIdentifier) {
    return machineIdentifier?.imageUrls || [];
  }

  normalizeMachineRecord(record = {}) {
    const title = record.title || record.name || "";
    const normalizedTitle = record.normalizedTitle || normalizeMachineTitle(title);

    return super.normalizeMachineRecord({
      ...record,
      title,
      normalizedTitle,
      source: IMAGE_SOURCES.IPDB,
      sourcePriority: 20
    });
  }
}
