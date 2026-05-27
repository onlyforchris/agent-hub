#!/usr/bin/env python3
"""Extract plain text from docx/pptx/xlsx by reading zip XML parts."""
import re
import sys
import zipfile
from xml.etree import ElementTree as ET


def extract_docx(data: bytes) -> str:
    with zipfile.ZipFile(io_bytes(data)) as archive:
        if "word/document.xml" not in archive.namelist():
            return ""
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    texts = []
    for node in root.iter():
        if node.tag.endswith("}t") and node.text:
            texts.append(node.text)
    return "\n".join(texts)


def io_bytes(data: bytes):
    import io
    return io.BytesIO(data)


def extract_zip_text(path: str) -> str:
    with open(path, "rb") as handle:
        payload = handle.read()
    with zipfile.ZipFile(io_bytes(payload)) as archive:
        chunks = []
        for name in archive.namelist():
            if name.endswith(".xml") and ("word/" in name or "ppt/" in name or "xl/" in name):
                xml = archive.read(name)
                root = ET.fromstring(xml)
                for node in root.iter():
                    if node.tag.endswith("}t") and node.text:
                        chunks.append(node.text)
        return "\n".join(chunks)


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: extract_text.py <inputPath>", file=sys.stderr)
        return 2
    text = extract_zip_text(sys.argv[1])
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
