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

// Single source of truth for the decision-record markdown format.
// Callers prepare the section text; this only renders.
function renderRecord({ id, commitHash, filesChanged, workflow, aiTurnCount, summary, why, ruledOut, turns }) {
  const date      = new Date().toISOString();
  const filesList = (filesChanged || []).join(", ") || "none";

  return `---
id: ${id}
commit: ${commitHash || "none"}
date: ${date}
workflow: ${workflow}
files_changed: [${filesList}]
ai_turn_count: ${aiTurnCount}
---

## Summary
${summary}

## Why This Approach
${why}

## What Was Tried and Ruled Out
${ruledOut}

## AI Session Turns
${turns}
`;
}

function buildRecord({ id, session, commitHash, filesChanged, summary }) {
  const turns = session.turns || [];

  return renderRecord({
    id, commitHash, filesChanged,
    workflow:    [...new Set(turns.map(t => t.workflow))].join(", ") || "unknown",
    aiTurnCount: turns.length,
    summary:     summary || turns.map(t => t.what).join("; "),
    why:         turns.filter(t => t.why).pop()?.why || "Not recorded.",
    ruledOut:    turns.filter(t => t.why).map(t => `- ${t.why}`).join("\n") || "None recorded.",
    turns:       turns.map((t, i) => `${i + 1}. [${t.workflow}]  ${t.what}`).join("\n") || "None recorded.",
  });
}

function recordFilename(id, date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${d}-${id}.md`;
}

module.exports = { generateId, getCurrentCommit, getChangedFiles, renderRecord, buildRecord, recordFilename };
