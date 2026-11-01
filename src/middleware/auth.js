'use strict';

// Authentication / authorisation middleware and shared view locals.

const db = require('../db');

// Makes the logged-in user (and a few globals) available to every EJS template.
function locals(req, res, next) {
  let user = null;
  if (req.session.userId) {
    user = db
      .prepare('SELECT id, name, email, role, address, lat, lng, alerts_opt_in FROM users WHERE id = ?')
      .get(req.session.userId);
  }
  res.locals.currentUser = user;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.path = req.path;
  next();
}

// Gate for any logged-in user.
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  next();
}

// Gate for admins only.
function requireAdmin(req, res, next) {
  if (!res.locals.currentUser || res.locals.currentUser.role !== 'admin') {
    req.session.flash = { type: 'error', message: 'Admin access required.' };
    return res.redirect('/dashboard');
  }
  next();
}

// Redirect already-authenticated users away from login/register.
function redirectIfAuthed(req, res, next) {
  if (req.session.userId) return res.redirect('/dashboard');
  next();
}

module.exports = { locals, requireAuth, requireAdmin, redirectIfAuthed };
