"use strict";

const fs       = require("node:fs");
const readline = require("node:readline");

const { readSession, clearSession, isSessionStale }        = require("../lib/session-file");
const { generateId, getCurrentCommit, getChangedFiles, buildRecord, recordFilename } = require("../lib/decision");
const {
  shadowBranchExists, shadowBranchExistsOnRemote,
  initShadowBranch, fetchShadowBranch,
  writeDecisionRecord,
} = require("../lib/git");
const { isLoggedIn, requireLoginFresh, readRC } = require("../lib/config");
const api = require("../lib/api");

async function askSummary(prompt) {
  // Git pipes push info through process.stdin — open /dev/tty directly for user input
  let input = process.stdin;

  if (!process.stdin.isTTY) {
    try {
      input = fs.createReadStream("/dev/tty");
    } catch {
      return ""; // No terminal available (CI) — skip silently
    }
  }

  return new Promise(resolve => {
    const rl = readline.createInterface({ input, output: process.stderr });
    rl.question(prompt, answer => {
      resolve(answer.trim());
      rl.close();
      if (input !== process.stdin) input.destroy();
    });
    rl.on("error", () => resolve(""));
    rl.on("close", () => resolve(""));
  });
}

async function handlePrePush() {
  const cwd     = process.cwd();
  const session = readSession(cwd);

  // No session turns — nothing to record, push proceeds normally
  if (!session?.turns?.length) return;

  const turns = session.turns;

  if (isSessionStale(cwd)) {
    process.stderr.write("\n[prepcli] Warning: this session started >24 hours ago.\n");
  }

  // Show accumulated turns
  process.stderr.write(`\n[prepcli] ${turns.length} AI turn${turns.length === 1 ? "" : "s"} this session:\n`);
  for (const t of turns) {
    process.stderr.write(`  [${t.workflow}]  ${t.what}\n`);
  }
  process.stderr.write("\n");

  const summary = await askSummary("  Final summary? (Enter to skip): ");

  if (!summary) {
    clearSession(cwd);
    process.stderr.write("\n");
    return;
  }

  const id           = generateId();
  const commitHash   = getCurrentCommit(cwd);
  const filesChanged = getChangedFiles(cwd);
  const content      = buildRecord({ id, session, commitHash, filesChanged, summary });
  const filename     = recordFilename(id);

  // Ensure shadow branch exists
  if (!shadowBranchExists(cwd)) {
    if (shadowBranchExistsOnRemote(cwd)) {
      fetchShadowBranch(cwd);
    } else {
      initShadowBranch(cwd);
    }
  }

  process.stderr.write("  Writing to shadow branch...");
  try {
    writeDecisionRecord(filename, content, cwd);
  } catch(e) {
    process.stderr.write(` failed (${e.message})\n`);
    clearSession(cwd);
    return;
  }

  process.stderr.write(" done.\n");

  // Write lean summary to cloud if logged in
  if (isLoggedIn()) {
    try {
      const cfg = await requireLoginFresh();
      const rc  = readRC();
      if (rc?.project_id) {
        const lean = {
          summary,
          why:                  turns.filter(t => t.why).pop()?.why || "",
          alternatives_rejected: turns.filter(t => t.why).map(t => t.why),
          key_files:            filesChanged.slice(0, 10),
          workflow:             [...new Set(turns.map(t => t.workflow))].join(","),
          ai_turn_count:        turns.length,
          commit_hash:          commitHash,
          session_start:        session.started_at,
          session_end:          new Date().toISOString(),
        };
        await api.post(`/projects/${rc.project_id}/sessions`, lean, cfg.access_token);
      }
    } catch { /* cloud write must never block push */ }
  }

  clearSession(cwd);
  process.stderr.write(`  ✓  Decision recorded (${id})\n`);
  process.stderr.write(`     View: prepcli log\n\n`);
}

function run(hookName) {
  if (hookName === "pre-push") {
    handlePrePush()
      .catch(() => {})   // errors must never block push
      .then(() => process.exit(0));
  } else {
    process.exit(0);
  }
}

module.exports = { run };
