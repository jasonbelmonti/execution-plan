---
name: execution-plan
description: Create validated Execution Plan artifacts that translate source-grounded execution context, handoff artifacts, task packets, planning notes, or implementation intent into concrete ordered steps, file-touch plans, validation gates, stop conditions, viability review gates, and estimator-ready inputs. Use when Codex needs to make the route to task completion specific before implementation, review whether a plan is viable before committing to execution, derive proposal inputs for execution sizing, sequence work for another agent, or turn a high-level objective into materially executable actions.
---

# Execution Plan

## Overview

Create a durable Execution Plan on disk that turns source context into a concrete route to completion. The plan must be specific enough for another agent to execute without rereading the full thread and structured enough to inform execution sizing.

The artifact path is:

```text
./.codefactory/execution-plans/<plan-id>/execution-plan.md
```

## Durable Artifact Context Contract

This skill writes durable planning state to the filesystem. A written file is
not automatically in model context. After creating or updating an Execution
Plan:

1. Write the artifact to disk.
2. Run validation and checksum steps when available.
3. Re-read the artifact from disk before relying on its contents.
4. Return the exact artifact path, validation status, checksum path when
   present, and stop conditions.

At kickoff, handoff, resume after context compression, or review preparation:

1. Read the relevant Execution Plan from disk first.
2. Verify checksum or validation state when present.
3. Treat newer explicit user instructions as higher authority than the plan.
4. If scope, constraints, validation gates, review boundaries, or stop
   conditions changed, update the plan and revision log before continuing.
5. Do not rely on chat memory, summaries, or the fact that the artifact was
   recently written.

## Required Workflow

Follow these steps in order.

### Step 1: Establish the artifact location

Choose a stable `plan_id` from the work item, branch, ticket, or short slug. Create or update:

- `./.codefactory/execution-plans/<plan-id>/execution-plan.md`
- `./.codefactory/execution-plans/<plan-id>/execution-plan.sha256`

Use the same `plan_id` across revisions unless the objective changes materially.

### Step 2: Load the source context

Read every source that materially controls the plan:

- latest user instructions and explicit decisions in the thread
- repo-local operating instructions such as `AGENTS.md`
- source handoff artifacts, task packets, design notes, tickets, PRDs, or planning docs
- current workspace state: branch, worktree path, relevant files, diffs, tests, known gaps
- validation requirements, review boundaries, non-goals, dependencies, and blockers

If a named source has not been loaded, fetch or read it before drafting. Mark unavailable but material sources as missing input.

### Step 3: Convert context into an executable route

Transform the objective into ordered work that is concrete, specific, and material:

- name the first files, commands, tools, or artifacts to inspect or change
- split work into steps with dependencies and observable evidence
- identify likely file touches, change type, purpose, expected churn, and risk notes
- distinguish confirmed facts from assumptions and inferences
- define validation gates that prove the planned behavior or artifact
- define stop conditions that require user direction, scope change, missing access, or new planning
- keep out-of-scope improvements out of the blocking route

Avoid generic plan steps such as "implement the feature" unless the row also names the target, action, and evidence.

### Step 4: Write or revise the Execution Plan

Use [profiles/execution-plan.yaml](profiles/execution-plan.yaml) as the required artifact structure and deterministic validation contract.

Apply these rules:

- write the artifact to disk, not only into chat
- use exact dates, file paths, commands, branch names, issue IDs, and document titles when available
- keep the route sequential and executable
- make each step evidence-producing
- include an `Estimation Inputs` section with enough data to derive a newline-delimited proposed file list or diff-backed sizing command
- include `reviewContextSize` in `Estimation Inputs` with exactly one value: `focused`, `standard`, or `expanded`
- include a `Plan Viability Review` section that evaluates whether the route is executable before execution starts
- include a `Review Handoff` table that selects exactly one review context packet and keeps that packet sized to the selected `reviewContextSize`
- include planned follow-up work only when it is non-blocking for the current route
- update `Revision Log` for every intentional artifact revision
- record the artifact checksum by referencing the separate `.sha256` file or by marking the current row `pending`; do not embed a current digest inside the artifact when doing so would change that digest
- do not silently rewrite the objective, constraints, or stop conditions

### Step 5: Review plan viability

Review the drafted plan with an LLM-as-judge pass before committing to implementation. Read the plan as if it were being handed to an executor and look for contradictions, conflicts, missing prerequisites, bad sequencing, unverifiable gates, hidden blockers, or assumptions that could prevent the route from working.

Use the `Plan Viability Review` table to record that judgment:

- evaluate the route against the loaded sources, current access, dependencies, and constraints
- check whether prerequisite inspections, changes, and validations are sequenced before dependent work
- check whether validation gates can objectively prove the intended outcome
- check whether estimation inputs are concrete enough for proposal or diff-backed sizing
- check whether stop conditions catch missing sources, blockers, scope expansion, and failed validation
- complete every required viability review area from the validation profile with the exact viability question text
- record concise reviewer notes that explain the LLM judge result for each area
- mark each row `pass`, `revise`, or `blocked`

