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

function validateProfile(markdown) {
  const result = spawnSync(markdownEnginePath, ["validate", "--file", writeFixture(markdown), "--profile", profilePath, "--format", "json"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.ok([0, 1].includes(result.status), result.stderr);
  return JSON.parse(result.stdout);
}

function hasDiagnostic(result, code, properties = {}) {
  return result.diagnostics.some((diagnostic) => diagnostic.code === code && Object.entries(properties).every(([key, value]) => diagnostic[key] === value));
}

function hasFailedProfileRule(result, ruleId) {
  return result.ruleResults.some((rule) => rule.ruleId === ruleId && rule.status === "failed");
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
  assert.equal(result.evidence.artifactType, "ExecutionPlan");
  assert.deepEqual(result.evidence.routeOrder, ["EP-ACT-1", "EP-GATE-1", "EP-ACT-2", "EP-GATE-2"]);
});

test("structural profile accepts the worked example with every 3.5.0 rule evaluated", () => {
  const result = validateProfile(example);
  assert.equal(result.valid, true);
  assert.equal(result.evidence.engineVersion, "3.5.0");
  assert.equal(result.profile.ruleCount, 38);
  assert.equal(result.profile.evaluatedRuleCount, 38);
  assert.equal(result.profile.skippedRuleCount, 0);
});

test("structural profile requires the exact artifact type", () => {
  const variants = [
    example.replace("type: ExecutionPlan\n", ""),
    example.replace("type: ExecutionPlan", 'type: ""'),
    example.replace("type: ExecutionPlan", "type: WorkItem"),
  ];

  for (const variant of variants) {
    const structural = validateProfile(variant);
    assert.equal(structural.valid, false);
    assert.ok(hasFailedProfileRule(structural, "frontmatter.shape"));
  }
});

test("accepts producer-owned frontmatter extensions", () => {
  const extended = example.replace(
    "validation_profile: /skills/execution-plan/profiles/execution-plan.yaml",
    "validation_profile: /skills/execution-plan/profiles/execution-plan.yaml\ntags:\n  - example\nproducer:\n  skill: execution-plan\npriority: 1",
  );
  assert.equal(validateProfile(extended).valid, true);
  assert.equal(validate(extended).valid, true);
});

test("structural profile owns the concept-level okf_version exclusion", () => {
  const invalid = example.replace("type: ExecutionPlan", 'type: ExecutionPlan\nokf_version: "0.1"');
  const structural = validateProfile(invalid);
  const relational = validate(invalid);
  assert.equal(structural.valid, false);
  assert.ok(hasFailedProfileRule(structural, "frontmatter.shape"));
  assert.ok(structural.diagnostics.some(({ code }) => code === "profile.validation.frontmatterFieldForbidden"));
  assert.equal(relational.valid, true);
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

test("rejects lowercase identifier suffixes", () => {
  const result = validate(example.replaceAll("EP-GATE-1", "EP-GATE-check1"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.invalid-id", { table: "route" }));
  assert.ok(hasDiagnostic(result, "plan.invalid-reference-list", { column: "Required prior Step IDs" }));
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

test("structural profile rejects semantically decoded lifecycle authority", () => {
  const variants = [
    example.replace("title:", '"sta\\u0074us": BLOCKED\n"planning\\u005fdepth": compact\ntitle:'),
    example.replace("title:", "? status\n: BLOCKED\n? planning_depth\n: compact\ntitle:"),
  ];
  for (const variant of variants) {
    const result = validateProfile(variant);
    assert.equal(result.valid, false);
    assert.equal(result.diagnostics.filter(({ code }) => code === "profile.validation.frontmatterFieldForbidden").length, 2);
  }
});

test("structural profile requires non-blank metadata values", () => {
  const result = validateProfile(example.replace("target_branch: codex/cache-prune-dry-run", 'target_branch: "   "'));
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some(({ code }) => code === "profile.validation.frontmatterFieldBlank"));
});

test("structural profile requires the current artifact version", () => {
  const result = validateProfile(example.replace('artifact_version: "2.0"', 'artifact_version: "2.1"'));
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some(({ code }) => code === "profile.validation.frontmatterFieldValueMismatch"));
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

test("structural profile rejects a second authority table in Plan Control", () => {
  const duplicate = "\n| Plan state | Planning depth | Source status | Baseline status | State rationale |\n| --- | --- | --- | --- | --- |\n| BLOCKED | compact | missing | unavailable | Duplicate. |\n";
  const result = validateProfile(example.replace("\n## Source Contract", `${duplicate}\n## Source Contract`));
  assert.equal(result.valid, false);
  assert.ok(hasFailedProfileRule(result, "tables.total.exact"));
});

test("structural profile rejects malformed extra tables in contracted sections", () => {
  const variants = [
    example.replace(
      "\n## Change Footprint",
      "\n| Action ID | Concrete action |\n| --- | --- |\n| EP-ACT-EXTRA | Delete cache contents before validating the dry-run path. |\n\n## Change Footprint",
    ),
    example.replace(
      "\n## Execution Actions",
      "\n| Step ID | Kind | Phase ID | Required prior Step IDs | Note |\n| --- | --- | --- | --- | --- |\n| EP-ACT-3 | action | EP-PH-1 | EP-GATE-2 | Conflicting route declaration. |\n\n## Execution Actions",
    ),
  ];
  for (const variant of variants) {
    const result = validateProfile(variant);
    assert.equal(result.valid, false);
    assert.ok(hasFailedProfileRule(result, "tables.total.exact"));
  }
});

test("structural profile rejects an empty contracted table", () => {
  const invalid = example.split("\n").filter((line) => !line.startsWith("| EP-SRC-")).join("\n");
  const result = validateProfile(invalid);
  assert.equal(result.valid, false);
  assert.ok(hasFailedProfileRule(result, "rows.source-contract.count"));
});

test("structural profile enforces single-row lifecycle authorities", () => {
  const variants = [
    [example.replace("| READY | standard | current | inspected | The outcome", "| DRAFT | compact | current | inspected | Duplicate authority. |\n| READY | standard | current | inspected | The outcome"), "rows.plan-control.count"],
    [example.replace("| PASS | 2026-08-11T21:25:58-05:00 by Codex |", "| REVISE | 2026-08-11T21:25:58-05:00 by Codex | Duplicate authority. | Repair. |\n| PASS | 2026-08-11T21:25:58-05:00 by Codex |"), "rows.plan-readiness.count"],
  ];
  for (const [invalid, ruleId] of variants) {
    const result = validateProfile(invalid);
    assert.equal(result.valid, false);
    assert.ok(hasFailedProfileRule(result, ruleId));
  }
});

test("structural profile rejects a contracted row-count overflow", () => {
  const sourceRow = example.split("\n").find((line) => line.startsWith("| EP-SRC-1 |"));
  const extraRows = Array.from({ length: 29 }, (_, index) => sourceRow.replace("EP-SRC-1", `EP-SRC-X${index}`)).join("\n");
  const invalid = example.replace("\n\n## Outcome Anchors", `\n${extraRows}\n\n## Outcome Anchors`);
  const result = validateProfile(invalid);
  assert.equal(result.valid, false);
  assert.ok(hasFailedProfileRule(result, "rows.source-contract.count"));
});

test("structural profile owns exact table-header enforcement", () => {
  const invalid = example
    .replace("| Step ID | Kind | Phase ID | Required prior Step IDs |", "| Step ID | Kind | Phase ID | Required prior Step IDs | Extra |")
    .replace("| --- | --- | --- | --- |\n| EP-ACT-1 | action | EP-PH-1 | None |", "| --- | --- | --- | --- | --- |\n| EP-ACT-1 | action | EP-PH-1 | None | Extra |");
  const structural = validateProfile(invalid);
  const relational = validate(invalid);
  assert.equal(structural.valid, false);
  assert.equal(relational.valid, false);
  assert.ok(hasFailedProfileRule(structural, "tables.execution-route.columns"));
  assert.equal(hasDiagnostic(relational, "plan.table-schema", { table: "route" }), false);
});

test("structural profile owns outcome and precondition coverage", () => {
  const invalid = example
    .replace(
      "\n\n## Baseline Findings",
      "\n| EP-OUT-3 | EP-SRC-1 | A3 | An intentionally unassigned observable. | A focused proof would be required. |\n\n## Baseline Findings",
    )
    .replace(
      "\n\n## Implementation Decisions",
      "\n| EP-PRE-3 | A deferred optional check is not required by this route. | Confirm the deferred check remains outside the route. | EP-TRIG-1 |\n\n## Implementation Decisions",
    );
  const structural = validateProfile(invalid);
  const relational = validate(invalid);
  assert.equal(structural.valid, false);
  assert.ok(hasFailedProfileRule(structural, "coverage.outcomes.execution-actions"));
  assert.ok(hasFailedProfileRule(structural, "coverage.outcomes.validation-gates"));
  assert.ok(hasFailedProfileRule(structural, "coverage.preconditions.execution-actions"));
  assert.equal(relational.valid, true);
});

test("structural profile owns phase coverage", () => {
  const invalid = twoPhasePlan()
    .replace("| EP-ACT-2 | action | EP-PH-2 | EP-GATE-1 |", "| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |")
    .replace("| EP-GATE-2 | gate | EP-PH-2 | EP-ACT-2 |", "| EP-GATE-2 | gate | EP-PH-1 | EP-ACT-2 |");
  const structural = validateProfile(invalid);
  assert.equal(structural.valid, false);
  assert.ok(hasFailedProfileRule(structural, "coverage.phases.execution-route"));
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
  const result = validate(example.replace("| EP-ACT-1, EP-GATE-1, EP-ACT-2, EP-GATE-2 | Baseline command output", "| EP-ACT-GHOST | Baseline command output"));
  assert.equal(result.valid, false);
  assert.ok(hasDiagnostic(result, "plan.dangling-reference", { reference: "EP-ACT-GHOST" }));
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
