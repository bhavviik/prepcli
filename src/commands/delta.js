"use strict";

const { classifyMessage } = require("../lib/delta");
const store = require("../lib/delta-store");

function run(action, opts = {}) {
  if (action === "add") {
    let { workflow, gap, question, message } = opts;
    if (!workflow) { console.error("delta add requires --workflow"); process.exit(1); }
    if (!gap && message) {
      const c = classifyMessage(message);
      if (!c.is_delta) return; // not a delta — nothing to record
      gap = c.gap_type;
    }
    if (!gap) { console.error("delta add requires --gap or --message"); process.exit(1); }
    store.addDelta({ workflow, gap, question });
    return; // silent — the AI calls this invisibly
  }

  if (action === "close") {
    const r = store.closeSession(opts.workflow);
    console.log(`Session closed (${r.workflow}): ${r.delta_count} delta(s), quality ${r.score.toFixed(2)}`);
    return;
  }

  if (action === "questions") {
    if (!opts.workflow) { console.error("delta questions requires --workflow"); process.exit(1); }
    const qs = store.promotedFor(opts.workflow);
    if (qs.length) console.log(qs.join("\n")); // empty output if none
    return;
  }

  console.error(`Unknown delta action: ${action}. Use: add | close | questions`);
  process.exit(1);
}

module.exports = { run };
