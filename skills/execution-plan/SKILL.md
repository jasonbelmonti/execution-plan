---
name: execution-plan
description: "Create, revise, and review validated Execution Plan artifacts that turn an authoritative completion contract and an inspected implementation baseline into a concrete, dependency-ordered route an agent can execute. Use when Codex needs to plan how work will be implemented before coding: repository reconnaissance, implementation decisions, phases and actions, file or symbol touches, validation sequencing, recovery controls, and stop or replan triggers. Do not use this skill to define objectives, scope, acceptance criteria, or approval boundaries."
---

# Execution Plan

## Overview

Create a durable plan for **how** an executor will reach an already-authoritative completion outcome from a specific baseline. Treat the plan as a source-bounded, replaceable execution hypothesis: it may select internal implementation details and ordering, but it must not create, weaken, or reinterpret the outcome, scope, constraints, proof obligations, or approval boundary supplied by its sources.

A useful plan lets another capable agent begin with the first action, follow dependencies, recognize each safe intermediate state, collect the required proof, and stop before making an unauthorized or unsafe decision.

The artifact path is:

```text
./.codefactory/execution-plans/<plan-id>/execution-plan.md
```

Write its checksum to:

```text
./.codefactory/execution-plans/<plan-id>/execution-plan.sha256
```

Every canonical Execution Plan is also a native Open Knowledge Format concept. Its YAML frontmatter must include exact `type: ExecutionPlan` plus the identity, repository, baseline, source-contract, and validation-profile fields defined in the authoring guide. `Plan Control` remains the sole authority for plan state and planning depth: never add frontmatter `status` or `planning_depth`. Never add concept-level `okf_version`; that key is reserved for the OKF bundle-root `index.md`. Preserve every unowned producer frontmatter key during revision unless explicit source authority removes it.

## Contract Boundary

The source contract owns **what must be true**. The Execution Plan owns **how to make it true**.

The plan owns:

- repository and environment findings that justify the route
- internal implementation decisions and explicitly bounded assumptions
- dependency-ordered phases, actions, and safe intermediate states
- expected file, symbol, interface, data, and artifact touches
- validation procedure, timing, expected observations, and evidence capture
- containment, recovery, rollback, stop, and replan behavior

The plan does not own:

- the objective, business outcome, or problem statement
- in-scope or out-of-scope classifications
- observable acceptance criteria or proof obligations
- product, safety, compatibility, or approval constraints
- review authority or permission for external, destructive, production, or persistent-data actions

Apply these rules:

- Cite authoritative outcome anchors; do not invent replacement acceptance criteria.
- If a source has stable outcome IDs, preserve them. Otherwise create plan-local aliases that point to exact source locations.
- If an implementation choice would change observable behavior, scope, a proof obligation, or an approval boundary, stop and obtain revised source authority.
- Do not require a particular upstream artifact type. A user decision, ticket, brief, specification, or other source may control the outcome.
- Keep prospective route content in the plan. Do not turn it into an activity diary or claim that planned evidence has already been observed.
- `READY` means the route is executable against its recorded source and baseline; it never means implementation or acceptance is complete.

## Operating Modes

Select one operation before using the workflow:

- `CREATE`: author a new route from authoritative sources and an inspected baseline.
- `REVISE`: change an existing route after a source, baseline, dependency, discovery, or validation change.
- `REVIEW`: evaluate an existing plan without mutating it. Revise only when the user explicitly authorizes revision.

Validation during `CREATE` or `REVISE` does not change the operation to `REVIEW`.

## Plan States

Use only these plan states:

- `DRAFT`: planning can continue, but the route is not safe to execute.
- `BLOCKED`: a missing or conflicting source, baseline fact, access prerequisite, or decision prevents a trustworthy route.
- `READY`: source status is `current`, baseline status is `inspected`, the semantic route audit and both machine validators pass, and no blocking decision remains.
- `SUPERSEDED`: explicit authority or a replacement plan has retired this route. Name the successor or withdrawal authority.

Any material route revision moves a `READY` plan to `DRAFT` until the affected sources and baseline are reloaded, the semantic route audit is repeated, and both machine validators rerun. Every state except `READY` forbids execution from the plan.

## Planning Depth

Keep the core schema stable and calibrate the detail inside it:

- `compact`: default for a bounded route whose consequential decisions can be stated concisely, including multi-file work. Usually one phase with a short action and gate sequence.
- `standard`: a named route uncertainty or interacting constraint requires additional explanation. Record only materially competitive alternatives and relevant recovery behavior.
- `expanded`: consequential failure or coupled migration, trust, data or compatibility obligations require detailed treatment. Add only applicable operational sections and coordination gates.

