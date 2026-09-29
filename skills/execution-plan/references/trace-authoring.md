# Trace authoring for execution-plan

Apply this convention to new complete artifacts and authorized material revisions.
This workflow explicitly selects [profiles/trace.json](../profiles/trace.json), using
Markdown Trace 0.1.3's document graph. The [worked example](../references/example-execution-plan.md) shows
annotation placement. Existing structural profiles, semantic review, lifecycle
and source precedence remain authoritative. Historical documents may remain
unannotated until revision; never rewrite them during review.

## Definitions and ownership

Use the installed `markdown-trace` skill for protocol and runtime operation.
Wrap the existing visible label with a standard Markdown definition link:
`[label](ctx://trace/entity/ID?role=definition)`. Declare each identity once;
use `[label](ctx://trace/entity/ID?rel=RELATION)` for typed references. Ordinary
bare IDs are generic references, not definitions. Preserve established IDs.

Declare every heading with one stable `CTX-*` context identity, keeping its
visible text and depth unchanged. A heading that owns a domain entity instead
uses that entity's one definition. These section roots make unnumbered governing
prose retrievable. Assign IDs once and retain them across edits; do not renumber
when sections move. Local table-row and list-item definitions take ownership
from their surrounding heading. Never put two definitions in one row/item.

Domain kinds and prefixes: plan-item: EP.

- Declare each `EP-*` once in the ID cell of its owning detail table: sources, outcomes, findings, preconditions, decisions, phases, actions, gates, responses and triggers.
- `Execution Route` and `Change Footprint` contain references, never second action/gate declarations. Their rows retain their original meaning and order.
- In Execution Actions, link Outcome IDs with `rel=implements`. In Validation Gates, link Outcome IDs with `rel=verifies`. Keep comma-separated visible ID lists unchanged. Other existing ID references create generic `references` edges.
- Trace maps the first prefix component, so all `EP-*` entities share kind `plan-item`. Table-specific source rules check definition and typed-reference placement; the existing plan validator still checks exact subtype references, outcome coverage, dependencies and order. Trace traversal order never becomes execution order.
- For annotated plans, the plan validator also requires every visible Outcome ID in action and gate cells to have exactly one matching `implements` or `verifies` link. It checks each resolved destination, including reference-style links, so partial multi-outcome annotations and mismatched labels cannot pass the required validator pair. Unannotated historical plans retain their existing validation behavior.
- Keep the full applicable Execution Route, source obligations, shared gate-evidence prose and failure controls in worker selections. Row-only action/gate extraction is insufficient. Checksum only after all annotations and existing readiness gates are final.

Unrecognized external ticket/test IDs are source citations, not local graph
identities. Keep them in qualified multiword code such as `ticket EXTERNAL-123`,
or define a supported local source alias with the exact external locator. Do not
invent local requirements for external IDs. Extend the profile through reviewed
profile authoring if the domain needs a new vocabulary.

## Validate and hand off

Run the original structural checks and semantic/review gates. Also run the installed
Trace helper with the owned profile before readiness; resolve `TRACE_SKILL_DIR`
to the absolute installed markdown-trace skill directory and `AUTHOR_SKILL_DIR`
to this skill directory. Inspect `--runtime-info` and `--help` first; preserve the
host's verified executable binding and report an unavailable runtime.

```sh
node "$TRACE_SKILL_DIR/scripts/run.mjs" --file artifact.md \
  --profile "$AUTHOR_SKILL_DIR/profiles/trace.json"
```

Require exit 0 and validation status `pass`. Repair annotations from diagnostics;
never weaken a profile to make an artifact pass. Missing runtime or failed Trace
prevents a new artifact's Trace-ready/readiness claim; retain the owning workflow's
non-ready result and exact missing check. A passing graph does not prove semantic
coverage, truth of evidence or implementation completion.

For extraction, load markdown-trace's context guidance. Select the assignment's
entities plus explicit roots for all applicable governing sections and disconnected
proof obligations. Inspect incoming checks as well as outgoing dependencies. Use
explicit finite traversal and source budgets; inspect boundaries, omitted IDs and
exact returned text. A heading root includes only fragments it owns; separately declared child rows,
list items and subsections need their own roots or traversed edges. Select those
applicable identities too, or retain a full read. A row does not include the whole
surrounding section. A source or profile edit invalidates affected selections until reassessed.
Use assignment-specific coverage checks; read whole sources when coverage or cost
favors them, or when the user explicitly requests a whole-document read.

For agent reading, prefer `--format context-text --report-file PATH` with the same
roots, filters and budgets. Choose a new report path in an existing directory;
read exact excerpts and compact status first, then retained JSON only when its
provenance or omitted detail changes a decision. Keep `--format context` for
machine consumers that parse the JSON. Neither view changes reading obligations.

These are local document profiles. For cross-document traversal, a host must choose
one compatible interpretation and explicit pinned occurrence bindings; profiles
with different vocabularies cannot simply be combined. A bare matching ID never
resolves an external source. Delegation admission and total delivery accounting
remain the receiving workflow's responsibility; annotations alone do not prove
that selected excerpts cover the assignment’s applicable obligations.

## Maintainer probes

Run `MARKDOWN_TRACE_SKILL_DIR=/absolute/installed/markdown-trace python3
<skill-dir>/tests/test_trace_authoring.py` on the host's verified 0.1.3 binding.
The probes check example graphs, located declaration/edge/endpoint defects and
repair, exact scoped text including governing content, and explicit zero-budget
omissions. Run the original Markdown Engine compatibility checks as well.
Run `node --test <skill-dir>/scripts/validate-outcome-annotations.test.mjs`
for partial outcome annotations, mismatched destinations, reference-style links
and historical-plan compatibility through the plan validator CLI.
