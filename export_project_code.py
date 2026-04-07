"""Export project source files into a single TXT file."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Iterable

DEFAULT_CODE_EXTENSIONS = (
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".html",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".bat",
    ".sh",
    ".ps1",
)

DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".next",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "output",
    "test-results",
}


def parse_extension_list(values: Iterable[str] | None) -> set[str]:
    """Normalize extension inputs to a lowercase set that starts with a dot."""
    if not values:
        return set(DEFAULT_CODE_EXTENSIONS)

    normalized: set[str] = set()
    for value in values:
        ext = value.strip().lower()
        if not ext:
            continue
        if not ext.startswith("."):
            ext = f".{ext}"
        normalized.add(ext)

    return normalized


def is_probably_text_file(path: Path, sample_size: int = 4096) -> bool:
    """Skip binary files by checking for null bytes in a small sample."""
    try:
        with path.open("rb") as file:
            chunk = file.read(sample_size)
    except OSError:
        return False

    return b"\x00" not in chunk


def collect_files(
    root: Path,
    extensions: set[str],
    output_file: Path,
    include_hidden: bool,
) -> list[Path]:
    """Collect matching files under root while honoring excludes."""
    files: list[Path] = []
    output_file_resolved = output_file.resolve()

    for current_dir, dirnames, filenames in os.walk(root):
        if not include_hidden:
            dirnames[:] = [name for name in dirnames if not name.startswith(".")]
        dirnames[:] = [name for name in dirnames if name not in DEFAULT_EXCLUDED_DIRS]

        current_path = Path(current_dir)
        for filename in filenames:
            if not include_hidden and filename.startswith("."):
                continue

            absolute_path = current_path / filename
            if absolute_path.resolve() == output_file_resolved:
                continue

            if absolute_path.suffix.lower() not in extensions:
                continue

            if not is_probably_text_file(absolute_path):
                continue

            files.append(absolute_path.relative_to(root))

    files.sort(key=lambda item: item.as_posix())
    return files


def export_files(root: Path, output_file: Path, files: list[Path]) -> None:
    """Write all collected file contents to a single output file."""
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with output_file.open("w", encoding="utf-8", newline="\n") as out:
        out.write("# Project Code Export\n")
        out.write(f"# Root: {root.as_posix()}\n")
        out.write(f"# Files: {len(files)}\n\n")

        for relative_path in files:
            absolute_path = root / relative_path

            out.write("=" * 80 + "\n")
            out.write(f"FILE: {relative_path.as_posix()}\n")
            out.write("=" * 80 + "\n\n")

            try:
                content = absolute_path.read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                out.write(f"[Could not read file: {exc}]\n\n")
                continue

            out.write(content)
            if not content.endswith("\n"):
                out.write("\n")
            out.write("\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect project code files and write them to one TXT file.",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Project root folder to scan (default: current directory).",
    )
    parser.add_argument(
        "--output",
        default="project_code_dump.txt",
        help="Output TXT path. Relative paths are resolved from --root.",
    )
    parser.add_argument(
        "--ext",
        nargs="*",
        help="Optional list of file extensions to include (example: py ts tsx).",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files/folders such as .env and .github.",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    root = Path(args.root).resolve()
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = (root / output_path).resolve()

    extensions = parse_extension_list(args.ext)
    files = collect_files(
        root=root,
        extensions=extensions,
        output_file=output_path,
        include_hidden=args.include_hidden,
    )
    export_files(root=root, output_file=output_path, files=files)

    print(f"Exported {len(files)} files to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
