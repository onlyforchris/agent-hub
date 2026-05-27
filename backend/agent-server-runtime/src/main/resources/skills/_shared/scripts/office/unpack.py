#!/usr/bin/env python3
"""Unpack Office Open XML (.docx/.pptx/.xlsx) archive to a directory."""
import os
import sys
import zipfile


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: unpack.py <input> <outputDir>", file=sys.stderr)
        return 2
    input_path, output_dir = sys.argv[1], sys.argv[2]
    if not os.path.isfile(input_path):
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 1
    os.makedirs(output_dir, exist_ok=True)
    with zipfile.ZipFile(input_path, "r") as archive:
        archive.extractall(output_dir)
    print(f"Unpacked {input_path} -> {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
