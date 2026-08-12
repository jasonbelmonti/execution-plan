# Execution Plan Authoring Guide

## Contents

1. Authority and planning boundary
2. Artifact metadata
3. Required section schema
4. ID and reference semantics
5. Route-construction method
6. Planning-depth calibration
7. Conditional operational subsections
8. Semantic route audit
9. Review-mode output

## Authority and Planning Boundary

An Execution Plan is a prospective route, not the definition of the work. Its source contract supplies the authoritative outcome, scope, constraints, proof obligations, and approval boundary. The plan may summarize those obligations only through traceable, non-authoritative anchors needed to map actions and gates.

Use this decision test:

- If two routes can satisfy the same observable obligations, selecting between them is a planning decision.
- If a decision changes an observable obligation, allowed scope, preserved invariant, proof requirement, or approval impact, it requires renewed source authority and cannot be resolved inside the plan.

Do not require a particular kind of source artifact. Record each source's exact location and fingerprint so a later executor can establish freshness and precedence.

## Artifact Metadata

Use this frontmatter shape:

```yaml
---
title: Implement bounded outcome
plan_id: bounded-outcome
artifact_version: "2.0"
revision: "1"
created_at: 2026-08-11T21:25:58-05:00
updated_at: 2026-08-11T21:25:58-05:00
target_repo: /absolute/repository/path
target_worktree: /absolute/repository/path/.worktrees/branch-name
target_branch: codex/branch-name
baseline_ref: full-git-commit-or-equivalent-immutable-reference
source_contract: exact-primary-source-reference-and-fingerprint
validation_profile: /absolute/skill/path/profiles/execution-plan.yaml
---
```

Apply these metadata rules:

- Keep `plan_id` stable while revising the route for the same completion contract.
- Increment `revision` for every material route change.
- Treat the single `Plan Control` row as the sole authority for lifecycle state and planning depth; do not duplicate them in frontmatter. The route validator rejects `status` and `planning_depth` frontmatter fields.
- Use an immutable commit for `baseline_ref` when planning repository work. Record included working-tree changes in `Baseline Findings`; never imply that a commit fingerprints uncommitted work.
- Set `source_contract` to the primary completion-authority reference and fingerprint. When authority is jointly controlled, use a canonical authority-set fingerprint; list every material source separately in `Source Contract`.
- Use ISO 8601 timestamps with offsets.

## Required Section Schema

Preserve these top-level headings and their order.

### Plan Control

Use exactly one row:

```markdown
| Plan state | Planning depth | Source status | Baseline status | State rationale |
| --- | --- | --- | --- | --- |
| DRAFT | standard | current | inspected | Route construction is in progress; execution is not authorized from this revision. |
```

Allowed values:

- `Plan state`: `DRAFT`, `BLOCKED`, `READY`, or `SUPERSEDED`
- `Planning depth`: `compact`, `standard`, or `expanded`
- `Source status`: `current`, `missing`, `conflicted`, or `stale`
- `Baseline status`: `inspected`, `unavailable`, or `stale`

A `READY` row requires `current`, `inspected`, and a `PASS` decision in `Plan Readiness`. `DRAFT`, `BLOCKED`, and `SUPERSEDED` are not executable.

### Source Contract

```markdown
| Source ID | Source reference | Version / fingerprint | Authority | Status | Planning implication |
| --- | --- | --- | --- | --- | --- |
| EP-SRC-1 | Exact source path and section | Commit, checksum, revision, or timestamp | What this source controls | current | Constraint this source places on the route |
```

Record one row per material source. Use only `current`, `missing`, `conflicted`, or `stale` in `Status`. `Plan Control` summarizes the rows using `conflicted` before `missing`, `missing` before `stale`, and `current` only when every row is current. Distinguish controlling outcome authority from repository operating instructions, design constraints, baseline behavior, and informative context. When sources overlap, state the precedence or conflict rule explicitly in `Authority`. Resolve every precedence conflict before a plan becomes `READY`.

### Outcome Anchors

