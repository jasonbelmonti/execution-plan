#!/usr/bin/env python3
"""Validate an Execution Plan artifact with the profile and placeholder guard."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

MARKDOWN_ENGINE_VERSION = "3.0.0"

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


def default_markdown_engine_home() -> Path:
    default_data_home = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return Path(os.environ.get("MARKDOWN_ENGINE_HOME", default_data_home / "markdown-engine")).expanduser()


def resolve_markdown_engine_cli() -> Path | None:
    explicit_cli = os.environ.get("MARKDOWN_ENGINE_CLI")

    if explicit_cli:
        cli = Path(explicit_cli).expanduser().resolve()
        return cli if cli.is_file() else None

    candidates = [
        default_markdown_engine_home()
        / "tools"
        / "markdown-engine"
        / MARKDOWN_ENGINE_VERSION
        / "markdown-engine-cli.mjs",
    ]

    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()

    return None


def resolve_node() -> str | None:
    return shutil.which(os.environ.get("NODE_BINARY", "node"))


def run_markdown_engine(file_path: Path, profile_path: Path) -> tuple[int, str, str]:
    cli = resolve_markdown_engine_cli()
    if cli is None:
        return (
            2,
            "",
            "Bundled markdown-engine CLI not found. Run "
            "`scripts/install-markdown-engine-cli.sh` from the markdown-engine "
            "repository, set MARKDOWN_ENGINE_HOME to the install root, or set "
            "MARKDOWN_ENGINE_CLI to markdown-engine-cli.mjs.\n",
        )

    node = resolve_node()
    if node is None:
        return 2, "", "Node.js executable not found on PATH.\n"

    command = [
        node,
        str(cli),
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
    valid = not placeholder_results
    print(
        json.dumps(
            {
                "valid": valid,
                "markdownEngine": engine_result,
                "placeholderDiagnostics": placeholder_results,
            },
            indent=2,
        )
    )
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