Choose depth from the explanation needed to resolve route uncertainty and consequential failure. Breadth or a risk-category label alone does not set document length. Split the plan when unrelated routes have different completion contracts, owners, or safe execution boundaries.

## Trace-compatible authoring

For new complete artifacts and authorized material revisions, read
[Trace authoring](references/trace-authoring.md) and use the owned
[Trace profile](profiles/trace.json). Add stable definitions and meaningful
relationships while preserving visible headings, ID labels and existing schemas.
Run Trace alongside the existing structural and semantic gates before claiming
readiness. This requirement applies to complete authored artifacts, not partial
blocked responses or untouched historical documents. Review remains read-only;
report legacy annotation gaps before promising scoped extraction.

## Context economy

Aim for 800–1,500 words for a compact plan; this is an advisory relevance-review trigger, not a correctness limit. Preserve the schema and route gates. State source requirements once in their owning contract and use outcome IDs here. Actions contribute the change and postcondition; gates contribute the proof procedure. Share recovery/evidence instructions by IDs instead of repeating them in each row. Do not invent alternative designs, operational sections or speculative future steps for completeness.

Use assignment-specific reading for authors, reviewers, coordinators and workers. Inspect the plan and source sections needed for the assigned actions, due gates, prerequisites, applicable decisions, shared invariants and source obligations. Use inventories, search, exact selections and change comparisons, expanding unresolved dependencies. A supervisor verifies coverage and records source identities and exact selections without a prerequisite to read every source in full. Whole-plan review covers the complete plan; linked sources require their applicable content. The plan remains sequencing authority. Read whole sources when coverage or cost makes that appropriate, or when explicitly requested by the user; generic role-based full-read mandates are not a prerequisite.

At kickoff or resume, verify current source identities and inspect the assignment, required selections and relevant changes. Reassess affected selections after source changes; a digest check does not prove semantic coverage. Reuse unchanged content already inspected in the active context.

When a capsule or equivalent retained workflow uses `execution/plan.md`, treat it as one compact current-state entrypoint, not as another canonical Execution Plan. Refresh that path in place with the current authority and source fingerprints, canonical plan and checksum identity, repository and tested-code identities, applicable decisions and route position, remaining work or explicit completion, current proof locators and digests, and every unresolved failure or blocker. Reference each canonical plan, receipt, admission record, report, inventory or failure artifact once instead of copying its body. Keep disposable normalization, search and rendering caches outside retained `execution/`; preserve independently required machine records and failure evidence at their canonical paths.

## Conditional Reference Loading

Before creating, materially revising, or reviewing a plan:

1. Read the applicable sections of [references/execution-plan-authoring-guide.md](references/execution-plan-authoring-guide.md); it defines the exact table schema, ID rules, dependency semantics, route-audit questions, and conditional operational sections.
2. Inspect source sections that control the assignment’s completion, scope, constraints, proof, approval, or repository operation; expand unresolved dependencies.
3. In `REVISE` or `REVIEW`, inspect the current plan within the requested change or review boundary and verify its checksum before relying on it. A whole-plan review must cover every section.

Read [references/example-execution-plan.md](references/example-execution-plan.md) only when a complete artifact example is needed to resolve schema or validation ambiguity.

Treat [profiles/execution-plan.yaml](profiles/execution-plan.yaml) and [scripts/validate-execution-plan.mjs](scripts/validate-execution-plan.mjs) as machine-owned validators during ordinary planning. Read them only when changing the schema or interpreting a validation defect; running them is required before `READY`.

Do not inspect validator runtime code unless validation behavior itself is being debugged.

## Durable Artifact Context Contract

Writing a plan does not load it into later model context. At kickoff, handoff, resume after compression, revision, or review:

1. When present, inspect the compact `execution/plan.md` current-state entrypoint and resolve the canonical records needed for this assignment. The entrypoint does not override those records or the source contract.
2. Read the current canonical plan sections required for the operation, including its control state, assigned route, applicable gates and dependencies; cover all sections for a whole-plan review.
3. Verify `execution-plan.sha256` when present and verify every retained proof digest before relying on it.
4. Inspect applicable source-contract content and repository instructions, reusing verified unchanged reads in the active context.
5. Compare the recorded source fingerprints and repository baseline with current state. Distinguish contract changes, checkpoint-only source updates, expected implementation progress, and unrelated drift using the authoring guide; verify integrity before relying on any comparison.
6. Treat newer explicit user instructions as higher authority.
7. Preserve every unowned producer frontmatter key during `REVISE` unless explicit source authority removes it.
8. When source authority, baseline findings, constraints, validation obligations, safe ordering, tested inputs, fixtures, configuration or tool identity changed materially, treat affected route or proof as non-current. In `CREATE` or `REVISE`, move a materially affected route to `DRAFT` or `BLOCKED` before continuing. In `REVIEW`, report the required state transition externally without mutating the artifact.

