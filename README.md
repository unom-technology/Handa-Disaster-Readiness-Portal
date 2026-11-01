# 🛟 Handa — Community Disaster Readiness Portal

An **API-integrated web system** that helps residents and barangay/LGU administrators
prepare for and respond to disasters. It brings live weather, earthquake data, and
official disaster alerts into one dashboard, lets residents report local hazards,
and helps everyone find the nearest evacuation center with driving directions.

> Built for the **Final Project: API-Integrated System**. Node.js + Express, server-rendered
> with EJS, backed by SQLite. All integrated APIs are **free and keyless** — no paid accounts needed.

---

## ✅ How it meets the project requirements

| Requirement | Where it's implemented |
|---|---|
| **≥ 5 external APIs** | **6 integrated** — see the table below |
| **Registration & login, ≥ 2 roles** | `admin` and `resident` roles — [`src/routes/auth.js`](src/routes/auth.js), bcrypt password hashing, session login |
| **Database of the system's own records** | SQLite via `better-sqlite3` — [`src/db.js`](src/db.js): `users`, `incident_reports`, `evacuation_centers`, `alert_broadcasts` |
| **≥ 1 full CRUD module** | **2 full CRUD modules** — Incident Reports ([`src/routes/reports.js`](src/routes/reports.js)) and Evacuation Centers ([`src/routes/centers.js`](src/routes/centers.js)) |
| **Admin dashboard / summary page** | [`/admin`](src/routes/dashboard.js) — stats, charts, community map |
| **Version control + regular commits** | Git (see note at the bottom) |
| **Deployable on free hosting** | Works on Render / Railway — see **Deployment** |

### The 6 integrated APIs (all free, no API key)

| # | API | Purpose | Code |
|---|-----|---------|------|
| 1 | **Open-Meteo** | Live weather + 4-day forecast, rain/wind risk flags | [`src/services/weather.js`](src/services/weather.js) |
| 2 | **USGS Earthquake** | Recent earthquakes near the user | [`src/services/quakes.js`](src/services/quakes.js) |
| 3 | **GDACS** | Official multi-hazard disaster alerts (typhoon, flood, quake…) | [`src/services/gdacs.js`](src/services/gdacs.js) |
| 4 | **Nominatim / OpenStreetMap** | Geocoding (address → map coordinates) | [`src/services/geocode.js`](src/services/geocode.js) |
| 5 | **OSRM** | Routing & distance to the nearest evacuation center | [`src/services/routing.js`](src/services/routing.js) |
| 6 | **Nodemailer (SMTP / Ethereal)** | Emergency email broadcasts to residents | [`src/services/mailer.js`](src/services/mailer.js) |

> Leaflet + OpenStreetMap tiles power the interactive maps in the browser.

---

## 🚀 Quick start (local)

