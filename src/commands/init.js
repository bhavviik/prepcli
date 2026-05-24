"use strict";

const readline = require("node:readline/promises");
const { detectStack }                              = require("../lib/detect");
const { isLoggedIn, requireLoginFresh, readRC, writeRC } = require("../lib/config");
const api = require("../lib/api");

function displayStack(stack, gitRemote) {
  const lines = Object.entries(stack).map(([k, v]) => `  ${k}: ${v}`);
  if (gitRemote) lines.push(`  git_remote: ${gitRemote}`);
  return lines.join("\n");
}

async function prompt(rl, question) {
  return (await rl.question(question)).trim();
}

async function collectList(rl, header) {
  console.log(`\n${header}`);
  console.log("  Enter one per line. Press Enter on an empty line to finish.");
  const items = [];
  while (true) {
    const line = (await rl.question("  > ")).trim();
    if (!line) break;
    items.push(line);
  }
  return items;
}

async function run() {
  const existing = readRC();

  if (existing?.project_id || existing?.context) {
    const rl0 = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const ans = await prompt(rl0, "\n.prepclirc already exists. Re-initialize? [y/N]: ");
      if (!ans.toLowerCase().startsWith("y")) {
        console.log("Nothing changed.");
        return;
      }
    } finally {
      rl0.close();
    }
  }

  console.log("\nScanning project...\n");

  const cwd = process.cwd();
  const { stack, name, git_remote } = detectStack(cwd);

  if (Object.keys(stack).length > 0) {
    console.log("Detected stack:\n" + displayStack(stack, git_remote));
  } else {
    console.log("Could not auto-detect stack.");
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    // ── Confirm or edit stack ─────────────────────────────────────────────────
    const confirm = await prompt(rl, "\nDoes this look right? [Y/n]: ");

    let finalStack = { ...stack };

    if (confirm.toLowerCase() === "n") {
      console.log("\nEdit stack (press Enter to keep current value, type to override):");
      const fields = ["language", "runtime", "framework", "db", "ci", "hosting", "package_manager"];
      for (const field of fields) {
        const current = finalStack[field] || "";
        const val = await prompt(rl, `  ${field}${current ? ` [${current}]` : ""}: `);
        if (val)       finalStack[field] = val;
        else if (!current) delete finalStack[field];
      }
    }

    // Strip empty values
    finalStack = Object.fromEntries(Object.entries(finalStack).filter(([, v]) => v));

    // ── 3 questions ───────────────────────────────────────────────────────────
    const hardLimits = await collectList(rl,
      'Hard limits — things AI must NEVER do.\n  e.g. "never add console.log to production", "all DB migrations need a rollback"'
    );

    const activeConstraints = await collectList(rl,
      'Active constraints — things that are true RIGHT NOW.\n  e.g. "auth module is frozen", "deployment freeze until Dec 15"'
    );

    const conventionLines = await collectList(rl,
      'Conventions — patterns AI would get wrong.\n  e.g. "use AppError class, never throw raw strings", "snake_case for DB columns"'
    );

    const conventions = conventionLines.length > 0
      ? Object.fromEntries(conventionLines.map((v, i) => [String(i), v]))
      : {};

    const contextPayload = {
      stack:               finalStack,
      hard_limits:         hardLimits,
      active_constraints:  activeConstraints,
      conventions,
      recent_decisions:    [],
      open_questions:      [],
    };

    // ── Push to cloud if logged in ────────────────────────────────────────────
    if (isLoggedIn()) {
      try {
        const cfg = await requireLoginFresh();
        const projectName = name || cwd.split("/").pop();

        process.stdout.write("\nPushing to cloud...");

        const { project_id, already_existed } = await api.post("/projects", {
          name:       projectName,
          git_remote: git_remote || null,
        }, cfg.access_token);

        await api.put(`/projects/${project_id}/context`, contextPayload, cfg.access_token);

        writeRC({ project_id, git_remote: git_remote || null });

        console.log(" done.");
        if (already_existed) {
          console.log(`✓  Updated existing project (${project_id.slice(0, 8)}…)`);
        } else {
          console.log(`✓  Project created (${project_id.slice(0, 8)}…)`);
        }
        console.log("✓  Context pushed to cloud.");

      } catch (err) {
        console.error(`\nCloud sync failed: ${err.message}`);
        console.log("Saving context locally only.");
        writeRC({ project_id: null, git_remote: git_remote || null, context: contextPayload });
      }
    } else {
      writeRC({ project_id: null, git_remote: git_remote || null, context: contextPayload });
      console.log("\n✓  Context saved to .prepclirc (local only).");
      console.log("   Log in with `prepcli auth login` to sync to cloud.");
    }

    // ── Shadow branch + git hooks ─────────────────────────────────────────────
    const gitLib = require("../lib/git");

    process.stdout.write("\nSetting up shadow branch...");
    try {
      if (gitLib.shadowBranchExists(cwd)) {
        console.log(" already exists.");
      } else if (gitLib.shadowBranchExistsOnRemote(cwd)) {
        gitLib.fetchShadowBranch(cwd);
        console.log(" fetched from remote.");
      } else {
        gitLib.initShadowBranch(cwd);
        console.log(" created.");
      }

      gitLib.installPrePushHook(cwd);
      console.log("✓  Pre-push hook installed.");

      gitLib.configurePushRefspec(cwd);
      console.log("✓  Push refspec configured.");

      gitLib.ensureGitignoreEntry(cwd);
      console.log("✓  .prepcli-session added to .gitignore.");
    } catch (err) {
      console.log(` skipped (${err.message})`);
    }

    console.log("\nDone. Run `prepcli context` to review.");

  } finally {
    rl.close();
  }
}

module.exports = { run };
