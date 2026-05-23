"use strict";

const fs   = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

function tryRead(filePath) {
  try { return fs.readFileSync(filePath, "utf8"); }
  catch { return null; }
}

function tryJSON(filePath) {
  const raw = tryRead(filePath);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function exists(filePath) {
  try { fs.accessSync(filePath); return true; }
  catch { return false; }
}

function gitRemote(cwd) {
  try {
    return execSync("git remote get-url origin", { cwd, stdio: ["pipe", "pipe", "pipe"] })
      .toString().trim();
  } catch { return null; }
}

const FRAMEWORK_DEPS = {
  "next":            "Next.js",
  "@remix-run/node": "Remix",
  "astro":           "Astro",
  "gatsby":          "Gatsby",
  "nuxt":            "Nuxt",
  "@sveltejs/kit":   "SvelteKit",
  "svelte":          "Svelte",
  "vue":             "Vue",
  "react":           "React",
  "@nestjs/core":    "NestJS",
  "fastify":         "Fastify",
  "express":         "Express",
  "koa":             "Koa",
  "hono":            "Hono",
  "electron":        "Electron",
};

const DB_DEPS = {
  "@supabase/supabase-js": "Supabase",
  "@prisma/client":        "Prisma",
  "drizzle-orm":           "Drizzle",
  "typeorm":               "TypeORM",
  "mongoose":              "MongoDB",
  "pg":                    "PostgreSQL",
  "mysql2":                "MySQL",
  "sqlite3":               "SQLite",
  "redis":                 "Redis",
  "@upstash/redis":        "Upstash Redis",
};

function detectStack(cwd = process.cwd()) {
  const result = { stack: {}, name: null, git_remote: null };

  result.git_remote = gitRemote(cwd);

  const pkg = tryJSON(path.join(cwd, "package.json"));

  if (pkg) {
    result.name = pkg.name;
    const all = { ...pkg.dependencies, ...pkg.devDependencies };

    // Language
    if (all["typescript"] || exists(path.join(cwd, "tsconfig.json"))) {
      result.stack.language = "TypeScript";
    } else {
      result.stack.language = "JavaScript";
    }

    // Runtime
    const nvmrc   = tryRead(path.join(cwd, ".nvmrc"))?.trim();
    const nvFile  = tryRead(path.join(cwd, ".node-version"))?.trim();
    const engines = pkg.engines?.node;
    result.stack.runtime = `Node ${nvmrc || nvFile || engines || ">=18"}`;

    // Framework — first match wins (ordered most specific → least)
    for (const [dep, label] of Object.entries(FRAMEWORK_DEPS)) {
      if (all[dep]) { result.stack.framework = label; break; }
    }

    // Database
    for (const [dep, label] of Object.entries(DB_DEPS)) {
      if (all[dep]) { result.stack.db = label; break; }
    }

    // Package manager
    if (exists(path.join(cwd, "pnpm-lock.yaml")))    result.stack.package_manager = "pnpm";
    else if (exists(path.join(cwd, "yarn.lock")))     result.stack.package_manager = "yarn";
    else if (exists(path.join(cwd, "package-lock.json"))) result.stack.package_manager = "npm";

  } else if (exists(path.join(cwd, "Cargo.toml"))) {
    result.stack.language = "Rust";
    const cargo = tryRead(path.join(cwd, "Cargo.toml"));
    const nameMatch = cargo?.match(/^name\s*=\s*"([^"]+)"/m);
    if (nameMatch) result.name = nameMatch[1];

  } else if (exists(path.join(cwd, "go.mod"))) {
    result.stack.language = "Go";

  } else if (exists(path.join(cwd, "requirements.txt")) || exists(path.join(cwd, "pyproject.toml"))) {
    result.stack.language = "Python";
  }

  // CI
  if (exists(path.join(cwd, ".github/workflows")))  result.stack.ci = "GitHub Actions";
  else if (exists(path.join(cwd, ".circleci")))      result.stack.ci = "CircleCI";
  else if (exists(path.join(cwd, ".gitlab-ci.yml"))) result.stack.ci = "GitLab CI";

  // Hosting
  if (exists(path.join(cwd, "vercel.json")) || exists(path.join(cwd, ".vercel"))) {
    result.stack.hosting = "Vercel";
  } else if (exists(path.join(cwd, "netlify.toml"))) {
    result.stack.hosting = "Netlify";
  } else if (exists(path.join(cwd, "wrangler.toml"))) {
    result.stack.hosting = "Cloudflare Workers";
  } else if (exists(path.join(cwd, "fly.toml"))) {
    result.stack.hosting = "Fly.io";
  } else if (exists(path.join(cwd, "render.yaml"))) {
    result.stack.hosting = "Render";
  } else if (exists(path.join(cwd, "railway.json")) || exists(path.join(cwd, "railway.toml"))) {
    result.stack.hosting = "Railway";
  }

  return result;
}

module.exports = { detectStack };
