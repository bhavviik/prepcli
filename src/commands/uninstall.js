"use strict";

const fs   = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const { getTargets, listWorkflows, fmtDest } = require("../lib/targets");

function isInstalled(destination, workflows) {
  return workflows.some((f) => {
    try { fs.accessSync(path.join(destination, f)); return true; }
    catch { return false; }
  });
}

async function run(opts) {
  const workflows = listWorkflows();
  const targets   = getTargets();

  const installed = targets.filter((t) => isInstalled(t.destination, workflows));

  if (installed.length === 0) {
    console.log("No prepcli workflows found on this machine.");
    return;
  }

  if (opts.all || opts.yes) {
    return removeFrom(installed, workflows);
  }

  console.log("\nprepcli workflows found in:\n");
  installed.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.label}  (${fmtDest(t.destination)})`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question("\nRemove from which? [all / 1,2 / none]: ")).trim();
    if (!answer || answer === "none" || answer === "n") {
      console.log("Nothing removed.");
      return;
    }

    const selected = answer === "all" || answer === "a"
      ? installed
      : answer.split(/[,\s]+/).map(Number).filter(Boolean).map((n) => installed[n - 1]).filter(Boolean);

    await removeFrom(selected, workflows);
  } finally {
    rl.close();
  }
}

function removeFrom(targets, workflows) {
  let failures = 0;

  for (const t of targets) {
    try {
      for (const file of workflows) {
        const filePath = path.join(t.destination, file);
        try { fs.unlinkSync(filePath); } catch {}
      }
      console.log(`  ✓  Removed from ${t.label}  (${fmtDest(t.destination)})`);
    } catch (err) {
      failures++;
      console.error(`  ✗  ${t.label}: ${err.message}`);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    console.error(`\n${failures} error(s). Check folder permissions.`);
    return;
  }

  console.log("\nDone. Workflows removed.");
}

module.exports = { run };
