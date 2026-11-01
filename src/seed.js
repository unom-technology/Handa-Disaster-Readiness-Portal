'use strict';

// Standalone seeding entry point (`npm run seed`).
// Requiring the db module runs the schema creation + seed logic, then we exit.

require('./db');
console.log('[seed] Database ready.');
process.exit(0);
