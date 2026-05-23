#!/usr/bin/env node
"use strict";

const { program } = require("commander");

program
  .name("prepcli")
  .description("Persistent AI collaboration layer — context, decisions, and self-improving prompts")
  .version("0.1.0");

// ── Auth ──────────────────────────────────────────────────────────────────────
program
  .command("auth <action>")
  .description("login | logout | status")
  .action((action) => require("../src/commands/auth").run(action));

// ── Init ──────────────────────────────────────────────────────────────────────
program
  .command("init")
  .description("Scan codebase, create .prepclirc, push initial context to cloud")
  .action(() => require("../src/commands/init").run());

// ── Install ───────────────────────────────────────────────────────────────────
program
  .command("install")
  .description("Copy workflow files to AI tool directories")
  .option("--all", "Install to all detected tools")
  .option("--tool <ids>", "Comma-separated tool ids (claude-project, cursor, windsurf…)")
  .option("--yes, -y", "Skip confirmation prompt")
  .action((opts) => require("../src/commands/install").run(opts));

// ── Uninstall ─────────────────────────────────────────────────────────────────
program
  .command("uninstall")
  .description("Remove workflow files from AI tool directories")
  .option("--all", "Remove from all locations without prompting")
  .option("--yes, -y", "Skip confirmation prompt")
  .action((opts) => require("../src/commands/uninstall").run(opts));

// ── Context ───────────────────────────────────────────────────────────────────
program
  .command("context")
  .description("Show current project context from cloud")
  .option("--preview", "Show exactly what STEP 0 would inject")
  .option("--edit", "Open context in editor")
  .action((opts) => require("../src/commands/context").run(opts));

// ── Decision log ──────────────────────────────────────────────────────────────
program
  .command("log")
  .description("Browse AI decision records linked to commits")
  .option("--workflow <type>", "Filter by workflow type (debug, plan, review…)")
  .option("--file <path>", "Filter by file path")
  .option("--commit <hash>", "Show decision for a specific commit")
  .option("--last <period>", "Filter by time period (e.g. 30d)")
  .action((opts) => require("../src/commands/log").run(opts));

// ── Record ────────────────────────────────────────────────────────────────────
program
  .command("record [reason]")
  .description("Manually save a decision to the shadow branch")
  .action((reason) => require("../src/commands/record").run(reason));

// ── Stats ─────────────────────────────────────────────────────────────────────
program
  .command("stats")
  .description("Show prompt quality scores and delta trends")
  .option("--workflow <type>", "Filter by workflow type")
  .option("--last <period>", "Filter by time period (e.g. 30d)")
  .option("--compare <period>", "Compare to an earlier period")
  .action((opts) => require("../src/commands/stats").run(opts));

// ── Team ──────────────────────────────────────────────────────────────────────
program
  .command("team <action> [email]")
  .description("invite | list | remove")
  .action((action, email) => require("../src/commands/team").run(action, email));

// ── Doctor ────────────────────────────────────────────────────────────────────
program
  .command("doctor")
  .description("Diagnose setup issues (auth, .prepclirc, git hooks, push refspec)")
  .action(() => require("../src/commands/doctor").run());

program.parse();
