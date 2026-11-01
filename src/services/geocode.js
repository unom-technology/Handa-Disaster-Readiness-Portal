'use strict';

// API #4 - Nominatim / OpenStreetMap (nominatim.openstreetmap.org). Free, no key.
// Turns a typed address into coordinates. A small in-memory cache keeps us well
// within Nominatim's fair-use policy (max ~1 request/second per app).

const { fetchJson } = require('./http');
const config = require('../config');

const cache = new Map();

async function geocode(query) {
  const q = (query || '').trim();
  if (!q) return null;

  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'ph', // bias to the Philippines; remove for global use
    addressdetails: '1',
  });

  const data = await fetchJson(`${config.api.nominatim}?${params.toString()}`, {
    headers: { 'User-Agent': config.nominatimUserAgent },
  });

  if (!Array.isArray(data) || data.length === 0) {
    cache.set(key, null);
    return null;
  }

  const hit = data[0];
  const result = {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name,
    source: 'Nominatim / OpenStreetMap',
  };
  cache.set(key, result);
  return result;
}

module.exports = { geocode };
