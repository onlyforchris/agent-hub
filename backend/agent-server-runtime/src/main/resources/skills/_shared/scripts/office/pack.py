#!/usr/bin/env python3
"""Pack a directory into Office Open XML (.docx/.pptx/.xlsx) archive."""
import os
import sys
import zipfile


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: pack.py <inputDir> <outputPath> [originalPath]", file=sys.stderr)
        return 2
    input_dir, output_path = sys.argv[1], sys.argv[2]
    if not os.path.isdir(input_dir):
        print(f"Input dir not found: {input_dir}", file=sys.stderr)
        return 1
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for root, _, files in os.walk(input_dir):
            for name in files:
                full = os.path.join(root, name)
                rel = os.path.relpath(full, input_dir).replace("\\", "/")
                archive.write(full, rel)
    print(f"Packed {input_dir} -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
