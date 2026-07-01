"use strict";

// Phase 4 — delta classification + scoring. Pure logic, no I/O (so it's testable).
// A "delta" is context the user reveals AFTER typing GO — i.e. a question that
// should have been asked up front. We store the generalized question, never the
// raw message, so nothing sensitive is persisted.

const GAP_TYPES = {
  missing_constraint:   { weight: 1.5, patterns: ["don't touch", "do not modify", "cannot change", "must not", "leave alone", "hands off"] },
  missing_scope:        { weight: 1.2, patterns: ["also", "additionally", "one more thing", "and also", "i forgot"] },
  missing_integration:  { weight: 1.2, patterns: ["connects to", "calls the", "depends on", "integrated with", "goes through"] },
  missing_environment:  { weight: 1.0, patterns: ["staging", "production", "prod", "dev environment", "local only", "not in prod"] },
  missing_platform:     { weight: 1.0, patterns: ["safari", "mobile", "ios", "android", "firefox", "chrome", "browser", "tablet", "windows"] },
  missing_ownership:    { weight: 0.9, patterns: ["owned by", "team owns", "platform team", "infra team"] },
  clarification_needed: { weight: 0.8, patterns: ["i meant", "actually i meant", "not that", "misunderstood", "that's not what"] },
  missing_deadline:     { weight: 0.7, patterns: ["by friday", "needs to ship", "deadline", "this week", "end of sprint"] },
};

const NOT_DELTA = ["what does", "what is", "can you explain", "how does", "looks good", "lgtm", "ship it", "approved", "makes sense", "got it", "thanks", "thank you"];
const CLOSE_SIGNALS = ["looks good", "lgtm", "ship it", "approved", "done", "perfect", "that works", "that's it", "merged", "deployed", "thanks", "thank you"];

// Expected worst-case delta load per workflow — used to normalize the score.
const EXPECTED_MAX = { debug: 3, plan: 5, review: 2, prep: 3, refactor: 3, write: 4, general: 3 };

function weightOf(gap) { return GAP_TYPES[gap]?.weight ?? 1; }

// Fallback classifier — used only when the AI doesn't pass an explicit --gap.
function classifyMessage(message) {
  const lower = (message || "").toLowerCase();
  if (NOT_DELTA.some((p) => lower.includes(p))) return { is_delta: false };
  for (const [gap, cfg] of Object.entries(GAP_TYPES)) {
    if (cfg.patterns.some((p) => lower.includes(p))) return { is_delta: true, gap_type: gap, weight: cfg.weight };
  }
  if (lower.split(/\s+/).filter(Boolean).length > 8) return { is_delta: true, gap_type: "missing_scope", weight: 0.5 };
  return { is_delta: false };
}

function isWindowCloseSignal(message) {
  const lower = (message || "").toLowerCase();
  return CLOSE_SIGNALS.some((s) => lower.includes(s));
}

// 0 deltas = 1.00. More/heavier deltas → lower score, floored at 0.
function qualityScore(deltas, workflow) {
  const max = EXPECTED_MAX[workflow] || EXPECTED_MAX.general;
  const sum = deltas.reduce((s, d) => s + weightOf(d.gap), 0);
  return Math.max(0, Math.round((1 - sum / max) * 100) / 100);
}

// A question that recurred >= threshold times for a workflow gets "promoted" —
// it will be injected into that workflow's question pool next time.
function computePromoted(allDeltas, threshold = 3) {
  const counts = {}; // workflow -> question -> n
  for (const d of allDeltas) {
    if (!d.question) continue;
    const wf = (counts[d.workflow] ??= {});
    wf[d.question] = (wf[d.question] || 0) + 1;
  }
  const out = {};
  for (const [wf, qs] of Object.entries(counts)) {
    out[wf] = Object.entries(qs)
      .filter(([, n]) => n >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([q]) => q);
  }
  return out;
}

module.exports = { GAP_TYPES, EXPECTED_MAX, classifyMessage, isWindowCloseSignal, weightOf, qualityScore, computePromoted };
