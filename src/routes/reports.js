'use strict';

// CRUD MODULE #1 - Incident Reports.
// Residents create reports about hazards in their area; owners can edit/delete
// their own; admins can view all, change status, and delete any.

const express = require('express');
const db = require('../db');
const { geocode } = require('../services/geocode');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const TYPES = ['flood', 'landslide', 'fire', 'earthquake', 'typhoon', 'medical', 'other'];
const SEVERITIES = ['low', 'medium', 'high'];

function isAdmin(res) {
  return res.locals.currentUser && res.locals.currentUser.role === 'admin';
}

// Load a report and enforce "owner or admin" for write actions.
function loadReport(req, res) {
  const report = db.prepare('SELECT * FROM incident_reports WHERE id = ?').get(req.params.id);
  if (!report) {
    res.status(404).render('error', { title: 'Not found', message: 'Report not found.' });
    return null;
  }
  return report;
}

function canModify(res, report) {
  return isAdmin(res) || report.user_id === res.locals.currentUser.id;
}

// --- List (READ) ------------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const admin = isAdmin(res);
  const statusFilter = TYPES.includes(req.query.type) ? req.query.type : null;

  let rows;
  if (admin) {
    rows = db
      .prepare(
        `SELECT r.*, u.name AS reporter
         FROM incident_reports r JOIN users u ON u.id = r.user_id
         ${statusFilter ? 'WHERE r.type = ?' : ''}
         ORDER BY r.created_at DESC`
      )
      .all(...(statusFilter ? [statusFilter] : []));
  } else {
    rows = db
      .prepare(
        `SELECT r.*, u.name AS reporter
         FROM incident_reports r JOIN users u ON u.id = r.user_id
         WHERE r.user_id = ? ${statusFilter ? 'AND r.type = ?' : ''}
         ORDER BY r.created_at DESC`
      )
      .all(...(statusFilter ? [res.locals.currentUser.id, statusFilter] : [res.locals.currentUser.id]));
  }

  res.render('reports/list', {
    title: admin ? 'All incident reports' : 'My incident reports',
    reports: rows,
    admin,
    types: TYPES,
    typeFilter: statusFilter,
  });
});

// --- New form (CREATE) ------------------------------------------------------
router.get('/new', requireAuth, (req, res) => {
  res.render('reports/form', {
    title: 'Report an incident',
    report: { severity: 'medium', address: res.locals.currentUser.address || '' },
    types: TYPES,
    severities: SEVERITIES,
    action: '/reports',
    method: 'POST',
  });
});

// --- Create -----------------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  const { type, title, description, address, severity } = req.body;
  const errors = [];
  if (!TYPES.includes(type)) errors.push('Choose a valid incident type.');
  if (!title || title.trim().length < 3) errors.push('Give the report a short title.');
  if (!SEVERITIES.includes(severity)) errors.push('Choose a severity.');

  if (errors.length) {
    req.session.flash = { type: 'error', message: errors.join(' ') };
    return res.render('reports/form', {
      title: 'Report an incident',
      report: req.body,
      types: TYPES,
      severities: SEVERITIES,
      action: '/reports',
      method: 'POST',
    });
  }

  // Geocode the address (OpenStreetMap) so the report shows on the map.
  let lat = null;
  let lng = null;
  if (address && address.trim()) {
    try {
      const hit = await geocode(address);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      }
    } catch (_) {
      /* non-fatal */
    }
  }

  db.prepare(
    `INSERT INTO incident_reports (user_id, type, title, description, address, lat, lng, severity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    res.locals.currentUser.id,
    type,
    title.trim(),
    (description || '').trim(),
    (address || '').trim() || null,
    lat,
    lng,
    severity
  );

  req.session.flash = { type: 'success', message: 'Incident reported. Thank you!' };
  res.redirect('/reports');
});

// --- Detail (READ one) ------------------------------------------------------
router.get('/:id', requireAuth, (req, res) => {
  const report = loadReport(req, res);
  if (!report) return;
  if (!isAdmin(res) && report.user_id !== res.locals.currentUser.id) {
    return res.status(403).render('error', { title: 'Forbidden', message: 'Not your report.' });
  }
  const reporter = db.prepare('SELECT name, email FROM users WHERE id = ?').get(report.user_id);
  res.render('reports/detail', {
    title: report.title,
    report,
    reporter,
    admin: isAdmin(res),
  });
});

// --- Edit form (UPDATE) -----------------------------------------------------
router.get('/:id/edit', requireAuth, (req, res) => {
  const report = loadReport(req, res);
  if (!report) return;
  if (!canModify(res, report)) {
    return res.status(403).render('error', { title: 'Forbidden', message: 'Not allowed.' });
  }
  res.render('reports/form', {
    title: 'Edit report',
    report,
    types: TYPES,
    severities: SEVERITIES,
    action: `/reports/${report.id}?_method=PUT`,
    method: 'POST',
  });
});

// --- Update -----------------------------------------------------------------
router.put('/:id', requireAuth, async (req, res) => {
  const report = loadReport(req, res);
  if (!report) return;
  if (!canModify(res, report)) {
    return res.status(403).render('error', { title: 'Forbidden', message: 'Not allowed.' });
  }

  const { type, title, description, address, severity } = req.body;
  if (!TYPES.includes(type) || !title || !SEVERITIES.includes(severity)) {
    req.session.flash = { type: 'error', message: 'Please complete all required fields.' };
    return res.redirect(`/reports/${report.id}/edit`);
  }

  let { lat, lng } = report;
  if (address && address.trim() !== (report.address || '')) {
    try {
      const hit = await geocode(address);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      }
    } catch (_) {
      /* keep old coords */
    }
  }

  db.prepare(
    `UPDATE incident_reports
     SET type = ?, title = ?, description = ?, address = ?, lat = ?, lng = ?, severity = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(type, title.trim(), (description || '').trim(), (address || '').trim() || null, lat, lng, severity, report.id);

  req.session.flash = { type: 'success', message: 'Report updated.' };
  res.redirect(`/reports/${report.id}`);
});

// --- Change status (admin action) -------------------------------------------
router.post('/:id/status', requireAuth, (req, res) => {
  if (!isAdmin(res)) {
    return res.status(403).render('error', { title: 'Forbidden', message: 'Admin only.' });
  }
  const report = loadReport(req, res);
  if (!report) return;
  const status = req.body.status;
  if (!['pending', 'verified', 'resolved'].includes(status)) {
    req.session.flash = { type: 'error', message: 'Invalid status.' };
    return res.redirect('/reports');
  }
  db.prepare("UPDATE incident_reports SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, report.id);
  req.session.flash = { type: 'success', message: `Report marked ${status}.` };
  res.redirect(req.get('referer') || '/reports');
});

// --- Delete -----------------------------------------------------------------
router.delete('/:id', requireAuth, (req, res) => {
  const report = loadReport(req, res);
  if (!report) return;
  if (!canModify(res, report)) {
    return res.status(403).render('error', { title: 'Forbidden', message: 'Not allowed.' });
  }
  db.prepare('DELETE FROM incident_reports WHERE id = ?').run(report.id);
  req.session.flash = { type: 'success', message: 'Report deleted.' };
  res.redirect('/reports');
});

module.exports = router;