```markdown
| Outcome ID | Source IDs | Source location | Required observable | Proof obligation |
| --- | --- | --- | --- | --- |
| EP-OUT-1 | EP-SRC-1 | Exact criterion or section | Concise faithful snapshot of the required terminal state | Exact source-required evidence, without claiming it already exists |
```

`Outcome Anchors` is a trace layer, not a second acceptance contract:

- Assign one `EP-OUT-*` alias to each independently provable source obligation.
- Preserve any source-native identifier verbatim inside `Source location` and keep `Source IDs` machine-readable.
- Do not split, merge, weaken, strengthen, or invent obligations for planning convenience.
- If a source obligation cannot be stated faithfully, mark the plan `BLOCKED` and request source clarification.
- Map every outcome to at least one action and at least one validation gate.

### Baseline Findings

```markdown
| Finding ID | Repository evidence | Current behavior / constraint | Planning implication | Confidence |
| --- | --- | --- | --- | --- |
| EP-FIND-1 | Exact path and symbol, command output, test, or interface | What the inspected baseline establishes | How the finding changes target selection, ordering, or risk | confirmed |
```

Use `confirmed` for directly inspected evidence and `inferred` only with an explicit basis and confirmation action. Include relevant dirty-worktree state, generated files, callers, tests, conventions, ownership boundaries, and external dependencies. A file list without an observed fact is not a finding.

### Preconditions

```markdown
| Precondition ID | Required state / input | Verification | Unmet trigger ID |
| --- | --- | --- | --- |
| EP-PRE-1 | Concrete access, tool, decision, fixture, service, or approval state | Exact read-only check | EP-TRIG-1 |
```

Preconditions must be observable. Include environment, access, dependency, source-generation, fixture, service, and approval prerequisites only when they affect the route. Reference every precondition from at least one action; the action's `Precondition IDs` cell is the sole authority for when it is required.

### Implementation Decisions

```markdown
| Decision ID | Kind | Decision or assumption | Finding IDs | Evidence / rationale | Affected action IDs | Replan trigger ID |
| --- | --- | --- | --- | --- | --- | --- |
| EP-DEC-1 | decision | Use the existing extension point instead of adding a parallel path | EP-FIND-1 | The inspected extension point owns the behavior | EP-ACT-2, EP-ACT-3 | EP-TRIG-2 |
```

Use `decision` or `assumption` in `Kind`.

- Record internal design choices that materially shape targets or ordering.
- Record assumptions only when evidence makes them reasonable and a named trigger catches invalidation.
- Include rejected alternatives in the rationale when they were materially plausible.
- A `READY` plan has no unresolved decision that affects observable behavior, safety, data handling, or approval.

### Execution Phases

```markdown
| Phase ID | Phase objective | Entry precondition IDs | Safe intermediate state |
| --- | --- | --- | --- |
| EP-PH-1 | Establish the smallest proving implementation slice | EP-PRE-1 | Repository remains buildable and the new behavior is isolated behind its intended boundary |
```

Use a phase only when it ends in a meaningful safe or proving state. Order phases by intended execution. Every phase must contain at least one action, occupy one contiguous block in `Execution Route`, and end with a gate that proves its safe intermediate state.

### Execution Route

```markdown
| Step ID | Kind | Phase ID | Required prior Step IDs |
| --- | --- | --- | --- |
| EP-ACT-1 | action | EP-PH-1 | None |
| EP-GATE-1 | gate | EP-PH-1 | EP-ACT-1 |
| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |
```

`Execution Route` is the sole authority for step order and phase membership. Its source order is the safe sequence an executor follows. Each `Step ID` must identify exactly one row in `Execution Actions` or `Validation Gates`, and `Kind` must match that detail row. Every declared action and gate appears exactly once in the route.

Use `None` only for a step with no prerequisite. Otherwise list only direct prerequisite steps that already appear above the row. A reference to the current or a later row is invalid. Keep each phase in one contiguous block ordered like `Execution Phases`, and make its final route row a gate. Source order remains authoritative even when a later row does not list every transitive predecessor.

