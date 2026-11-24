#!/usr/bin/env python3
"""Decide where the user stories come from and download them from Jira when that is the source.

Source order (references/user-story-source.md):
  1. user_stories/ has no story file and jira-source.md is filled in  -> JIRA  (download with `fetch`)
  2. jira-source.md is missing or empty and user_stories/ has files    -> LOCAL (use the files)
  3. both are empty                                                    -> NONE  (ask the Jira details, `init`, then `fetch`)
  4. both are present                                                  -> BOTH  (ask the user which one to use)

Commands:
  status                 print SOURCE=<JIRA|LOCAL|NONE|BOTH> and the details; exit 0
  init  --base-url ...   create jira-source.md from the answers (never overwrites a filled-in file)
  check                  read-only: connect to Jira and count the issues the file selects
  fetch [--dry-run]      download the selected issues into user_stories/ as Markdown

Credentials come only from environment variables, never from jira-source.md:
  Jira Cloud:               JIRA_EMAIL + JIRA_API_TOKEN
  Jira Server/Data Center:  JIRA_PAT
Standard library only (Python 3.9+).
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import logging
import os
import re
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

log = logging.getLogger("jira_stories")

SOURCE_FILE = "jira-source.md"
IGNORED = {"readme.md", ".gitkeep", SOURCE_FILE}
STORY_EXT = {".docx", ".pdf", ".md", ".txt", ".xlsx", ".doc"}
MARKER = "<!-- source: jira"
KEYS = ("base_url", "deployment", "project_key", "issue_keys", "jql",
        "acceptance_criteria_field", "output", "document_name")
TEMPLATE = """# Jira source for user stories

Read by `.github/skills/qa-automation-orchestrator/scripts/jira_stories.py` and by the skills that need user stories
(rules: `.github/skills/qa-automation-orchestrator/references/user-story-source.md`).
Fill in the values after the colons. **Never put a password or API token in this file.** Set them as environment variables:
`JIRA_EMAIL` + `JIRA_API_TOKEN` (Jira Cloud) or `JIRA_PAT` (Jira Server / Data Center).

- base_url: {base_url}
- deployment: {deployment}
- project_key: {project_key}
- issue_keys: {issue_keys}
- jql: {jql}
- acceptance_criteria_field: {acceptance_criteria_field}
- output: {output}
- document_name: {document_name}

Field notes:
- base_url: the Jira site, for example `https://<company>.atlassian.net` (Cloud) or `https://jira.<company>.com` (Server).
- deployment: `cloud` or `server`.
- Select the stories with issue_keys (comma-separated, for example `ABC-101, ABC-102`) or jql. With only project_key,
  every Story in the project is selected (`project = <key> AND issuetype = Story`).
- acceptance_criteria_field: optional custom field ID that holds acceptance criteria, for example `customfield_10035`.
- output: `per-issue` (one file per issue, default) or `single` (all issues in one file named document_name).
"""


def requirements_dir(arg: str | None) -> Path:
    """The .github/_requirements folder: the argument, else found from this script's location."""
    log.debug("Resolving the requirements folder")
    try:
        if arg:
            path = Path(arg).resolve()
        else:
            path = Path(__file__).resolve().parents[3] / "_requirements"
        log.debug("Requirements folder: %s", path)
        return path
    except Exception as error:  # noqa: BLE001
        log.error("Resolving the requirements folder failed: %s", error)
        raise


def story_files(stories: Path) -> list[Path]:
    """Story documents in user_stories/ (README.md, .gitkeep and jira-source.md are not stories)."""
    log.debug("Listing story files in %s", stories)
    try:
        if not stories.is_dir():
            return []
        files = sorted(p for p in stories.iterdir()
                       if p.is_file() and p.name.lower() not in IGNORED
                       and not p.name.startswith("~$") and p.suffix.lower() in STORY_EXT)
        log.debug("Found %d story file(s)", len(files))
        return files
    except Exception as error:  # noqa: BLE001
        log.error("Listing story files failed: %s", error)
        raise


