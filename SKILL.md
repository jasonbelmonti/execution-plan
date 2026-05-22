---
name: execution-plan
description: Create validated Execution Plan artifacts that translate source-grounded execution context, handoff artifacts, task packets, planning notes, or implementation intent into concrete ordered steps, file-touch plans, validation gates, stop conditions, viability review gates, and estimator-ready inputs. Use when Codex needs to make the route to task completion specific before implementation, review whether a plan is viable before committing to execution, derive proposal inputs for execution sizing, sequence work for another agent, or turn a high-level objective into materially executable actions.
---

# Execution Plan

## Overview

Create a durable Execution Plan on disk that turns source context into a concrete route to completion. The plan must be specific enough for another agent to execute without rereading the full thread and structured enough to inform execution sizing.

The artifact path is:

```text
./.codex/execution-plans/<plan-id>/execution-plan.md
```

## Required Workflow

Follow these steps in order.

### Step 1: Establish the artifact location

Choose a stable `plan_id` from the work item, branch, ticket, or short slug. Create or update:

- `./.codex/execution-plans/<plan-id>/execution-plan.md`
- `./.codex/execution-plans/<plan-id>/execution-plan.sha256`

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

Use [references/execution-plan-template.md](references/execution-plan-template.md) as the required artifact structure.

Apply these rules:

- write the artifact to disk, not only into chat
- use exact dates, file paths, commands, branch names, issue IDs, and document titles when available
- keep the route sequential and executable
- make each step evidence-producing
- include an `Estimation Inputs` section with enough data to derive a newline-delimited proposed file list or diff-backed sizing command
- include a `Plan Viability Review` section that evaluates whether the route is executable before execution starts
- include planned follow-up work only when it is non-blocking for the current route
- update `Revision Log` for every intentional artifact revision
- record the artifact checksum by referencing the separate `.sha256` file or by marking the current row `pending`; do not embed a current digest inside the artifact when doing so would change that digest
- do not silently rewrite the objective, constraints, or stop conditions

### Step 5: Review plan viability

Review the drafted plan as a pre-execution gate before committing to implementation:

- verify the route is executable with the loaded sources, current access, and known dependencies
- verify dependencies are sequenced before dependent changes
- verify validation gates can produce objective evidence for the success criteria
- verify estimation inputs are concrete enough for proposal or diff-backed sizing
- verify stop conditions catch missing sources, blockers, scope expansion, and failed validation
- complete every required viability review area from the template; do not remove, collapse, or summarize the required rows
- mark each `Plan Viability Review` row `pass`, `revise`, or `blocked`

If any row is `revise`, revise the plan before validation. If any row is `blocked`, stop and return the artifact path, blocker, missing inputs, and next decision needed. Do not use a plan as execution context while the viability review is not fully `pass`.

### Step 6: Validate and checksum the artifact

Validate the artifact with the bundled validator:

```bash
python3 <skill-dir>/scripts/validate_execution_plan.py --file ./.codex/execution-plans/<plan-id>/execution-plan.md
```

The validator runs the bundled `@jasonbelmonti/markdown-engine` profile and then checks unresolved placeholders across the full raw artifact, including frontmatter. Use the wrapper as the approval gate because markdown-engine v1 profile text assertions do not inspect frontmatter values.

Then write a checksum:

```bash
shasum -a 256 ./.codex/execution-plans/<plan-id>/execution-plan.md > ./.codex/execution-plans/<plan-id>/execution-plan.sha256
```

If validation fails, revise the artifact before using it as execution context.

Use the separate `.sha256` file as the checksum source of truth for the current artifact. The revision log may reference that file, record a previous checksum, or use `pending` while the current checksum is being written.

### Step 7: Prepare estimation inputs

Make the plan useful for execution sizing without requiring a sizing tool to parse prose:

- for proposal-mode sizing, ensure `File Touch Plan` contains one row per expected path and `Estimation Inputs` states how to derive the proposed file list
- for diff-backed sizing, record the intended `repoRoot`, `baseRef`, `headRef`, and whether working-tree changes are in scope
- include a defensible `proposalLinesChanged` value only when the file list materially understates or overstates expected churn
- record uncertainty in `Risk notes` or `Stop Conditions` instead of inflating the plan

### Step 8: Perform a quality check

Before handing off, verify that the artifact answers:

- What is the actual objective?
- Which sources control the plan?
- What exact route should execution follow?
- What files or artifacts are expected to change?
- What inputs can inform execution sizing?
- Did the viability review pass before execution commitment?
- What validation proves success?
- Does the `Plan Readiness Check` show that placeholders were removed, sources are complete, steps are specific, and estimation inputs are usable?
- Does the bundled validator pass, including the full-document placeholder guard?
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

- Use [references/execution-plan-template.md](references/execution-plan-template.md) as the required artifact structure.
- Use [profiles/execution-plan.yaml](profiles/execution-plan.yaml) as the markdown-engine validation profile.
- Use [scripts/validate_execution_plan.py](scripts/validate_execution_plan.py) as the required validation wrapper.
