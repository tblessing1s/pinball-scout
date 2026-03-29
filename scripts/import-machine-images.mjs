import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { machineCatalog } from "../data/machines.js";
import { IpdbAdapter } from "../lib/adapters/media-sources/ipdb-adapter.js";
import { PinsideAdapter } from "../lib/adapters/media-sources/pinside-adapter.js";
import { MediaResolutionService } from "../lib/services/media/media-resolution-service.js";
import { MEDIA_ASSET_MODES } from "../lib/services/media/media-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[index + 1];
    options[key] = next && !next.startsWith("--") ? next : true;
    if (options[key] === next) index += 1;
  }

  return options;
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      current = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) return [];
  const [header, ...dataRows] = rows;

  return dataRows.map((values) => Object.fromEntries(
    header.map((key, columnIndex) => [key.trim(), (values[columnIndex] || "").trim()])
  ));
}

async function loadMachineSeed(inputPath) {
  if (!inputPath) {
    return machineCatalog;
  }

  const resolvedPath = path.resolve(repoRoot, inputPath);
  const raw = await readFile(resolvedPath, "utf8");

  if (resolvedPath.endsWith(".csv")) {
    return parseCsv(raw).map((record) => ({
      ...record,
      year: record.year ? Number(record.year) : null
    }));
  }

  return JSON.parse(raw);
}

async function loadJson(relativePath, fallbackValue) {
  try {
    const resolvedPath = path.resolve(repoRoot, relativePath);
    const raw = await readFile(resolvedPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function searchLink(baseUrl, query) {
  return `${baseUrl}${encodeURIComponent(query)}`;
}

function isModernMachine(machine) {
  return Number(machine.year) >= 2010;
}

function buildAdapterSeedRecords(machines, manifest = [], source) {
  const manifestByName = new Map(manifest.map((item) => [item.name, item]));

  return machines.flatMap((machine) => {
    const includeRecord = source === "PINSIDE" ? isModernMachine(machine) : !isModernMachine(machine);
    if (!includeRecord) return [];

    const direct = manifestByName.get(machine.title || machine.name);
    const localAssetUrl = direct?.filename ? `assets/machines/${direct.filename}` : "";

    return [{
      id: machine.slug,
      title: machine.title || machine.name,
      manufacturer: machine.manufacturer,
      year: machine.year,
      sourcePageUrl: source === "PINSIDE"
        ? (machine.pinsideUrl || searchLink("https://pinside.com/pinball/machine?query=", machine.title || machine.name))
        : (machine.ipdbUrl || searchLink("https://www.ipdb.org/search.pl?any=", machine.title || machine.name)),
      imageUrls: localAssetUrl ? [localAssetUrl] : [],
      attributionText: source === "PINSIDE" ? "Pinside seeded match" : "IPDB seeded match",
      sourceMachineId: machine.ipdbId || machine.slug,
      notes: "Curated seed record for the MVP media pipeline."
    }];
  });
}

function buildLocalFallbackMedia(machines, manifest = []) {
  const manifestByName = new Map(manifest.map((item) => [item.name, item]));

  return machines.flatMap((machine) => {
    const direct = manifestByName.get(machine.title || machine.name);
    const explicitLocalUrl = [machine.localImageUrl, machine.primaryImageUrl]
      .find((value) => typeof value === "string" && value.startsWith("assets/"));

    if (!direct && !explicitLocalUrl) {
      return [];
    }

    const fallbackFilename = `${slugify(machine.title || machine.name)}.png`;
    const filename = direct?.filename || fallbackFilename;
    const primaryImageUrl = explicitLocalUrl || `assets/machines/${filename}`;

    return [{
      machineSlug: machine.slug,
      primaryImageUrl,
      imageUrls: [primaryImageUrl],
      imageSource: "LOCAL",
      attributionText: "Checked-in local asset",
      sourcePageUrl: direct?.source_page || machine.pinsideUrl || machine.ipdbUrl || "",
      sourceMachineId: machine.slug,
      sourcePriority: 100,
      status: "resolved",
      lastSyncedAt: new Date().toISOString(),
      notes: "Local manifest fallback."
    }];
  });
}

function toModuleSource(records) {
  return `export const machineMedia = ${JSON.stringify(records, null, 2)};\n\nexport const machineMediaIndex = new Map(machineMedia.map((item) => [item.machineSlug, item]));\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const machines = await loadMachineSeed(args.input);
  const overrides = await loadJson("data/machine-media-overrides.json", []);
  const manifest = await loadJson("assets/machines/manifest.json", []);
  const assetMode = args["asset-mode"] || MEDIA_ASSET_MODES.LOCAL_CACHE;
  const outputPath = path.resolve(repoRoot, args.output || "data/machine-media.generated.js");
  const unresolvedPath = path.resolve(repoRoot, args["unresolved-output"] || "data/machine-media-unresolved.generated.json");

  const service = new MediaResolutionService({
    assetMode,
    manualOverrides: overrides,
    localFallbackMedia: buildLocalFallbackMedia(machines, manifest),
    adapters: [
      new PinsideAdapter({
        seedRecords: buildAdapterSeedRecords(machines, manifest, "PINSIDE")
      }),
      new IpdbAdapter({
        seedRecords: buildAdapterSeedRecords(machines, manifest, "IPDB")
      })
    ],
    log(entry) {
      const message = `${entry.level.toUpperCase()} ${entry.event} ${entry.machineSlug || ""}`.trim();
      console.log(message);
    }
  });

  const result = await service.resolveMachines(machines);

  if (outputPath.endsWith(".json")) {
    await writeFile(outputPath, JSON.stringify(result.media, null, 2));
  } else {
    await writeFile(outputPath, toModuleSource(result.media));
  }

  await writeFile(unresolvedPath, JSON.stringify(result.unresolved, null, 2));

  console.log(`Resolved ${result.media.length} machines.`);
  console.log(`Unresolved ${result.unresolved.length} machines.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