### Execution Actions

```markdown
| Action ID | Precondition IDs | Outcome IDs | Targets | Concrete action | Observable postcondition | Evidence to capture | Failure response ID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-ACT-1 | EP-PRE-1 | EP-OUT-1 | Exact path and symbol | Make one bounded implementation change | Specific repository or runtime state visible after the action | Diff, focused command output, or artifact path | EP-RESP-1 |
```

Action rules:

- Put each action in `Execution Route` at the exact point it runs; do not duplicate phase or dependency fields here.
- Keep one coherent mutation, inspection, generation, or verification purpose per row.
- Name symbols or interfaces as well as files when reconnaissance discovered them.
- State the resulting observable repository or system condition, not the executor's intent.
- Capture evidence that lets the next action or gate verify the postcondition.
- Use a discovery action only for bounded information gathering. If its result selects the material route, keep the plan `DRAFT` until discovery resolves it and the plan is revised.
- Preserve the declared route order even when actions are independent; the plan must give the executor one safe sequence rather than require concurrency decisions.
- Reject actions such as “implement feature,” “update tests,” or “handle errors” unless the same row names the target, concrete change, postcondition, and evidence.

### Change Footprint

```markdown
| Path / component | Action IDs | Change type | Purpose | Confidence | Risk / ownership note |
| --- | --- | --- | --- | --- | --- |
| Exact expected path, symbol, generated artifact, schema, service, or configuration | EP-ACT-1 | modify | Why this surface changes | confirmed | Ownership boundary, churn uncertainty, or regression risk |
```

Use one row per materially distinct editable surface. Use `confirmed` when reconnaissance identified the target and `candidate` when an early action must confirm it. A `candidate` that determines the architecture or scope prevents `READY`; a bounded candidate within a chosen route does not.

Do not include speculative line counts. Estimation may be derived later from this table as an optional consumer.

### Validation Gates

```markdown
| Gate ID | Outcome IDs | Command or check | Expected observation | Evidence capture | Evidence artifact | Evidence verification | Failure response ID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-GATE-1 | EP-OUT-1 | Exact test command or bounded manual inspection | Concrete pass signal and relevant negative condition | Exact command or manual procedure that records stdout, stderr, exit status, report, screenshot, log, or diff | Exact retained artifact path | Exact check that the artifact exists and contains the expected signal and execution metadata | EP-RESP-1 |
```

Gate rules:

- Put each gate in `Execution Route` immediately after the latest action or gate it proves; do not duplicate phase or dependency fields here.
- Name the gate in a later route row's `Required prior Step IDs` when it directly controls whether that step may begin.
- Map every gate to source outcomes; do not use gates to introduce new acceptance obligations.
- State the exact command when reconnaissance can discover it. For a manual check, name the actor, surface, procedure, and observable pass state.
- Include focused checks early enough to localize failures and broader regression checks after integration.
- For `standard` and `expanded` plans, cover relevant positive, negative, edge, and regression behavior; omit inapplicable categories explicitly in the rationale rather than creating empty gates.
- Specify how evidence is captured and verified, not only where it should appear; do not report planned checks as passed.

### Failure and Replan Controls

Use two tables in this section.

```markdown
| Response ID | Trigger | Containment | Exact recovery / rollback procedure | Single restored safe state | Verification | Escalation trigger ID |
| --- | --- | --- | --- | --- | --- | --- |
| EP-RESP-1 | Observable action or gate failure | Immediate action that limits damage | Exact ownership-safe commands or manual operations, with concrete targets and preserved evidence | One unambiguous state safe for retry, replan, or handoff | Exact check that proves the one named state was restored | EP-TRIG-1 |
```

```markdown
| Trigger ID | Observable trigger | Stopped Step IDs | Evidence to preserve | Required decision / input | Exact resume condition |
| --- | --- | --- | --- | --- | --- |
| EP-TRIG-1 | Concrete contradiction, failed assumption, scope pressure, unavailable dependency, or unsafe state | EP-ACT-2, EP-GATE-2 | Diff, logs, command output, or artifact | Named authority, source revision, access, or technical input | Observable condition that permits a revised route |
```

