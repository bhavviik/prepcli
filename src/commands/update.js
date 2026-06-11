"use strict";

const { execSync } = require("node:child_process");

async function run() {
  const current = require("../../package.json").version;

  let latest;
  try {
    latest = execSync("npm show @prepcli/prepcli version", { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    console.error("Could not reach npm registry. Check your connection.");
    process.exit(1);
  }

  if (current === latest) {
    console.log(`Already on the latest version (${current}).`);
    return;
  }

  console.log(`Updating prepcli ${current} → ${latest}...`);

  try {
    execSync("npm install -g @prepcli/prepcli@latest", { stdio: "inherit" });
    console.log(`\n✓  Updated to ${latest}`);
  } catch {
    console.error("\nUpdate failed. Try with sudo:");
    console.error("  sudo npm install -g @prepcli/prepcli@latest");
    process.exit(1);
  }
}

module.exports = { run };
