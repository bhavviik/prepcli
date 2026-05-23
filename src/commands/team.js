"use strict";
// Phase 6 — Team Features

function run(action, email) {
  switch (action) {
    case "invite":
      console.log(`[Phase 6] team invite ${email || "<email>"} — not implemented yet.`);
      break;
    case "list":
      console.log("[Phase 6] team list — not implemented yet.");
      break;
    case "remove":
      console.log(`[Phase 6] team remove ${email || "<email>"} — not implemented yet.`);
      break;
    default:
      console.error(`Unknown team action: ${action}. Use invite | list | remove`);
      process.exit(1);
  }
}

module.exports = { run };
