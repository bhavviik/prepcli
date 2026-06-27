"use strict";

const { test } = require("node:test");
const assert   = require("node:assert");
const { classifyMessage, isWindowCloseSignal, qualityScore, computePromoted } = require("../lib/delta");

test("classifyMessage: constraint phrase is a delta", () => {
  const r = classifyMessage("oh also don't touch the auth config");
  assert.equal(r.is_delta, true);
  assert.equal(r.gap_type, "missing_constraint");
});

test("classifyMessage: acknowledgement is not a delta", () => {
  assert.equal(classifyMessage("looks good, thanks").is_delta, false);
});

test("isWindowCloseSignal", () => {
  assert.equal(isWindowCloseSignal("ship it"), true);
  assert.equal(isWindowCloseSignal("one more change"), false);
});

test("qualityScore: 0 deltas = 1.0; heavier deltas score lower", () => {
  assert.equal(qualityScore([], "debug"), 1);
  const one = qualityScore([{ gap: "missing_constraint" }], "debug"); // 1 - 1.5/3
  assert.equal(one, 0.5);
  assert.ok(qualityScore([{ gap: "missing_constraint" }, { gap: "missing_scope" }], "debug") < one);
});

test("computePromoted: question promoted only at threshold", () => {
  const q = "Are there modules that must not be touched?";
  const deltas = [
    { workflow: "debug", question: q },
    { workflow: "debug", question: q },
  ];
  assert.deepEqual(computePromoted(deltas, 3).debug || [], []); // 2 < 3
  deltas.push({ workflow: "debug", question: q });
  assert.deepEqual(computePromoted(deltas, 3).debug, [q]);      // 3 >= 3
});
