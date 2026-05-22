#!/usr/bin/env python3
"""Validate an Execution Plan artifact with profile, readiness, and viability guards."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PLACEHOLDER_TOKENS = (
    "TODO",
    "replace-with-command-or-manual-check",
    "/absolute/path",
    "/absolute/path/or/repo/relative/path",
    "<skill-dir>",
    "<plan-id>",
    "<target-repo>",
    "<repo-root>",
    "Summarize the intended route",
    "State the concrete completion outcome",
    "Explain why this path is part of the route",
)

PLAN_VIABILITY_SECTION = "Plan Viability Review"
PASS_DECISION = "pass"


def line_col(text: str, offset: int) -> tuple[int, int]:
    line = text.count("\n", 0, offset) + 1
    line_start = text.rfind("\n", 0, offset) + 1
    return line, offset - line_start + 1


def placeholder_diagnostics(text: str) -> list[dict[str, object]]:
    diagnostics: list[dict[str, object]] = []

    for token in PLACEHOLDER_TOKENS:
        start = 0
        while True:
            index = text.find(token, start)
            if index == -1:
                break

            line, column = line_col(text, index)
            diagnostics.append(
                {
                    "code": "execution-plan.unresolvedPlaceholder",
                    "message": f'Execution Plan artifact must not contain unresolved placeholder "{token}".',
                    "severity": "error",
                    "token": token,
                    "line": line,
                    "column": column,
                }
            )
            start = index + len(token)

    return diagnostics


def normalize_cell(value: str) -> str:
    return " ".join(value.strip().strip("`").split()).lower()


def split_table_row(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return []
    return [cell.strip() for cell in stripped.strip("|").split("|")]


def section_lines(text: str, section_title: str) -> list[str]:
    lines = text.splitlines()
    start_index: int | None = None

    for index, line in enumerate(lines):
        if line.strip() == f"# {section_title}":
            start_index = index + 1
            break

    if start_index is None:
        return []

    section: list[str] = []
    for line in lines[start_index:]:
        if line.startswith("# "):
            break
        section.append(line)
    return section


def extract_first_table(text: str, section_title: str) -> tuple[list[str], list[dict[str, str]]]:
    lines = section_lines(text, section_title)
    for index, line in enumerate(lines):
        header = split_table_row(line)
        if not header or index + 1 >= len(lines):
            continue

        separator = split_table_row(lines[index + 1])
        if not separator or not all(set(cell.replace(":", "").strip()) <= {"-"} for cell in separator):
            continue

        rows: list[dict[str, str]] = []
        for row_line in lines[index + 2:]:
            cells = split_table_row(row_line)
            if not cells:
                break
            padded = cells + [""] * max(0, len(header) - len(cells))
            rows.append(dict(zip(header, padded)))
        return header, rows

    return [], []


def viability_diagnostics(text: str) -> list[dict[str, object]]:
    diagnostics: list[dict[str, object]] = []
    header, rows = extract_first_table(text, PLAN_VIABILITY_SECTION)

    if not header or not rows:
        return [
            {
                "code": "execution-plan.viabilityReviewMissing",
                "message": "Plan Viability Review must include at least one table row.",
                "severity": "error",
            }
        ]

    if "Decision" not in header:
        return [
            {
                "code": "execution-plan.viabilityDecisionMissing",
                "message": 'Plan Viability Review table must include a "Decision" column.',
                "severity": "error",
            }
        ]

    for index, row in enumerate(rows, start=1):
        decision = normalize_cell(row.get("Decision", ""))
        if decision != PASS_DECISION:
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityDecisionNotPass",
                    "message": 'Plan Viability Review decisions must all be "pass" before execution commitment.',
                    "severity": "error",
                    "row": index,
                    "decision": row.get("Decision", ""),
                    "reviewArea": row.get("Review area", ""),
                }
            )

    return diagnostics


def run_markdown_engine(file_path: Path, profile_path: Path) -> tuple[int, str, str]:
    command = [
        "npx",
        "-y",
        "@jasonbelmonti/markdown-engine@2.0.0",
        "validate",
        "--file",
        str(file_path),
        "--profile",
        str(profile_path),
        "--format",
        "json",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate an Execution Plan artifact.")
    parser.add_argument("--file", required=True, help="Execution Plan markdown file to validate.")
    parser.add_argument(
        "--profile",
        help="Optional validation profile path. Defaults to ../profiles/execution-plan.yaml relative to this script.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    script_dir = Path(__file__).resolve().parent
    file_path = Path(args.file).resolve()
    profile_path = Path(args.profile).resolve() if args.profile else script_dir.parent / "profiles" / "execution-plan.yaml"

    if not file_path.is_file():
        print(json.dumps({"valid": False, "error": f"file does not exist: {file_path}"}, indent=2))
        return 2
    if not profile_path.is_file():
        print(json.dumps({"valid": False, "error": f"profile does not exist: {profile_path}"}, indent=2))
        return 2

    engine_exit, engine_stdout, engine_stderr = run_markdown_engine(file_path, profile_path)
    try:
        engine_result = json.loads(engine_stdout) if engine_stdout.strip() else {"valid": False}
    except json.JSONDecodeError:
        print(engine_stdout, end="")
        print(engine_stderr, end="", file=sys.stderr)
        return engine_exit or 1

    if engine_exit != 0 or not engine_result.get("valid", False):
        print(json.dumps({"valid": False, "markdownEngine": engine_result}, indent=2))
        if engine_stderr:
            print(engine_stderr, end="", file=sys.stderr)
        return engine_exit or 1

    artifact_text = file_path.read_text(encoding="utf-8")
    placeholder_results = placeholder_diagnostics(artifact_text)
    viability_results = viability_diagnostics(artifact_text)
    valid = not placeholder_results and not viability_results
    print(
        json.dumps(
            {
                "valid": valid,
                "markdownEngine": engine_result,
                "placeholderDiagnostics": placeholder_results,
                "viabilityDiagnostics": viability_results,
            },
            indent=2,
        )
    )
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
