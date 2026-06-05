import { findNearbyPinballMapLocations } from "./services/pinball-map-service.js";

export async function findNearbyLocations({ zip, maxMiles = 50, targetMachineNames = [] }) {
  return findNearbyPinballMapLocations({ zip, maxMiles, targetMachineNames });
}

export function buildMachineLocationIndex(locations) {
  const index = new Map();

  locations.forEach((location) => {
    (location.machineIds || []).forEach((machineId) => {
      const existing = index.get(machineId) || [];
      existing.push(location);
      index.set(machineId, existing);
    });
  });

  return index;
}
