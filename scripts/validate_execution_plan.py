#!/usr/bin/env python3
"""Validate an Execution Plan artifact with profile, readiness, and viability guards."""

from __future__ import annotations

import argparse
import json
import re
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
REQUIRED_VIABILITY_COLUMNS = (
    "Review area",
    "Viability question",
    "Evidence",
    "Decision",
    "Required revision",
)
REQUIRED_VIABILITY_REVIEW_ITEMS = (
    ("Source authority", "Are all material sources loaded or explicitly marked as missing?"),
    ("Route feasibility", "Can the route be executed with current access, dependencies, and constraints?"),
    (
        "Dependency order",
        "Are prerequisite inspections, changes, and validations sequenced before dependent work?",
    ),
    ("Validation evidence", "Can the validation gates prove the intended outcome objectively?"),
    ("Estimation readiness", "Can execution sizing derive proposal or diff inputs from the plan?"),
    ("Execution commitment", "Is the plan ready to use as execution context without hidden blockers?"),
)
MISSING_EVIDENCE_VALUES = (
    "",
    "-",
    "n/a",
    "n/a.",
    "na",
    "na.",
    "none",
    "none.",
    "tbd",
    "tbd.",
    "todo",
    "todo.",
)
PLACEHOLDER_EVIDENCE_TOKENS = (
    "todo",
    "tbd",
    "to be determined",
    "placeholder",
    "replace",
    "unknown",
    "pending",
    "later",
)


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


def contains_placeholder_token(value: str, tokens: tuple[str, ...]) -> bool:
    normalized = normalize_cell(value)
    return any(re.search(rf"\b{re.escape(token)}\b", normalized) for token in tokens)


def evidence_is_missing(value: str) -> bool:
    normalized = normalize_cell(value)
    return normalized in MISSING_EVIDENCE_VALUES or contains_placeholder_token(value, PLACEHOLDER_EVIDENCE_TOKENS)


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


def section_heading_count(text: str, section_title: str) -> int:
    return sum(1 for line in text.splitlines() if line.strip() == f"# {section_title}")


def extract_tables(text: str, section_title: str) -> list[tuple[list[str], list[dict[str, str]]]]:
    lines = section_lines(text, section_title)
    tables: list[tuple[list[str], list[dict[str, str]]]] = []
    index = 0

    while index < len(lines):
        line = lines[index]
        header = split_table_row(line)
        if not header or index + 1 >= len(lines):
            index += 1
            continue

        separator = split_table_row(lines[index + 1])
        if not separator or not all(set(cell.replace(":", "").strip()) <= {"-"} for cell in separator):
            index += 1
            continue

        rows: list[dict[str, str]] = []
        row_index = index + 2
        while row_index < len(lines):
            row_line = lines[row_index]
            cells = split_table_row(row_line)
            if not cells:
                break
            padded = cells + [""] * max(0, len(header) - len(cells))
            rows.append(dict(zip(header, padded)))
            row_index += 1

        tables.append((header, rows))
        index = row_index + 1

    return tables


def viability_diagnostics(text: str) -> list[dict[str, object]]:
    diagnostics: list[dict[str, object]] = []
    section_count = section_heading_count(text, PLAN_VIABILITY_SECTION)
    tables = extract_tables(text, PLAN_VIABILITY_SECTION)

    if section_count > 1:
        diagnostics.append(
            {
                "code": "execution-plan.viabilityMultipleSections",
                "message": "Plan Viability Review must appear exactly once.",
                "severity": "error",
                "sectionCount": section_count,
            }
        )

    if not tables:
        return [
            {
                "code": "execution-plan.viabilityReviewMissing",
                "message": "Plan Viability Review must include at least one table row.",
                "severity": "error",
            }
        ]

    if len(tables) != 1:
        diagnostics.append(
            {
                "code": "execution-plan.viabilityMultipleTables",
                "message": "Plan Viability Review must contain exactly one table.",
                "severity": "error",
                "tableCount": len(tables),
            }
        )

    expected_questions = {
        normalize_cell(area): (area, question)
        for area, question in REQUIRED_VIABILITY_REVIEW_ITEMS
    }

    header, rows = tables[0]
    for column in REQUIRED_VIABILITY_COLUMNS:
        if column not in header:
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityColumnMissing",
                    "message": f'Plan Viability Review table must include a "{column}" column.',
                    "severity": "error",
                    "column": column,
                }
            )

    if diagnostics and any(diagnostic["code"] == "execution-plan.viabilityColumnMissing" for diagnostic in diagnostics):
        return diagnostics

    if not rows:
        diagnostics.append(
            {
                "code": "execution-plan.viabilityReviewMissing",
                "message": "Plan Viability Review must include at least one table row.",
                "severity": "error",
            }
        )

    rows_by_area: dict[str, dict[str, str]] = {}
    for index, row in enumerate(rows, start=1):
        review_area = row.get("Review area", "")
        area_key = normalize_cell(review_area)
        if not area_key:
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityReviewAreaBlank",
                    "message": "Plan Viability Review rows must include a review area.",
                    "severity": "error",
                    "row": index,
                }
            )
        elif area_key in rows_by_area:
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityDuplicateArea",
                    "message": f'Plan Viability Review contains a duplicate review area "{review_area}".',
                    "severity": "error",
                    "row": index,
                    "reviewArea": review_area,
                }
            )
        else:
            rows_by_area[area_key] = row

        question = row.get("Viability question", "")
        if not normalize_cell(question):
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityQuestionBlank",
                    "message": "Plan Viability Review rows must include a viability question.",
                    "severity": "error",
                    "row": index,
                    "reviewArea": review_area,
                }
            )

        evidence = row.get("Evidence", "")
        if evidence_is_missing(evidence):
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityEvidenceBlank",
                    "message": "Plan Viability Review rows must include concrete evidence.",
                    "severity": "error",
                    "row": index,
                    "reviewArea": review_area,
                }
            )

        required_revision = row.get("Required revision", "")
        if not required_revision.strip():
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityRequiredRevisionBlank",
                    "message": "Plan Viability Review rows must include a required revision value.",
                    "severity": "error",
                    "row": index,
                    "reviewArea": review_area,
                }
            )

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

    for area_key, (area, expected_question) in expected_questions.items():
        row = rows_by_area.get(area_key)
        if row is None:
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityRequiredAreaMissing",
                    "message": f'Plan Viability Review must include the required review area "{area}".',
                    "severity": "error",
                    "reviewArea": area,
                }
            )
            continue

        actual_question = row.get("Viability question", "")
        if normalize_cell(actual_question) != normalize_cell(expected_question):
            diagnostics.append(
                {
                    "code": "execution-plan.viabilityQuestionMismatch",
                    "message": f'Plan Viability Review area "{area}" must use the required viability question.',
                    "severity": "error",
                    "reviewArea": area,
                    "expectedQuestion": expected_question,
                    "actualQuestion": actual_question,
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
