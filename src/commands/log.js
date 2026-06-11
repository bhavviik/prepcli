"use strict";

const { execSync } = require("node:child_process");
const { shadowBranchExists, SHADOW_BRANCH, gitRoot } = require("../lib/git");

function execSafe(cmd, cwd) {
  try { return execSync(cmd, { cwd, stdio: ["pipe", "pipe", "pipe"] }).toString().trim(); }
  catch { return null; }
}

function parseRecord(content) {
  const get = re => { const m = content.match(re); return m ? m[1].trim() : null; };
  return {
    id:       get(/^id: (.+)$/m),
    date:     get(/^date: (.+)$/m),
    workflow: get(/^workflow: (.+)$/m),
    commit:   get(/^commit: (.+)$/m),
    turns:    parseInt(get(/^ai_turn_count: (\d+)$/m) || "0"),
    files:    (get(/^files_changed: \[(.+)\]$/m) || "").split(",").map(f => f.trim()).filter(Boolean),
    summary:  get(/## Summary\n(.+)/),
    why:      get(/## Why This Approach\n(.+)/),
  };
}

function run(opts = {}) {
  const cwd  = process.cwd();
  const root = gitRoot(cwd);

  if (!shadowBranchExists(cwd)) {
    console.log("No decision records found. Run `prepcli init` to set up the shadow branch.");
    return;
  }

  const filesOut = execSafe(`git ls-tree --name-only ${SHADOW_BRANCH}`, root);
  if (!filesOut) { console.log("No decisions recorded yet."); return; }

  const filenames = filesOut.split("\n").filter(f => f.endsWith(".md")).reverse();

  const records = filenames.map(filename => {
    const content = execSafe(`git show ${SHADOW_BRANCH}:${filename}`, root);
    if (!content) return null;
    return { filename, ...parseRecord(content) };
  }).filter(Boolean);

  // Apply filters
  let filtered = records;
  if (opts.workflow) filtered = filtered.filter(r => r.workflow?.includes(opts.workflow));
  if (opts.file)     filtered = filtered.filter(r => r.files.some(f => f.includes(opts.file)));
  if (opts.commit)   filtered = filtered.filter(r => r.commit?.startsWith(opts.commit));

  if (filtered.length === 0) { console.log("No matching decisions found."); return; }

  for (const r of filtered) {
    const date   = r.date ? new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "?";
    const commit = r.commit && r.commit !== "none" ? r.commit.slice(0, 7) : "none";

    console.log(`\n${date}  •  ${r.workflow || "?"}  •  ${r.turns} AI turn${r.turns === 1 ? "" : "s"}  •  commit ${commit}`);
    console.log(`  ${r.summary || r.filename}`);
    if (r.why && r.why !== "Not recorded.") console.log(`  Why:   ${r.why}`);
    if (r.files.length)                     console.log(`  Files: ${r.files.filter(f => f).join(", ")}`);
  }
  console.log("");
}

module.exports = { run };
