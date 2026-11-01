'use strict';

// Lightweight CSRF protection: a per-session token injected into every form and
// verified on state-changing requests. Avoids the deprecated `csurf` package.

const crypto = require('crypto');

function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (mutating) {
    const sent = req.body._csrf || req.headers['x-csrf-token'];
    if (sent !== req.session.csrfToken) {
      return res.status(403).send('Invalid or missing CSRF token. Go back and retry.');
    }
  }
  next();
}

module.exports = csrf;
