"use strict";

const fs   = require("node:fs");
const path = require("node:path");
const { gitRoot } = require("./git");

const SESSION_FILENAME = ".prepcli-session";
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

function sessionPath(cwd = process.cwd()) {
  return path.join(gitRoot(cwd), SESSION_FILENAME);
}

function addTurn({ workflow, what, why }, cwd = process.cwd()) {
  const filePath = sessionPath(cwd);
  const existing = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf8"))
    : { started_at: new Date().toISOString(), turns: [] };

  existing.turns.push({ workflow, what, why: why || "", at: new Date().toISOString() });
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf8");
}

function readSession(cwd = process.cwd()) {
  const filePath = sessionPath(cwd);
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return null; }
}

function clearSession(cwd = process.cwd()) {
  const filePath = sessionPath(cwd);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function isSessionStale(cwd = process.cwd()) {
  const session = readSession(cwd);
  if (!session?.started_at) return false;
  return Date.now() - new Date(session.started_at).getTime() > STALE_MS;
}

module.exports = { SESSION_FILENAME, sessionPath, addTurn, readSession, clearSession, isSessionStale };
