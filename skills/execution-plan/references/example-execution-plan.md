---
type: ExecutionPlan
title: Add dry-run behavior to cache pruning
plan_id: cache-prune-dry-run
artifact_version: "2.0"
revision: "1"
created_at: "2026-08-11T21:25:58-05:00"
updated_at: "2026-08-11T21:25:58-05:00"
target_repo: /workspace/cache-cli
target_worktree: /workspace/cache-cli/.worktrees/dry-run
target_branch: codex/cache-prune-dry-run
baseline_ref: 1234567890abcdef1234567890abcdef12345678
source_contract: issue-42-revision-3
validation_profile: /skills/execution-plan/profiles/execution-plan.yaml
---

# Add dry-run behavior to cache pruning

This fictional plan demonstrates the complete artifact shape and cross-reference conventions. Its sources, repository paths, commands, and baseline are illustrative rather than execution authority.

## Plan Control

| Plan state | Planning depth | Source status | Baseline status | State rationale |
| --- | --- | --- | --- | --- |
| READY | standard | current | inspected | The outcome sources and repository baseline are current, the route audit passes, and all structural references resolve. |

## Source Contract

| Source ID | Source reference | Version / fingerprint | Authority | Status | Planning implication |
| --- | --- | --- | --- | --- | --- |
| EP-SRC-1 | Issue 42, acceptance rows A1 and A2 | revision 3 | Controls observable behavior and proof obligations. | current | Dry-run must share selection behavior while preventing mutation; normal pruning must remain unchanged. |
| EP-SRC-2 | Repository operating instructions | commit 1234567890abcdef1234567890abcdef12345678 | Controls worktree and validation operation. | current | Perform implementation in the named worktree and preserve unrelated changes. |

## Outcome Anchors

| Outcome ID | Source IDs | Source location | Required observable | Proof obligation |
| --- | --- | --- | --- | --- |
| EP-OUT-1 | EP-SRC-1 | A1 | Dry-run reports exactly the entries normal pruning would select and leaves the cache unchanged. | A before-and-after filesystem comparison is identical while selected entries appear in command output. |
| EP-OUT-2 | EP-SRC-1 | A2 | Invocation without dry-run preserves existing deletion and exit behavior. | Existing prune regression tests and a focused deletion fixture pass. |

## Baseline Findings

| Finding ID | Repository evidence | Current behavior / constraint | Planning implication | Confidence |
| --- | --- | --- | --- | --- |
| EP-FIND-1 | src/prune.ts, selectCandidates and deleteCandidates | Candidate selection and deletion are separate functions invoked in sequence. | Reuse selectCandidates for both modes and gate only the deletion call. | confirmed |
| EP-FIND-2 | test/prune.test.ts, deletes eligible entries case | Existing fixtures prove normal mutation behavior. | Extend the fixture for dry-run immutability and retain the original regression assertion. | confirmed |
| EP-FIND-3 | src/prune.ts, formatEntries and the normal prune result path | The command already formats the candidate paths returned from the prune flow. | Route the dry-run candidate list through the same formatter so reported entries exactly match normal selection. | confirmed |

## Preconditions

| Precondition ID | Required state / input | Verification | Unmet trigger ID |
| --- | --- | --- | --- |
| EP-PRE-1 | HEAD is the recorded baseline, the two planned targets have no pre-existing staged or unstaged diff, and existing focused tests pass. | Confirm `git rev-parse HEAD` equals the recorded baseline, both `git diff --quiet -- src/prune.ts test/prune.test.ts` and `git diff --cached --quiet -- src/prune.ts test/prune.test.ts` exit 0, and `npm test -- --runInBand test/prune.test.ts` exits 0 before editing. | EP-TRIG-1 |
| EP-PRE-2 | EP-ACT-1 and EP-GATE-1 completed, and the resulting planned-target diff remains isolated to src/prune.ts. | Confirm EP-GATE-1 recorded exit status 0, `git diff --name-only -- src/prune.ts test/prune.test.ts` returns exactly src/prune.ts, and `git diff --cached --quiet -- src/prune.ts test/prune.test.ts` exits 0 immediately before EP-ACT-2. | EP-TRIG-1 |

## Implementation Decisions

| Decision ID | Kind | Decision or assumption | Finding IDs | Evidence / rationale | Affected action IDs | Replan trigger ID |
| --- | --- | --- | --- | --- | --- | --- |
| EP-DEC-1 | decision | Reuse selectCandidates and formatEntries, and conditionally skip only deleteCandidates. | EP-FIND-1, EP-FIND-3 | The inspected mutation boundary and existing reporting path avoid duplicate selection or formatting rules. | EP-ACT-1, EP-ACT-2 | EP-TRIG-1 |

## Execution Phases

| Phase ID | Phase objective | Entry precondition IDs | Safe intermediate state |
| --- | --- | --- | --- |
| EP-PH-1 | Add dry-run through the existing selection and mutation boundary and prove both modes. | EP-PRE-1 | The CLI supports dry-run, normal behavior remains green, and no unvalidated generated output remains. |

## Execution Route

| Step ID | Kind | Phase ID | Required prior Step IDs |
| --- | --- | --- | --- |
| EP-ACT-1 | action | EP-PH-1 | None |
| EP-GATE-1 | gate | EP-PH-1 | EP-ACT-1 |
| EP-ACT-2 | action | EP-PH-1 | EP-GATE-1 |
| EP-GATE-2 | gate | EP-PH-1 | EP-ACT-2 |

