#!/usr/bin/env python3
"""extract_source.py — print a BRD/user-story source ONCE as clean text.

    python scripts/extract_source.py <file.docx|.pdf|.md|.txt> [--out extracted.txt]

DOCX: tracked-change aware. Walks every <w:t> under every paragraph (body + tables + nested
tables) in document order, keeps <w:ins> insertions, drops <w:delText>, and reports the gap
versus plain python-docx paragraph extraction. Headings are prefixed with '#' by level,
tables are emitted as pipe rows so field-validation tables stay row-by-row readable.
"""
from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}
T = f"{{{W}}}"


def _runs_text(el) -> str:
    """Concatenate current text under an element, skipping deleted text."""
    parts = []
    for node in el.iter():
        if node.tag == f"{T}delText":
            continue
        if node.tag == f"{T}t":
            parts.append(node.text or "")
        elif node.tag == f"{T}tab":
            parts.append("\t")
        elif node.tag in (f"{T}br", f"{T}cr"):
            parts.append("\n")
    return "".join(parts)


def _para(p) -> str:
    style = p.find("w:pPr/w:pStyle", NS)
    sval = style.get(f"{T}val", "") if style is not None else ""
    num = p.find("w:pPr/w:numPr", NS)
    text = _runs_text(p).strip()
    if not text:
        return ""
    m = re.match(r"(?i)heading\s*(\d)", sval)
    if m:
        return "#" * int(m.group(1)) + " " + text
    if sval.lower().startswith("title"):
        return "# " + text
    if num is not None:
        return "- " + text
    return text


def _block(el, out: list[str]) -> None:
    for child in el:
        if child.tag == f"{T}p":
            out.append(_para(child))
        elif child.tag == f"{T}tbl":
            out.append("")
            for tr in child.findall("w:tr", NS):
                cells = []
                for tc in tr.findall("w:tc", NS):
                    inner: list[str] = []
                    _block(tc, inner)
                    cells.append(" ".join(x for x in inner if x).replace("|", "/"))
                out.append("| " + " | ".join(cells) + " |")
            out.append("")
        elif child.tag == f"{T}sdt":
            content = child.find("w:sdtContent", NS)
            if content is not None:
                _block(content, out)


def extract_docx(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("w:body", NS)
    lines: list[str] = []
    _block(body, lines)
    text = "\n".join(lines)
    tracked = {"ins": xml.count(b"<w:ins "), "del": xml.count(b"<w:del "), "delText": xml.count(b"<w:delText")}
    stats = {"tracked_changes": tracked, "has_tracked_changes": any(tracked.values())}
    try:
        import docx  # python-docx
        d = docx.Document(str(path))
        plain = "\n".join(p.text for p in d.paragraphs)
        stats["plain_paragraphs"] = sum(1 for p in d.paragraphs if p.text.strip())
        stats["plain_chars"] = len(plain)
    except Exception as exc:  # pragma: no cover
        stats["plain_extraction"] = f"unavailable: {exc}"[:120]
    stats["aware_lines"] = sum(1 for l in lines if l.strip())
    stats["aware_chars"] = len(text)
    if "plain_chars" in stats:
        stats["char_gap_vs_plain"] = stats["aware_chars"] - stats["plain_chars"]
    return text, stats


def extract_pdf(path: Path) -> tuple[str, dict]:
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(str(path)) as pdf:
            for p in pdf.pages:
                pages.append(p.extract_text() or "")
                for tbl in p.extract_tables() or []:
                    for row in tbl:
                        pages.append("| " + " | ".join((c or "").replace("\n", " ") for c in row) + " |")
        return "\n".join(pages), {"pages": len(pages)}
    except ImportError:
        from pypdf import PdfReader
        r = PdfReader(str(path))
        return "\n".join(pg.extract_text() or "" for pg in r.pages), {"pages": len(r.pages)}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source")
    ap.add_argument("--out", help="also write the text here")
    a = ap.parse_args()
    p = Path(a.source)
    ext = p.suffix.lower()
    if ext == ".docx":
        text, stats = extract_docx(p)
    elif ext == ".pdf":
        text, stats = extract_pdf(p)
    else:
        text, stats = p.read_text(encoding="utf-8", errors="ignore"), {}
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
    print(f"=== EXTRACTION STATS === {stats}")
    if stats.get("has_tracked_changes"):
        print("NOTE: tracked changes present — this output is tracked-change aware (insertions kept, deletions dropped).")
    
    ALL_PLATFORMS = [
        "Mobile App",
        "Web",
        "Mobile Web",
        "Mobile App + Web",
        "Mobile App + Mobile Web",
        "Web + Mobile Web",
        "Mobile App + Web + Mobile Web",
    ]
    print("=== PLATFORM SELECTION PROMPT ===")
    print("Direct Platform Prompt (Select from the 7 configured options):")
    for idx, opt in enumerate(ALL_PLATFORMS, 1):
        print(f"  {idx}. {opt}")
    print("\nIf 'Mobile App' (Option 1) is selected, immediately prompt:")
    print('  "Select the required platform"')
    print("  1. Both Android and iOS (Recommended)")
    print("  2. Android")
    print("  3. iOS")
    print("Execution must block until user responds.")
    print("=== SOURCE TEXT ===")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