For reversible low-risk work, containment may mean stopping with a preserved diff and a green baseline. For migrations or external side effects, describe rollback, data recovery, idempotency, partial-failure handling, and operator verification explicitly.

### Plan Readiness

Use exactly one row:

```markdown
| Decision | Reviewed at | Evidence / rationale | Required revision or blocker |
| --- | --- | --- | --- |
| REVISE | ISO 8601 timestamp and reviewer | Concise evidence from the semantic route audit | Exact repair needed before execution |
```

Allowed decisions are `PASS`, `REVISE`, and `BLOCKED`. Use `PASS` only when every audit area below passes and write `None.` in the final cell. `PASS` is a route-quality judgment, not evidence of implementation success.

### Revision Log

```markdown
| Revision | Timestamp | Actor | Material change | Reason / source | Checksum reference |
| --- | --- | --- | --- | --- | --- |
| 1 | ISO 8601 timestamp | Agent or person | What changed in the route | Discovery, instruction, baseline, or source that required it | execution-plan.sha256 |
```

Reference the checksum file rather than embedding the current digest in the checksummed document.

## ID and Reference Semantics

Use one stable ID per source row and one or more references where a relationship is many-to-many:

- sources: `EP-SRC-*`
- outcome aliases: `EP-OUT-*`
- baseline findings: `EP-FIND-*`
- preconditions: `EP-PRE-*`
- decisions or assumptions: `EP-DEC-*`
- phases: `EP-PH-*`
- actions: `EP-ACT-*`
- validation gates: `EP-GATE-*`
- failure responses: `EP-RESP-*`
- stop or replan triggers: `EP-TRIG-*`

Use comma-separated IDs when a cell references multiple rows. Use `None` only in `Execution Route.Required prior Step IDs` when the step has no prerequisite. Use `None.` for a passed readiness decision with no remaining repair. Do not use empty cells.

Use only ASCII letters and digits after the final prefix hyphen; for example, `EP-ACT-1`, `EP-ACT-A2`, or `EP-GATE-check1`. Periods, underscores, and additional hyphens are not valid inside or at the end of an ID. This keeps plan references unambiguous beside prose punctuation and artifact filenames.

The structural ceilings are 30 sources, 20 outcomes, 30 findings, 30 preconditions, 30 decisions, 12 phases, 100 route steps, 60 actions, 40 gates, 30 responses, and 30 replan triggers. These are coherence guards, not targets. If a trustworthy route exceeds one, split it at independently authoritative outcomes or safe execution boundaries; never omit rows merely to fit the ceiling.

The structural profile checks metadata, required section order, and unresolved placeholders. The execution-plan validator consumes Markdown Engine's normalized document and checks exact core tables, non-empty route content, explicit reference columns and enums, source/readiness consistency, route/detail correspondence, prior-step references, ordered phase membership, and gate-terminated phase exits. Plan-like text in explanatory prose is not a machine relationship. The semantic route audit must still reject:

- duplicate, dangling, self, or forward prerequisite references
- duplicate or missing action/gate route entries
- a phase that reappears after a later phase begins or does not end in a proving gate
- an action that mutates a target before the producing or safety action runs
- an action that begins before every listed prior gate has passed
- a gate scheduled before the behavior or artifact it checks exists
- a response that cannot restore or contain the state it names
- outcome aliases that change source meaning

## Route-Construction Method

Build the plan from evidence rather than decomposing the objective into generic chores.

1. Trace the outcome to the current entry point, owner, data flow, or artifact boundary.
2. Identify the smallest change that can make one source outcome observable without creating an unsafe intermediate state.
3. Order enabling refactors, contract-preserving implementation, integration, and validation by actual dependencies.
4. Put focused gates immediately after high-uncertainty or high-risk changes.
5. Preserve a buildable, recoverable, or otherwise named safe state at every phase exit.
6. Delay broad cleanup until it is required by the selected route; exclude unrelated improvement work.
7. Make the final gates prove source outcomes and preserved regression behavior, not merely command success.

