'use strict';

// Registration, login, logout and profile (address) management.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { geocode } = require('../services/geocode');
const { requireAuth, redirectIfAuthed } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Register ---------------------------------------------------------------
router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('register', { title: 'Create account', form: {} });
});

router.post('/register', redirectIfAuthed, async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const address = (req.body.address || '').trim();

  const errors = [];
  if (name.length < 2) errors.push('Please enter your full name.');
  if (!EMAIL_RE.test(email)) errors.push('Please enter a valid email address.');
  if (password.length < 6) errors.push('Password must be at least 6 characters.');

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) errors.push('That email is already registered.');

  if (errors.length) {
    req.session.flash = { type: 'error', message: errors.join(' ') };
    return res.render('register', {
      title: 'Create account',
      form: { name, email, address },
    });
  }

  // Try to geocode the address so the dashboard has a location to work with.
  let lat = config.defaultLat;
  let lng = config.defaultLng;
  if (address) {
    try {
      const hit = await geocode(address);
      if (hit) {
        lat = hit.lat;
        lng = hit.lng;
      }
    } catch (_) {
      /* non-fatal: fall back to default coords */
    }
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, address, lat, lng)
       VALUES (?, ?, ?, 'resident', ?, ?, ?)`
    )
    .run(name, email, hash, address || null, lat, lng);

  req.session.userId = info.lastInsertRowid;
  req.session.flash = { type: 'success', message: `Welcome, ${name}!` };
  res.redirect('/dashboard');
});

// --- Login ------------------------------------------------------------------
router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('login', { title: 'Log in', form: {} });
});

router.post('/login', redirectIfAuthed, (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.session.flash = { type: 'error', message: 'Invalid email or password.' };
    return res.render('login', { title: 'Log in', form: { email } });
  }

  req.session.userId = user.id;
  req.session.flash = { type: 'success', message: `Welcome back, ${user.name}!` };
  res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
});

// --- Logout -----------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// --- Profile (update saved address / alert preference) ----------------------
router.get('/profile', requireAuth, (req, res) => {
  res.render('profile', { title: 'My profile' });
});

router.post('/profile', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim();
  const address = (req.body.address || '').trim();
  const optIn = req.body.alerts_opt_in ? 1 : 0;

  let lat = res.locals.currentUser.lat;
  let lng = res.locals.currentUser.lng;
  if (address && address !== res.locals.currentUser.address) {
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
    `UPDATE users SET name = ?, address = ?, lat = ?, lng = ?, alerts_opt_in = ?
     WHERE id = ?`
  ).run(name || res.locals.currentUser.name, address || null, lat, lng, optIn, req.session.userId);

  req.session.flash = { type: 'success', message: 'Profile updated.' };
  res.redirect('/profile');
});

module.exports = router;
