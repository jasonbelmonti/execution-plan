# Missing Validation Gate Graph Fixture

## Source Contract

| Source ID | Source reference | Version / fingerprint | Authority | Status | Planning implication |
| --- | --- | --- | --- | --- | --- |
| EP-SRC-1 | docs/contract.md | fixture-v1 | fixture authority | current | Prove the core execution-plan paths. |

## Outcome Anchors

| Outcome ID | Source IDs | Source location | Required observable | Proof obligation |
| --- | --- | --- | --- | --- |
| EP-OUT-1 | EP-SRC-1 | contract outcome | A complete core trace path exists. | Confirm the source reaches action and gate evidence. |

## Execution Actions

| Action ID | Precondition IDs | Outcome IDs | Targets | Concrete action | Observable postcondition | Evidence to capture | Failure response ID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-ACT-1 | None. | EP-OUT-1 | fixture action | Add the profile fixture. | The profile has an action path. | Focused test output. | None. |

## Validation Gates

| Gate ID | Outcome IDs | Command or check | Expected observation | Evidence capture | Evidence artifact | Evidence verification | Failure response ID |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EP-GATE-1 | None. | markdown-trace graph-validate | The fixture exposes its missing gate link. | Capture command output. | Graph-validation JSON. | Exit code 1. | None. |
