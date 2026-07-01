#!/usr/bin/env node
"use strict";

const { program } = require("commander");

program
  .name("prepcli")
  .description("Persistent AI collaboration layer — context, decisions, and self-improving prompts")
  .version(require("../package.json").version)
  .addHelpText("beforeAll", `
  Get started:
    1. prepcli auth login     sign in with email OTP
    2. prepcli install        copy workflows to Claude Code / Cursor / Codex
    3. prepcli init           scan project and set up context
`)
  .addHelpText("afterAll", `
  ── Setup ──────────────────────────────────────────────────────────
    auth login / logout / status
    install [--tool <id>] [--all]
    init                              needs: auth (online mode)
    uninstall
    mode offline | online             switch sync mode

  ── Daily use ──────────────────────────────────────────────────────
    context [--preview]               needs: auth, init
    session add / show / clear
    record [--what] [--why]           needs: auth, init
    log [--workflow] [--last <30d>]
    stats [--workflow]                prompt quality + recurring gaps

  Run "prepcli help <command>" for full options on any command.
`);

// ── Auth ──────────────────────────────────────────────────────────────────────
program
  .command("auth <action>")
  .description("login | logout | status")
  .action((action) => require("../src/commands/auth").run(action));

// ── Install ───────────────────────────────────────────────────────────────────
program
  .command("install")
  .description("Copy workflow files to Claude Code / Cursor / Antigravity / Codex")
  .option("--all", "Install to all detected tools")
  .option("--tool <ids>", "Comma-separated tool ids (claude-code, cursor, antigravity, codex-project, codex-personal)")
  .option("--yes, -y", "Skip confirmation prompt")
  .action((opts) => require("../src/commands/install").run(opts));

// ── Init ──────────────────────────────────────────────────────────────────────
program
  .command("init")
  .description("Scan codebase, create .prepclirc, push initial context  [needs: auth]")
  .action(() => require("../src/commands/init").run());

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
  .description("Show project context injected at session start  [needs: auth, init]")
  .option("--preview", "Show exactly what STEP 0 would inject")
  .option("--edit", "Open context in editor")
  .action((opts) => require("../src/commands/context").run(opts));

// ── Session ───────────────────────────────────────────────────────────────────
program
  .command("session <action>")
  .description("add | show | clear — manage the local AI session accumulator")
  .option("--workflow <type>", "Workflow type: debug | plan | review | prep | refactor | write")
  .option("--what <text>",     "One sentence: what was done")
  .option("--why <text>",      "One sentence: why this approach")
  .action((action, opts) => require("../src/commands/session").run(action, opts));

// ── Record ────────────────────────────────────────────────────────────────────
program
  .command("record")
  .description("Manually save a decision to the shadow branch  [needs: auth, init]")
  .option("--what <text>",      "What was decided or discovered")
  .option("--why <text>",       "Why this approach over alternatives")
  .option("--ruled-out <text>", "What was considered and rejected (comma-separated)")
  .option("--workflow <type>",  "Workflow type: manual | debug | plan | discovery")
  .action((opts) => require("../src/commands/record").run(opts));

// ── Decision log ──────────────────────────────────────────────────────────────
program
  .command("log")
  .description("Browse AI decision records linked to commits")
  .option("--workflow <type>", "Filter by workflow type: debug | plan | review…")
  .option("--file <path>",     "Filter by file path")
  .option("--commit <hash>",   "Show decision for a specific commit")
  .option("--last <period>",   "Filter by time period, e.g. 30d")
  .action((opts) => require("../src/commands/log").run(opts));

// ── Update ────────────────────────────────────────────────────────────────────
program
  .command("update")
  .description("Update prepcli to the latest version")
  .action(() => require("../src/commands/update").run());

// ── Mode ──────────────────────────────────────────────────────────────────────
program
  .command("mode [value]")
  .description("offline | online — switch or show current mode")
  .action((value) => require("../src/commands/mode").run(value));

// ── Internal git hook handler (hidden) ────────────────────────────────────────
program
  .command("_hook <name>", { hidden: true })
  .action((name) => require("../src/commands/hook").run(name));

// ── Delta capture (hidden — AI calls these via workflow STEP 6) ────────────────
program
  .command("delta <action>", { hidden: true })
  .option("--workflow <type>", "Workflow type")
  .option("--gap <type>",      "Gap type: missing_constraint | missing_scope | …")
  .option("--question <text>", "The question that would have surfaced this up front")
  .option("--message <text>",  "Raw message (classified locally if --gap omitted)")
  .action((action, opts) => require("../src/commands/delta").run(action, opts));

// ── Stats ─────────────────────────────────────────────────────────────────────
program
  .command("stats")
  .description("Show prompt quality scores and recurring gap types  [needs: init]")
  .option("--workflow <type>", "Filter by workflow type")
  .action((opts) => require("../src/commands/stats").run(opts));

program
  .command("team <action> [email]", { hidden: true })
  .action((action, email) => require("../src/commands/team").run(action, email));

program
  .command("doctor", { hidden: true })
  .action(() => require("../src/commands/doctor").run());

program.parse();
