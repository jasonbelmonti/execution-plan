#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ID_SUFFIX = "[A-Za-z0-9]+";

const TABLES = {
  planControl: {
    section: "Plan Control",
    headers: ["Plan state", "Planning depth", "Source status", "Baseline status", "State rationale"],
    maxRows: 1,
  },
  sources: {
    section: "Source Contract",
    headers: ["Source ID", "Source reference", "Version / fingerprint", "Authority", "Status", "Planning implication"],
    idColumn: "Source ID",
    prefixes: ["EP-SRC"],
    maxRows: 30,
  },
  outcomes: {
    section: "Outcome Anchors",
    headers: ["Outcome ID", "Source IDs", "Source location", "Required observable", "Proof obligation"],
    idColumn: "Outcome ID",
    prefixes: ["EP-OUT"],
    maxRows: 20,
  },
  findings: {
    section: "Baseline Findings",
    headers: ["Finding ID", "Repository evidence", "Current behavior / constraint", "Planning implication", "Confidence"],
    idColumn: "Finding ID",
    prefixes: ["EP-FIND"],
    maxRows: 30,
  },
  preconditions: {
    section: "Preconditions",
    headers: ["Precondition ID", "Required state / input", "Verification", "Unmet trigger ID"],
    idColumn: "Precondition ID",
    prefixes: ["EP-PRE"],
    maxRows: 30,
  },
  decisions: {
    section: "Implementation Decisions",
    headers: ["Decision ID", "Kind", "Decision or assumption", "Finding IDs", "Evidence / rationale", "Affected action IDs", "Replan trigger ID"],
    idColumn: "Decision ID",
    prefixes: ["EP-DEC"],
    maxRows: 30,
  },
  phases: {
    section: "Execution Phases",
    headers: ["Phase ID", "Phase objective", "Entry precondition IDs", "Safe intermediate state"],
    idColumn: "Phase ID",
    prefixes: ["EP-PH"],
    maxRows: 12,
  },
  route: {
    section: "Execution Route",
    headers: ["Step ID", "Kind", "Phase ID", "Required prior Step IDs"],
    idColumn: "Step ID",
    prefixes: ["EP-ACT", "EP-GATE"],
    maxRows: 100,
  },
  actions: {
    section: "Execution Actions",
    headers: ["Action ID", "Precondition IDs", "Outcome IDs", "Targets", "Concrete action", "Observable postcondition", "Evidence to capture", "Failure response ID"],
    idColumn: "Action ID",
    prefixes: ["EP-ACT"],
    maxRows: 60,
  },
  footprint: {
    section: "Change Footprint",
    headers: ["Path / component", "Action IDs", "Change type", "Purpose", "Confidence", "Risk / ownership note"],
  },
  gates: {
    section: "Validation Gates",
    headers: ["Gate ID", "Outcome IDs", "Command or check", "Expected observation", "Evidence capture", "Evidence artifact", "Evidence verification", "Failure response ID"],
    idColumn: "Gate ID",
    prefixes: ["EP-GATE"],
    maxRows: 40,
  },
  responses: {
    section: "Failure and Replan Controls",
    headers: ["Response ID", "Trigger", "Containment", "Exact recovery / rollback procedure", "Single restored safe state", "Verification", "Escalation trigger ID"],
    idColumn: "Response ID",
    prefixes: ["EP-RESP"],
    maxRows: 30,
  },
  triggers: {
    section: "Failure and Replan Controls",
    headers: ["Trigger ID", "Observable trigger", "Stopped Step IDs", "Evidence to preserve", "Required decision / input", "Exact resume condition"],
    idColumn: "Trigger ID",
    prefixes: ["EP-TRIG"],
    maxRows: 30,
  },
  readiness: {
    section: "Plan Readiness",
    headers: ["Decision", "Reviewed at", "Evidence / rationale", "Required revision or blocker"],
    maxRows: 1,
  },
  revisions: {
    section: "Revision Log",
    headers: ["Revision", "Timestamp", "Actor", "Material change", "Reason / source", "Checksum reference"],
  },
};

const REFERENCES = [
  ["outcomes", "Source IDs", "sources"],
  ["preconditions", "Unmet trigger ID", "triggers", { exactOne: true }],
  ["decisions", "Finding IDs", "findings"],
  ["decisions", "Affected action IDs", "actions"],
  ["decisions", "Replan trigger ID", "triggers", { exactOne: true }],
  ["phases", "Entry precondition IDs", "preconditions"],
  ["route", "Phase ID", "phases", { exactOne: true }],
  ["route", "Required prior Step IDs", "route", { allowNone: true, previousOnly: true }],
  ["actions", "Precondition IDs", "preconditions"],
  ["actions", "Outcome IDs", "outcomes"],
  ["actions", "Failure response ID", "responses", { exactOne: true }],
  ["footprint", "Action IDs", "actions"],
  ["gates", "Outcome IDs", "outcomes"],
  ["gates", "Failure response ID", "responses", { exactOne: true }],
  ["responses", "Escalation trigger ID", "triggers", { exactOne: true }],
  ["triggers", "Stopped Step IDs", "route"],
];