Do not resume from chat memory or a stale plan. Past gate results must also remain applicable to the current code, tests, fixtures, configuration, and environment. The plan specifies how to assess that applicability; observed results and source comparisons belong in existing execution evidence or a source checkpoint, not in the prospective plan.

## Required Workflow

### 1. Establish operation and artifact identity

Select `CREATE`, `REVISE`, or `REVIEW`. Choose a stable `plan_id` from the work item or short slug, use the repository's required worktree practice, and record the exact repository, worktree, branch, and immutable baseline reference.

Keep the same `plan_id` for route revisions that pursue the same completion contract. Create a new plan ID when the controlling outcome or approval boundary changes materially.

### 2. Load and test the source contract

Inspect authoritative source content relevant to execution, following dependencies when needed. Establish:

- exact outcome or criterion anchors
- scope and non-goal boundaries
- constraints and preserved invariants
- required proof and review implications
- source precedence, freshness, and unresolved conflicts

Record each source with a version, date, commit, message, or other usable fingerprint. Treat repository behavior as baseline evidence unless a source explicitly makes it normative.

Stop instead of planning when a missing or conflicting source determines observable behavior, scope, safety, data handling, or approval. Do not repair an incomplete completion contract by silently making product decisions in the plan.

### 3. Inspect the execution baseline

Perform focused reconnaissance before choosing the route. Inspect the relevant entry points, symbols, callers, tests, fixtures, configuration, generated artifacts, ownership boundaries, and local changes. Run read-only discovery commands when they materially reduce uncertainty.

Record findings with concrete evidence such as a path and symbol, command output, commit, interface, or test name. A list of files without findings is not reconnaissance.

### 4. Select and justify the implementation strategy

Choose the smallest coherent route that can satisfy all source outcomes while preserving declared constraints and existing required behavior. Record:

- the selected internal approach and sequencing rationale
- materially competitive alternatives rejected and why, only when they explain the selected route
- assumptions that remain inside implementation authority
- dependencies, access, tooling, and environment preconditions
- safe intermediate states and the earliest proving slice

Resolve material unknowns before dependent work. If an assumption is disproved during execution, its row must name the affected actions and replan trigger.

### 5. Build the dependency-ordered route

Define stable phases, route steps, actions, and gates using the authoring guide. Make `Execution Route` the sole sequencing and phase-membership authority: its source order is the required safe execution order, and every prerequisite named by a step must already appear above it.

Every action must name:

- its route position, required prior steps, and preconditions
- the authoritative outcome anchors it advances
- exact files, symbols, interfaces, commands, or artifacts when discoverable
- one concrete change or inspection and its observable postcondition
- evidence the executor must capture
- a defined failure response

Use phases for meaningful safe intermediate states, not administrative categories. End every phase with a gate that proves the named safe state. Treat row order as a safe linearization even when independent implementation work could theoretically run in parallel; do not require an executor to infer concurrency. Reject duplicate route entries, dangling detail rows, forward prerequisites, phase re-entry, and steps that require evidence or artifacts not yet produced.

### 6. Design proof, recovery, and replan behavior

Map every outcome anchor to at least one action and at least one validation gate. Sequence each gate after the action that makes it meaningful. Include positive, negative, edge, and regression checks in proportion to the route's risk.

For each gate, specify the exact command or manual check when known, expected observable result, evidence-capture procedure, evidence artifact, evidence verification, and failure response. Planned evidence is a capture instruction, not proof that the check passed.

For each outcome's proving checks, ask whether a plausible incorrect implementation within the stated boundary and risk could pass; if so, specify the observation that distinguishes it. Use source-authorized behavior and independent expected results; supporting gates such as typechecking do not alone prove runtime outcomes. Specify the tested-state provenance, invalidation conditions, and affected rechecks in existing gate fields using the authoring guide. Do not invent new acceptance obligations or mandatory tests to fill categories.

Define containment and recovery for failed actions or gates. Add the applicable conditional sections for migrations, rollout, compatibility, security, privacy, observability, external coordination, or persistent data. Name observable stop and replan triggers, work that may continue independently, and exact resume conditions.

### 7. Write the artifact

For `CREATE` or `REVISE`, write the plan using every required heading and exact table header in the authoring guide. Use plan-local IDs consistently:

