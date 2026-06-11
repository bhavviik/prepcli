"use strict";
const path = require("node:path");
module.exports = function getCodexTargets({ cwd, home }) {
  return [
    {
      id: "codex-personal",
      label: "Codex CLI (personal — ~/.codex/)",
      destination: path.join(home, ".codex"),
      commandNames: ["codex"],
      hintPaths: [path.join(home, ".codex")],
      defaultWhenUndetected: false
    },
    {
      id: "codex-project",
      label: "Codex CLI (project — .codex/)",
      destination: path.join(cwd, ".codex"),
      commandNames: ["codex"],
      hintPaths: [path.join(cwd, ".codex")],
      defaultWhenUndetected: false
    }
  ];
};
