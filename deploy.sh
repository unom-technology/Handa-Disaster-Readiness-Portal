#!/usr/bin/env bash
#
# Handa — deploy / update script
# Usage:  bash deploy.sh
#
# Steps:
#   [1] Pull the latest code (if this is a git clone with a remote)
#   [2] Install / update npm packages
#   [3] Make sure pm2 is installed
#   [4] Create or update the SQLite database schema
#   [5] Start the app under pm2 — or restart it if it is already running
#
set -euo pipefail

APP_NAME="Handa-Sys"
ENTRY="server.js"

cd "$(dirname "$0")"

# --- pretty output ----------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[x]${NC} $*" >&2; exit 1; }

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Handa — Deploy / Update  (pm2: ${APP_NAME})${NC}"
echo -e "${GREEN}=============================================${NC}"

# --- 0. requirements --------------------------------------------------------
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Get it from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || die "npm is not available."
echo "    node $(node --version)  ·  npm $(npm --version)"

# --- 1. pull latest code ----------------------------------------------------
step "Checking for code updates..."
if [ -d .git ] && git remote | grep -q .; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [ -n "$(git status --porcelain)" ]; then
    warn "You have uncommitted local changes — skipping 'git pull' so nothing is lost."
    warn "Commit or stash them first if you want to pull."
  else
    git pull --ff-only origin "$BRANCH" && echo "    Up to date with origin/$BRANCH."
  fi
else
  warn "No git remote configured — running with the local code as-is."
fi

# --- 2. install / update packages ------------------------------------------
step "Installing / updating npm packages..."
npm install --no-fund --no-audit
echo "    Dependencies ready."

# --- 3. pm2 -----------------------------------------------------------------
step "Checking pm2..."
if ! command -v pm2 >/dev/null 2>&1; then
  warn "pm2 not found — installing it globally..."
  npm install -g pm2
else
  echo "    pm2 $(pm2 --version) already installed."
fi

# --- 4. database ------------------------------------------------------------
# src/db.js uses CREATE TABLE IF NOT EXISTS, so this is safe to run every time:
# it creates the database and any missing tables, and seeds the admin account
# plus sample evacuation centers only when they don't exist yet.
step "Applying database schema (SQLite)..."
node src/seed.js
echo "    Database at data/handa.db is up to date."

# --- 5. start or restart ----------------------------------------------------
step "Starting application under pm2 as '${APP_NAME}'..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
  echo "    Restarted existing process."
else
  pm2 start "$ENTRY" --name "$APP_NAME"
  echo "    Created new pm2 process."
fi

pm2 save >/dev/null 2>&1 || warn "Could not save the pm2 process list (non-fatal)."

# --- done -------------------------------------------------------------------
echo
pm2 list
PORT_IN_USE="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || true)"
echo -e "\n${GREEN}[✓] Deployment complete.${NC}"
echo "    App URL   : http://localhost:${PORT_IN_USE:-3000}"
echo "    Live logs : pm2 logs ${APP_NAME}"
echo "    Stop      : pm2 stop ${APP_NAME}"
echo "    Status    : pm2 status"