def read_source(stories: Path) -> dict[str, str]:
    """Values of jira-source.md (`- key: value` lines); empty dict when the file is missing."""
    log.debug("Reading %s", SOURCE_FILE)
    try:
        path = stories / SOURCE_FILE
        if not path.is_file():
            log.debug("%s does not exist", SOURCE_FILE)
            return {}
        values: dict[str, str] = {}
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip().lower().startswith("field notes"):
                break  # the help text below repeats the key names
            m = re.match(r"^\s*-\s*([a-z_]+)\s*:\s*(.*?)\s*$", line)
            if m and m.group(1) in KEYS and m.group(1) not in values:
                values[m.group(1)] = m.group(2).strip().strip("`")
        log.debug("Read %d value(s) from %s", sum(1 for v in values.values() if v), SOURCE_FILE)
        return values
    except Exception as error:  # noqa: BLE001
        log.error("Reading %s failed: %s", SOURCE_FILE, error)
        raise


def source_filled(values: dict[str, str]) -> bool:
    """Filled in = a base_url and at least one selector (issue_keys, jql or project_key)."""
    log.debug("Checking whether the Jira source is filled in")
    filled = bool(values.get("base_url")) and any(values.get(k) for k in ("issue_keys", "jql", "project_key"))
    log.debug("Jira source filled in: %s", filled)
    return filled


def is_jira_download(path: Path) -> bool:
    """True for a file this script downloaded from Jira (it starts with the source marker)."""
    log.debug("Checking whether %s was downloaded from Jira", path.name)
    try:
        if path.suffix.lower() != ".md":
            return False
        with path.open(encoding="utf-8", errors="replace") as handle:
            downloaded = handle.read(len(MARKER)) == MARKER
        log.debug("%s downloaded from Jira: %s", path.name, downloaded)
        return downloaded
    except Exception as error:  # noqa: BLE001
        log.error("Checking %s failed: %s", path.name, error)
        raise


def decide(stories: Path) -> tuple[str, list[Path], dict[str, str]]:
    """The source rule: JIRA, LOCAL, NONE or BOTH. Files downloaded from Jira count as Jira, not as local stories."""
    log.info("Deciding the user story source")
    try:
        files = [p for p in story_files(stories) if not is_jira_download(p)]
        values = read_source(stories)
        jira = source_filled(values)
        if files and jira:
            source = "BOTH"
        elif files:
            source = "LOCAL"
        elif jira:
            source = "JIRA"
        else:
            source = "NONE"
        log.info("User story source: %s", source)
        return source, files, values
    except Exception as error:  # noqa: BLE001
        log.error("Deciding the user story source failed: %s", error)
        raise


def selection_jql(values: dict[str, str]) -> str:
    """JQL for the configured selection: issue_keys, else jql, else every Story of project_key."""
    log.debug("Building the JQL")
    try:
        keys = [k.strip().upper() for k in re.split(r"[,\s]+", values.get("issue_keys", "")) if k.strip()]
        bad = [k for k in keys if not re.fullmatch(r"[A-Z][A-Z0-9_]+-\d+", k)]
        if bad:
            raise ValueError(f"issue_keys has invalid keys: {', '.join(bad)}")
        if keys:
            jql = f"key in ({', '.join(keys)}) ORDER BY key"
        elif values.get("jql"):
            jql = values["jql"]
        else:
            project = values.get("project_key", "").strip()
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]+", project):
                raise ValueError(f"project_key is not a valid project key: {project!r}")
            jql = f"project = {project} AND issuetype = Story ORDER BY key"
        log.debug("JQL: %s", jql)
        return jql
    except Exception as error:  # noqa: BLE001
        log.error("Building the JQL failed: %s", error)
        raise


