"use strict";
const path = require("node:path");
module.exports = function getCursorTargets({ cwd, home }) {
  return [
    {
      id: "cursor",
      label: "Cursor (.cursor/prompts)",
      destination: path.join(cwd, ".cursor", "prompts"),
      commandNames: ["cursor"],
      hintPaths: [path.join(home, ".cursor"), path.join(cwd, ".cursor")],
      defaultWhenUndetected: true
    }
  ];
};
