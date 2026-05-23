"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CONFIG_DIR  = path.join(os.homedir(), ".prepcli");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const RC_FILE            = ".prepclirc";
const KNOWN_EMAILS_FILE   = path.join(CONFIG_DIR, "known_emails.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function deleteConfig() {
  try { fs.unlinkSync(CONFIG_FILE); } catch {}
}

function isLoggedIn() {
  const cfg = readConfig();
  return !!(cfg && cfg.access_token);
}

// Silently refresh the access token if it expires within 5 minutes.
// Uses the stored refresh_token — user never needs to re-login unless
// the refresh token itself expires (30 days, configurable in Supabase).
async function refreshIfNeeded() {
  const cfg = readConfig();
  if (!cfg) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = (cfg.expires_at || 0) - now;

  // Still valid for more than 5 minutes — nothing to do
  if (expiresIn > 300) return cfg;

  if (!cfg.refresh_token) {
    // No refresh token stored — force re-login
    deleteConfig();
    return null;
  }

  try {
    const api = require("./api");
    const data = await api.post("/auth/refresh", { refresh_token: cfg.refresh_token });

    const updated = {
      ...cfg,
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
    };
    writeConfig(updated);
    return updated;

  } catch (err) {
    if (err.message === "session_expired") {
      deleteConfig();
      return null;
    }
    // Network error — return existing config and let the next API call fail naturally
    return cfg;
  }
}

function requireLogin() {
  if (!isLoggedIn()) {
    console.error("Not logged in. Run: prepcli auth login");
    process.exit(1);
  }
  return readConfig();
}

// Async version — use this in all commands that call Supabase.
// Silently refreshes the token if needed before returning.
async function requireLoginFresh() {
  if (!isLoggedIn()) {
    console.error("Not logged in. Run: prepcli auth login");
    process.exit(1);
  }
  const cfg = await refreshIfNeeded();
  if (!cfg) {
    console.error("Session expired. Run: prepcli auth login");
    process.exit(1);
  }
  return cfg;
}

function readRC() {
  try {
    return JSON.parse(fs.readFileSync(RC_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeRC(data) {
  fs.writeFileSync(RC_FILE, JSON.stringify(data, null, 2));
}

function requireRC() {
  const rc = readRC();
  if (!rc || !rc.project_id) {
    console.error("No .prepclirc found. Run: npx prepcli init");
    process.exit(1);
  }
  return rc;
}


function readKnownEmails() {
  try {
    return JSON.parse(fs.readFileSync(KNOWN_EMAILS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function addKnownEmail(email) {
  const emails = readKnownEmails();
  const normalized = email.toLowerCase();
  if (!emails.includes(normalized)) {
    emails.push(normalized);
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(KNOWN_EMAILS_FILE, JSON.stringify(emails, null, 2));
  }
}

module.exports = {
  readConfig, writeConfig, deleteConfig,
  isLoggedIn, requireLogin, requireLoginFresh, refreshIfNeeded,
  readRC, writeRC, requireRC,
  readKnownEmails, addKnownEmail,
  CONFIG_FILE, RC_FILE, KNOWN_EMAILS_FILE
};
