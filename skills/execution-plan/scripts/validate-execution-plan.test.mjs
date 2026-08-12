import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { validateExecutionPlan } from "./validate-execution-plan.mjs";

const examplePath = fileURLToPath(new URL("../references/example-execution-plan.md", import.meta.url));
const profilePath = fileURLToPath(new URL("../profiles/execution-plan.yaml", import.meta.url));
const validatorPath = fileURLToPath(new URL("./validate-execution-plan.mjs", import.meta.url));
const markdownEnginePath = process.env.MARKDOWN_ENGINE_BIN || join(process.env.MARKDOWN_ENGINE_BIN_DIR ?? join(homedir(), ".local/bin"), "markdown-engine");
const example = readFileSync(examplePath, "utf8");
const temporaryDirectory = mkdtempSync(join(tmpdir(), "execution-plan-validator-"));
let fixtureIndex = 0;

after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

function writeFixture(markdown) {
  const file = join(temporaryDirectory, `fixture-${fixtureIndex++}.md`);
  writeFileSync(file, markdown);
  return file;
}

function normalize(markdown) {
  const result = spawnSync(markdownEnginePath, ["--file", writeFixture(markdown)], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).document;
}

function validate(markdown) {
  return validateExecutionPlan(normalize(markdown));
}

function runCli(markdown) {
  return spawnSync(process.execPath, [validatorPath], {
    encoding: "utf8",
    input: JSON.stringify({ document: normalize(markdown) }),
    maxBuffer: 16 * 1024 * 1024,
  });
}

function hasDiagnostic(result, code, properties = {}) {
  return result.diagnostics.some((diagnostic) => diagnostic.code === code && Object.entries(properties).every(([key, value]) => diagnostic[key] === value));
}

function twoPhasePlan() {
  return example
    .replace(
      "| EP-PH-1 | Add dry-run through the existing selection and mutation boundary and prove both modes. | EP-PRE-1 | The CLI supports dry-run, normal behavior remains green, and no unvalidated generated output remains. |",
      "| EP-PH-1 | Implement and type-check the route. | EP-PRE-1 | The implementation is type-safe. |\n| EP-PH-2 | Add and run behavioral proof. | EP-PRE-2 | The focused and regression behavior passes. |",
    )
    .replace("| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |", "| EP-ACT-2 | action | EP-PH-2 | EP-GATE-1 |")
    .replace("| EP-GATE-2 | gate | EP-PH-1 | EP-ACT-2 |", "| EP-GATE-2 | gate | EP-PH-2 | EP-ACT-2 |");
}

test("accepts the worked example and preserves its explicit route", () => {
  const result = validate(example);
  assert.equal(result.valid, true);
  assert.deepEqual(result.evidence.routeOrder, ["EP-ACT-1", "EP-GATE-1", "EP-ACT-2", "EP-GATE-2"]);
});

test("rejects a self prerequisite", () => {
  const result = validate(example.replace("| EP-ACT-1 | action | EP-PH-1 | None |", "| EP-ACT-1 | action | EP-PH-1 | EP-ACT-1 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.self-dependency"));
});

test("rejects a forward prerequisite", () => {
  const result = validate(example.replace("| EP-GATE-1 | gate | EP-PH-1 | EP-ACT-1 |", "| EP-GATE-1 | gate | EP-PH-1 | EP-ACT-2 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.forward-reference"));
});

test("rejects an undeclared route prerequisite", () => {
  const result = validate(example.replace("| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |", "| EP-ACT-2 | action | EP-PH-1 | EP-GATE-404 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.dangling-reference"));
});

test("rejects a malformed route phase", () => {
  const result = validate(example.replace("| EP-ACT-1 | action | EP-PH-1 |", "| EP-ACT-1 | action | bogus EP-PH-1 text |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.invalid-reference-list", { column: "Phase ID" }));
});

test("rejects an action with no outcome mapping", () => {
  const result = validate(example.replace("| EP-ACT-1 | EP-PRE-1 | EP-OUT-1 |", "| EP-ACT-1 | EP-PRE-1 | None |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.invalid-reference-list", { column: "Outcome IDs" }));
});

test("rejects a gate with no outcome mapping", () => {
  const result = validate(example.replace("| EP-GATE-1 | EP-OUT-1 |", "| EP-GATE-1 | None |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.invalid-reference-list", { column: "Outcome IDs" }));
});

test("rejects invalid decision semantics and dangling decision references", () => {
  const invalid = example
    .replace("| EP-DEC-1 | decision |", "| EP-DEC-1 | tentative |")
    .replace("| EP-FIND-1, EP-FIND-3 |", "| EP-FIND-404 |")
    .replace("| EP-ACT-1, EP-ACT-2 | EP-TRIG-1 |", "| EP-ACT-404 | EP-TRIG-404 |");
  const result = validate(invalid);
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.invalid-enum", { column: "Kind" }));
  assert.ok(result.diagnostics.filter(({ code }) => code === "plan.dangling-reference").length >= 3);
});

test("rejects an outcome anchor with an undeclared source", () => {
  const result = validate(example.replace("| EP-OUT-1 | EP-SRC-1 | A1 |", "| EP-OUT-1 | EP-SRC-404 | A1 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.dangling-reference", { column: "Source IDs" }));
});

test("rejects an empty core cell", () => {
  const result = validate(example.replace("| EP-ACT-1 | EP-PRE-1 | EP-OUT-1 |", "| EP-ACT-1 |  | EP-OUT-1 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.empty-cell"));
});