If any row is `revise`, revise the plan before validation. If any row is `blocked`, stop and return the artifact path, blocker, missing inputs, and next decision needed. Do not use a plan as execution context while the viability review is not fully `pass`.

### Step 6: Validate and checksum the artifact

Validate the artifact with the installed bundled CLI and declarative profile. Do not run or recreate a skill-local validation wrapper or custom placeholder script; profile validation is delegated to markdown-engine.

```bash
"${MARKDOWN_ENGINE_BIN_DIR:-$HOME/.local/bin}/markdown-engine" validate --file ./.codefactory/execution-plans/<plan-id>/execution-plan.md --profile <skill-dir>/profiles/execution-plan.yaml --format json
```

The validation profile checks required structure, typed non-empty frontmatter, unresolved placeholder text, and conditional Review Handoff packet sizing. It uses the markdown-engine 3.1.0 `frontmatterShape` feature; if validation reports unsupported `frontmatterShape`, update the bundled markdown-engine CLI rather than adding a local fallback. Use the JSON output as validation evidence, including `engineVersion`, `profileHash`, `inputHash`, evaluated rule count, skipped rule count, and failed diagnostics when present. The structural gate does not decide whether the plan is viable. The LLM review pass in Step 5 owns that qualitative judgment.

Then write a checksum:

```bash
shasum -a 256 ./.codefactory/execution-plans/<plan-id>/execution-plan.md > ./.codefactory/execution-plans/<plan-id>/execution-plan.sha256
```

If validation fails, revise the artifact before using it as execution context.

Use the separate `.sha256` file as the checksum source of truth for the current artifact. The revision log may reference that file, record a previous checksum, or use `pending` while the current checksum is being written.

### Step 7: Prepare estimation inputs

Make the plan useful for execution sizing without requiring a sizing tool to parse prose:

- for proposal-mode sizing, ensure `File Touch Plan` contains one row per expected path and `Estimation Inputs` states how to derive the proposed file list
- for diff-backed sizing, record the intended `repoRoot`, `baseRef`, `headRef`, and whether working-tree changes are in scope
- include a defensible `proposalLinesChanged` value only when the file list materially understates or overstates expected churn
- set `reviewContextSize` to `focused` for localized low-risk work, `standard` for moderate or cross-boundary work, and `expanded` for high-risk, broad, migration, security, data, or user-visible workflow work
- record uncertainty in `Risk notes` or `Stop Conditions` instead of inflating the plan

### Step 8: Right-size the review context packet

In `Review Handoff`, use this exact table header:

```markdown
| Review context packet | Task fit | Status | Packet contents |
| --- | --- | --- | --- |
```

Include exactly three rows named `Focused`, `Standard`, and `Expanded`. Set exactly one `Status` cell to `SELECTED` and the other two to `OMITTED`. The selected row must match `reviewContextSize`.

- `Focused`: localized low-risk work. Include the objective, changed files, key source authority, validation evidence, and residual risk in a compact packet.
- `Standard`: moderate or cross-boundary work. Include the focused packet contents plus adjacent behavior, review boundary, and test rationale.
- `Expanded`: high-risk, broad, migration, security, data, or user-visible workflow work. Include the standard packet contents plus contracts, rollout or rollback notes, and broader regression evidence.

### Step 9: Perform a quality check

Before handing off, verify that the artifact answers:

- What is the actual objective?
- Which sources control the plan?
- What exact route should execution follow?
- What files or artifacts are expected to change?
- What inputs can inform execution sizing?
- Did the viability review pass before execution commitment?
- Does `reviewContextSize` match the selected Review Handoff packet, with exactly one `SELECTED` row?
- What validation proves success?
- Does the `Plan Readiness Check` show that placeholders were removed, sources are complete, steps are specific, estimation inputs are usable, and the review context packet is right-sized?
- Does markdown-engine profile validation pass, including frontmatter shape, the full-document placeholder guard, and conditional Review Handoff sizing rules?
- What is out of scope or deferred?
- When should an agent stop and ask for direction?

If any answer is missing, revise the plan, validate it, and update the checksum.

## Output Expectations

Return the artifact path, validation status, checksum path, and any missing inputs or stop conditions. Do not replace the on-disk artifact with a chat-only summary.

Always:

- anchor the plan in loaded source context
- make the first action executable
- keep each step tied to evidence
- include estimator-ready file or diff inputs
- include a completed viability review with passing decisions before execution handoff
- include completed plan readiness checks
- include validation gates and stop conditions
- keep the revision log current
- state blockers and missing inputs plainly

## Reference Files

- Use [profiles/execution-plan.yaml](profiles/execution-plan.yaml) as the required artifact structure and markdown-engine validation profile. The profile owns structural, placeholder, and conditional review packet validation.
