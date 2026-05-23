"use strict";

const readline = require("node:readline/promises");
const api = require("../lib/api");
const { writeConfig, deleteConfig, readConfig } = require("../lib/config");

// ── Login ─────────────────────────────────────────────────────────────────────
async function login() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const email = (await rl.question("Email: ")).trim();

    if (!email || !email.includes("@")) {
      console.error("Enter a valid email address.");
      process.exit(1);
    }

    try {
      await api.post("/auth/otp", { email });
    } catch (err) {
      console.error("Failed to send code:", err.message);
      process.exit(1);
    }

    console.log("\nCode sent to " + email);
    console.log("Check your email and enter the code below.\n");

    const code = (await rl.question("Enter code: ")).trim();

    if (!code || !/^\d+$/.test(code)) {
      console.error("Invalid code.");
      process.exit(1);
    }

    let data;
    try {
      data = await api.post("/auth/verify", { email, token: code });
    } catch {
      console.error("Invalid or expired code. Run: prepcli auth login");
      process.exit(1);
    }

    writeConfig({
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      user_id:       data.user_id,
      email:         data.email,
      expires_at:    data.expires_at,
    });

    console.log("\nLogged in as " + data.email);
    console.log("Run `prepcli init` inside your project to set it up.");

  } finally {
    rl.close();
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function logout() {
  const cfg = readConfig();

  if (!cfg) {
    console.log("Already logged out.");
    return;
  }

  try {
    await api.post("/auth/logout", {}, cfg.access_token);
  } catch {
    // Local cleanup is what matters
  }

  deleteConfig();
  console.log("Logged out.");
}

// ── Status ────────────────────────────────────────────────────────────────────
async function status() {
  const { refreshIfNeeded } = require("../lib/config");
  let cfg = readConfig();

  if (!cfg || !cfg.access_token) {
    console.log("Not logged in.");
    console.log("Run: prepcli auth login");
    return;
  }

  const now  = Math.floor(Date.now() / 1000);
  const ttl  = (cfg.expires_at || 0) - now;

  if (ttl <= 300) {
    const refreshed = await refreshIfNeeded();
    if (refreshed) cfg = refreshed;
  }

  const expired    = cfg.expires_at && now >= cfg.expires_at;
  const expiresStr = cfg.expires_at
    ? new Date(cfg.expires_at * 1000).toLocaleString()
    : "unknown";

  const tokenStatus = expired
    ? "EXPIRED — run: prepcli auth login"
    : "valid until " + expiresStr;

  console.log("Logged in as: " + cfg.email);
  console.log("User ID:      " + cfg.user_id);
  console.log("Token:        " + tokenStatus);
  console.log("Auto-refresh: enabled");
}

// ── Router ────────────────────────────────────────────────────────────────────
async function run(action) {
  switch (action) {
    case "login":  await login();  break;
    case "logout": await logout(); break;
    case "status": await status(); break;
    default:
      console.error("Unknown auth action: \"" + action + "\". Use: login | logout | status");
      process.exit(1);
  }
}

module.exports = { run };
