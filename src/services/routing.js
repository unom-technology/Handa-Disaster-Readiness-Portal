'use strict';

// API #5 - OSRM routing (router.project-osrm.org). Free, no API key.
// Used to (a) find the nearest evacuation centre by real driving distance and
// (b) draw a route line from the user to a centre on the map.

const { fetchJson } = require('./http');
const config = require('../config');

// Driving route between two points. Returns distance (km), duration (min) and
// a GeoJSON geometry for drawing on Leaflet.
async function getRoute(fromLat, fromLng, toLat, toLng) {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${config.api.osrm}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const data = await fetchJson(url);

  if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
    throw new Error('No route found');
  }
  const route = data.routes[0];
  return {
    source: 'OSRM',
    distanceKm: +(route.distance / 1000).toFixed(2),
    durationMin: Math.round(route.duration / 60),
    geometry: route.geometry, // GeoJSON LineString
  };
}

// Given the user's location and a list of centres, rank them by driving
// distance using OSRM's table service (one request for all destinations).
async function rankByDistance(fromLat, fromLng, centers) {
  if (!centers.length) return [];

  const points = [
    `${fromLng},${fromLat}`,
    ...centers.map((c) => `${c.lng},${c.lat}`),
  ].join(';');

  const url =
    `${config.api.osrm}/table/v1/driving/${points}` +
    `?sources=0&annotations=duration,distance`;

  const data = await fetchJson(url);
  if (data.code !== 'Ok') throw new Error('Distance table unavailable');

  const distances = data.distances[0].slice(1); // drop the source->source (0) entry
  const durations = data.durations[0].slice(1);

  return centers
    .map((c, i) => ({
      ...c,
      distanceKm: distances[i] != null ? +(distances[i] / 1000).toFixed(2) : null,
      durationMin: durations[i] != null ? Math.round(durations[i] / 60) : null,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

module.exports = { getRoute, rankByDistance };
