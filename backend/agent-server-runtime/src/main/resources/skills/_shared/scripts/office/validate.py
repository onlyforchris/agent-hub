#!/usr/bin/env python3
"""Validate Office Open XML package structure."""
import os
import sys
import zipfile


REQUIRED_PARTS = ("[Content_Types].xml",)


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: validate.py <targetPath>", file=sys.stderr)
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        print(f"Target not found: {target}", file=sys.stderr)
        return 1
    try:
        with zipfile.ZipFile(target, "r") as archive:
            names = set(archive.namelist())
            for part in REQUIRED_PARTS:
                if part not in names:
                    print(f"Missing required part: {part}", file=sys.stderr)
                    return 1
    except zipfile.BadZipFile:
        print("Invalid zip/Office package", file=sys.stderr)
        return 1
    print(f"Valid Office package: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
