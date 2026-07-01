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

const AUTH_DEPS = {
  "better-auth":    "better-auth",
  "next-auth":      "NextAuth",
  "@auth/core":     "Auth.js",
  "passport":       "Passport",
  "lucia":          "Lucia",
};

const TEST_DEPS = {
  "vitest":     "Vitest",
  "jest":       "Jest",
  "playwright": "Playwright",
  "cypress":    "Cypress",
};

const API_DEPS = {
  "@trpc/server":          "tRPC",
  "@tanstack/react-query": "TanStack Query",
};

const STYLE_DEPS = {
  "tailwindcss":       "Tailwind CSS",
  "@emotion/react":    "Emotion",
  "styled-components": "styled-components",
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

    // Auth
    for (const [dep, label] of Object.entries(AUTH_DEPS)) {
      if (all[dep]) { result.stack.auth = label; break; }
    }

    // Testing
    for (const [dep, label] of Object.entries(TEST_DEPS)) {
      if (all[dep]) { result.stack.testing = label; break; }
    }

    // API layer
    for (const [dep, label] of Object.entries(API_DEPS)) {
      if (all[dep]) { result.stack.api = label; break; }
    }

    // Styling
    for (const [dep, label] of Object.entries(STYLE_DEPS)) {
      if (all[dep]) { result.stack.styling = label; break; }
    }

    // Monorepo
    if (all["turbo"] || exists(path.join(cwd, "turbo.json"))) {
      result.stack.monorepo = "Turborepo";
    } else if (exists(path.join(cwd, "pnpm-workspace.yaml"))) {
      result.stack.monorepo = "pnpm workspaces";
    }

    // i18n
    if (all["i18next"] || all["next-i18next"] || all["@formatjs/intl"]) {
      result.stack.i18n = all["i18next"] ? "i18next" : all["next-i18next"] ? "next-i18next" : "FormatJS";
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

function detectStructure(cwd = process.cwd(), { maxDepth = 2, maxDirs = 40 } = {}) {
  let out;
  try {
    out = execSync("git ls-files", { cwd, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
  } catch {
    return null;
  }
  const files = out.split("\n").filter(Boolean);
  if (!files.length) return null;

  const dirs = new Set();
  for (const f of files) {
    const parts = f.split("/");
    for (let d = 1; d < parts.length && d <= maxDepth; d++) {
      dirs.add(parts.slice(0, d).join("/"));
    }
  }
  const sorted = [...dirs].sort();
  return { file_count: files.length, dirs: sorted.slice(0, maxDirs), truncated: sorted.length > maxDirs };
}

module.exports = { detectStack, detectStructure };
