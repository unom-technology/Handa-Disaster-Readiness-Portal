'use strict';

// CRUD MODULE #2 - Evacuation Centers.
// Anyone logged in can view the list/map. Only admins can create, edit, delete.

const express = require('express');
const db = require('../db');
const { geocode } = require('../services/geocode');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const STATUSES = ['open', 'full', 'closed'];

function load(req, res) {
  const center = db.prepare('SELECT * FROM evacuation_centers WHERE id = ?').get(req.params.id);
  if (!center) {
    res.status(404).render('error', { title: 'Not found', message: 'Evacuation center not found.' });
    return null;
  }
  return center;
}

// --- List / map (READ) ------------------------------------------------------
router.get('/', requireAuth, (req, res) => {
  const centers = db.prepare('SELECT * FROM evacuation_centers ORDER BY name').all();
  res.render('centers/list', {
    title: 'Evacuation centers',
    centers,
    admin: res.locals.currentUser.role === 'admin',
    user: res.locals.currentUser,
  });
});

// --- New form (CREATE, admin) ----------------------------------------------
router.get('/new', requireAuth, requireAdmin, (req, res) => {
  res.render('centers/form', {
    title: 'Add evacuation center',
    center: { status: 'open', capacity: 0 },
    statuses: STATUSES,
    action: '/centers',
    method: 'POST',
  });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const data = await buildFromBody(req.body);
  if (data.error) {
    req.session.flash = { type: 'error', message: data.error };
    return res.render('centers/form', {
      title: 'Add evacuation center',
      center: req.body,
      statuses: STATUSES,
      action: '/centers',
      method: 'POST',
    });
  }

  db.prepare(
    `INSERT INTO evacuation_centers (name, address, lat, lng, capacity, contact, status, notes)
     VALUES (@name, @address, @lat, @lng, @capacity, @contact, @status, @notes)`
  ).run(data.values);

  req.session.flash = { type: 'success', message: 'Evacuation center added.' };
  res.redirect('/centers');
});

// --- Edit form (UPDATE, admin) ---------------------------------------------
router.get('/:id/edit', requireAuth, requireAdmin, (req, res) => {
  const center = load(req, res);
  if (!center) return;
  res.render('centers/form', {
    title: 'Edit evacuation center',
    center,
    statuses: STATUSES,
    action: `/centers/${center.id}?_method=PUT`,
    method: 'POST',
  });
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const center = load(req, res);
  if (!center) return;

  const data = await buildFromBody(req.body, center);
  if (data.error) {
    req.session.flash = { type: 'error', message: data.error };
    return res.redirect(`/centers/${center.id}/edit`);
  }

  db.prepare(
    `UPDATE evacuation_centers
     SET name=@name, address=@address, lat=@lat, lng=@lng, capacity=@capacity,
         contact=@contact, status=@status, notes=@notes, updated_at=datetime('now')
     WHERE id=@id`
  ).run({ ...data.values, id: center.id });

  req.session.flash = { type: 'success', message: 'Evacuation center updated.' };
  res.redirect('/centers');
});

// --- Delete (admin) ---------------------------------------------------------
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const center = load(req, res);
  if (!center) return;
  db.prepare('DELETE FROM evacuation_centers WHERE id = ?').run(center.id);
  req.session.flash = { type: 'success', message: 'Evacuation center deleted.' };
  res.redirect('/centers');
});

// Validate + geocode a center payload. Reuses existing coords on edit when the
// address is unchanged.
async function buildFromBody(body, existing = null) {
  const name = (body.name || '').trim();
  const address = (body.address || '').trim();
  const capacity = parseInt(body.capacity, 10) || 0;
  const status = STATUSES.includes(body.status) ? body.status : 'open';
  const contact = (body.contact || '').trim();
  const notes = (body.notes || '').trim();

  if (name.length < 3) return { error: 'Center name is required.' };
  if (!address) return { error: 'Address is required (used to place it on the map).' };

  let lat = existing ? existing.lat : null;
  let lng = existing ? existing.lng : null;

  // Allow manual coordinate entry; otherwise geocode the address.
  if (body.lat && body.lng) {
    lat = parseFloat(body.lat);
    lng = parseFloat(body.lng);
  } else if (!existing || address !== existing.address) {
    try {
      const hit = await geocode(address);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      }
    } catch (_) {
      /* ignore */
    }
  }

  if (lat == null || lng == null) {
    return { error: 'Could not locate that address. Try a more specific one or enter coordinates.' };
  }

  return { values: { name, address, lat, lng, capacity, contact, status, notes } };
}

module.exports = router;
