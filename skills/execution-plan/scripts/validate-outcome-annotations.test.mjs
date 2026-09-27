import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const example = readFileSync(new URL("../references/example-execution-plan.md", import.meta.url), "utf8");
const validator = fileURLToPath(new URL("./validate-execution-plan.mjs", import.meta.url));
const engine = process.env.MARKDOWN_ENGINE_BIN || join(process.env.MARKDOWN_ENGINE_BIN_DIR ?? join(homedir(), ".local/bin"), "markdown-engine");
const directory = mkdtempSync(join(tmpdir(), "plan-outcome-annotations-"));
let fixtureIndex = 0;
after(() => rmSync(directory, { recursive: true, force: true }));

function validate(markdown) {
  const file = join(directory, `fixture-${fixtureIndex++}.md`);
  writeFileSync(file, markdown);
  const normalized = spawnSync(engine, ["--file", file], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert.equal(normalized.status, 0, normalized.stderr);
  const result = spawnSync(process.execPath, [validator], { input: normalized.stdout, encoding: "utf8" });
  assert.ok([0, 1].includes(result.status), result.stderr);
  return { status: result.status, ...JSON.parse(result.stdout) };
}

function replaceOnce(source, before, after) {
  assert.ok(source.includes(before), `Missing fixture target: ${before}`);
  return source.replace(before, after);
}

function expectAnnotationFailure(markdown, table, row) {
  const result = validate(markdown);
  assert.equal(result.status, 1);
  assert.equal(result.valid, false);
  const diagnostic = result.diagnostics.find((entry) => entry.code === "plan.outcome-annotation-mismatch");
  assert.ok(diagnostic, JSON.stringify(result));
  assert.equal(diagnostic.table, table);
  assert.equal(diagnostic.row, row);
  assert.equal(diagnostic.column, "Outcome IDs");
  assert.ok(diagnostic.line > 0);
}

test("accepts complete multi-outcome annotations and unannotated historical plans", () => {
  assert.equal(validate(example).valid, true);
  const legacy = example.replace(/\[([^\]]+)\]\(ctx:\/\/trace\/entity\/[^)]+\)/g, "$1");
  assert.equal(validate(legacy).valid, true);
});

for (const [relation, table] of [["implements", "actions"], ["verifies", "gates"]]) {
  const first = `[EP-OUT-1](ctx://trace/entity/EP-OUT-1?rel=${relation})`;
  const second = `[EP-OUT-2](ctx://trace/entity/EP-OUT-2?rel=${relation})`;

  test(`${relation}: rejects a partially annotated multi-outcome cell`, () => {
    expectAnnotationFailure(replaceOnce(example, second, "EP-OUT-2"), table, 2);
  });

  test(`${relation}: rejects destinations that disagree with visible outcome IDs`, () => {
    for (const target of ["EP-OUT-2", "EP-SRC-1"]) {
      expectAnnotationFailure(replaceOnce(example, first, `[EP-OUT-1](ctx://trace/entity/${target}?rel=${relation})`), table, 1);
    }
  });

  test(`${relation}: rejects generic or incorrect relationships`, () => {
    for (const query of ["", "?rel=references", `?rel=${relation === "implements" ? "verifies" : "implements"}`]) {
      expectAnnotationFailure(replaceOnce(example, second, `[EP-OUT-2](ctx://trace/entity/EP-OUT-2${query})`), table, 2);
    }
  });

  test(`${relation}: checks resolved reference-style destinations`, () => {
    const referenced = replaceOnce(example, second, "[EP-OUT-2][outcome-link]");
    assert.equal(validate(`${referenced}\n[outcome-link]: ctx://trace/entity/EP-OUT-2?rel=${relation}\n`).valid, true);
    expectAnnotationFailure(`${referenced}\n[outcome-link]: ctx://trace/entity/EP-OUT-1?rel=${relation}\n`, table, 2);
  });
}