When several actions could run independently, choose one safe linearization and record it in `Execution Route`. Optimize for a coherent proving sequence, low conflict risk, and useful intermediate evidence rather than executor-managed concurrency.

## Planning-Depth Calibration

### Compact

- One source contract and a small inspected surface.
- Usually one phase, 2-5 actions, focused gates, and one general recovery response.
- Still require traceability, observable postconditions, and a stop trigger.

### Standard

- Multiple files or boundaries, ordinary ambiguity, or meaningful regression risk.
- Use multiple phases when they create useful proving states.
- Record material alternatives, assumptions, focused plus regression gates, and boundary-specific recovery.

### Expanded

- Broad or high-consequence work, persistent data, public contracts, migrations, security, privacy, compatibility, rollout, or cross-system coordination.
- Add all applicable operational subsections below.
- Prefer multiple independently safe phases, explicit approval points, broader regression evidence, and tested rollback or recovery procedures.

## Conditional Operational Subsections

Add applicable `###` subsections inside `Failure and Replan Controls`; omit inapplicable ones. Each subsection must name actions, gates, responses, and triggers rather than repeat source obligations.

- `Migration and Data Safety`: ordering, backfill, dual-read/write, idempotency, partial failure, integrity checks, recovery, and irreversible boundary.
- `Rollout and Rollback`: deployment order, flags, cohorting, monitoring threshold, rollback action, and rollback verification.
- `Compatibility and Versioning`: producer/consumer order, schema or API compatibility window, generated artifacts, deprecation, and mixed-version behavior.
- `Security and Privacy`: trust boundaries, secrets, authorization, data minimization, audit evidence, and security-specific stop conditions.
- `Observability and Operations`: signals, dashboards, logs, alerts, success thresholds, incident ownership, and post-rollout observation window.
- `External Coordination`: named owner, prerequisite approval, communication point, maintenance window, and exact confirmation required before dependent actions.

## Semantic Route Audit

Before `PASS`, answer each question with evidence from the plan and loaded sources:

1. Are all outcome anchors faithful to current source authority and exact locations?
2. Does any action or decision alter scope, observable behavior, proof, or approval beyond that authority?
3. Do baseline findings identify the actual entry points, owners, callers, tests, and local-change risks needed for this route?
4. Are all material assumptions bounded by evidence and an observable replan trigger?
5. Can every precondition be checked before its dependent action?
6. Does `Execution Route` contain every action and gate exactly once, keep phases contiguous, and place every required prior step above its consumer?
7. Does every action identify a concrete target, change, postcondition, evidence capture, required predecessor gate, and failure response?
8. Does every outcome map to sufficient actions and objective gates, including relevant regression behavior?
9. Can every phase stop in the safe intermediate state it claims?
10. Does every failure response provide an ownership-safe procedure that restores one verifiable state, and do stop controls match the consequence of failure?
11. Are conditional operational subsections present wherever the route involves their risks?
12. Can a receiving agent begin the first action without deciding architecture, product behavior, scope, safety, or approval policy?

Set `PASS` only when all twelve answers are yes. Use `REVISE` for plan-local repairs and `BLOCKED` when progress requires new authority, access, a source decision, or a changed baseline.

## Review-Mode Output

In `REVIEW`, do not mutate the source plan. Return:

- observed plan state, revision, source status, baseline status, and checksum result
- structural-profile and execution-plan validation results
- semantic route-audit verdict: `READY`, `REVISE`, or `BLOCKED`
- blocking findings with exact affected IDs and repairs or resume conditions
- non-blocking observations that do not prevent safe execution
- the first action an executor could run if the verdict is `READY`

`PASS` is the plan's internal semantic-audit decision. An external `READY` review verdict additionally requires observed Plan state `READY`, a current checksum, and both machine validators passing.
