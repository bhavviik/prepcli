"use strict";

const fs              = require("node:fs");
const path            = require("node:path");
const { execSync, execFileSync } = require("node:child_process");

const SHADOW_BRANCH = "prepcli/shadow/v1";

function exec(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
}

function execSafe(cmd, cwd) {
  try { return exec(cmd, cwd); } catch { return null; }
}

function gitRoot(cwd = process.cwd()) {
  return execSafe("git rev-parse --show-toplevel", cwd) || cwd;
}

function shadowBranchExists(cwd = process.cwd()) {
  return execSafe(`git rev-parse --verify refs/heads/${SHADOW_BRANCH}`, gitRoot(cwd)) !== null;
}

function shadowBranchExistsOnRemote(cwd = process.cwd()) {
  const out = execSafe(`git ls-remote --heads origin ${SHADOW_BRANCH}`, gitRoot(cwd));
  return Boolean(out?.includes(SHADOW_BRANCH));
}

function initShadowBranch(cwd = process.cwd()) {
  const root = gitRoot(cwd);
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME:    "prepcli",
    GIT_AUTHOR_EMAIL:   "bot@prepcli.in",
    GIT_COMMITTER_NAME: "prepcli",
    GIT_COMMITTER_EMAIL:"bot@prepcli.in",
  };

  // Create empty tree (git constant, no temp files needed)
  const emptyTree = execFileSync("git", ["mktree"], {
    cwd: root, input: "", env, stdio: ["pipe", "pipe", "pipe"],
  }).toString().trim();

  // Create initial commit on that empty tree (no parent)
  const commitHash = execFileSync("git", ["commit-tree", emptyTree, "-F", "-"], {
    cwd: root, input: "chore: init prepcli shadow branch", env, stdio: ["pipe", "pipe", "pipe"],
  }).toString().trim();

  // Point the branch ref at that commit (no checkout — working tree untouched)
  execFileSync("git", ["update-ref", `refs/heads/${SHADOW_BRANCH}`, commitHash], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"],
  });
}

function fetchShadowBranch(cwd = process.cwd()) {
  try {
    exec(`git fetch origin ${SHADOW_BRANCH}:${SHADOW_BRANCH}`, gitRoot(cwd));
    return true;
  } catch { return false; }
}

function writeBlobObject(content, cwd = process.cwd()) {
  return execFileSync("git", ["hash-object", "-w", "--stdin"], {
    cwd: gitRoot(cwd),
    input: content,
    stdio: ["pipe", "pipe", "pipe"],
  }).toString().trim();
}

function getShadowTree(cwd = process.cwd()) {
  const out = execSafe(`git ls-tree ${SHADOW_BRANCH}`, gitRoot(cwd));
  if (!out) return [];
  return out.split("\n").filter(Boolean).map(line => {
    const m = line.match(/^(\d+)\s+\w+\s+([0-9a-f]+)\t(.+)$/);
    if (!m) return null;
    return { mode: m[1], hash: m[2], filename: m[3] };
  }).filter(Boolean);
}

function createTreeObject(entries, cwd = process.cwd()) {
  const input = entries.map(e => `${e.mode} blob ${e.hash}\t${e.filename}`).join("\n");
  return execFileSync("git", ["mktree"], {
    cwd: gitRoot(cwd),
    input,
    stdio: ["pipe", "pipe", "pipe"],
  }).toString().trim();
}

function createCommitObject(treeHash, parentHash, message, cwd = process.cwd()) {
  const root = gitRoot(cwd);
  const args = ["commit-tree", treeHash];
  if (parentHash) args.push("-p", parentHash);
  args.push("-F", "-");

  const env = {
    ...process.env,
    GIT_AUTHOR_NAME:     "prepcli",
    GIT_AUTHOR_EMAIL:    "bot@prepcli.in",
    GIT_COMMITTER_NAME:  "prepcli",
    GIT_COMMITTER_EMAIL: "bot@prepcli.in",
  };

  return execFileSync("git", args, {
    cwd: root, input: message, env, stdio: ["pipe", "pipe", "pipe"],
  }).toString().trim();
}

function updateShadowBranch(commitHash, cwd = process.cwd()) {
  execFileSync("git", ["update-ref", `refs/heads/${SHADOW_BRANCH}`, commitHash], {
    cwd: gitRoot(cwd), stdio: ["pipe", "pipe", "pipe"],
  });
}

function writeDecisionRecord(filename, content, cwd = process.cwd()) {
  const root = gitRoot(cwd);

  const blobHash   = writeBlobObject(content, root);
  const existing   = getShadowTree(root);
  const newEntries = existing.filter(e => e.filename !== filename);
  newEntries.push({ mode: "100644", hash: blobHash, filename });

  const treeHash   = createTreeObject(newEntries, root);
  const parentHash = execSafe(`git rev-parse refs/heads/${SHADOW_BRANCH}`, root);
  const commitHash = createCommitObject(treeHash, parentHash, `record: ${filename}`, root);

  updateShadowBranch(commitHash, root);
  return commitHash;
}

function configurePushRefspec(cwd = process.cwd()) {
  const root    = gitRoot(cwd);
  const refspec = `refs/heads/${SHADOW_BRANCH}:refs/heads/${SHADOW_BRANCH}`;
  const existing = execSafe("git config --get-all remote.origin.push", root) || "";
  if (!existing.includes(refspec)) {
    execFileSync("git", ["config", "--add", "remote.origin.push", refspec], {
      cwd: root, stdio: ["pipe", "pipe", "pipe"],
    });
  }
}

function hasPushAccess(cwd = process.cwd()) {
  const root = gitRoot(cwd);
  // Check if remote origin exists first
  if (!execSafe("git remote get-url origin", root)) return false;
  try {
    execSync("git push --dry-run origin HEAD", { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch(e) {
    const msg = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    // "up-to-date" means we have access but nothing to push
    return msg.includes("up-to-date") || msg.includes("up to date");
  }
}

function installPrePushHook(cwd = process.cwd()) {
  const root    = gitRoot(cwd);
  const hooksDir = path.join(root, ".git", "hooks");
  const hookPath = path.join(hooksDir, "pre-push");

  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

  const script = [
    "#!/bin/sh",
    "# Installed by prepcli. Remove this file to disable session recording.",
    "# stdin carries git push info — prepcli reads its own .prepcli-session file instead.",
    "command -v prepcli >/dev/null 2>&1 && prepcli _hook pre-push || true",
  ].join("\n") + "\n";

  fs.writeFileSync(hookPath, script, { mode: 0o755 });
}

function ensureGitignoreEntry(cwd = process.cwd()) {
  const root       = gitRoot(cwd);
  const ignorePath = path.join(root, ".gitignore");
  const entries    = [".prepcli-session", ".prepcli-deltas.json"];

  let content   = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, "utf8") : "";
  const present = content.split("\n").map(l => l.trim());

  for (const entry of entries) {
    if (!present.includes(entry)) {
      content += (content.endsWith("\n") || !content ? "" : "\n") + entry + "\n";
      present.push(entry);
    }
  }
  fs.writeFileSync(ignorePath, content);
}

module.exports = {
  SHADOW_BRANCH,
  gitRoot,
  shadowBranchExists,
  shadowBranchExistsOnRemote,
  initShadowBranch,
  fetchShadowBranch,
  writeBlobObject,
  getShadowTree,
  createTreeObject,
  createCommitObject,
  updateShadowBranch,
  writeDecisionRecord,
  configurePushRefspec,
  hasPushAccess,
  installPrePushHook,
  ensureGitignoreEntry,
};
