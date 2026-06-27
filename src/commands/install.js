"use strict";

const fs   = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const { getTargets, listWorkflows, fmtDest, WORKFLOW_DIR } = require("../lib/targets");

async function chooseTargets(targets, opts) {
  if (opts.all || opts.yes) return targets;

  if (opts.tool) {
    const ids = opts.tool.split(",").map((s) => s.trim());
    const found = ids.map((id) => {
      const t = targets.find((t) => t.id === id);
      if (!t) { console.error(`Unknown tool id: ${id}`); process.exit(1); }
      return t;
    });
    return found;
  }

  const recommended = targets.filter((t) => t.detected || t.defaultWhenUndetected);

  if (!process.stdin.isTTY) return recommended;

  console.log("\nWhere should prepcli install workflow files?\n");
  targets.forEach((t, i) => {
    const tag = t.detected ? "detected" : t.defaultWhenUndetected ? "default" : "not detected";
    console.log(`  ${i + 1}. ${t.label} — ${tag}`);
  });

  const defaults = recommended.map((t) => targets.indexOf(t) + 1).join(",");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`\nChoose [${defaults || "none"}] or type all: `);
    return parseSelection(answer.trim(), targets, recommended);
  } finally {
    rl.close();
  }
}

function parseSelection(input, targets, recommended) {
  if (!input || input === "") return recommended;
  if (input === "all" || input === "a") return targets;
  if (input === "none" || input === "n") return [];
  const nums = input.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n));
  if (nums.length === 0) throw new Error("Enter numbers like 1,3 or 'all'.");
  const invalid = nums.filter((n) => n < 1 || n > targets.length);
  if (invalid.length > 0) throw new Error(`Out of range: ${invalid.join(", ")}`);
  return [...new Set(nums)].map((n) => targets[n - 1]);
}

async function run(opts) {
  const workflows = listWorkflows();
  const targets   = getTargets();
  const selected  = await chooseTargets(targets, opts);

  if (selected.length === 0) { console.log("Nothing selected."); return; }

  console.log(`\nInstalling ${workflows.length} workflow(s): ${workflows.join(", ")}\n`);

  let failures = 0;
  for (const t of selected) {
    try {
      fs.mkdirSync(t.destination, { recursive: true });
      for (const file of workflows) {
        fs.copyFileSync(path.join(WORKFLOW_DIR, file), path.join(t.destination, file));
      }
      console.log(`  ✓  ${t.label}  →  ${fmtDest(t.destination)}`);
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

  console.log("\nDone. Use /prep  /debug  /review  /plan  /refactor  /write in your AI tool.");
}

module.exports = { run };
