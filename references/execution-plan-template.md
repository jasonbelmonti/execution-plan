---
title: "Execution Plan Template"
plan_id: "sample-plan"
artifact_version: "1.0.0"
status: "draft"
created_at: "2026-05-22T00:00:00Z"
updated_at: "2026-05-22T00:00:00Z"
target_repo: "/tmp/example-target-repo"
target_branch: "main"
source_packet: "current-thread"
estimation_mode: "proposal"
validation_profile: "profiles/execution-plan.yaml"
---

# Objective

Produce a source-grounded execution route that another agent can follow to complete the requested work and generate estimation-ready inputs before implementation.

# Source Inventory

| Source | Retrieved at | Authority | Status | Plan impact |
| --- | --- | --- | --- | --- |
| Current thread | 2026-05-22T00:00:00Z | Latest user intent and decisions | loaded | Controls immediate objective and constraints. |
| AGENTS.md | 2026-05-22T00:00:00Z | Repo-local operating rules | loaded | Controls execution workflow and local conventions. |
| Target workspace | 2026-05-22T00:00:00Z | Current implementation state | loaded | Controls file-touch plan and validation gates. |

# Planning Constraints

- Confirmed constraints: Follow loaded source instructions and keep the route bounded to the stated objective.
- Dependencies: Target repository access and readable source context.
- Non-goals: Do not require out-of-scope enhancements before current completion.
- Assumptions / Inferences: Mark any unsupported route decision before execution starts.
- Missing inputs: None identified in this sample.

# Target Completion Route

First, load the controlling sources and current workspace state. Next, convert the objective into ordered execution steps and a file-touch plan. Then, run the plan validation profile and target verification checks. Completion is proven when the plan artifact validates, the checksum file exists, and the route identifies concrete execution evidence.

# Execution Steps

| Step | Action | Target | Depends on | Evidence | Stop condition |
| --- | --- | --- | --- | --- | --- |
| 1 | Inspect the controlling sources and current workspace state. | Current thread, local instructions, target files | None | Source Inventory is complete. | A material named source is unavailable. |
| 2 | Make the smallest scoped change that satisfies the objective. | Target files listed in File Touch Plan | Step 1 | Diff or artifact exists and maps to the objective. | Required scope exceeds the stated route. |
| 3 | Run validation gates and record evidence. | Commands listed in Validation Gates | Step 2 | Passing checks or documented failures. | A required gate fails for an out-of-scope reason. |

# File Touch Plan

| Path | Change type | Purpose | Expected churn | Risk notes |
| --- | --- | --- | --- | --- |
| `src/example-target.ts` | update | Carry the planned implementation route for the objective. | medium | Verify adjacent behavior with targeted tests. |

# Estimation Inputs

| Field | Value | Notes |
| --- | --- | --- |
| `repoRoot` | `/tmp/example-target-repo` | Use the repository that owns the planned change. |
| `mode` | `proposal` | Use `proposal` before implementation or `diff` when a diff exists. |
| `proposedFiles` | Derive from File Touch Plan `Path` values. | Use newline-delimited paths for proposal-mode sizing. |
| `proposalLinesChanged` | `unknown` | Set only when the file list misrepresents expected churn. |
| `baseRef` | `n/a` | Required for diff-backed sizing. |
| `headRef` | `n/a` | Optional when the default head is not intended. |
| `includeWorkingTree` | `false` | Set true only when uncommitted work is part of the estimate. |

# Validation Gates

| Gate | Command or check | Required evidence | Owner |
| --- | --- | --- | --- |
| Plan validation wrapper | `python3 scripts/validate_execution_plan.py --file ./.codex/execution-plans/sample-plan/execution-plan.md` | Wrapper validation passes before handoff, including markdown-engine profile validation and full-document placeholder checks. | codex |
| Target verification | Run the target repository checks named by the source context. | Evidence proves the objective inside the stated route. | codex |

# Stop Conditions

- A named material source is unavailable.
- Sources conflict and the controlling source cannot be determined.
- The route requires destructive operations, new credentials, or external access not already approved.
- The expected file touch plan expands enough to change sizing or decomposition.
- Required validation fails for reasons outside the current scope.

# Plan Readiness Check

| Check | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| Placeholder sweep | No unresolved template placeholders remain in the artifact. | Profile validation and manual scan completed. | pass |
| Source completeness | Material sources are loaded or listed as missing inputs. | Source Inventory contains controlling sources and status. | pass |
| Step specificity | Each execution step has an action, target, dependency, evidence, and stop condition. | Execution Steps table is complete. | pass |
| Estimation readiness | File or diff inputs can be passed to an execution sizing workflow. | Estimation Inputs and File Touch Plan are complete. | pass |
| Validation readiness | Required commands or manual checks have evidence expectations. | Validation Gates table is complete. | pass |

# Review Handoff

- Review boundary: Judge whether the current route satisfies the objective without requiring deferred enhancements.
- Out of scope: Improvements not required for current completion.
- Planned follow-up work: None identified in this sample.
- Evidence to include: Validation output, checksum path, and target verification notes.

# Revision Log

| Timestamp | Actor | Change | Artifact checksum reference |
| --- | --- | --- | --- |
| 2026-05-22T00:00:00Z | codex | Created initial Execution Plan. | pending; write `execution-plan.sha256` after validation |