def auth_header(deployment: str) -> str:
    """Authorization header from the environment; the secret is never logged."""
    log.debug("Building the Jira authorization from environment variables (%s)", deployment)
    try:
        if deployment == "server":
            pat = os.environ.get("JIRA_PAT", "")
            if not pat:
                raise RuntimeError("Set the JIRA_PAT environment variable (Jira Server / Data Center personal access token).")
            return f"Bearer {pat}"
        email, token = os.environ.get("JIRA_EMAIL", ""), os.environ.get("JIRA_API_TOKEN", "")
        if not email or not token:
            raise RuntimeError("Set the JIRA_EMAIL and JIRA_API_TOKEN environment variables (Jira Cloud API token).")
        return "Basic " + base64.b64encode(f"{email}:{token}".encode()).decode()
    except Exception as error:  # noqa: BLE001
        log.error("Jira authorization failed: %s", error)
        raise


def get_json(url: str, auth: str) -> dict:
    """GET a Jira REST URL and return the JSON body."""
    log.debug("GET %s", url)
    try:
        req = urllib.request.Request(url, headers={"Authorization": auth, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        log.debug("GET finished")
        return body
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        log.error("Jira returned HTTP %s for %s: %s", error.code, url.split("?")[0], detail)
        raise RuntimeError(f"Jira returned HTTP {error.code}: {detail}") from error
    except Exception as error:  # noqa: BLE001
        log.error("Jira request failed: %s", error)
        raise


def search(values: dict[str, str]) -> list[dict]:
    """All issues the configuration selects (Cloud: /rest/api/3/search/jql; Server: /rest/api/2/search)."""
    log.info("Searching Jira")
    try:
        base = values["base_url"].rstrip("/")
        if not base.startswith("https://"):
            raise ValueError("base_url must start with https://")
        deployment = (values.get("deployment") or "cloud").lower()
        auth = auth_header(deployment)
        fields = ["summary", "description", "issuetype", "status", "priority", "labels", "components",
                  "fixVersions", "parent", "updated"]
        if values.get("acceptance_criteria_field"):
            fields.append(values["acceptance_criteria_field"])
        params = {"jql": selection_jql(values), "fields": ",".join(fields), "maxResults": "50"}
        issues: list[dict] = []
        if deployment == "server":
            start = 0
            while True:
                page = get_json(f"{base}/rest/api/2/search?" + urllib.parse.urlencode({**params, "startAt": start}), auth)
                issues += page.get("issues", [])
                start += len(page.get("issues", []))
                if not page.get("issues") or start >= page.get("total", 0):
                    break
        else:
            token = None
            while True:
                query = {**params, **({"nextPageToken": token} if token else {})}
                page = get_json(f"{base}/rest/api/3/search/jql?" + urllib.parse.urlencode(query), auth)
                issues += page.get("issues", [])
                token = page.get("nextPageToken")
                if not token or page.get("isLast", True):
                    break
        log.info("Jira returned %d issue(s)", len(issues))
        return issues
    except Exception as error:  # noqa: BLE001
        log.error("Jira search failed: %s", error)
        raise


def adf_to_md(node, depth: int = 0) -> str:
    """Jira Cloud rich text (Atlassian Document Format) to Markdown; Server wiki text passes through."""
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    kind = node.get("type")
    kids = node.get("content", [])
    inner = "".join(adf_to_md(k, depth) for k in kids)
    if kind == "text":
        return node.get("text", "")
    if kind == "hardBreak":
        return "\n"
    if kind == "paragraph":
        return inner + "\n\n"
    if kind == "heading":
        return "#" * min(6, node.get("attrs", {}).get("level", 2) + 1) + " " + inner + "\n\n"
    if kind in ("bulletList", "orderedList"):
        lines = []
        for i, item in enumerate(kids, 1):
            text = "".join(adf_to_md(k, depth + 1) for k in item.get("content", [])).strip()
            bullet = f"{i}." if kind == "orderedList" else "-"
            lines.append("  " * depth + f"{bullet} {text}")
        return "\n".join(lines) + "\n\n"
    if kind == "codeBlock":
        return "```\n" + inner + "\n```\n\n"
    if kind == "table":
        rows = []
        for r, row in enumerate(kids):
            cells = [" ".join(adf_to_md(c).split()) for c in row.get("content", [])]
            rows.append("| " + " | ".join(cells) + " |")
            if r == 0:
                rows.append("|" + " --- |" * len(cells))
        return "\n".join(rows) + "\n\n"
    if kind == "rule":
        return "---\n\n"
    return inner


def issue_markdown(issue: dict, ac_field: str) -> str:
    """One issue as a Markdown user story, with the source marker the pipeline recognises."""
    key = issue.get("key", "")
    log.debug("Converting %s to Markdown", key)
    try:
        f = issue.get("fields", {})
        name = lambda v: (v or {}).get("name", "") if isinstance(v, dict) else ""  # noqa: E731
        parts = [
            f"{MARKER} key={key} updated={f.get('updated', '')} -->",
            f"# {key} {f.get('summary', '').strip()}",
            "",
            "| Field | Value |",
            "| --- | --- |",
            f"| Issue type | {name(f.get('issuetype'))} |",
            f"| Status | {name(f.get('status'))} |",
            f"| Priority | {name(f.get('priority'))} |",
            f"| Parent / Epic | {(f.get('parent') or {}).get('key', '')} |",
            f"| Labels | {', '.join(f.get('labels') or [])} |",
            f"| Components | {', '.join(c.get('name', '') for c in f.get('components') or [])} |",
            f"| Fix versions | {', '.join(v.get('name', '') for v in f.get('fixVersions') or [])} |",
            "",
            "## Description",
            "",
            adf_to_md(f.get("description")).strip() or "_No description in Jira._",
            "",
        ]
        if ac_field:
            parts += ["## Acceptance criteria", "", adf_to_md(f.get(ac_field)).strip() or "_Empty in Jira._", ""]
        text = "\n".join(parts) + "\n"
        log.debug("%s converted", key)
        return text
    except Exception as error:  # noqa: BLE001
        log.error("Converting %s failed: %s", key, error)
        raise


def slug(text: str) -> str:
    """File-name-safe words."""
    return re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")[:60] or "story"


def write_story(stories: Path, archive: Path, name: str, text: str, dry_run: bool) -> str:
    """Write one story file. A changed earlier Jira download goes to archive/; a hand-written file is never touched."""
    log.debug("Writing %s", name)
    try:
        path = stories / name
        if path.exists():
            old = path.read_text(encoding="utf-8", errors="replace")
            if not old.startswith(MARKER):
                log.warning("%s exists and was not downloaded from Jira; left untouched", name)
                return f"SKIPPED {name} (a file not downloaded from Jira has this name)"
            if old == text:
                return f"UNCHANGED {name}"
            if not dry_run:
                archive.mkdir(parents=True, exist_ok=True)
                stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
                shutil.move(str(path), str(archive / f"{path.stem}_{stamp}{path.suffix}"))
            action = "UPDATED"
        else:
            action = "NEW"
        if not dry_run:
            path.write_text(text, encoding="utf-8")
        log.info("%s %s", action, name)
        return f"{action} {name}" + (" (dry run)" if dry_run else "")
    except Exception as error:  # noqa: BLE001
        log.error("Writing %s failed: %s", name, error)
        raise


def cmd_status(req: Path) -> int:
    """Print the decision for the skills to act on."""
    log.info("Status of the user story source")
    try:
        source, files, values = decide(req / "user_stories")
        downloaded = [p for p in story_files(req / "user_stories") if is_jira_download(p)]
        print(f"SOURCE={source}")
        print(f"STORY_FILES={len(files)}")
        for p in files:
            print(f"  FILE {p.name}")
        print(f"JIRA_DOWNLOADS={len(downloaded)}")
        for p in downloaded:
            print(f"  DOWNLOADED {p.name}")
        print(f"JIRA_FILE={'filled' if source_filled(values) else ('empty' if values else 'missing')}")
        if values.get("base_url"):
            print(f"  JIRA {values.get('base_url')} selection: {selection_jql(values) if source_filled(values) else '-'}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Status failed: %s", error)
        print(f"ERROR {error}")
        return 2


def cmd_init(req: Path, args: argparse.Namespace) -> int:
    """Create jira-source.md from the user's answers; a filled-in file is never overwritten."""
    log.info("Creating %s", SOURCE_FILE)
    try:
        stories = req / "user_stories"
        stories.mkdir(parents=True, exist_ok=True)
        if source_filled(read_source(stories)) and not args.force:
            print(f"EXISTS {SOURCE_FILE} is already filled in; not overwritten (edit it, or pass --force after the user agreed)")
            return 1
        values = {k: (getattr(args, k) or "") for k in KEYS}
        values["deployment"] = values["deployment"] or "cloud"
        values["output"] = values["output"] or "per-issue"
        (stories / SOURCE_FILE).write_text(TEMPLATE.format(**values), encoding="utf-8")
        print(f"CREATED {stories / SOURCE_FILE}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Creating %s failed: %s", SOURCE_FILE, error)
        print(f"ERROR {error}")
        return 2


def cmd_check(req: Path) -> int:
    """Read-only connection check."""
    log.info("Checking the Jira connection")
    try:
        values = read_source(req / "user_stories")
        if not source_filled(values):
            print(f"ERROR {SOURCE_FILE} is missing or empty")
            return 2
        issues = search(values)
        print(f"OK {len(issues)} issue(s) selected: {', '.join(i.get('key', '') for i in issues[:20])}"
              + (" ..." if len(issues) > 20 else ""))
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Jira check failed: %s", error)
        print(f"ERROR {error}")
        return 2


def cmd_fetch(req: Path, dry_run: bool) -> int:
    """Download the selected issues into user_stories/."""
    log.info("Downloading user stories from Jira%s", " (dry run)" if dry_run else "")
    try:
        stories, archive = req / "user_stories", req / "archive"
        values = read_source(stories)
        if not source_filled(values):
            print(f"ERROR {SOURCE_FILE} is missing or empty")
            return 2
        issues = search(values)
        if not issues:
            print("ERROR Jira returned no issue for the selection; nothing written")
            return 2
        ac = values.get("acceptance_criteria_field", "")
        docs = [issue_markdown(i, ac) for i in issues]
        results = []
        if (values.get("output") or "per-issue") == "single":
            name = slug(values.get("document_name") or values.get("project_key") or "Jira_Stories") + ".md"
            first = f"{MARKER} keys={','.join(i.get('key', '') for i in issues)} -->\n"
            body = first + "\n".join(d.split("\n", 1)[1] for d in docs)
            results.append(write_story(stories, archive, name, body, dry_run))
        else:
            for issue, text in zip(issues, docs):
                name = f"{issue.get('key', '')}_{slug(issue.get('fields', {}).get('summary', ''))}.md"
                results.append(write_story(stories, archive, name, text, dry_run))
        for line in results:
            print(line)
        print(f"DONE {len(issues)} issue(s); files in {stories}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Download failed: %s", error)
        print(f"ERROR {error}")
        return 2


def main(argv: list[str] | None = None) -> int:
    """Command-line entry point."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--requirements", help="path to .github/_requirements (default: found from this script)")
    parser.add_argument("--verbose", action="store_true", help="debug logging")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="which source to use")
    init = sub.add_parser("init", help="create jira-source.md from the answers")
    for key in KEYS:
        init.add_argument("--" + key.replace("_", "-"), dest=key)
    init.add_argument("--force", action="store_true", help="overwrite a filled-in file (only after the user agreed)")
    sub.add_parser("check", help="read-only Jira connection check")
    fetch = sub.add_parser("fetch", help="download the stories into user_stories/")
    fetch.add_argument("--dry-run", action="store_true", help="show what would be written")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING,
                        format="%(levelname)s %(name)s: %(message)s")
    log.info("Command %s started", args.cmd)
    req = requirements_dir(args.requirements)
    if args.cmd == "status":
        return cmd_status(req)
    if args.cmd == "init":
        return cmd_init(req, args)
    if args.cmd == "check":
        return cmd_check(req)
    return cmd_fetch(req, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
