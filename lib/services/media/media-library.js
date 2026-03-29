import { machineMedia, machineMediaIndex } from "../../../data/machine-media.generated.js";
import { machineMediaConfig } from "../../../data/machine-media-config.js";
import { buildPinsideMachineUrl, buildPinsideMarketUrl } from "../pinside-market.js";

function searchLink(baseUrl, query) {
  return `${baseUrl}${encodeURIComponent(query)}`;
}

function isLocalAsset(value) {
  return typeof value === "string" && value.startsWith("assets/");
}

function fallbackImageCandidates(machine) {
  const values = [
    machine.imageUrl,
    machine.image_url,
    machine.image_path
  ].filter((value) => typeof value === "string" && value.trim().length);

  const baseNames = [
    machine.slug,
    machine.name,
    machine.title,
    machine.image
  ]
    .filter(Boolean)
    .map((value) => String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
    );

  for (const baseName of new Set(baseNames)) {
    values.push(
      `assets/machines/${baseName}.jpg`,
      `assets/machines/${baseName}.jpeg`,
      `assets/machines/${baseName}.png`,
      `assets/machines/${baseName}.webp`
    );
  }

  return [...new Set(values)];
}

export function getMachineMedia(machineOrSlug) {
  const slug = typeof machineOrSlug === "string" ? machineOrSlug : machineOrSlug?.slug;
  return slug ? machineMediaIndex.get(slug) || null : null;
}

export function resolveMachineImageSources(machine) {
  const media = getMachineMedia(machine);
  const configuredMode = machineMediaConfig.assetMode;
  const candidates = [];

  if (media) {
    const urls = [media.primaryImageUrl, ...(media.imageUrls || [])].filter(Boolean);
    urls.forEach((url) => {
      if (configuredMode === "remote-only" && isLocalAsset(url)) return;
      candidates.push(url);
    });

    if (candidates.length) {
      return [...new Set(candidates)];
    }
  }

  return [...new Set(fallbackImageCandidates(machine))];
}

export function mergeMachineMedia(machine) {
  const media = getMachineMedia(machine);
  const title = machine.title || machine.name;

  return {
    ...machine,
    id: machine.id || machine.slug,
    title,
    ipdbId: machine.ipdbId || null,
    pinsideUrl: buildPinsideMachineUrl({ ...machine, title }),
    pinsideMarketUrl: buildPinsideMarketUrl({ ...machine, title }),
    ipdbUrl: machine.ipdbUrl || searchLink("https://www.ipdb.org/search.pl?any=", title),
    primaryImageUrl: media?.primaryImageUrl || "",
    imageUrls: media?.imageUrls || [],
    imageSource: media?.imageSource || "",
    attributionText: media?.attributionText || "",
    sourcePageUrl: media?.sourcePageUrl || "",
    sourceMachineId: media?.sourceMachineId || "",
    sourcePriority: media?.sourcePriority ?? null,
    mediaStatus: media?.status || ""
  };
}

export { machineMedia };
