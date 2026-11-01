'use strict';

// Handa - Community Disaster Readiness Portal
// Main Express application: middleware wiring, route mounting, error handling.

const path = require('path');
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');

const config = require('./src/config');
const db = require('./src/db'); // opens DB, creates schema, seeds on first run
const SqliteStore = require('./src/session-store');
const { locals } = require('./src/middleware/auth');
const csrf = require('./src/middleware/csrf');

const authRoutes = require('./src/routes/auth');
const dashboardRoutes = require('./src/routes/dashboard');
const reportRoutes = require('./src/routes/reports');
const centerRoutes = require('./src/routes/centers');
const adminRoutes = require('./src/routes/admin');
const apiRoutes = require('./src/routes/api');

const app = express();

// View engine (server-rendered EJS).
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets.
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing + HTML-form method override (?_method=PUT/DELETE).
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

// Sessions (persisted in SQLite so logins survive restarts in dev).
app.use(
  session({
    store: new SqliteStore(),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: config.isProd, // HTTPS-only cookies in production
    },
  })
);

// Behind a proxy (Render/Railway) so secure cookies work.
if (config.isProd) app.set('trust proxy', 1);

// Shared template locals + CSRF for every request.
app.use(locals);
app.use(csrf);

// Make config bits available to all views.
app.use((req, res, next) => {
  res.locals.appName = 'Handa';
  res.locals.tagline = 'Community Disaster Readiness Portal';
  next();
});

// --- Routes -----------------------------------------------------------------
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect(res.locals.currentUser && res.locals.currentUser.role === 'admin' ? '/admin' : '/dashboard');
  }
  res.render('home', { title: 'Welcome' });
});

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/reports', reportRoutes);
app.use('/centers', centerRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// --- 404 --------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not found',
    message: `Page not found: ${req.originalUrl}`,
  });
});

// --- Error handler ----------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: config.isProd ? 'An unexpected error occurred.' : err.message,
  });
});

app.listen(config.port, () => {
  console.log(`\n  Handa running at http://localhost:${config.port}`);
  console.log(`  Admin login: ${config.admin.email} / (see ADMIN_PASSWORD, default "Admin@123")\n`);
});
