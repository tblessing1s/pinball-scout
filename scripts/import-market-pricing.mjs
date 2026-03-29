import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { machineCatalog } from "../data/machines.js";
import { marketPricingSourceIndex } from "../data/market-pricing-sources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_LOOKBACK_YEARS = 3;
const DEFAULT_TIMEOUT_MS = 20000;
const PINBALL_PRICES_HOME = "https://www.pinballprices.com/";

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

function moneyValue(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoMonth(value = new Date()) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function roundCurrency(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function compactWhitespace(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToLines(html) {
  const withoutScripts = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const withBreaks = withoutScripts
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|br|tr|td|th)>/gi, "\n")
    .replace(/<(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|br|tr|td|th)[^>]*>/gi, "\n");

  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((line) => compactWhitespace(line))
    .filter(Boolean);
}

function buildPinballPricesUrl(title) {
  const normalized = String(title || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "-");

  return `https://www.pinballprices.com/average-prices/${encodeURIComponent(normalized)}`;
}

function buildPinsideMachineUrl(pinsideSlug) {
  return `https://pinside.com/pinball/machine/${pinsideSlug}`;
}

function buildPinsideMarketUrl(pinsideSlug) {
  return `${buildPinsideMachineUrl(pinsideSlug)}/market`;
}

async function fetchText(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "PinballScoutPricingImporter/1.0 (+https://pinball-scout.local)"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parsePinballPricesUpdateLabel(lines) {
  return lines.find((line) => /update/i.test(line)) || "";
}

function parsePinballPricesSales(lines, lookbackYears = DEFAULT_LOOKBACK_YEARS) {
  const detailsIndex = lines.findIndex((line) => line === "Individual Sale Details");
  if (detailsIndex < 0) {
    return [];
  }

  const minYear = new Date().getUTCFullYear() - Number(lookbackYears || DEFAULT_LOOKBACK_YEARS) + 1;
  const sales = [];

  for (let index = detailsIndex + 1; index < lines.length - 4; index += 1) {
    const price = moneyValue(lines[index]);
    const year = Number(lines[index + 1]);
    const condition = lines[index + 2];
    const source = lines[index + 3];

    if (!price || !Number.isInteger(year) || year < 1900 || year < minYear) {
      continue;
    }

    if (!source || source === "Sold for") {
      continue;
    }

    sales.push({
      price,
      year,
      condition,
      source
    });
  }

  return sales;
}

function parsePinsideMedian(lines) {
  const marker = lines.findIndex((line) => /trimmed median/i.test(line));
  if (marker < 0) return null;

  const line = lines[marker];
  const direct = moneyValue(line);
  if (direct) return direct;

  for (let index = Math.max(0, marker - 2); index <= Math.min(lines.length - 1, marker + 2); index += 1) {
    const candidate = moneyValue(lines[index]);
    if (candidate) return candidate;
  }

  return null;
}

function parsePinsideMarketPrices(lines) {
  const marker = lines.findIndex((line) => line === "Games");
  if (marker < 0) return [];

  const values = [];

  for (let index = marker + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "Parts" || /Hey there! Welcome to Pinside!/i.test(line)) break;

    const price = moneyValue(line);
    if (!price) continue;

    const nextLine = lines[index + 1] || "";
    if (!/Machine - For Sale|Machine - For Trade|Machine - Wanted/i.test(nextLine)) continue;
    values.push(price);
  }

  return values;
}

function deriveRangeFromSales(values) {
  if (!values.length) return null;

  const low = values.length >= 5 ? percentile(values, 0.2) : Math.min(...values);
  const high = values.length >= 5 ? percentile(values, 0.8) : Math.max(...values);
  const mid = median(values);

  return {
    min: roundCurrency(low),
    max: roundCurrency(high),
    median: roundCurrency(mid),
    sampleSize: values.length
  };
}

function deriveRangeFromPinsideMedian(medianValue, marketValues = []) {
  if (!medianValue) return null;

  if (marketValues.length >= 2) {
    return {
      min: roundCurrency(Math.min(...marketValues)),
      max: roundCurrency(Math.max(...marketValues)),
      median: roundCurrency(medianValue),
      sampleSize: marketValues.length
    };
  }

  return {
    min: roundCurrency(medianValue * 0.9),
    max: roundCurrency(medianValue * 1.1),
    median: roundCurrency(medianValue),
    sampleSize: marketValues.length || 1
  };
}

function mergeOverride(baseRecord, overrideRecord = {}) {
  if (!overrideRecord || typeof overrideRecord !== "object") {
    return baseRecord;
  }

  return {
    ...baseRecord,
    ...overrideRecord,
    usedRange: overrideRecord.usedRange || baseRecord.usedRange,
    sourceBreakdown: {
      ...(baseRecord.sourceBreakdown || {}),
      ...(overrideRecord.sourceBreakdown || {})
    },
    notes: overrideRecord.notes || baseRecord.notes
  };
}

function toModuleSource(records) {
  return `export const marketPricing = ${JSON.stringify(records, null, 2)};\n\nexport const marketPricingIndex = new Map(marketPricing.map((item) => [item.machineSlug, item]));\n`;
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

async function loadPinballPricesMetadata() {
  try {
    const home = await fetchText(PINBALL_PRICES_HOME);
    const lines = htmlToLines(home);
    return {
      updateLabel: parsePinballPricesUpdateLabel(lines)
    };
  } catch {
    return {
      updateLabel: ""
    };
  }
}

async function importMachinePricing(machine, overridesBySlug, options, pinballPricesMetadata) {
  const source = marketPricingSourceIndex.get(machine.slug) || {};
  const overrideRecord = overridesBySlug[machine.slug] || {};
  const pricingTitle = overrideRecord.pinballPricesTitle || source.pinballPricesTitle || machine.title || machine.name;
  const pinsideSlug = overrideRecord.pinsideSlug || source.pinsideSlug || "";

  const result = {
    machineSlug: machine.slug,
    title: machine.title || machine.name,
    usedRange: null,
    pricingType: "used-market-guide",
    pricingMethod: "",
    confidence: "low",
    sampleSize: 0,
    updatedAt: new Date().toISOString(),
    sourceBreakdown: {},
    notes: "",
    lastObservedMonth: toIsoMonth(),
    pinballPricesUpdateLabel: pinballPricesMetadata.updateLabel || ""
  };

  let pinballPricesValues = [];
  let pinballPricesUrl = "";

  if (pricingTitle) {
    pinballPricesUrl = overrideRecord.pinballPricesUrl || buildPinballPricesUrl(pricingTitle);

    try {
      const page = await fetchText(pinballPricesUrl, options.timeoutMs);
      const lines = htmlToLines(page);
      const sales = parsePinballPricesSales(lines, options.lookbackYears);
      pinballPricesValues = sales.map((item) => item.price);

      result.sourceBreakdown.pinballPrices = {
        url: pinballPricesUrl,
        sampleSize: sales.length,
        recentYears: [...new Set(sales.map((item) => item.year))].sort((left, right) => right - left)
      };
    } catch (error) {
      result.sourceBreakdown.pinballPrices = {
        url: pinballPricesUrl,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  const soldRange = deriveRangeFromSales(pinballPricesValues);
  if (soldRange) {
    result.usedRange = {
      min: soldRange.min,
      max: soldRange.max,
      median: soldRange.median
    };
    result.sampleSize = soldRange.sampleSize;
    result.pricingMethod = "pinballprices_recent_sales";
    result.confidence = soldRange.sampleSize >= 5 ? "high" : soldRange.sampleSize >= 3 ? "medium" : "low";
  }

  if (!result.usedRange && pinsideSlug) {
    const pinsidePageUrl = buildPinsideMachineUrl(pinsideSlug);
    const pinsideMarketUrl = buildPinsideMarketUrl(pinsideSlug);

    try {
      const [machinePage, marketPage] = await Promise.all([
        fetchText(pinsidePageUrl, options.timeoutMs),
        fetchText(pinsideMarketUrl, options.timeoutMs)
      ]);
      const machineLines = htmlToLines(machinePage);
      const marketLines = htmlToLines(marketPage);
      const pinsideMedian = parsePinsideMedian(machineLines);
      const marketValues = parsePinsideMarketPrices(marketLines);
      const range = deriveRangeFromPinsideMedian(pinsideMedian, marketValues);

      result.sourceBreakdown.pinside = {
        machineUrl: pinsidePageUrl,
        marketUrl: pinsideMarketUrl,
        median: pinsideMedian,
        marketSampleSize: marketValues.length
      };

      if (range) {
        result.usedRange = {
          min: range.min,
          max: range.max,
          median: range.median
        };
        result.sampleSize = range.sampleSize;
        result.pricingMethod = "pinside_trimmed_median_with_live_market_context";
        result.confidence = marketValues.length >= 3 ? "medium" : "low";
      }
    } catch (error) {
      result.sourceBreakdown.pinside = {
        machineUrl: pinsidePageUrl,
        marketUrl: pinsideMarketUrl,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  if (!result.usedRange && machine.estimated_price_min && machine.estimated_price_max) {
    result.usedRange = {
      min: machine.estimated_price_min,
      max: machine.estimated_price_max,
      median: roundCurrency((machine.estimated_price_min + machine.estimated_price_max) / 2)
    };
    result.sampleSize = 0;
    result.pricingMethod = "catalog_estimated_price_fallback";
    result.confidence = "low";
    result.notes = "No external pricing source resolved; using seeded catalog estimate.";
  }

  return mergeOverride(result, overrideRecord);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(repoRoot, args.output || "data/market-pricing.generated.js");
  const overrides = await loadJson(args.overrides || "data/market-pricing-overrides.json", {});
  const pinballPricesMetadata = await loadPinballPricesMetadata();
  const options = {
    timeoutMs: Number(args.timeout || DEFAULT_TIMEOUT_MS),
    lookbackYears: Number(args["lookback-years"] || DEFAULT_LOOKBACK_YEARS)
  };

  const records = [];

  for (const machine of machineCatalog) {
    console.log(`IMPORT pricing ${machine.slug}`);
    const record = await importMachinePricing(machine, overrides, options, pinballPricesMetadata);
    records.push(record);
  }

  await writeFile(outputPath, toModuleSource(records));
  console.log(`Wrote ${records.length} machine pricing records to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