`EP-SRC-*`, `EP-OUT-*`, `EP-FIND-*`, `EP-PRE-*`, `EP-DEC-*`, `EP-PH-*`, `EP-ACT-*`, `EP-GATE-*`, `EP-RESP-*`, and `EP-TRIG-*`.

Emit exact `type: ExecutionPlan`, reject body-authority and reserved OKF metadata, and retain every unowned producer frontmatter key during revision.

Use `None` only where the authoring guide permits it. Do not use empty cells, vague placeholders, speculative line counts, review-packet sizing, or restated follow-up work.

For `REVIEW`, do not execute this mutation step. Audit the loaded artifact in place and return findings externally; do not change its Plan Control, Plan Readiness, Revision Log, checksum, or content.

### 8. Run the semantic route audit

Read the plan as the receiving executor and audit it against the loaded sources and current baseline. The audit must establish:

- source fidelity: anchors are current, traceable, and not reinterpreted
- boundary containment: the route stays inside scope, constraints, and authority
- baseline grounding: findings justify targets and decisions
- decision closure: no hidden product, safety, data, or approval choice remains
- route integrity: every action and gate appears once in a complete safe sequence, with prerequisites above their consumers
- action executability: targets, changes, postconditions, evidence, and failure responses are concrete
- outcome coverage: every anchor maps to an action and sufficient objective gates that distinguish its required outcome from plausible incorrect behavior, with no orphan references
- evidence applicability: capture identifies the tested inputs, detects unexpected input changes during a check, and defines how later changes invalidate affected results before reuse or handoff
- operational safety: recovery and replan controls match the failure consequences
- handoff viability: another capable agent can start at the first action without material replanning

In `CREATE` or `REVISE`, record one evidence-backed decision in `Plan Readiness`: `PASS`, `REVISE`, or `BLOCKED`. This is a bounded self-audit, not independent assurance. If `REVISE`, repair the plan and rerun the audit. If `BLOCKED`, stop. Allow at most three plan drafts before returning the remaining blockers and exact next action.

In `REVIEW`, apply the same audit questions but return an external `READY`, `REVISE`, or `BLOCKED` verdict without writing it into the reviewed artifact.

### 9. Validate, finalize, and checksum last

In `REVIEW`, verify the existing checksum and run both validators read-only against the existing artifact. Report observed state and diagnostics; never update state, revision history, content, or checksum.

In `CREATE` or `REVISE`, keep the canonical artifact `DRAFT` while authoring. After the semantic audit records `PASS` and all other content mutations are complete:

1. Write a sibling `execution-plan.candidate.md` containing the intended final `READY` state and final revision-log row.
2. Run both validators against the candidate:

```bash
export MARKDOWN_ENGINE_BIN="${MARKDOWN_ENGINE_BIN:-${MARKDOWN_ENGINE_BIN_DIR:-$HOME/.local/bin}/markdown-engine}"
"$MARKDOWN_ENGINE_BIN" validate --file ./.codefactory/execution-plans/<plan-id>/execution-plan.candidate.md --profile <skill-dir>/profiles/execution-plan.yaml --format json
"$MARKDOWN_ENGINE_BIN" --file ./.codefactory/execution-plans/<plan-id>/execution-plan.candidate.md | node <skill-dir>/scripts/validate-execution-plan.mjs
```

Require both commands to exit `0` and return `valid: true` with no diagnostics; require Markdown Engine `evidence.engineVersion` to match the Fleet-approved shared runtime. The profile owns Markdown-native metadata, including exact `type: ExecutionPlan`, non-blank required values, the exact artifact version, reserved and duplicate lifecycle-field exclusions, section order, placeholder checks, exact table schemas, total table cardinality, per-schema row bounds through `selectionCount`, and generic action/gate/phase/precondition ID coverage through `tableColumnCoverage`. The execution-plan validator consumes Markdown Engine's normalized document and owns nonempty cells, explicit reference columns, enums, lifecycle consistency, route/detail correspondence, prior-step references, ordered phase membership, and gate-terminated phase exits. Unknown producer-owned frontmatter keys remain valid. It does not reconstruct a dependency graph: `Execution Route` source order is the executable sequence. Neither validator replaces the semantic route audit. If a compatible runtime or validator is unavailable, do not invent a fallback or claim `READY`.

Prefer compact validation output when available. For summary output, use `diagnosticCounts.total` to check the complete count, and open `report.path` only when omitted details are needed. Use `--report-file <new-file>` for durable evidence because automatic cache reports expire; scripts inspecting every rule result or comparing JSON bytes must request `--output full`. The normalization command piped into the plan validator remains unchanged.

