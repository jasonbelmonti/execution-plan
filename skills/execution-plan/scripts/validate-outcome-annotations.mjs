const TRACE_PREFIX = "ctx://trace/entity/";
const OUTCOME_ID = /^EP-OUT-[A-Z0-9]+$/;
const OWNERS = [
  { header: "Action ID", table: "actions", relation: "implements" },
  { header: "Gate ID", table: "gates", relation: "verifies" },
];

function isInside(link, cell) {
  const parent = cell.target.path;
  const child = link.target.path;
  return child.length > parent.length && parent.every((part, index) => child[index] === part);
}

function matchesOutcomes(links, ids, relation) {
  if (links.length !== ids.length) return false;
  const remaining = new Set(ids);
  return links.every((link) => {
    const id = link.text.trim();
    return link.url === `${TRACE_PREFIX}${id}?rel=${relation}` && remaining.delete(id);
  }) && remaining.size === 0;
}

// Engine owns parsing and reference-style resolution. The existing validators
// own table schemas and ID lists; this check only binds visible outcomes to links.
export function validateOutcomeAnnotations(document) {
  const links = [
    ...(document?.links ?? []),
    ...(document?.linkReferences ?? []).filter((link) => link.kind === "linkReference"),
  ];
  // Historical unannotated plans retain their existing validation behavior.
  if (!links.some((link) => link.url?.startsWith(TRACE_PREFIX))) return [];

  const diagnostics = [];
  for (const table of document.tables ?? []) {
    const headers = table.cells.filter((cell) => cell.header);
    const owner = OWNERS.find(({ header }) => headers.some((cell) => cell.text === header));
    const outcomeColumn = headers.find((cell) => cell.text === "Outcome IDs")?.columnIndex;
    if (!owner || outcomeColumn === undefined) continue;
    for (const cell of table.cells.filter((cell) => !cell.header && cell.columnIndex === outcomeColumn)) {
      const ids = cell.text.split(",").map((id) => id.trim());
      if (ids.some((id) => !OUTCOME_ID.test(id))) continue;
      if (matchesOutcomes(links.filter((link) => isInside(link, cell)), ids, owner.relation)) continue;
      diagnostics.push({
        code: "plan.outcome-annotation-mismatch",
        message: `Every Outcome ID must have one ${owner.relation} link whose visible ID and destination agree`,
        table: owner.table,
        row: cell.rowIndex,
        column: "Outcome IDs",
        line: cell.sourceRange.start.line,
      });
    }
  }
  return diagnostics;
}
