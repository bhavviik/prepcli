"use strict";
const path = require("node:path");
module.exports = function getClaudeTargets({ cwd, home }) {
  return [
    {
      id: "claude-personal",
      label: "Claude Code (personal — ~/.claude/commands)",
      destination: path.join(home, ".claude", "commands"),
      commandNames: ["claude"],
      hintPaths: [path.join(home, ".claude")],
      defaultWhenUndetected: false
    },
    {
      id: "claude-project",
      label: "Claude Code (project — .claude/commands)",
      destination: path.join(cwd, ".claude", "commands"),
      commandNames: ["claude"],
      hintPaths: [path.join(cwd, ".claude")],
      defaultWhenUndetected: true
    }
  ];
};
