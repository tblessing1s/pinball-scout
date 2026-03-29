import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { machineCatalog } from "../data/machines.js";
import { machineMedia } from "../data/machine-media.generated.js";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(repoRoot, args.output || "data/machine-media-unresolved.generated.json");
  const mediaBySlug = new Map(machineMedia.map((item) => [item.machineSlug, item]));

  const unresolved = machineCatalog.flatMap((machine) => {
    const media = mediaBySlug.get(machine.slug);
    if (media?.primaryImageUrl) return [];

    return [{
      machineSlug: machine.slug,
      title: machine.title,
      manufacturer: machine.manufacturer,
      year: machine.year,
      reason: media?.status || "missing_media_record"
    }];
  });

  await writeFile(outputPath, JSON.stringify(unresolved, null, 2));
  console.log(`Wrote ${unresolved.length} unresolved machine records to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
