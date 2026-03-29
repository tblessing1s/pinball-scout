import { pinballMapConfig } from "../config.js";

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function geocodeUsZip(zip) {
  const normalized = String(zip || "").replace(/\D/g, "").slice(0, 5);

  if (normalized.length !== 5) {
    throw new Error("Enter a valid 5-digit ZIP code.");
  }

  const response = await fetch(`${pinballMapConfig.zipLookupBaseUrl}/${normalized}`);
  if (!response.ok) {
    throw new Error(`ZIP lookup failed for ${normalized}.`);
  }

  const payload = await response.json();
  const place = Array.isArray(payload.places) ? payload.places[0] : null;
  const latitude = parseCoordinate(place?.latitude);
  const longitude = parseCoordinate(place?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`No coordinates found for ZIP ${normalized}.`);
  }

  return {
    zip: normalized,
    latitude,
    longitude,
    city: place?.["place name"] || "",
    state: place?.["state abbreviation"] || ""
  };
}
