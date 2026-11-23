
#!/usr/bin/env python3

import os
import zipfile
import argparse
from pathlib import Path
import subprocess


def get_ignored_paths(root: Path):
    """Use Git to determine which files are ignored."""
    try:
        result = subprocess.run(
            ["git", "ls-files", "--others", "--ignored", "--exclude-standard", "-z"],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )
        return set(result.stdout.split("\0"))
    except (subprocess.CalledProcessError, FileNotFoundError):
        return set()


def zip_project(project_dir: Path, output: Path):
    project_dir = project_dir.resolve()
    output = output.resolve()

    ignored = get_ignored_paths(project_dir)

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in project_dir.rglob("*"):
            if not path.is_file():
                continue

            relative = path.relative_to(project_dir)
            relative_str = relative.as_posix()

            # Exclude Git metadata and ignored files.
            if ".git" in relative.parts:
                continue

            if relative_str in ignored:
                continue

            # Don't include the output archive itself.
            if path.resolve() == output:
                continue

            archive.write(path, relative_str)

    print(f"Created: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Zip a project while respecting .gitignore"
    )
    parser.add_argument(
        "project",
        nargs="?",
        default=".",
        help="Project directory (default: current directory)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default="project.zip",
        help="Output ZIP filename (default: project.zip)",
    )

    args = parser.parse_args()

    zip_project(Path(args.project), Path(args.output))
