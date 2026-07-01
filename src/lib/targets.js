"use strict";

const fs   = require("node:fs");
const os   = require("node:os");
const path = require("node:path");

const WORKFLOW_DIR = path.resolve(__dirname, "../../workflows");

// All install targets as data. destination/hintPaths depend on cwd/home,
// so this is a function rather than a static array.
function buildTargets({ cwd, home }) {
  return [
    {
      id: "claude-personal",
      label: "Claude Code (personal — ~/.claude/commands)",
      destination: path.join(home, ".claude", "commands"),
      commandNames: ["claude"],
      hintPaths: [path.join(home, ".claude")],
      defaultWhenUndetected: false,
    },
    {
      id: "claude-project",
      label: "Claude Code (project — .claude/commands)",
      destination: path.join(cwd, ".claude", "commands"),
      commandNames: ["claude"],
      hintPaths: [path.join(cwd, ".claude")],
      defaultWhenUndetected: true,
    },
    {
      id: "cursor",
      label: "Cursor (.cursor/prompts)",
      destination: path.join(cwd, ".cursor", "prompts"),
      commandNames: ["cursor"],
      hintPaths: [path.join(home, ".cursor"), path.join(cwd, ".cursor")],
      defaultWhenUndetected: true,
    },
    {
      id: "antigravity",
      label: "Antigravity (.agent/workflows)",
      destination: path.join(cwd, ".agent", "workflows"),
      commandNames: ["antigravity"],
      hintPaths: [path.join(cwd, ".agent")],
      defaultWhenUndetected: false,
    },
    {
      id: "codex-personal",
      label: "Codex CLI (personal — ~/.codex/)",
      destination: path.join(home, ".codex"),
      commandNames: ["codex"],
      hintPaths: [path.join(home, ".codex")],
      defaultWhenUndetected: false,
    },
    {
      id: "codex-project",
      label: "Codex CLI (project — .codex/)",
      destination: path.join(cwd, ".codex"),
      commandNames: ["codex"],
      hintPaths: [path.join(cwd, ".codex")],
      defaultWhenUndetected: false,
    },
  ];
}

function commandExists(cmd) {
  return (process.env.PATH || "").split(path.delimiter).some((dir) => {
    const exts = process.platform === "win32" ? ["", ".cmd", ".exe"] : [""];
    return exts.some((ext) => {
      try { fs.accessSync(path.join(dir, cmd + ext), fs.constants.X_OK); return true; }
      catch { return false; }
    });
  });
}

function pathExists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}

function getTargets({ cwd = process.cwd(), home = os.homedir() } = {}) {
  return buildTargets({ cwd, home }).map((t) => {
    const detected = t.commandNames.some(commandExists) || t.hintPaths.some(pathExists);
    return { ...t, detected };
  });
}

function listWorkflows() {
  return fs.readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".md")).sort();
}

function fmtDest(dest) {
  const home = os.homedir();
  if (dest.startsWith(home)) return `~${dest.slice(home.length)}`;
  return path.relative(process.cwd(), dest) || ".";
}

module.exports = { getTargets, listWorkflows, fmtDest, WORKFLOW_DIR };