## Execution Actions

| Action ID | Precondition IDs | Outcome IDs | Targets | Concrete action | Observable postcondition | Evidence to capture | Failure response ID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-ACT-1 | EP-PRE-1 | EP-OUT-1 | src/prune.ts, command option parsing, prune flow, and formatEntries result path | Add the dry-run option; route both modes through selectCandidates and formatEntries; bypass deleteCandidates only for dry-run. | Dry-run emits the exact selected candidate paths through the existing formatter without entering the deletion branch. | `git diff -- src/prune.ts` captured in the implementation handoff. | EP-RESP-1 |
| EP-ACT-2 | EP-PRE-2 | EP-OUT-1, EP-OUT-2 | test/prune.test.ts, prune fixtures | Over the same candidate fixture, assert that dry-run output contains exactly the formatted selected paths, assert the cache snapshot is unchanged, and retain the normal-deletion assertion. | Tests prove exact dry-run reporting and immutability while preserving normal pruning over identical selection inputs. | `git diff -- test/prune.test.ts` captured in the implementation handoff. | EP-RESP-1 |

## Change Footprint

| Path / component | Action IDs | Change type | Purpose | Confidence | Risk / ownership note |
| --- | --- | --- | --- | --- | --- |
| src/prune.ts | EP-ACT-1 | modify | Expose the option and bypass only the mutation call. | confirmed | Keep selection and existing exit semantics unchanged. |
| test/prune.test.ts | EP-ACT-2 | modify | Prove exact dry-run reporting, immutability, and normal-mode regression behavior. | confirmed | Reuse the fixture so candidate selection cannot drift between modes. |

## Validation Gates

| Gate ID | Outcome IDs | Command or check | Expected observation | Evidence capture | Evidence artifact | Evidence verification | Failure response ID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-GATE-1 | EP-OUT-1 | Run `npm run typecheck`. | The command exits zero with the new option and conditional mutation branch typed. | Run `mkdir -p .codefactory/execution-plans/cache-prune-dry-run/evidence`; redirect combined output to the named evidence file; append the exit status, `git rev-parse HEAD`, and a UTC timestamp before evaluating success. | `.codefactory/execution-plans/cache-prune-dry-run/evidence/EP-GATE-1-typecheck.txt` | Verify the file is nonempty, contains no type error, records exit status 0, and records the current commit and timestamp. | EP-RESP-1 |
| EP-GATE-2 | EP-OUT-1, EP-OUT-2 | Run `npm test -- --runInBand test/prune.test.ts`, then `npm test`. | Dry-run reports eligible entries without filesystem changes; normal mode deletes them; all existing tests pass. | Confirm the evidence directory exists; redirect each command's combined output to its named evidence file; append each exit status, `git rev-parse HEAD`, and a UTC timestamp before evaluating success. | `.codefactory/execution-plans/cache-prune-dry-run/evidence/EP-GATE-2-focused.txt` and `.codefactory/execution-plans/cache-prune-dry-run/evidence/EP-GATE-2-regression.txt` | Verify both files are nonempty, contain their passing summaries plus exit status 0, and record the current commit and timestamp. | EP-RESP-1 |

## Failure and Replan Controls

| Response ID | Trigger | Containment | Exact recovery / rollback procedure | Single restored safe state | Verification | Escalation trigger ID |
| --- | --- | --- | --- | --- | --- | --- |
| EP-RESP-1 | An action postcondition or validation gate fails. | Stop dependent actions; run `mkdir -p .codefactory/execution-plans/cache-prune-dry-run/evidence`, then run `git diff --binary -- src/prune.ts test/prune.test.ts > .codefactory/execution-plans/cache-prune-dry-run/evidence/EP-RESP-1-failed.patch` and preserve the failing command output beside it. | Run `git apply -R --check .codefactory/execution-plans/cache-prune-dry-run/evidence/EP-RESP-1-failed.patch`, then run the same command without `--check`; do not touch other paths. If either command fails, stop and apply EP-TRIG-1. | The two planned targets match their pre-execution content and the focused prune regression test passes. | Require `git diff --exit-code -- src/prune.ts test/prune.test.ts` and `npm test -- --runInBand test/prune.test.ts` to exit 0. | EP-TRIG-1 |

| Trigger ID | Observable trigger | Stopped Step IDs | Evidence to preserve | Required decision / input | Exact resume condition |
| --- | --- | --- | --- | --- | --- |
| EP-TRIG-1 | Baseline behavior differs, the mutation boundary cannot be reused, or required output semantics are ambiguous. | EP-ACT-1, EP-GATE-1, EP-ACT-2, EP-GATE-2 | Baseline command output, relevant source locations, and the isolated diff. | A revised behavior decision or route grounded in current repository evidence. | The controlling source resolves observable semantics and a revised plan passes both readiness gates. |

## Plan Readiness

| Decision | Reviewed at | Evidence / rationale | Required revision or blocker |
| --- | --- | --- | --- |
| PASS | 2026-08-11T21:25:58-05:00 by Codex | All source anchors map bidirectionally to concrete actions and gates; repository findings justify the mutation boundary; dependencies, recovery, and stop behavior are explicit. | None. |

## Revision Log

| Revision | Timestamp | Actor | Material change | Reason / source | Checksum reference |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-11T21:25:58-05:00 | Codex | Authored the source-bounded dry-run implementation route. | Issue 42 revision 3 and inspected baseline. | execution-plan.sha256 |
