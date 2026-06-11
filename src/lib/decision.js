"use strict";

const crypto   = require("node:crypto");
const { execSync } = require("node:child_process");

function generateId() {
  return "dec-" + crypto.randomBytes(4).toString("hex");
}

function getCurrentCommit(cwd = process.cwd()) {
  try {
    return execSync("git rev-parse HEAD", { cwd, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  } catch { return null; }
}

function getChangedFiles(cwd = process.cwd()) {
  try {
    const out = execSync("git diff --name-only HEAD~1 HEAD", { cwd, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    return out.split("\n").filter(Boolean);
  } catch { return []; }
}

function buildRecord({ id, session, commitHash, filesChanged, summary }) {
  const date  = new Date().toISOString();
  const turns = session.turns || [];

  const workflows   = [...new Set(turns.map(t => t.workflow))].join(", ") || "unknown";
  const turnLines   = turns.map((t, i) => `${i + 1}. [${t.workflow}]  ${t.what}`).join("\n") || "None recorded.";
  const altLines    = turns.filter(t => t.why).map(t => `- ${t.why}`).join("\n") || "None recorded.";
  const lastWhy     = turns.filter(t => t.why).pop()?.why || "Not recorded.";
  const filesList   = (filesChanged || []).join(", ") || "unknown";

  return `---
id: ${id}
commit: ${commitHash || "none"}
date: ${date}
workflow: ${workflows}
files_changed: [${filesList}]
ai_turn_count: ${turns.length}
---

## Summary
${summary || turns.map(t => t.what).join("; ")}

## Why This Approach
${lastWhy}

## What Was Tried and Ruled Out
${altLines}

## AI Session Turns
${turnLines}
`;
}

function recordFilename(id, date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${d}-${id}.md`;
}

module.exports = { generateId, getCurrentCommit, getChangedFiles, buildRecord, recordFilename };
