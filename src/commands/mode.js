"use strict";

const { readRC, writeRC } = require("../lib/config");

function run(newMode) {
  const rc = readRC();

  if (!rc) {
    console.error("No .prepclirc found. Run: prepcli init");
    process.exit(1);
  }

  if (!newMode) {
    const current = rc.mode || "online";
    console.log(`Current mode: ${current}`);
    console.log("Switch with: prepcli mode offline  |  prepcli mode online");
    return;
  }

  if (newMode !== "offline" && newMode !== "online") {
    console.error('Invalid mode. Use: offline | online');
    process.exit(1);
  }

  if (rc.mode === newMode) {
    console.log(`Already in ${newMode} mode.`);
    return;
  }

  writeRC({ ...rc, mode: newMode });

  if (newMode === "offline") {
    console.log("Switched to offline mode.");
    console.log("  ✓  session recording, decision log, shadow branch — all working");
    console.log("  ✗  context will not sync to cloud");
    console.log("  ✗  no team sharing");
    console.log("\nSwitch back anytime with: prepcli mode online");
  } else {
    console.log("Switched to online mode.");
    console.log("  ✓  context synced to cloud");
    console.log("  ✓  team sharing available");
    if (!require("../lib/config").isLoggedIn()) {
      console.log("\nNot logged in. Run: prepcli auth login");
    }
  }
}

module.exports = { run };
