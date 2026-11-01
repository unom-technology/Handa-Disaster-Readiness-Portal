'use strict';

// API #2 - USGS Earthquake Catalog (earthquake.usgs.gov). Free, no API key.
// Returns recent earthquakes near a point, sorted newest first, with the
// straight-line distance from the user.

const { fetchJson } = require('./http');
const config = require('../config');

// Haversine distance in kilometres.
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getRecentQuakes(lat, lng, { radiusKm = 500, days = 7, minMagnitude = 2.5 } = {}) {
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const params = new URLSearchParams({
    format: 'geojson',
    starttime: start,
    latitude: lat,
    longitude: lng,
    maxradiuskm: radiusKm,
    minmagnitude: minMagnitude,
    orderby: 'time',
    limit: '20',
  });

  const data = await fetchJson(`${config.api.usgs}?${params.toString()}`);

  const quakes = (data.features || []).map((f) => {
    const [qlng, qlat, depth] = f.geometry.coordinates;
    return {
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      depthKm: depth,
      lat: qlat,
      lng: qlng,
      distanceKm: Math.round(distanceKm(lat, lng, qlat, qlng)),
      url: f.properties.url,
      tsunami: f.properties.tsunami === 1,
    };
  });

  return {
    source: 'USGS',
    count: quakes.length,
    strongest: quakes.reduce(
      (m, q) => (q.magnitude > (m ? m.magnitude : -1) ? q : m),
      null
    ),
    quakes,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { getRecentQuakes, distanceKm };