const ENUMS = [
  ["sources", "Status", ["current", "missing", "conflicted", "stale"]],
  ["findings", "Confidence", ["confirmed", "inferred"]],
  ["decisions", "Kind", ["decision", "assumption"]],
  ["route", "Kind", ["action", "gate"]],
  ["footprint", "Confidence", ["confirmed", "candidate"]],
  ["planControl", "Plan state", ["DRAFT", "BLOCKED", "READY", "SUPERSEDED"]],
  ["planControl", "Planning depth", ["compact", "standard", "expanded"]],
  ["planControl", "Source status", ["current", "missing", "conflicted", "stale"]],
  ["planControl", "Baseline status", ["inspected", "unavailable", "stale"]],
  ["readiness", "Decision", ["PASS", "REVISE", "BLOCKED"]],
];

const COVERAGE = [
  ["outcomes", "actions", "Outcome IDs"],
  ["outcomes", "gates", "Outcome IDs"],
  ["phases", "route", "Phase ID"],
  ["preconditions", "actions", "Precondition IDs"],
];

function diagnostic(diagnostics, code, message, context = {}) {
  diagnostics.push({ code, message, ...context });
}

function sameHeaders(left, right) {
  return left.length === right.length && left.every((header, index) => header === right[index]);
}

function normalizedTables(document) {
  if (!Array.isArray(document?.children) || !Array.isArray(document?.tables)) {
    throw new Error("Markdown Engine output is missing normalized children or tables");
  }
  const headings = document.children
    .filter((node) => node.type === "heading" && node.attributes?.depth === 2)
    .map((node) => ({ title: node.text, index: node.target?.path?.[0] }))
    .filter(({ index }) => Number.isInteger(index));

  return document.tables.map((table) => {
    const tableIndex = table.target?.path?.[0];
    const section = headings.filter(({ index }) => index < tableIndex).at(-1)?.title;
    const headers = table.cells.filter((cell) => cell.header).sort((a, b) => a.columnIndex - b.columnIndex).map((cell) => cell.text.trim());
    const rowIndexes = [...new Set(table.cells.filter((cell) => !cell.header).map((cell) => cell.rowIndex))].sort((a, b) => a - b);
    const rows = rowIndexes.map((rowIndex) => Object.fromEntries(headers.map((header, columnIndex) => {
      const cell = table.cells.find((candidate) => !candidate.header && candidate.rowIndex === rowIndex && candidate.columnIndex === columnIndex);
      return [header, cell?.text.trim() ?? ""];
    })));
    return { section, headers, rows };
  });
}

function loadTables(document, diagnostics) {
  let candidates = [];
  try {
    candidates = normalizedTables(document);
  } catch (error) {
    diagnostic(diagnostics, "plan.normalized-document-invalid", error.message);
  }
  const tables = new Map();
  for (const [key, definition] of Object.entries(TABLES)) {
    const matches = candidates.filter(({ section, headers }) => section === definition.section && sameHeaders(headers, definition.headers));
    if (matches.length !== 1) diagnostic(diagnostics, "plan.table-count", `${definition.section} requires exactly one table with the contracted headers; found ${matches.length}`, { table: key });
    const table = matches[0] ?? { section: definition.section, headers: definition.headers, rows: [] };
    if (table.rows.length === 0) diagnostic(diagnostics, "plan.table-empty", `${definition.section} requires at least one data row`, { table: key });
    if (definition.maxRows !== undefined && table.rows.length > definition.maxRows) diagnostic(diagnostics, "plan.table-row-limit", `${definition.section} allows at most ${definition.maxRows} rows; found ${table.rows.length}`, { table: key });
    tables.set(key, table);
  }
  const expectedCounts = new Map();
  for (const { section } of Object.values(TABLES)) expectedCounts.set(section, (expectedCounts.get(section) ?? 0) + 1);
  for (const [section, expected] of expectedCounts) {
    const count = candidates.filter((candidate) => candidate.section === section).length;
    if (count !== expected) diagnostic(diagnostics, "plan.section-table-count", `${section} requires exactly ${expected} table${expected === 1 ? "" : "s"} of any shape; found ${count}`, { section });
  }
  return tables;
}

function validId(value, prefixes) {
  return prefixes.some((prefix) => new RegExp(`^${prefix}-${ID_SUFFIX}$`).test(value));
}