test("rejects semantically decoded lifecycle authority", () => {
  const variants = [
    example.replace("title:", '"sta\\u0074us": BLOCKED\n"planning\\u005fdepth": compact\ntitle:'),
    example.replace("title:", "? status\n: BLOCKED\n? planning_depth\n: compact\ntitle:"),
  ];
  for (const variant of variants) {
    const result = validate(variant);
    assert.equal(result.valid, false);
    assert.equal(result.diagnostics.filter(({ code }) => code === "plan.duplicate-lifecycle-metadata").length, 2);
  }
});

test("required validator pair rejects malformed stopped-step references", () => {
  for (const orphan of ["EP-ACT-ghost.", "_EP-GATE-ghost_"]) {
    const invalid = example.replace("| EP-ACT-1, EP-GATE-1, EP-ACT-2, EP-GATE-2 | Baseline command output", `| ${orphan} | Baseline command output`);
    const cli = runCli(invalid);
    assert.equal(cli.status, 1, cli.stderr);
    assert.ok(JSON.parse(cli.stdout).diagnostics.some(({ code, column }) => ["plan.invalid-reference-list", "plan.dangling-reference"].includes(code) && column === "Stopped Step IDs"));
    const structural = spawnSync(markdownEnginePath, ["validate", "--file", writeFixture(invalid), "--profile", profilePath, "--format", "json"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    assert.equal(cli.status === 0 && structural.status === 0, false);
  }
});

test("rejects a second authority table in Plan Control", () => {
  const duplicate = "\n| Plan state | Planning depth | Source status | Baseline status | State rationale |\n| --- | --- | --- | --- | --- |\n| BLOCKED | compact | missing | unavailable | Duplicate. |\n";
  const result = validate(example.replace("\n## Source Contract", `${duplicate}\n## Source Contract`));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.table-count") || hasDiagnostic(result, "plan.authority-table-count"));
});

test("rejects READY when a source row is stale", () => {
  const result = validate(example.replace("| EP-SRC-1 | Issue 42, acceptance rows A1 and A2 | revision 3 | Controls observable behavior and proof obligations. | current |", "| EP-SRC-1 | Issue 42, acceptance rows A1 and A2 | revision 3 | Controls observable behavior and proof obligations. | stale |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.source-status-mismatch"));
  assert.ok(hasDiagnostic(result, "plan.ready-with-noncurrent-source"));
});

test("rejects READY with an uninspected baseline", () => {
  const result = validate(example.replace("| READY | standard | current | inspected |", "| READY | standard | current | unavailable |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.ready-with-uninspected-baseline"));
});

test("rejects PASS with a remaining blocker", () => {
  const result = validate(example.replace("| None. |\n\n## Revision Log", "| Critical unresolved blocker. |\n\n## Revision Log"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.pass-with-blocker"));
});

test("rejects dangling unmet and escalation triggers", () => {
  const invalid = example
    .replace("| EP-TRIG-1 |\n\n## Implementation Decisions", "| EP-TRIG-404 |\n\n## Implementation Decisions")
    .replace("| EP-TRIG-1 |\n\n| Trigger ID", "| EP-TRIG-405 |\n\n| Trigger ID");
  const result = validate(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.filter(({ code }) => code === "plan.dangling-reference").length >= 2);
});

test("rejects undeclared stopped steps", () => {
  const result = validate(example.replace("| EP-ACT-1, EP-GATE-1, EP-ACT-2, EP-GATE-2 | Baseline command output", "| EP-ACT-ghost | Baseline command output"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.dangling-reference", { reference: "EP-ACT-ghost" }));
});

test("allows plan-like text in explanatory prose", () => {
  const result = validate(example.replace("The inspected mutation boundary", "EP-FIND-ghost is prose; the inspected mutation boundary"));
  assert.equal(result.valid, true);
});

test("rejects a route kind that disagrees with its detail ID", () => {
  const result = validate(example.replace("| EP-ACT-1 | action | EP-PH-1 | None |", "| EP-ACT-1 | gate | EP-PH-1 | None |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.route-detail-mismatch"));
});

test("rejects a route step without a detail row", () => {
  const actionRow = example.split("\n").find((line) => line.startsWith("| EP-ACT-2 | EP-PRE-2 |"));
  const result = validate(example.replace(`\n${actionRow}`, ""));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.route-detail-mismatch"));
});

test("rejects a detail row without a route step", () => {
  const result = validate(example.replace("| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |\n", ""));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.detail-missing-route-step"));
});

test("rejects duplicate route steps", () => {
  const result = validate(example.replace("| EP-GATE-2 | gate | EP-PH-1 | EP-ACT-2 |", "| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.duplicate-id"));
});

test("accepts a coherent two-phase route", () => {
  const result = validate(twoPhasePlan());
  assert.equal(result.valid, true);
  assert.deepEqual(result.evidence.phaseOrder, ["EP-PH-1", "EP-PH-2"]);
  assert.deepEqual(result.evidence.routeOrder, ["EP-ACT-1", "EP-GATE-1", "EP-ACT-2", "EP-GATE-2"]);
});

test("rejects phase re-entry", () => {
  const result = validate(twoPhasePlan().replace("| EP-GATE-2 | gate | EP-PH-2 | EP-ACT-2 |", "| EP-GATE-2 | gate | EP-PH-1 | EP-ACT-2 |"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.phase-order"));
});

test("rejects a phase that does not end with a gate", () => {
  const result = validate(example.replace("| EP-GATE-2 | gate | EP-PH-1 | EP-ACT-2 |\n", ""));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.phase-without-exit-gate"));
});

test("rejects a phase without an action", () => {
  const invalid = twoPhasePlan()
    .replace("| EP-ACT-2 | action | EP-PH-2 | EP-GATE-1 |\n", "")
    .replace("| EP-GATE-2 | gate | EP-PH-2 | EP-ACT-2 |", "| EP-GATE-2 | gate | EP-PH-2 | EP-GATE-1 |");
  const result = validate(invalid);
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.phase-without-action"));
});
