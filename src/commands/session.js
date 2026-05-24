"use strict";

const { addTurn, readSession, clearSession } = require("../lib/session-file");

function run(action, opts = {}) {
  if (action === "add") {
    const { workflow, what, why } = opts;

    if (!workflow || !what) {
      console.error("prepcli session add requires --workflow and --what");
      process.exit(1);
    }

    addTurn({ workflow, what, why: why || "" });
    // Silent — no output. AI calls this invisibly.
    return;
  }

  if (action === "show") {
    const session = readSession();
    if (!session?.turns?.length) {
      console.log("No active session.");
      return;
    }
    console.log(`Session started: ${session.started_at}`);
    console.log(`Turns: ${session.turns.length}`);
    for (const t of session.turns) {
      console.log(`  [${t.workflow}]  ${t.what}`);
      if (t.why) console.log(`           why: ${t.why}`);
    }
    return;
  }

  if (action === "clear") {
    clearSession();
    console.log("Session cleared.");
    return;
  }

  console.error(`Unknown session action: ${action}. Use: add | show | clear`);
  process.exit(1);
}

module.exports = { run };
