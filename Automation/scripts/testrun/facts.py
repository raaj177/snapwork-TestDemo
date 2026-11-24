"""Failure 'why': facts captured at failure time (no AI) and an optional one-line AI note."""
from __future__ import annotations

import json
import shutil
import subprocess
import xml.etree.ElementTree as ET

from common import ALLURE_DIR, ROOT, SCREENSHOTS_DIR

ALLURE = ALLURE_DIR
PAGE_SOURCE_NAMES = ("page_source", "page source", "pagesource")


def _is_test(d: dict, test_id: str) -> bool:
    """The Allure result of a testcase: its it() title starts with '<id>:', or a label/link carries the ID
    (testCase.ts adds it as a tms link or label in beforeTest)."""
    if str(d.get("name", "")).startswith(f"{test_id}:"):
        return True
    if any(l.get("value") == test_id for l in d.get("labels", [])):
        return True
    return any(l.get("name") == test_id or str(l.get("url", "")).endswith(test_id) for l in d.get("links", []))


def _latest_result_json(test_id: str):
    best = None
    for f in ALLURE.glob("*-result.json"):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if _is_test(d, test_id):
            if best is None or d.get("stop", 0) > best.get("stop", 0):
                best = d
    return best


def _attachments(d: dict):
    """Attachments of the result and of its steps (hooks attach evidence inside steps)."""
    stack = [d]
    while stack:
        node = stack.pop()
        yield from node.get("attachments", [])
        stack.extend(node.get("steps", []))


def screen_facts(test_id: str, max_texts: int = 10) -> str:
    """What the device screen showed when the test failed, read from the saved page source."""
    d = _latest_result_json(test_id)
    if not d:
        return ""
    src = next((a["source"] for a in _attachments(d)
                if any(n in a.get("name", "").lower() for n in PAGE_SOURCE_NAMES) or "xml" in a.get("type", "")), None)
    if not src or not (ALLURE / src).exists():
        return ""
    try:
        root = ET.parse(ALLURE / src).getroot()
    except ET.ParseError:
        return ""
    nodes = list(root.iter())
    texts: list[str] = []
    for n in nodes:
        for attr in ("text", "content-desc", "label", "name", "value"):
            v = (n.get(attr) or "").strip()
            if v and v not in texts and len(v) <= 80:
                texts.append(v.replace("\n", " "))
    if len(nodes) <= 3 or not texts:
        return f"Screen at failure looked blank ({len(nodes)} UI elements, no visible text)."
    return "Screen at failure showed: " + " | ".join(texts[:max_texts])


def screenshot_of(test_id: str, since: float | None = None) -> str:
    """Newest evidence file AllureEvidence saved under screenshots/ for this testcase (and, with since, saved after that
    time, so an earlier run's file is never named), relative to the automation root."""
    if not SCREENSHOTS_DIR.is_dir():
        return ""
    files = [f for f in SCREENSHOTS_DIR.rglob("*")
             if f.is_file() and test_id in f.name and (since is None or f.stat().st_mtime >= since)]
    if not files:
        return ""
    return max(files, key=lambda f: f.stat().st_mtime).relative_to(ROOT).as_posix()


def ai_note(test_id: str, expected: str, steps: str, actual: str, exception: str, facts: str,
            screenshot: str, timeout: int = 150) -> str:
    """One-line diagnosis from the `claude` CLI (headless). Returns '' on any problem (never raises)."""
    exe = shutil.which("claude")
    if not exe:
        return ""
    prompt = (
        "You are reviewing ONE failed mobile UI testcase. Reply with a single plain sentence (max 35 words) "
        "saying what the app showed versus what was expected and the most likely reason "
        "(product defect, changed label/screen, wrong locator, or environment). No markdown, no preamble.\n\n"
        f"Testcase: {test_id}\nSteps: {steps[:600]}\nExpected: {expected[:500]}\n"
        f"Recorded actual result: {actual[:500]}\nException: {exception}\n{facts}\n"
        + (f"A screenshot is saved at: {screenshot} (read it if useful).\n" if screenshot else "")
    )
    cmd = [exe, "-p", "--model", "haiku", "--allowedTools", "Read"]
    try:
        out = subprocess.run(cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                             timeout=timeout, cwd=str(ROOT))
    except (OSError, subprocess.TimeoutExpired):
        return ""
    if out.returncode != 0:
        return ""
    text = " ".join(out.stdout.split()).replace("—", "-").replace("–", "-")
    return text[:400]