**Requirements:** [Node.js](https://nodejs.org) 18 or newer (tested on Node 24).

```bash
# 1. Install dependencies
npm install

# 2. (Optional) copy the example environment file and edit it
cp .env.example .env      # Windows PowerShell: copy .env.example .env

# 3. Start the server
npm start                 # or: npm run dev   (auto-restarts on file changes)
```

Then open **http://localhost:3000**.

### Default admin login (created automatically on first run)

```
Email:    admin@handa.local
Password: Admin@123
```

Change these with `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` **before** the first run,
or update them later from the **Users** page / a new admin account.

Register any new account from the **Sign up** page — new accounts are `resident` by
default; an admin can promote them under **Users**.

---

## 🧭 Using the system

### As a resident
- **Dashboard** — live weather, nearby earthquakes, GDACS alerts, the nearest
  evacuation centers, and an interactive map.
- **Report an incident** — file a flood/fire/landslide/etc. report. The address you
  type is geocoded (OpenStreetMap) so it appears on the map. Full CRUD on your own reports.
- **Evac Centers** — browse all centers on a map and click one to get **driving
  directions** from your saved address (OSRM).
- **Profile** — set your home address (localises your data) and toggle email alerts.

### As an admin
- **Admin dashboard** — totals for users, reports (by type & status), evacuation
  centers, and live GDACS alert count, plus a community map.
- **Reports** — view **all** residents' reports; verify / resolve / edit / delete.
- **Centers** — full CRUD on evacuation centers.
- **Users** — promote/demote roles, delete accounts.
- **Send Alert** — email a broadcast to all opted-in residents.

---

## 📧 Email configuration

By default (no SMTP settings), the app auto-creates a **free Ethereal test inbox**.
No real email is sent — instead a **preview link** is printed to the console and shown
on the **Send Alert** page, so you can demo broadcasts without any signup.

To send **real** email, fill these into `.env` (e.g. a Gmail *App Password*):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM="Handa Alerts <your@gmail.com>"
```

---

## 🗂️ Project structure

```
Josh_App/
├─ server.js                  # Express app: middleware, routes, error handling
├─ src/
│  ├─ config.js               # Env config with safe defaults
│  ├─ db.js                   # SQLite schema + seed (admin + sample centers)
│  ├─ seed.js                 # `npm run seed` entry point
│  ├─ session-store.js        # Custom SQLite-backed session store (no extra deps)
│  ├─ middleware/
│  │  ├─ auth.js              # requireAuth / requireAdmin / view locals
│  │  └─ csrf.js              # Per-session CSRF protection
│  ├─ routes/
│  │  ├─ auth.js              # register / login / logout / profile
│  │  ├─ dashboard.js         # resident dashboard + admin dashboard
│  │  ├─ reports.js           # CRUD module #1: incident reports
│  │  ├─ centers.js           # CRUD module #2: evacuation centers
│  │  ├─ admin.js             # user management + alert broadcasts
│  │  └─ api.js               # internal JSON API (maps/live refresh)
│  └─ services/               # one file per external API
│     ├─ http.js  weather.js  quakes.js  gdacs.js  geocode.js  routing.js  mailer.js
├─ views/                     # EJS templates (pages + partials)
├─ public/
│  ├─ css/style.css           # single responsive stylesheet
│  └─ js/app.js               # Leaflet maps + routing (browser)
└─ data/                      # SQLite database lives here (gitignored)
```

---

## 🧠 Key design decisions (handy for the Q&A)

- **Server-rendered EJS** instead of a separate SPA — fewer moving parts, easier to
  run and explain, and the whole request/response flow is visible.
- **SQLite (`better-sqlite3`)** — a real relational database with SQL, foreign keys and
  constraints, but zero separate DB server to install. Easy to swap for PostgreSQL/MySQL later.
- **API logic lives on the server** (`src/services/*`). The browser calls our own
  `/api/*` endpoints, so keys/limits/caching stay server-side and the UI stays simple.
- **Resilient dashboard** — external APIs are fetched with `Promise.allSettled`, so one
  slow or failing API never breaks the page; each card degrades gracefully.
- **Security basics** — passwords hashed with bcrypt, HTTP-only session cookies,
  per-session CSRF tokens on every form, and role checks on every protected route.
- **Custom session store** — a ~90-line SQLite-backed `express-session` store so logins
  survive restarts without adding a dependency.

---

## ☁️ Deployment (free tier)

Works on **Render**, **Railway**, etc.

1. Push this repo to GitHub.
2. Create a new **Web Service** from the repo.
   - **Build command:** `npm install`
   - **Start command:** `npm start`
3. Set environment variables: `SESSION_SECRET` (a long random string),
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `NODE_ENV=production`. Add SMTP vars for real email.

> ⚠️ **Note on the database:** SQLite stores data in a file under `data/`. Some free
> hosts use an *ephemeral* filesystem, so data can reset on redeploys/restarts. That's
> fine for a demo. For persistent production data, attach a persistent disk or switch
> the database layer to PostgreSQL (e.g. Supabase/Neon free tier).

---

## 📜 Data sources & attribution

Weather by **Open-Meteo** · Earthquakes by **USGS** · Disaster alerts by **GDACS** ·
Geocoding & map tiles © **OpenStreetMap** contributors (via **Nominatim** & **Leaflet**) ·
Routing by **OSRM**. Please respect each provider's fair-use/usage policy.

---

## ✍️ A note on authorship & commits

This is an **individual** project and the commit history is part of the grade. Commit
**regularly and in your own words** as you study, customize, and extend the system, and
make sure you can **explain every part** during the Q&A (see *Key design decisions* above).
Good next steps to make it yours: add your own barangay's evacuation centers, add SMS
alerts, or add charts to the admin dashboard.
