#!/usr/bin/env python3
"""Placeholder xlsx formula recalc hook (requires LibreOffice in production)."""
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: recalc.py <inputPath>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    if not os.path.isfile(path):
        print(f"Input not found: {path}", file=sys.stderr)
        return 1
    print(f"Recalc skipped (stub): {path}. Install LibreOffice for full recalc.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
