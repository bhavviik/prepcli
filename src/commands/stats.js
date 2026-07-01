"use strict";

const { read } = require("../lib/delta-store");

function run(opts = {}) {
  const { history } = read();
  let rows = history;
  if (opts.workflow) rows = rows.filter((r) => r.workflow === opts.workflow);

  if (!rows.length) {
    console.log("No sessions recorded yet.");
    console.log("Deltas are captured automatically after you type GO in a workflow.");
    return;
  }

  const byWf = {};
  for (const r of rows) (byWf[r.workflow] ??= []).push(r);

  console.log(`\nSessions: ${rows.length}\n`);
  console.log("Quality by workflow (avg — higher means fewer details missed):");
  for (const [wf, list] of Object.entries(byWf)) {
    const avg    = list.reduce((s, r) => s + r.score, 0) / list.length;
    const deltas = list.reduce((s, r) => s + r.deltas.length, 0);
    console.log(`  /${wf.padEnd(9)} ${avg.toFixed(2)}  (${deltas} deltas across ${list.length} session${list.length === 1 ? "" : "s"})`);
  }

  const gaps = {};
  for (const r of rows) for (const d of r.deltas) gaps[d.gap] = (gaps[d.gap] || 0) + 1;
  const top = Object.entries(gaps).sort((a, b) => b[1] - a[1]);
  if (top.length) {
    console.log("\nTop gap types (what keeps getting missed):");
    for (const [g, n] of top.slice(0, 5)) console.log(`  ${String(g).padEnd(22)} ${n}`);
  }
  console.log("");
}

module.exports = { run };
