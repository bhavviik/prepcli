"use strict";

const fs   = require("node:fs");
const path = require("node:path");
const { gitRoot } = require("./git");
const { qualityScore, computePromoted } = require("./delta");

// Local-first, gitignored. Holds only generalized questions + gap labels —
// never raw user text. So nothing sensitive lives here or leaves the machine.
// Cloud label-sync (online mode) is not wired yet; the loop works fully offline.
const FILE = ".prepcli-deltas.json";

function storePath(cwd = process.cwd()) { return path.join(gitRoot(cwd), FILE); }

function read(cwd = process.cwd()) {
  try { return JSON.parse(fs.readFileSync(storePath(cwd), "utf8")); }
  catch { return { open: null, history: [] }; }
}

function write(data, cwd = process.cwd()) {
  fs.writeFileSync(storePath(cwd), JSON.stringify(data, null, 2), "utf8");
}

function addDelta({ workflow, gap, question }, cwd = process.cwd()) {
  const s = read(cwd);
  if (!s.open || s.open.workflow !== workflow) s.open = { workflow, deltas: [] };
  s.open.deltas.push({ gap, question: question || "", at: new Date().toISOString() });
  write(s, cwd);
}

// Flush the open window into history with a quality score. Always safe to call —
// no open window just records a clean (0-delta, score 1.0) session.
function closeSession(workflow, cwd = process.cwd()) {
  const s = read(cwd);
  const open = s.open && (!workflow || s.open.workflow === workflow)
    ? s.open
    : { workflow: workflow || "general", deltas: [] };
  const score = qualityScore(open.deltas, open.workflow);
  s.history.push({
    workflow: open.workflow,
    score,
    deltas: open.deltas.map((d) => ({ gap: d.gap, question: d.question })),
    at: new Date().toISOString(),
  });
  s.open = null;
  write(s, cwd);
  return { workflow: open.workflow, delta_count: open.deltas.length, score };
}

function allDeltas(cwd = process.cwd()) {
  const s = read(cwd);
  const hist = s.history.flatMap((h) => h.deltas.map((d) => ({ ...d, workflow: h.workflow })));
  const open = s.open ? s.open.deltas.map((d) => ({ ...d, workflow: s.open.workflow })) : [];
  return [...hist, ...open];
}

function promotedFor(workflow, cwd = process.cwd()) {
  return computePromoted(allDeltas(cwd))[workflow] || [];
}

module.exports = { read, addDelta, closeSession, allDeltas, promotedFor, storePath, FILE };
