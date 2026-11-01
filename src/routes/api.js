'use strict';

// Internal JSON API consumed by the browser (Leaflet maps, live refresh).
// These endpoints proxy the external services so API logic stays on the server.

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getWeather } = require('../services/weather');
const { getRecentQuakes } = require('../services/quakes');
const { getAlerts } = require('../services/gdacs');
const { geocode } = require('../services/geocode');
const { getRoute, rankByDistance } = require('../services/routing');

const router = express.Router();
router.use(requireAuth);

// Small helper to keep handlers tidy.
const ok = (res, data) => res.json({ ok: true, ...data });
const fail = (res, err) => res.status(502).json({ ok: false, error: err.message });

router.get('/weather', async (req, res) => {
  try {
    ok(res, { weather: await getWeather(req.query.lat, req.query.lng) });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/quakes', async (req, res) => {
  try {
    ok(res, await getRecentQuakes(req.query.lat, req.query.lng));
  } catch (e) {
    fail(res, e);
  }
});

router.get('/alerts', async (req, res) => {
  try {
    ok(res, await getAlerts(req.query.country || 'Philippines'));
  } catch (e) {
    fail(res, e);
  }
});

router.get('/geocode', async (req, res) => {
  try {
    const hit = await geocode(req.query.q);
    if (!hit) return res.status(404).json({ ok: false, error: 'No match' });
    ok(res, { result: hit });
  } catch (e) {
    fail(res, e);
  }
});

// Route from a point to a specific evacuation centre (for the "Get directions" button).
router.get('/route', async (req, res) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    ok(res, { route: await getRoute(fromLat, fromLng, toLat, toLng) });
  } catch (e) {
    fail(res, e);
  }
});

// Nearest open centres to a point, ranked by real driving distance (OSRM table).
router.get('/nearest-centers', async (req, res) => {
  try {
    const centers = db.prepare("SELECT * FROM evacuation_centers WHERE status != 'closed'").all();
    const ranked = await rankByDistance(
      parseFloat(req.query.lat),
      parseFloat(req.query.lng),
      centers
    );
    ok(res, { centers: ranked });
  } catch (e) {
    fail(res, e);
  }
});

// Centres as plain JSON for map markers.
router.get('/centers', (req, res) => {
  ok(res, { centers: db.prepare('SELECT * FROM evacuation_centers').all() });
});

module.exports = router;
