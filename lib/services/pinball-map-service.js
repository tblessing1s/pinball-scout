import { machines } from "../../data/machines.js";
import { pinballMapConfig } from "../config.js";
import { buildMachineTitleVariants, normalizeMachineTitle } from "../domain/machine.js";
import { geocodeUsZip } from "./zip-geocoder.js";

const machineCatalog = machines.map((machine) => ({
  ...machine,
  title: machine.title || machine.name,
  normalizedTitle: normalizeMachineTitle(machine.title || machine.name),
  titleVariants: buildMachineTitleVariants(machine)
}));

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMiles(from, to) {
  const earthRadiusMiles = 3958.8;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function candidateEndpointUrls({ latitude, longitude }) {
  const lat = encodeURIComponent(String(latitude));
  const lon = encodeURIComponent(String(longitude));

  return [
    `${pinballMapConfig.siteBaseUrl}/api/v1/locations/closest_by_lat_lon.json?lat=${lat}&lon=${lon}`,
    `${pinballMapConfig.siteBaseUrl}/api/v1/locations/closest_by_lat_lon?lat=${lat}&lon=${lon}`,
    `${pinballMapConfig.siteBaseUrl}/api/v1/locations.json?lat=${lat}&lon=${lon}`
  ];
}

function milesToLatitudeDelta(miles) {
  return miles / 69;
}

function milesToLongitudeDelta(miles, latitude) {
  const latitudeCosine = Math.cos(toRadians(latitude));
  if (!latitudeCosine) return 0;
  return miles / (69 * latitudeCosine);
}

function buildSearchSamplePoints(origin, radiusMiles, sampleCount) {
  const points = [{ latitude: origin.latitude, longitude: origin.longitude }];
  const ringRadiusMiles = Math.max(5, Math.min(radiusMiles, 50));

  for (let index = 0; index < sampleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / sampleCount;
    const latMiles = Math.sin(angle) * ringRadiusMiles;
    const lonMiles = Math.cos(angle) * ringRadiusMiles;

    points.push({
      latitude: origin.latitude + milesToLatitudeDelta(latMiles),
      longitude: origin.longitude + milesToLongitudeDelta(lonMiles, origin.latitude)
    });
  }

  return points;
}

async function fetchJsonWithFallback(urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }

      const payload = await response.json();
      return { payload, url };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Pinball Map request failed.");
}

function normalizeLocationCollection(payload) {
  if (payload?.location && typeof payload.location === "object") return [payload.location];
  if (Array.isArray(payload?.locations)) return payload.locations;
  if (Array.isArray(payload?.location_machine_xrefs)) {
    return payload.location_machine_xrefs
      .map((item) => item.location || item)
      .filter(Boolean);
  }
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeMachineCollection(payload) {
  if (Array.isArray(payload?.machines)) return payload.machines;
  if (Array.isArray(payload?.machine_details)) return payload.machine_details;
  if (Array.isArray(payload)) return payload;
  return [];
}

function baseMachineName(value) {
  return String(value || "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

function bestInternalSlugForMachineName(machineName) {
  const normalized = normalizeMachineTitle(machineName);
  if (!normalized) return null;

  let bestMatch = null;
  let bestScore = 0;

  machineCatalog.forEach((machine) => {
    let score = 0;
    if (machine.normalizedTitle === normalized) score += 100;
    if (machine.titleVariants.includes(machineName)) score += 30;
    if (machine.titleVariants.includes(normalized)) score += 25;
    if (normalized.includes(machine.normalizedTitle) || machine.normalizedTitle.includes(normalized)) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = machine.slug;
    }
  });

  return bestScore >= 25 ? bestMatch : null;
}

async function fetchLocationMachines(locationId) {
  const url = `${pinballMapConfig.siteBaseUrl}/api/v1/locations/${locationId}/machine_details.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pinball Map machine lookup failed for location ${locationId}.`);
  }

  const payload = await response.json();
  return normalizeMachineCollection(payload);
}

function locationCoordinates(location) {
  return {
    latitude: parseCoordinate(location.lat ?? location.latitude),
    longitude: parseCoordinate(location.lon ?? location.lng ?? location.longitude)
  };
}

async function fetchClosestLocationForPoint(point) {
  const { payload } = await fetchJsonWithFallback(candidateEndpointUrls(point));
  const rawLocations = normalizeLocationCollection(payload);
  return rawLocations[0] || null;
}

async function fetchUniqueNearbyLocations(origin, maxMiles) {
  const samplePoints = buildSearchSamplePoints(origin, Number(maxMiles || 50), pinballMapConfig.radialSampleCount);
  const rawMatches = await Promise.all(samplePoints.map((point) => fetchClosestLocationForPoint(point).catch(() => null)));
  const uniqueLocations = new Map();

  rawMatches.filter(Boolean).forEach((location) => {
    const locationId = String(location.id || "");
    if (!locationId || uniqueLocations.has(locationId)) return;
    uniqueLocations.set(locationId, location);
  });

  return [...uniqueLocations.values()];
}

export async function findNearbyPinballMapLocations({ zip, maxMiles = 50 }) {
  const origin = await geocodeUsZip(zip);
  const rawLocations = (await fetchUniqueNearbyLocations(origin, maxMiles)).slice(0, pinballMapConfig.locationSearchLimit);

  if (!rawLocations.length) {
    return [];
  }

  const enriched = await Promise.all(rawLocations.map(async (location) => {
    const coordinates = locationCoordinates(location);
    const hasCoordinates = Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude);
    const distanceMiles = hasCoordinates
      ? Math.round(haversineMiles(origin, coordinates))
      : Number.MAX_SAFE_INTEGER;

    let machineIds = [];
    const machineNames = Array.isArray(location.machine_names)
      ? location.machine_names.map((name) => String(name).trim()).filter(Boolean)
      : [];
    const externalMachineNames = [];

    if (machineNames.length) {
      machineNames.forEach((name) => {
        const slug = bestInternalSlugForMachineName(baseMachineName(name));
        if (slug) {
          machineIds.push(slug);
        } else {
          externalMachineNames.push(name);
        }
      });
      machineIds = [...new Set(machineIds)];
    }

    if (!machineIds.length) {
      try {
        const machineDetails = await fetchLocationMachines(location.id);
        const detailNames = machineDetails
          .map((machine) => String(machine.name || "").trim())
          .filter(Boolean);
        if (!machineNames.length) {
          machineNames.push(...detailNames);
        }
        detailNames.forEach((name) => {
          const slug = bestInternalSlugForMachineName(baseMachineName(name));
          if (slug) {
            machineIds.push(slug);
          } else {
            externalMachineNames.push(name);
          }
        });
        machineIds = [...new Set(machineIds)];
      } catch (error) {
        console.warn("[Pinball Scout] Pinball Map machine detail lookup failed", {
          locationId: location.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      id: String(location.id),
      name: location.name || "Unknown location",
      city: location.city || "",
      state: location.state || "",
      source: "Pinball Map",
      region: location.region_name || location.region || "",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      distanceMiles,
      machineIds,
      machineNames,
      externalMachineNames: [...new Set(externalMachineNames)],
      website: location.website || "",
      locationType: location.location_type || ""
    };
  }));

  return enriched
    .filter((location) => Number.isFinite(location.distanceMiles))
    .filter((location) => location.distanceMiles <= Number(maxMiles || 50))
    .sort((left, right) => left.distanceMiles - right.distanceMiles);
}
