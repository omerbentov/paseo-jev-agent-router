import assert from "node:assert/strict";
import { test } from "node:test";
import { agentConfig, choiceLabels, decide, readAnswer, requestBody, type Profile } from "../server/jev.ts";

const plan: Profile = { id: "p1", name: "Plan", notes: "When we plan a feature", provider: "codex", model: "gpt-6-astra", modeId: "auto-review", thinkingOptionId: "high", featureValues: { plan_mode: true } };
const dev: Profile = { id: "p2", name: "Developer", provider: "codex" };
const qa: Profile = { id: "p3", name: "Testing QA", notes: "When I want to test features", provider: "claude", model: "claude-opus-5" };
const profiles = [plan, dev, qa];

test("labels are profile names, made unique", () => {
  const labels = choiceLabels([plan, { ...dev, name: "Plan" }, { ...qa, name: "  " }]);
  assert.deepEqual([...labels.keys()], ["Plan", "Plan (2)", "p3"]);
});

test("criteria carry the notes when a profile has them", () => {
  const body = JSON.parse(requestBody("do x", choiceLabels(profiles)));
  assert.deepEqual(body.questions.profile.criteria, {
    Plan: "Plan: When we plan a feature",
    Developer: "Developer",
    "Testing QA": "Testing QA: When I want to test features",
  });
  assert.deepEqual(body.state, { task: "do x" });
});

test("reads Jev's choice back to the profile", () => {
  const labels = choiceLabels(profiles);
  const text = JSON.stringify({ answers: { profile: { type: "choice", choice: "Testing QA", confidence: 0.92 } } });
  assert.deepEqual(readAnswer(text, labels), { profile: qa, confidence: 0.92 });
});

test("an unknown choice or a malformed body is no answer", () => {
  const labels = choiceLabels(profiles);
  assert.equal(readAnswer(JSON.stringify({ answers: { profile: { choice: "Nobody" } } }), labels), null);
  assert.equal(readAnswer("not json", labels), null);
  assert.equal(readAnswer("{}", labels), null);
});

test("a confident pick stands", () => {
  const decision = decide({ profile: qa, confidence: 0.9 }, profiles, 0.5, "p2");
  assert.equal(decision.profile, qa);
});

test("an unsure pick yields to the fallback", () => {
  const decision = decide({ profile: qa, confidence: 0.4 }, profiles, 0.5, "p2");
  assert.equal(decision.profile, dev);
  assert.match(decision.reason, /fallback Developer/);
});

test("an unsure pick stands when the fallback is unset or deleted", () => {
  assert.equal(decide({ profile: qa, confidence: 0.4 }, profiles, 0.5, "").profile, qa);
  assert.equal(decide({ profile: qa, confidence: 0.4 }, profiles, 0.5, "gone").profile, qa);
});

test("a profile becomes provider/model agent config", () => {
  assert.deepEqual(agentConfig(plan), { provider: "codex/gpt-6-astra", modeId: "auto-review", thinkingOptionId: "high", featureValues: { plan_mode: true } });
  assert.equal(agentConfig(dev).provider, "codex");
});