function parseIdList(value, prefixes, { allowNone = false } = {}) {
  if (value === "None") {
    if (allowNone) return [];
    throw new Error("None is not permitted");
  }
  if (!value) throw new Error("reference cell must not be empty");
  const references = value.split(",").map((reference) => reference.trim());
  if (references.some((reference) => !validId(reference, prefixes))) throw new Error(`expected comma-separated ${prefixes.join(" or ")}-* IDs`);
  if (new Set(references).size !== references.length) throw new Error("duplicate reference");
  return references;
}

function registerIds(tables, diagnostics) {
  const indexes = new Map();
  for (const [key, definition] of Object.entries(TABLES)) {
    if (!definition.idColumn) continue;
    const order = new Map();
    tables.get(key).rows.forEach((row, rowIndex) => {
      const id = row[definition.idColumn];
      if (!validId(id, definition.prefixes)) diagnostic(diagnostics, "plan.invalid-id", `${definition.section} row ${rowIndex + 1} has invalid ${definition.idColumn}: ${id}`, { table: key, row: rowIndex + 1 });
      else if (order.has(id)) diagnostic(diagnostics, "plan.duplicate-id", `${definition.section} declares ${id} more than once`, { table: key, row: rowIndex + 1, id });
      else order.set(id, rowIndex);
    });
    indexes.set(key, order);
  }
  return indexes;
}

function referenceKey(table, rowIndex, column) {
  return `${table}\0${rowIndex}\0${column}`;
}

function validateReferences(tables, indexes, diagnostics) {
  const parsed = new Map();
  for (const [from, column, to, options = {}] of REFERENCES) {
    const fromDefinition = TABLES[from];
    const targetDefinition = TABLES[to];
    tables.get(from).rows.forEach((row, rowIndex) => {
      let references = [];
      try {
        references = parseIdList(row[column], targetDefinition.prefixes, options);
      } catch (error) {
        diagnostic(diagnostics, "plan.invalid-reference-list", `${fromDefinition.section} row ${rowIndex + 1} ${column}: ${error.message}`, { table: from, row: rowIndex + 1, column });
      }
      parsed.set(referenceKey(from, rowIndex, column), references);
      if (options.exactOne && references.length !== 1) diagnostic(diagnostics, "plan.reference-cardinality", `${fromDefinition.section} row ${rowIndex + 1} ${column} requires exactly one ID`, { table: from, row: rowIndex + 1, column });
      const currentId = fromDefinition.idColumn ? row[fromDefinition.idColumn] : undefined;
      for (const reference of references) {
        if (!indexes.get(to).has(reference)) diagnostic(diagnostics, "plan.dangling-reference", `${fromDefinition.section} row ${rowIndex + 1} ${column} references undeclared ${reference}`, { table: from, row: rowIndex + 1, column, reference });
        else if (from === to && reference === currentId) diagnostic(diagnostics, "plan.self-dependency", `${currentId} depends on itself`, { table: from, row: rowIndex + 1, reference });
        else if (options.previousOnly && indexes.get(to).get(reference) >= rowIndex) diagnostic(diagnostics, "plan.forward-reference", `${currentId} requires ${reference}, which is not an earlier route step`, { table: from, row: rowIndex + 1, reference });
      }
    });
  }
  return parsed;
}

function validateRoute(tables, indexes, parsed, diagnostics) {
  const routeRows = tables.get("route").rows;
  const phaseIndex = indexes.get("phases");
  const phaseSteps = new Map([...phaseIndex.keys()].map((phase) => [phase, []]));

  routeRows.forEach((row, rowIndex) => {
    const id = row["Step ID"];
    const detailTable = row.Kind === "action" ? "actions" : row.Kind === "gate" ? "gates" : undefined;
    if (detailTable && !indexes.get(detailTable).has(id)) {
      diagnostic(diagnostics, "plan.route-detail-mismatch", `${id} is a ${row.Kind} route step without a matching detail row`, { table: "route", row: rowIndex + 1, id });
    }
    const phase = (parsed.get(referenceKey("route", rowIndex, "Phase ID")) ?? [])[0];
    if (phaseIndex.has(phase)) phaseSteps.get(phase).push(row);
  });

  for (const detailTable of ["actions", "gates"]) {
    for (const id of indexes.get(detailTable).keys()) {
      if (!indexes.get("route").has(id)) diagnostic(diagnostics, "plan.detail-missing-route-step", `${id} has a detail row but no Execution Route entry`, { table: detailTable, id });
    }
  }

  let greatestPhaseIndex = -1;
  routeRows.forEach((row, rowIndex) => {
    const phase = (parsed.get(referenceKey("route", rowIndex, "Phase ID")) ?? [])[0];
    const currentPhaseIndex = phaseIndex.get(phase);
    if (currentPhaseIndex === undefined) return;
    if (currentPhaseIndex < greatestPhaseIndex) diagnostic(diagnostics, "plan.phase-order", `${row["Step ID"]} re-enters ${phase} after a later phase began`, { table: "route", row: rowIndex + 1, phase });
    greatestPhaseIndex = Math.max(greatestPhaseIndex, currentPhaseIndex);
  });

  for (const [phase, steps] of phaseSteps) {
    if (!steps.some((step) => step.Kind === "action")) diagnostic(diagnostics, "plan.phase-without-action", `${phase} requires at least one action`, { phase });
    if (steps.at(-1)?.Kind !== "gate") diagnostic(diagnostics, "plan.phase-without-exit-gate", `${phase} must end with a validation gate`, { phase });
  }
}

