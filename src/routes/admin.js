'use strict';

// Admin-only: user management and emergency alert broadcasts (email).

const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { broadcast } = require('../services/mailer');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// --- Users ------------------------------------------------------------------
router.get('/users', (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, address, alerts_opt_in, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.render('admin/users', { title: 'Manage users', users });
});

router.post('/users/:id/role', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const role = req.body.role === 'admin' ? 'admin' : 'resident';

  if (id === res.locals.currentUser.id) {
    req.session.flash = { type: 'error', message: 'You cannot change your own role.' };
    return res.redirect('/admin/users');
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  req.session.flash = { type: 'success', message: `Role updated to ${role}.` };
  res.redirect('/admin/users');
});

router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === res.locals.currentUser.id) {
    req.session.flash = { type: 'error', message: 'You cannot delete your own account.' };
    return res.redirect('/admin/users');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  req.session.flash = { type: 'success', message: 'User deleted.' };
  res.redirect('/admin/users');
});

// --- Emergency alert broadcasts (email) -------------------------------------
router.get('/alerts', (req, res) => {
  const history = db
    .prepare(
      `SELECT b.*, u.name AS admin_name
       FROM alert_broadcasts b LEFT JOIN users u ON u.id = b.admin_id
       ORDER BY b.created_at DESC LIMIT 20`
    )
    .all();
  const optedIn = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE alerts_opt_in = 1 AND role = 'resident'")
    .get().n;
  res.render('admin/alerts', { title: 'Send alert', history, optedIn });
});

router.post('/alerts', async (req, res) => {
  const subject = (req.body.subject || '').trim();
  const message = (req.body.message || '').trim();

  if (subject.length < 3 || message.length < 5) {
    req.session.flash = { type: 'error', message: 'Please enter a subject and message.' };
    return res.redirect('/admin/alerts');
  }

  const recipients = db
    .prepare("SELECT email FROM users WHERE alerts_opt_in = 1 AND role = 'resident'")
    .all()
    .map((r) => r.email);

  let previewUrl = null;
  let count = 0;
  try {
    const result = await broadcast({ recipients, subject, text: message });
    count = result.recipientsCount;
    previewUrl = result.previewUrl;
  } catch (err) {
    req.session.flash = { type: 'error', message: `Email failed: ${err.message}` };
    return res.redirect('/admin/alerts');
  }

  db.prepare(
    `INSERT INTO alert_broadcasts (admin_id, title, message, recipients_count, preview_url)
     VALUES (?, ?, ?, ?, ?)`
  ).run(res.locals.currentUser.id, subject, message, count, previewUrl);

  req.session.flash = {
    type: 'success',
    message:
      `Alert sent to ${count} resident(s).` +
      (previewUrl ? ` Ethereal preview available below.` : ''),
  };
  res.redirect('/admin/alerts');
});

module.exports = router;