3. If either validator fails, do not promote or checksum the candidate. Keep the canonical artifact non-executable, set its readiness to `REVISE`, record the diagnostics, and repair within the draft limit.
4. Only after both validators pass, calculate and verify a candidate checksum before promotion. Install the checksum first and the matching plan second. At every interruption boundary the canonical state is the prior pair, a non-executable checksum mismatch, or the new preverified matching pair—never an unchecksummed `READY` plan:

```bash
(
set -eu
plan_dir=./.codefactory/execution-plans/<plan-id>
cd "$plan_dir"
test ! -e execution-plan.previous.md
test ! -e execution-plan.previous.sha256
candidate_record=$(shasum -a 256 execution-plan.candidate.md)
candidate_digest=${candidate_record%% *}
test -n "$candidate_digest"
printf '%s  execution-plan.md\n' "$candidate_digest" > execution-plan.candidate.sha256
verification_record=$(shasum -a 256 execution-plan.candidate.md)
test "${verification_record%% *}" = "$candidate_digest"
if [ -f execution-plan.md ]; then cp -p execution-plan.md execution-plan.previous.md; fi
if [ -f execution-plan.sha256 ]; then cp -p execution-plan.sha256 execution-plan.previous.sha256; fi
mv execution-plan.candidate.sha256 execution-plan.sha256
mv execution-plan.candidate.md execution-plan.md
shasum -a 256 -c execution-plan.sha256
rm -f execution-plan.previous.md execution-plan.previous.sha256
)
```

Do not promote either file if candidate checksum creation, backup, or verification fails. After promotion, do not hand off or permit execution unless the final verification succeeds. If installing the plan or final verification fails, the checksum-first invariant makes the canonical route non-executable; preserve the failed files for diagnosis and restore the `.previous` pair when present. Remove the `.previous` pair only after the final check passes. Re-read the checksummed artifact before handing it off.

## Blocked Output Contract

In `CREATE` or `REVISE`, when a trustworthy full route cannot be produced, write a visibly `BLOCKED` planning packet instead of fabricating required plan content. Include `Plan Control` followed by:

| Missing planning input | Route decision affected | Why execution is unsafe | Permitted reconnaissance | Decision owner | Exact resume condition |
| --- | --- | --- | --- | --- | --- |
| Concrete source, baseline fact, access, or decision | The affected phase, action, or route choice | Specific correctness, safety, data, or authority impact | Safe read-only work, or `None` | Named role or person | Observable condition that permits replanning |

A standalone blocked packet is not a complete Execution Plan and must not claim full-profile validation or execution readiness.

In `REVIEW`, do not write a blocked packet over the reviewed artifact. Return the blocker and exact resume condition externally.

## Change Control

In `CREATE`, `REVISE`, or a separately authorized transition from review to revision, revise the plan when implementation discoveries change targets, dependencies, ordering, validation procedures, recovery behavior, or route risk without changing the source contract. Reload affected evidence, increment the revision, repeat the semantic route audit, rerun both machine validators, and replace the checksum.

Stop and return to source authority when a discovery changes the objective, observable outcome, scope, constraint, proof obligation, or approval boundary. Do not hide that change in `Implementation Decisions`, `Revision Log`, or a new action.

## Output Expectations

Return:

- the exact plan and checksum paths
- operation, plan state, revision, source fingerprint, and baseline reference
- structural-profile and execution-plan validation evidence plus the semantic route-audit decision
- the first executable action and its preconditions
- any blocker, stop condition, or conditional operational section that requires attention

Do not replace the durable artifact with a chat-only plan summary.

Any handoff identifies the exact plan, controlling sources and their fingerprints. Specify the assignment-specific required selections, coverage rationale and conditional-read triggers for the recipient, regardless of role. The plan is not standalone authority.

For a retained capsule handoff, refresh the single `execution/plan.md` entrypoint described in Context economy. Keep it compact: name the current state and reference canonical records by exact locator and digest. Do not append another full plan, report or inventory when the applicable identities are unchanged. If an applicable identity changed, regenerate or explicitly invalidate the affected reference before handoff.

## Reference Files

- [references/execution-plan-authoring-guide.md](references/execution-plan-authoring-guide.md): exact artifact schema, ID and dependency semantics, planning tests, conditional sections, and examples.
- [references/example-execution-plan.md](references/example-execution-plan.md): complete fictional `READY` plan for schema and validator orientation.
- [profiles/execution-plan.yaml](profiles/execution-plan.yaml): Markdown-native metadata, section-order, and placeholder validation profile.
- [scripts/validate-execution-plan.mjs](scripts/validate-execution-plan.mjs): normalized-document relational, lifecycle/readiness, and ordered-route validator.