export function validateExecutionPlan(document) {
  const diagnostics = [];
  for (const field of ["status", "planning_depth"]) {
    if (document?.frontmatter && Object.prototype.hasOwnProperty.call(document.frontmatter, field)) diagnostic(diagnostics, "plan.duplicate-lifecycle-metadata", `Frontmatter field ${field} duplicates Plan Control authority; remove it`);
  }

  const tables = loadTables(document, diagnostics);
  for (const [key, table] of tables) {
    table.rows.forEach((row, rowIndex) => {
      for (const header of table.headers) if (!row[header]) diagnostic(diagnostics, "plan.empty-cell", `${table.section} row ${rowIndex + 1} has an empty ${header} cell`, { table: key, row: rowIndex + 1, column: header });
    });
  }

  const indexes = registerIds(tables, diagnostics);
  const parsed = validateReferences(tables, indexes, diagnostics);

  for (const [tableKey, column, allowed] of ENUMS) {
    tables.get(tableKey).rows.forEach((row, rowIndex) => {
      if (!allowed.includes(row[column])) diagnostic(diagnostics, "plan.invalid-enum", `${TABLES[tableKey].section} row ${rowIndex + 1} ${column} must be one of ${allowed.join(", ")}; found ${row[column]}`, { table: tableKey, row: rowIndex + 1, column });
    });
  }

  for (const [entityTable, consumerTable, column] of COVERAGE) {
    const used = new Set(tables.get(consumerTable).rows.flatMap((_, rowIndex) => parsed.get(referenceKey(consumerTable, rowIndex, column)) ?? []));
    for (const id of indexes.get(entityTable).keys()) if (!used.has(id)) diagnostic(diagnostics, "plan.missing-coverage", `${id} is not referenced by ${TABLES[consumerTable].section} ${column}`, { id, table: consumerTable, column });
  }

  validateRoute(tables, indexes, parsed, diagnostics);

  const planControl = tables.get("planControl").rows[0];
  const readiness = tables.get("readiness").rows[0];
  if (planControl) {
    const sources = tables.get("sources").rows;
    const aggregate = ["conflicted", "missing", "stale"].find((status) => sources.some((source) => source.Status === status)) ?? "current";
    if (planControl["Source status"] !== aggregate) diagnostic(diagnostics, "plan.source-status-mismatch", `Plan Control Source status is ${planControl["Source status"]}, but source rows resolve to ${aggregate}`);
    if (planControl["Plan state"] === "READY" && sources.some((source) => source.Status !== "current")) diagnostic(diagnostics, "plan.ready-with-noncurrent-source", "READY requires every material source row to be current");
    if (planControl["Plan state"] === "READY" && planControl["Baseline status"] !== "inspected") diagnostic(diagnostics, "plan.ready-with-uninspected-baseline", "READY requires an inspected baseline");
    if (planControl["Plan state"] === "READY" && readiness?.Decision !== "PASS") diagnostic(diagnostics, "plan.ready-without-pass", "READY requires a PASS Plan Readiness decision");
  }
  if (readiness) {
    const repair = readiness["Required revision or blocker"];
    if (readiness.Decision === "PASS" && repair !== "None.") diagnostic(diagnostics, "plan.pass-with-blocker", `PASS requires Required revision or blocker to equal None.; found ${repair}`);
    if (readiness.Decision !== "PASS" && repair === "None.") diagnostic(diagnostics, "plan.nonpass-without-repair", `${readiness.Decision} must name a required revision or blocker`);
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
    evidence: {
      phaseCount: indexes.get("phases").size,
      actionCount: indexes.get("actions").size,
      gateCount: indexes.get("gates").size,
      stepCount: indexes.get("route").size,
      phaseOrder: [...indexes.get("phases").keys()],
      routeOrder: tables.get("route").rows.map((row) => row["Step ID"]),
    },
  };
}

function main() {
  try {
    const result = validateExecutionPlan(JSON.parse(readFileSync(0, "utf8")).document);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`Unable to validate normalized Markdown Engine output: ${error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
