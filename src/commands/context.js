"use strict";

const { execSync } = require("node:child_process");
const { requireLoginFresh, readRC } = require("../lib/config");
const api = require("../lib/api");

function fmtContext(ctx) {
  const lines = [];

  if (ctx.stack && Object.keys(ctx.stack).length > 0) {
    lines.push("Stack:");
    for (const [k, v] of Object.entries(ctx.stack)) lines.push(`  ${k}: ${v}`);
  }

  if (ctx.hard_limits?.length) {
    lines.push("\nHard limits:");
    ctx.hard_limits.forEach(l => lines.push(`  • ${l}`));
  }

  if (ctx.active_constraints?.length) {
    lines.push("\nActive constraints:");
    ctx.active_constraints.forEach(l => lines.push(`  • ${l}`));
  }

  if (ctx.conventions && Object.keys(ctx.conventions).length > 0) {
    lines.push("\nConventions:");
    Object.values(ctx.conventions).forEach(v => lines.push(`  • ${v}`));
  }

  if (ctx.recent_decisions?.length) {
    lines.push("\nRecent decisions:");
    ctx.recent_decisions.slice(0, 5).forEach(d => {
      lines.push(`  • ${d.what}${d.why ? ` — ${d.why}` : ""}`);
    });
  }

  if (ctx.open_questions?.length) {
    lines.push("\nOpen questions:");
    ctx.open_questions.forEach(q => lines.push(`  ? ${q}`));
  }

  return lines.join("\n");
}

function fmtPreview(ctx) {
  const parts = [];

  if (ctx.stack && Object.keys(ctx.stack).length > 0) {
    parts.push("Stack: " + Object.entries(ctx.stack).map(([k, v]) => `${k}=${v}`).join(", "));
  }
  if (ctx.hard_limits?.length) {
    parts.push("Hard limits: " + ctx.hard_limits.join("; "));
  }
  if (ctx.active_constraints?.length) {
    parts.push("Active constraints: " + ctx.active_constraints.join("; "));
  }
  if (ctx.conventions && Object.keys(ctx.conventions).length > 0) {
    parts.push("Conventions: " + Object.values(ctx.conventions).join("; "));
  }
  if (ctx.recent_decisions?.length) {
    const recent = ctx.recent_decisions.slice(0, 3).map(d => d.what).join("; ");
    parts.push("Recent decisions: " + recent);
  }

  return parts.join("\n");
}

async function run(opts) {
  const rc = readRC();

  // ── Local fallback (not logged in / no project_id) ────────────────────────
  if (!rc?.project_id) {
    if (!rc?.context) {
      console.error("No context found. Run: prepcli init");
      process.exit(1);
    }
    const ctx = rc.context;

    if (opts.preview) {
      console.log(fmtPreview(ctx));
      return;
    }

    console.log("\nProject context (local):\n");
    console.log(fmtContext(ctx));
    console.log("\nNote: context is local only. Log in with `prepcli auth login` to sync to cloud.");
    return;
  }

  // ── Cloud ─────────────────────────────────────────────────────────────────
  const cfg = await requireLoginFresh();

  let ctx;
  try {
    const result = await api.get(`/projects/${rc.project_id}/context`, cfg.access_token);
    ctx = result.context;
  } catch (err) {
    console.error(`Failed to fetch context: ${err.message}`);
    process.exit(1);
  }

  if (!ctx) {
    console.log("No context stored yet. Run: prepcli init");
    return;
  }

  if (opts.preview) {
    console.log(fmtPreview(ctx));
    return;
  }

  if (opts.edit) {
    const os   = require("node:os");
    const fs   = require("node:fs");
    const path = require("node:path");

    const tmp = path.join(os.tmpdir(), `prepcli-ctx-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify(ctx, null, 2));

    const editor = process.env.EDITOR || process.env.VISUAL || "nano";
    try {
      execSync(`${editor} "${tmp}"`, { stdio: "inherit" });
    } catch {
      console.error("Editor closed with error. No changes saved.");
      try { fs.unlinkSync(tmp); } catch {}
      process.exit(1);
    }

    let updated;
    try {
      updated = JSON.parse(fs.readFileSync(tmp, "utf8"));
    } catch {
      console.error("File contains invalid JSON. No changes saved.");
      try { fs.unlinkSync(tmp); } catch {}
      process.exit(1);
    }
    try { fs.unlinkSync(tmp); } catch {}

    await api.put(`/projects/${rc.project_id}/context`, updated, cfg.access_token);
    console.log("✓  Context updated.");
    return;
  }

  console.log(`\nProject context (${rc.project_id.slice(0, 8)}…):\n`);
  console.log(fmtContext(ctx));
  if (ctx.last_updated) {
    console.log(`\nLast updated: ${new Date(ctx.last_updated).toLocaleString()}`);
  }
}

module.exports = { run };
