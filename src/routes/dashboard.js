'use strict';

// Resident dashboard and admin dashboard. Both pull live data from the external
// APIs using Promise.allSettled so a single slow/failed API never breaks the page.

const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getWeather } = require('../services/weather');
const { getRecentQuakes } = require('../services/quakes');
const { getAlerts } = require('../services/gdacs');
const { rankByDistance } = require('../services/routing');

const router = express.Router();

// Resolve a settled promise into { data, error }.
function unwrap(result) {
  if (result.status === 'fulfilled') return { data: result.value, error: null };
  return { data: null, error: result.reason ? result.reason.message : 'Unavailable' };
}

// --- Resident dashboard -----------------------------------------------------
router.get('/dashboard', requireAuth, async (req, res) => {
  const user = res.locals.currentUser;
  const lat = user.lat || config.defaultLat;
  const lng = user.lng || config.defaultLng;

  const centers = db
    .prepare("SELECT * FROM evacuation_centers WHERE status != 'closed'")
    .all();

  const [weatherR, quakesR, alertsR, rankedR] = await Promise.allSettled([
    getWeather(lat, lng),
    getRecentQuakes(lat, lng),
    getAlerts('Philippines'),
    rankByDistance(lat, lng, centers),
  ]);

  const weather = unwrap(weatherR);
  const quakes = unwrap(quakesR);
  const alerts = unwrap(alertsR);
  const ranked = unwrap(rankedR);

  // Nearest 3 centres (fall back to raw list if OSRM ranking failed).
  const nearestCenters = ranked.data
    ? ranked.data.slice(0, 3)
    : centers.slice(0, 3);

  const myReports = db
    .prepare('SELECT * FROM incident_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
    .all(user.id);

  res.render('dashboard', {
    title: 'Dashboard',
    lat,
    lng,
    weather,
    quakes,
    alerts,
    nearestCenters,
    allCenters: centers,
    myReports,
  });
});

// --- Admin dashboard --------------------------------------------------------
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  // Summary counters straight from our own database.
  const stats = {
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    residents: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'resident'").get().n,
    reports: db.prepare('SELECT COUNT(*) AS n FROM incident_reports').get().n,
    pending: db.prepare("SELECT COUNT(*) AS n FROM incident_reports WHERE status = 'pending'").get().n,
    centers: db.prepare('SELECT COUNT(*) AS n FROM evacuation_centers').get().n,
    openCenters: db.prepare("SELECT COUNT(*) AS n FROM evacuation_centers WHERE status = 'open'").get().n,
    broadcasts: db.prepare('SELECT COUNT(*) AS n FROM alert_broadcasts').get().n,
  };

  const reportsByType = db
    .prepare('SELECT type, COUNT(*) AS n FROM incident_reports GROUP BY type ORDER BY n DESC')
    .all();
  const reportsByStatus = db
    .prepare('SELECT status, COUNT(*) AS n FROM incident_reports GROUP BY status')
    .all();

  const recentReports = db
    .prepare(
      `SELECT r.*, u.name AS reporter
       FROM incident_reports r JOIN users u ON u.id = r.user_id
       ORDER BY r.created_at DESC LIMIT 8`
    )
    .all();

  const allReports = db
    .prepare('SELECT id, type, title, lat, lng, severity, status FROM incident_reports WHERE lat IS NOT NULL')
    .all();
  const centers = db.prepare('SELECT * FROM evacuation_centers').all();

  // Live GDACS alert count for the header (best-effort).
  let alertCount = null;
  try {
    const a = await getAlerts('Philippines');
    alertCount = a.count;
  } catch (_) {
    /* ignore */
  }

  res.render('admin/dashboard', {
    title: 'Admin dashboard',
    stats,
    reportsByType,
    reportsByStatus,
    recentReports,
    allReports,
    centers,
    alertCount,
    mapCenter: { lat: config.defaultLat, lng: config.defaultLng },
  });
});

module.exports = router;
