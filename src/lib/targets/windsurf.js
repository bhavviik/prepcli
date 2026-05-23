"use strict";
const path = require("node:path");
module.exports = function getWindsurfTargets({ cwd, home }) {
  return [
    {
      id: "windsurf",
      label: "Windsurf (.windsurf)",
      destination: path.join(cwd, ".windsurf"),
      commandNames: ["windsurf"],
      hintPaths: [path.join(home, ".windsurf"), path.join(cwd, ".windsurf")],
      defaultWhenUndetected: true
    }
  ];
};
