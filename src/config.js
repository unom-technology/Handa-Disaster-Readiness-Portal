'use strict';

// Loads environment variables from .env (if present) and exposes typed config
// with safe defaults so the app boots even with a bare checkout.
require('dotenv').config();

const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'handa-dev-secret-change-me',

  // Paths
  rootDir: path.join(__dirname, '..'),
  dataDir: path.join(__dirname, '..', 'data'),
  dbPath: path.join(__dirname, '..', 'data', 'handa.db'),

  // Default map centre (Manila, PH) used until a user saves their own address.
  defaultLat: parseFloat(process.env.DEFAULT_LAT) || 14.5995,
  defaultLng: parseFloat(process.env.DEFAULT_LNG) || 120.9842,
  defaultPlace: process.env.DEFAULT_PLACE || 'Manila, Philippines',

  // Seed admin (created once when the database is first built).
  admin: {
    name: process.env.ADMIN_NAME || 'System Administrator',
    email: (process.env.ADMIN_EMAIL || 'admin@handa.local').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },

  // External API base URLs (all free / keyless).
  api: {
    openMeteo: 'https://api.open-meteo.com/v1/forecast',
    usgs: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    gdacs: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
    nominatim: 'https://nominatim.openstreetmap.org/search',
    osrm: 'https://router.project-osrm.org',
  },

  // Nominatim asks for an identifying User-Agent (optionally with a contact).
  nominatimUserAgent:
    'HandaReadinessPortal/1.0' +
    (process.env.NOMINATIM_CONTACT ? ` (${process.env.NOMINATIM_CONTACT})` : ''),

  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Handa Readiness Portal <no-reply@handa.local>',
  },

  isProd: process.env.NODE_ENV === 'production',
};

module.exports = config;
