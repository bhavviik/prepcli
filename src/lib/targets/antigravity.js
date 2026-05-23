"use strict";
const path = require("node:path");
module.exports = function getAntigravityTargets({ cwd }) {
  return [
    {
      id: "antigravity",
      label: "Antigravity (.agent/workflows)",
      destination: path.join(cwd, ".agent", "workflows"),
      commandNames: ["antigravity"],
      hintPaths: [path.join(cwd, ".agent")],
      defaultWhenUndetected: true
    }
  ];
};
