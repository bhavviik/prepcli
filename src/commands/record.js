"use strict";

const readline = require("node:readline/promises");

const { generateId, getCurrentCommit, getChangedFiles, recordFilename } = require("../lib/decision");
const {
  shadowBranchExists, shadowBranchExistsOnRemote,
  initShadowBranch, fetchShadowBranch,
  writeDecisionRecord,
} = require("../lib/git");
const { isLoggedIn, requireLoginFresh, readRC, isOffline } = require("../lib/config");
const api = require("../lib/api");

async function prompt(rl, question, fallback = "") {
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
}

function buildRecord({ id, what, why, ruledOut, workflow, commitHash, filesChanged }) {
  const date      = new Date().toISOString();
  const filesList = (filesChanged || []).join(", ") || "none";
  const ruledOutSection = ruledOut
    ? ruledOut.split(",").map(r => `- ${r.trim()}`).join("\n")
    : "None recorded.";

  return `---
id: ${id}
commit: ${commitHash || "none"}
date: ${date}
workflow: ${workflow}
files_changed: [${filesList}]
ai_turn_count: 0
---

## Summary
${what}

## Why This Approach
${why}

## What Was Tried and Ruled Out
${ruledOutSection}

## AI Session Turns
Manual record — not from an AI session.
`;
}

async function run(opts = {}) {
  const cwd = process.cwd();

  // ── Collect fields ──────────────────────────────────────────────────────────
  let { what, why, ruledOut, workflow } = opts;

  if (!what || !why) {
    // Interactive mode
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    try {
      console.log("\n[prepcli] Recording decision\n");

      if (!what) {
        what = await prompt(rl, "What did you decide or discover?\n> ");
        if (!what) { console.log("Cancelled — nothing recorded."); return; }
      }

      if (!why) {
        why = await prompt(rl, "\nWhy?\n> ");
        if (!why) { console.log("Cancelled — nothing recorded."); return; }
      }

      if (!ruledOut) {
        ruledOut = await prompt(rl, "\nWhat was ruled out? (Enter to skip)\n> ");
      }

      if (!workflow) {
        workflow = await prompt(rl, "\nWorkflow? [manual/debug/plan/discovery] (Enter for manual)\n> ", "manual");
      }

    } finally {
      rl.close();
    }
  }

  workflow = workflow || "manual";

  // ── Ensure shadow branch exists ─────────────────────────────────────────────
  if (!shadowBranchExists(cwd)) {
    process.stdout.write("\nInitialising shadow branch...");
    if (shadowBranchExistsOnRemote(cwd)) {
      fetchShadowBranch(cwd);
      console.log(" fetched from remote.");
    } else {
      initShadowBranch(cwd);
      console.log(" created.");
    }
  }

  // ── Build and write record ──────────────────────────────────────────────────
  const id           = generateId();
  const commitHash   = getCurrentCommit(cwd);
  const filesChanged = getChangedFiles(cwd);
  const content      = buildRecord({ id, what, why, ruledOut, workflow, commitHash, filesChanged });
  const filename     = recordFilename(id);

  process.stdout.write("\nWriting to shadow branch...");
  try {
    writeDecisionRecord(filename, content, cwd);
  } catch(e) {
    console.error(` failed: ${e.message}`);
    process.exit(1);
  }
  console.log(" done.");

  // ── Write lean summary to cloud if online mode and logged in ─────────────────
  if (!isOffline() && isLoggedIn()) {
    try {
      const cfg = await requireLoginFresh();
      const rc  = readRC();
      if (rc?.project_id) {
        const lean = {
          summary:               what,
          why,
          alternatives_rejected: ruledOut ? ruledOut.split(",").map(r => r.trim()) : [],
          key_files:             filesChanged.slice(0, 10),
          workflow,
          ai_turn_count:         0,
          commit_hash:           commitHash,
          session_start:         new Date().toISOString(),
          session_end:           new Date().toISOString(),
        };
        await api.post(`/projects/${rc.project_id}/sessions`, lean, cfg.access_token);
      }
    } catch { /* cloud write is non-fatal */ }
  }

  console.log(`\n✓  Decision recorded (${id})`);
  console.log("   View: prepcli log\n");
}

module.exports = { run };
