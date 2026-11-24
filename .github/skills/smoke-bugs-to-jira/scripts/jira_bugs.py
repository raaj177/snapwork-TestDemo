#!/usr/bin/env python3
"""Evidence-based Jira records for smoke failures: access check, duplicate search, create, attach, verify, record.

Every write is guarded:
  - `create` searches for an existing match first and never creates a duplicate; when the result of a create is
    uncertain (timeout, connection drop, 5xx) it searches again instead of retrying blindly.
  - `create` refuses a description that looks like it holds a credential, token, OTP or personal data.
  - `attach` refuses a file unless `--reviewed` says a person or the agent looked at it, and only takes images.
  - `record` re-opens the issue, checks key, parent, assignee, description and that the screenshot downloads,
    and writes issues.json only when every check passed.

Commands (run `<command> -h` for options):
  access      project access, issue types, required fields, and the assignee's account (read-only)
  find-epic   existing epics with this exact name (read-only)
  find-bugs   existing bugs for a testcase ID (read-only)
  create      create an Epic or a Bug from a JSON spec (searches first)
  attach      upload a reviewed screenshot to an issue
  verify      re-open an issue and check it (read-only)
  record      verify, then save the issue in <AutomationDir>/Jira/issues.json

Site and deployment default to `.github/_requirements/user_stories/jira-source.md` (base_url, deployment).
Credentials come only from environment variables: JIRA_EMAIL + JIRA_API_TOKEN (Cloud) or JIRA_PAT (Server/DC).
Standard library only (Python 3.9+). Output lines start with OK / FOUND / NONE / EXISTS / CREATED / UNCERTAIN /
VERIFIED / MISMATCH / REFUSED / ERROR so a caller can act on them.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import logging
import mimetypes
import os
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

log = logging.getLogger("jira_bugs")

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
MAX_ATTACHMENT = 10 * 1024 * 1024
LABEL_SMOKE = "smoke-automation"
SECRET_PATTERNS = [
    (r"(?i)\b(password|passwd|pwd|otp|mpin|pin|token|secret|api[_-]?key|authorization|cookie)\b\s*[:=]\s*(?![`'\"]?[*<{$])[^\s,;]{3,}", "a credential-like value"),
    (r"(?i)\bbearer\s+[A-Za-z0-9._~+/-]{10,}", "a bearer token"),
    (r"(?i)\bbasic\s+[A-Za-z0-9+/=]{16,}", "a basic-auth header"),
    (r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.", "a JWT"),
    (r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "an email address"),
    (r"(?<![\d*])[6-9]\d{9}(?![\d*])", "a 10-digit mobile number"),
    (r"(?<![\d*])\d{13,19}(?![\d*])", "a card or account number"),
]


# ---------------------------------------------------------------- configuration and HTTP

def jira_source(path_arg: str | None) -> dict[str, str]:
    """base_url and deployment from jira-source.md (first value of each key, above the field notes)."""
    log.debug("Reading jira-source.md defaults")
    try:
        path = Path(path_arg) if path_arg else Path(__file__).resolve().parents[3] / "_requirements" / "user_stories" / "jira-source.md"
        values: dict[str, str] = {}
        if path.is_file():
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.strip().lower().startswith("field notes"):
                    break
                m = re.match(r"^\s*-\s*([a-z_]+)\s*:\s*(.*?)\s*$", line)
                if m and m.group(1) not in values:
                    values[m.group(1)] = m.group(2).strip().strip("`")
        log.debug("jira-source.md defaults: %s", {k: v for k, v in values.items() if k in ("base_url", "deployment")})
        return values
    except Exception as error:  # noqa: BLE001
        log.error("Reading jira-source.md failed: %s", error)
        raise


class Jira:
    """Minimal Jira REST client. Cloud uses API v3 (ADF), Server/DC API v2 (wiki text)."""

    def __init__(self, site: str, deployment: str) -> None:
        log.debug("Creating the Jira client for %s (%s)", site, deployment)
        if not site or not site.startswith("https://"):
            raise ValueError("The Jira site must be an https:// URL (--site, or base_url in jira-source.md)")
        self.site = site.rstrip("/")
        self.cloud = (deployment or "cloud").lower() != "server"
        self.api = f"{self.site}/rest/api/{'3' if self.cloud else '2'}"
        self.auth = self.auth_header()

    def auth_header(self) -> str:
        """Authorization from the environment; never logged or printed."""
        log.debug("Building the authorization from environment variables")
        try:
            if not self.cloud:
                pat = os.environ.get("JIRA_PAT", "")
                if not pat:
                    raise RuntimeError("Set JIRA_PAT (Jira Server / Data Center personal access token) in your terminal.")
                return f"Bearer {pat}"
            email, token = os.environ.get("JIRA_EMAIL", ""), os.environ.get("JIRA_API_TOKEN", "")
            if not email or not token:
                raise RuntimeError("Set JIRA_EMAIL and JIRA_API_TOKEN (Jira Cloud API token) in your terminal.")
            return "Basic " + base64.b64encode(f"{email}:{token}".encode()).decode()
        except Exception as error:  # noqa: BLE001
            log.error("Authorization failed: %s", error)
            raise

    def request(self, method: str, url: str, body: bytes | None = None, headers: dict | None = None,
                raw: bool = False, timeout: int = 60):
        """One HTTP call; returns parsed JSON (or bytes with raw=True). HTTP errors become RuntimeError."""
        log.debug("%s %s", method, url.split("?")[0])
        try:
            hdrs = {"Authorization": self.auth, "Accept": "application/json", **(headers or {})}
            req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = resp.read()
            log.debug("%s finished (%d bytes)", method, len(data))
            if raw:
                return data
            return json.loads(data.decode("utf-8")) if data else {}
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", "replace")[:400]
            log.error("Jira returned HTTP %s for %s %s", error.code, method, url.split("?")[0])
            err = RuntimeError(f"Jira returned HTTP {error.code}: {detail}")
            err.status = error.code  # type: ignore[attr-defined]
            raise err from error
        except Exception as error:  # noqa: BLE001
            log.error("%s %s failed: %s", method, url.split("?")[0], error)
            raise

    def get(self, path: str, params: dict | None = None):
        """GET an API path."""
        query = ("?" + urllib.parse.urlencode(params)) if params else ""
        return self.request("GET", f"{self.api}{path}{query}")

    def post_json(self, path: str, payload: dict):
        """POST JSON to an API path."""
        return self.request("POST", f"{self.api}{path}", json.dumps(payload).encode("utf-8"),
                            {"Content-Type": "application/json"})

    def search(self, jql: str, fields: str = "summary,status,issuetype,parent,assignee,labels") -> list[dict]:
        """All issues for a JQL query."""
        log.info("Searching Jira: %s", jql)
        try:
            issues: list[dict] = []
            if self.cloud:
                token = None
                while True:
                    params = {"jql": jql, "fields": fields, "maxResults": "50", **({"nextPageToken": token} if token else {})}
                    page = self.get("/search/jql", params)
                    issues += page.get("issues", [])
                    token = page.get("nextPageToken")
                    if not token or page.get("isLast", True):
                        break
            else:
                start = 0
                while True:
                    page = self.get("/search", {"jql": jql, "fields": fields, "maxResults": "50", "startAt": str(start)})
                    issues += page.get("issues", [])
                    start += len(page.get("issues", []))
                    if not page.get("issues") or start >= page.get("total", 0):
                        break
            log.info("Search returned %d issue(s)", len(issues))
            return issues
        except Exception as error:  # noqa: BLE001
            log.error("Search failed: %s", error)
            raise

    def browse(self, key: str) -> str:
        """Human URL of an issue."""
        return f"{self.site}/browse/{key}"


def jql_text(value: str) -> str:
    """A JQL string literal."""
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def tc_label(testcase_id: str) -> str:
    """The label that ties a bug to one testcase ID (used to find duplicates)."""
    if not re.fullmatch(r"TC_[A-Za-z0-9_]+", testcase_id or ""):
        raise ValueError(f"Not a testcase ID: {testcase_id!r}")
    return testcase_id.lower().replace("_", "-")  # TC_US002_001 -> tc-us002-001


# ---------------------------------------------------------------- description conversion and checks

def inline_adf(text: str) -> list[dict]:
    """**bold** and `code` to ADF text nodes."""
    nodes = []
    for part in re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            nodes.append({"type": "text", "text": part[2:-2], "marks": [{"type": "strong"}]})
        elif part.startswith("`") and part.endswith("`"):
            nodes.append({"type": "text", "text": part[1:-1], "marks": [{"type": "code"}]})
        else:
            nodes.append({"type": "text", "text": part})
    return nodes


def md_to_adf(md: str) -> dict:
    """The Markdown subset of the bug template (## headings, 1. / - lists, ``` code, paragraphs) to ADF."""
    log.debug("Converting the description to ADF")
    blocks: list[dict] = []
    lines = md.replace("\r\n", "\n").split("\n")
    i, para = 0, []

    def flush() -> None:
        if para:
            content: list[dict] = []
            for n, line in enumerate(para):
                if n:
                    content.append({"type": "hardBreak"})
                content += inline_adf(line)
            blocks.append({"type": "paragraph", "content": content})
            para.clear()

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            flush()
            code, i = [], i + 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            if "\n".join(code).strip():
                blocks.append({"type": "codeBlock", "content": [{"type": "text", "text": "\n".join(code)}]})
        elif m := re.match(r"^(#{1,6})\s+(.*)$", line):
            flush()
            blocks.append({"type": "heading", "attrs": {"level": min(6, len(m.group(1)))}, "content": inline_adf(m.group(2))})
        elif re.match(r"^\s*(\d+\.|[-*])\s+", line):
            flush()
            ordered = bool(re.match(r"^\s*\d+\.", line))
            items = []
            while i < len(lines) and re.match(r"^\s*(\d+\.|[-*])\s+", lines[i]) and bool(re.match(r"^\s*\d+\.", lines[i])) == ordered:
                text = re.sub(r"^\s*(\d+\.|[-*])\s+", "", lines[i])
                items.append({"type": "listItem", "content": [{"type": "paragraph", "content": inline_adf(text) or [{"type": "text", "text": " "}]}]})
                i += 1
            blocks.append({"type": "orderedList" if ordered else "bulletList", "content": items})
            continue
        elif not line.strip():
            flush()
        else:
            para.append(line)
        i += 1
    flush()
    return {"type": "doc", "version": 1, "content": blocks}


def md_to_wiki(md: str) -> str:
    """The same Markdown subset to Jira Server wiki markup."""
    log.debug("Converting the description to wiki markup")
    out = []
    for line in md.replace("\r\n", "\n").split("\n"):
        if line.strip().startswith("```"):
            out.append("{code}")
            continue
        line = re.sub(r"\*\*([^*]+)\*\*", r"*\1*", line)
        line = re.sub(r"`([^`]+)`", r"{{\1}}", line)
        if m := re.match(r"^(#{1,6})\s+(.*)$", line):
            out.append(f"h{len(m.group(1))}. {m.group(2)}")
        elif m := re.match(r"^\s*\d+\.\s+(.*)$", line):
            out.append(f"# {m.group(1)}")
        elif m := re.match(r"^\s*[-*]\s+(.*)$", line):
            out.append(f"* {m.group(1)}")
        else:
            out.append(line)
    return "\n".join(out)


def sensitive_findings(text: str) -> list[str]:
    """What in the text looks like a credential, token or personal data."""
    log.debug("Scanning text for sensitive values")
    found = []
    for pattern, what in SECRET_PATTERNS:
        for m in re.finditer(pattern, text):
            sample = m.group(0)
            found.append(f"{what}: '{sample[:4]}…' at character {m.start()}")
    log.debug("Sensitive findings: %d", len(found))
    return found


# ---------------------------------------------------------------- commands

def cmd_access(jira: Jira, args) -> int:
    """Project access, issue types, required fields of Epic and Bug, and the assignee's account."""
    log.info("Checking access to project %s", args.project)
    try:
        me = jira.get("/myself")
        print(f"OK signed in as {me.get('displayName', '?')}")
        project = jira.get(f"/project/{urllib.parse.quote(args.project)}")
        print(f"OK project {project.get('key')} - {project.get('name')}")
        if jira.cloud:
            types = jira.get(f"/issue/createmeta/{urllib.parse.quote(args.project)}/issuetypes").get("issueTypes", [])
            names = {t.get("name"): t.get("id") for t in types}
        else:
            meta = jira.get("/issue/createmeta", {"projectKeys": args.project, "expand": "projects.issuetypes.fields"})
            ptypes = (meta.get("projects") or [{}])[0].get("issuetypes", [])
            names = {t.get("name"): t.get("id") for t in ptypes}
        print(f"OK issue types: {', '.join(sorted(names))}")
        for wanted in ("Epic", "Bug"):
            if wanted not in names:
                print(f"MISSING issue type {wanted} in {args.project}")
                continue
            if jira.cloud:
                fields = jira.get(f"/issue/createmeta/{urllib.parse.quote(args.project)}/issuetypes/{names[wanted]}").get("fields", [])
                required = [f"{f.get('name')} ({f.get('fieldId')})" for f in fields if f.get("required") and not f.get("hasDefaultValue")]
            else:
                tfields = next(t for t in ptypes if t.get("name") == wanted).get("fields", {})
                required = [f"{v.get('name')} ({k})" for k, v in tfields.items() if v.get("required") and not v.get("hasDefaultValue")]
            print(f"OK required fields for {wanted}: {', '.join(required) or 'none beyond the defaults'}")
        if args.assignee:
            key = "query" if jira.cloud else "username"
            users = jira.get("/user/assignable/search", {"project": args.project, key: args.assignee})
            exact = [u for u in users if (u.get("displayName") or "").strip().lower() == args.assignee.strip().lower()]
            if len(exact) == 1:
                ident = exact[0].get("accountId") if jira.cloud else exact[0].get("name")
                print(f"OK assignee {exact[0].get('displayName')} id={ident}")
            else:
                listing = "; ".join(u.get("displayName", "?") for u in users[:10]) or "no assignable user matched"
                print(f"AMBIGUOUS assignee '{args.assignee}': {len(exact)} exact match(es). Candidates: {listing}")
                return 3
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Access check failed: %s", error)
        print(f"ERROR {error}")
        return 2


def cmd_find_epic(jira: Jira, args) -> int:
    """Epics whose summary equals the name (case-insensitive)."""
    log.info("Looking for epic '%s' in %s", args.name, args.project)
    try:
        issues = jira.search(f"project = {args.project} AND issuetype = Epic AND summary ~ {jql_text(args.name)}")
        exact = [i for i in issues if (i["fields"].get("summary") or "").strip().lower() == args.name.strip().lower()]
        for i in exact:
            print(f"FOUND {i['key']} {jira.browse(i['key'])} status={i['fields'].get('status', {}).get('name')}")
        if not exact:
            print("NONE no epic with that exact name")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Epic search failed: %s", error)
        print(f"ERROR {error}")
        return 2


def bug_duplicates(jira: Jira, project: str, testcase_id: str, summary: str = "") -> list[dict]:
    """Bugs already filed for this testcase (by label, or the testcase ID in the summary)."""
    log.info("Looking for existing bugs for %s", testcase_id)
    try:
        jql = (f"project = {project} AND issuetype = Bug AND (labels = {jql_text(tc_label(testcase_id))} "
               f"OR summary ~ {jql_text(testcase_id)})")
        found = jira.search(jql)
        if summary:
            same = [i for i in found if (i["fields"].get("summary") or "").strip().lower() == summary.strip().lower()]
            found = same or found
        log.info("Existing bugs for %s: %d", testcase_id, len(found))
        return found
    except Exception as error:  # noqa: BLE001
        log.error("Duplicate search failed: %s", error)
        raise


def cmd_find_bugs(jira: Jira, args) -> int:
    """Existing bugs for a testcase ID."""
    log.info("Finding bugs for %s", args.testcase)
    try:
        found = bug_duplicates(jira, args.project, args.testcase)
        for i in found:
            f = i["fields"]
            print(f"FOUND {i['key']} {jira.browse(i['key'])} status={f.get('status', {}).get('name')} "
                  f"parent={(f.get('parent') or {}).get('key', '-')} summary={f.get('summary')}")
        if not found:
            print(f"NONE no bug found for {args.testcase}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Finding bugs failed: %s", error)
        print(f"ERROR {error}")
        return 2


def build_fields(jira: Jira, spec: dict) -> dict:
    """Jira create payload fields from a spec."""
    log.debug("Building the create payload for a %s", spec.get("issuetype"))
    fields: dict = {
        "project": {"key": spec["project"]},
        "issuetype": {"name": spec["issuetype"]},
        "summary": spec["summary"].strip(),
        "description": md_to_adf(spec["description_md"]) if jira.cloud else md_to_wiki(spec["description_md"]),
        "labels": sorted(set(spec.get("labels", []))),
    }
    if spec.get("assignee"):
        fields["assignee"] = {"accountId": spec["assignee"]} if jira.cloud else {"name": spec["assignee"]}
    if spec.get("priority"):
        fields["priority"] = {"name": spec["priority"]}
    if spec.get("parent"):
        if jira.cloud:
            fields["parent"] = {"key": spec["parent"]}
        elif spec.get("epic_link_field"):
            fields[spec["epic_link_field"]] = spec["parent"]
        else:
            raise ValueError("Jira Server needs epic_link_field (the Epic Link custom field ID) in the spec to set the epic")
    fields.update(spec.get("extra_fields", {}))
    return fields


def validate_spec(spec: dict) -> list[str]:
    """Problems that stop a create."""
    log.debug("Validating the spec")
    problems = []
    for key in ("project", "issuetype", "summary", "description_md"):
        if not str(spec.get(key, "")).strip():
            problems.append(f"missing {key}")
    if spec.get("issuetype") not in ("Epic", "Bug"):
        problems.append("issuetype must be Epic or Bug")
    if spec.get("issuetype") == "Bug":
        if not spec.get("testcase_id"):
            problems.append("a Bug needs testcase_id")
        if not spec.get("parent"):
            problems.append("a Bug needs parent (the epic key)")
        if not spec.get("assignee"):
            problems.append("a Bug needs assignee (the verified account id from `access --assignee`)")
    text = f"{spec.get('summary', '')}\n{spec.get('description_md', '')}"
    problems += [f"sensitive content - {f}" for f in sensitive_findings(text)]
    return problems


def cmd_create(jira: Jira, args) -> int:
    """Create an Epic or Bug after a duplicate search; on an uncertain result, search again instead of retrying."""
    log.info("Create requested from %s", args.spec)
    try:
        spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
        problems = validate_spec(spec)
        if problems:
            for p in problems:
                print(f"REFUSED {p}")
            return 3
        if spec["issuetype"] == "Bug":
            spec.setdefault("labels", [])
            spec["labels"] += [LABEL_SMOKE, tc_label(spec["testcase_id"])]
            existing = bug_duplicates(jira, spec["project"], spec["testcase_id"], spec["summary"])
        else:
            existing = [i for i in jira.search(f"project = {spec['project']} AND issuetype = Epic AND summary ~ {jql_text(spec['summary'])}")
                        if (i["fields"].get("summary") or "").strip().lower() == spec["summary"].strip().lower()]
        if existing:
            for i in existing:
                print(f"EXISTS {i['key']} {jira.browse(i['key'])} summary={i['fields'].get('summary')}")
            print("REFUSED not created: a matching issue exists. Reuse it, or pass --allow-duplicate after the user decided a new one is needed"
                  if not args.allow_duplicate else "NOTE creating anyway (--allow-duplicate)")
            if not args.allow_duplicate:
                return 3
        fields = build_fields(jira, spec)
        if args.dry_run:
            print("DRY-RUN payload:")
            print(json.dumps({"fields": fields}, indent=2)[:4000])
            return 0
        try:
            created = jira.post_json("/issue", {"fields": fields})
        except (socket.timeout, urllib.error.URLError, TimeoutError, ConnectionError) as error:
            return uncertain(jira, spec, f"no response ({error})")
        except RuntimeError as error:
            if getattr(error, "status", 0) >= 500:
                return uncertain(jira, spec, str(error))
            raise
        key = created.get("key")
        print(f"CREATED {key} {jira.browse(key)}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Create failed: %s", error)
        print(f"ERROR {error}")
        return 2


def uncertain(jira: Jira, spec: dict, reason: str) -> int:
    """After an uncertain create: search; report what exists, never retry automatically."""
    log.warning("Create result uncertain (%s); searching before any retry", reason)
    try:
        if spec["issuetype"] == "Bug":
            found = bug_duplicates(jira, spec["project"], spec["testcase_id"], spec["summary"])
        else:
            found = [i for i in jira.search(f"project = {spec['project']} AND issuetype = Epic AND summary ~ {jql_text(spec['summary'])}")
                     if (i["fields"].get("summary") or "").strip().lower() == spec["summary"].strip().lower()]
        if found:
            for i in found:
                print(f"CREATED {i['key']} {jira.browse(i['key'])} (found after an uncertain response: {reason})")
            return 0
        print(f"UNCERTAIN create did not answer ({reason}) and no matching issue was found. Search again before any retry.")
        return 4
    except Exception as error:  # noqa: BLE001
        log.error("Search after an uncertain create failed: %s", error)
        print(f"UNCERTAIN create did not answer ({reason}) and the follow-up search failed ({error}). Do not retry; check Jira by hand.")
        return 4


def cmd_attach(jira: Jira, args) -> int:
    """Upload one reviewed image to an issue."""
    log.info("Attaching %s to %s", args.file, args.issue)
    try:
        path = Path(args.file)
        if not args.reviewed:
            print("REFUSED open and review the screenshot first (no credentials, OTPs, tokens, personal data, "
                  "notifications or unrelated apps visible), then pass --reviewed")
            return 3
        if path.suffix.lower() not in IMAGE_EXT or not path.is_file():
            print(f"REFUSED only an existing image file ({', '.join(sorted(IMAGE_EXT))}) can be attached")
            return 3
        data = path.read_bytes()
        if len(data) > MAX_ATTACHMENT:
            print(f"REFUSED {path.name} is larger than {MAX_ATTACHMENT // (1024 * 1024)} MB")
            return 3
        boundary = uuid.uuid4().hex
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
                f"Content-Type: {ctype}\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
        result = jira.request("POST", f"{jira.api}/issue/{args.issue}/attachments", body,
                              {"Content-Type": f"multipart/form-data; boundary={boundary}", "X-Atlassian-Token": "no-check"},
                              timeout=180)
        for att in result if isinstance(result, list) else [result]:
            print(f"ATTACHED {args.issue} id={att.get('id')} file={att.get('filename')} size={att.get('size')}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Attach failed: %s", error)
        print(f"ERROR {error}")
        return 2


def check_issue(jira: Jira, key: str, parent: str | None, assignee: str | None, attachment: str | None) -> tuple[bool, dict]:
    """Re-open an issue and check parent, assignee, description and the attachment's bytes."""
    log.info("Verifying %s", key)
    try:
        issue = jira.get(f"/issue/{key}", {"fields": "summary,issuetype,parent,assignee,description,attachment,status,labels"})
        f = issue.get("fields", {})
        ok, facts = True, {"key": issue.get("key"), "url": jira.browse(issue.get("key", key)),
                           "summary": f.get("summary"), "type": (f.get("issuetype") or {}).get("name"),
                           "status": (f.get("status") or {}).get("name"), "labels": f.get("labels", [])}
        print(f"VERIFIED key {issue.get('key')}" if issue.get("key") == key else f"MISMATCH key {issue.get('key')} != {key}")
        ok &= issue.get("key") == key
        if parent:
            got = (f.get("parent") or {}).get("key")
            ok &= got == parent
            facts["parent"] = got
            print(f"{'VERIFIED' if got == parent else 'MISMATCH'} parent {got} (expected {parent})")
        if assignee:
            a = f.get("assignee") or {}
            got = a.get("accountId") if jira.cloud else a.get("name")
            ok &= got == assignee
            facts["assignee"] = a.get("displayName")
            print(f"{'VERIFIED' if got == assignee else 'MISMATCH'} assignee {a.get('displayName', 'unassigned')}")
        has_desc = bool(f.get("description"))
        ok &= has_desc
        print(f"{'VERIFIED' if has_desc else 'MISMATCH'} description {'present' if has_desc else 'empty'}")
        if attachment:
            att = next((a for a in f.get("attachment", []) if a.get("filename") == attachment), None)
            if not att:
                ok = False
                print(f"MISMATCH attachment {attachment} not on the issue")
            else:
                content = jira.request("GET", att["content"], raw=True, headers={"Accept": "*/*"}, timeout=180)
                same = len(content) == int(att.get("size", -1)) and len(content) > 0
                ok &= same
                facts["attachment"] = {"filename": attachment, "id": att.get("id"), "size": att.get("size"), "downloaded_bytes": len(content)}
                print(f"{'VERIFIED' if same else 'MISMATCH'} attachment {attachment} downloads ({len(content)} of {att.get('size')} bytes)")
        log.info("Verification of %s: %s", key, "passed" if ok else "failed")
        return ok, facts
    except Exception as error:  # noqa: BLE001
        log.error("Verification of %s failed: %s", key, error)
        raise


def cmd_verify(jira: Jira, args) -> int:
    """Read-only verification."""
    try:
        ok, _ = check_issue(jira, args.issue, args.parent, args.assignee, args.attachment)
        return 0 if ok else 5
    except Exception as error:  # noqa: BLE001
        print(f"ERROR {error}")
        return 2


BUG_META_FIELDS = ("testCaseIds", "priority", "environment", "applicationImpacted", "layer", "impact", "classification",
                   "workbook", "worksheet", "worksheetRow", "businessRule", "observedAt")


def empty_issues_doc() -> dict:
    """The issues.json skeleton automation-setup creates in <AutomationDir>/Jira/."""
    log.debug("Creating an empty issues.json document")
    return {"application": None, "projectKey": None, "baseUrl": None, "recordedOn": None, "assigneeDisplayName": None,
            "epic": None, "bugs": [], "notes": []}


def bug_entry(facts: dict, meta: dict, folder: Path) -> dict:
    """One bug in the issues.json layout: Jira facts verified just now, plus the testcase/triage meta."""
    log.debug("Building the issues.json entry for %s", facts.get("key"))
    try:
        entry = {"key": facts["key"], "parentKey": facts.get("parent"), "summary": facts["summary"], "url": facts["url"]}
        for field in BUG_META_FIELDS:
            if field in meta:
                entry[field] = meta[field]
        att = facts.get("attachment")
        if att:
            local = meta.get("attachmentLocalPath")
            entry["attachment"] = {
                "filename": att["filename"],
                "localPathRelativeToJiraFolder": os.path.relpath(Path(local).resolve(), folder.resolve()) if local else None,
                "persistedAndOpenedInJira": att.get("downloaded_bytes", 0) == int(att.get("size") or -1) > 0,
            }
        entry["verifiedAt"] = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return entry
    except Exception as error:  # noqa: BLE001
        log.error("Building the issues.json entry failed: %s", error)
        raise


def cmd_record(jira: Jira, args) -> int:
    """Verify, then add or update the issue in issues.json (only verified issues are saved)."""
    log.info("Recording %s in %s", args.issue, args.jira_dir)
    try:
        meta = json.loads(Path(args.meta).read_text(encoding="utf-8")) if args.meta else {}
        problems = sensitive_findings(json.dumps(meta))
        if problems:
            for p in problems:
                print(f"REFUSED meta has sensitive content - {p}")
            return 3
        ok, facts = check_issue(jira, args.issue, args.parent, args.assignee, args.attachment)
        if not ok:
            print(f"REFUSED {args.issue} not recorded: verification failed (fix the issue in Jira, then record again)")
            return 5
        folder = Path(args.jira_dir)
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / "issues.json"
        doc = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else empty_issues_doc()
        doc["baseUrl"] = jira.site
        doc["recordedOn"] = dt.date.today().isoformat()
        if facts.get("assignee"):
            doc["assigneeDisplayName"] = facts["assignee"]
        for key in ("application", "projectKey"):
            if meta.get(key):
                doc[key] = meta[key]
        if facts.get("type") == "Epic":
            doc["epic"] = {"key": facts["key"], "summary": facts["summary"], "url": facts["url"]}
        else:
            doc["bugs"] = [b for b in doc.get("bugs", []) if b.get("key") != facts["key"]] + [bug_entry(facts, meta, folder)]
            doc["bugs"].sort(key=lambda b: b.get("key", ""))
        if meta.get("note") and meta["note"] not in doc.setdefault("notes", []):
            doc["notes"].append(meta["note"])
        path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"RECORDED {facts['key']} in {path}")
        return 0
    except Exception as error:  # noqa: BLE001
        log.error("Record failed: %s", error)
        print(f"ERROR {error}")
        return 2


def main(argv: list[str] | None = None) -> int:
    """Command-line entry point."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--site", help="Jira site URL (default: base_url in jira-source.md)")
    p.add_argument("--deployment", choices=["cloud", "server"], help="default: deployment in jira-source.md, else cloud")
    p.add_argument("--jira-source", help="path to jira-source.md (default: .github/_requirements/user_stories/jira-source.md)")
    p.add_argument("--verbose", action="store_true")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("access"); a.add_argument("--project", required=True); a.add_argument("--assignee", help="exact Jira display name")
    e = sub.add_parser("find-epic"); e.add_argument("--project", required=True); e.add_argument("--name", required=True)
    b = sub.add_parser("find-bugs"); b.add_argument("--project", required=True); b.add_argument("--testcase", required=True)
    c = sub.add_parser("create"); c.add_argument("--spec", required=True); c.add_argument("--dry-run", action="store_true")
    c.add_argument("--allow-duplicate", action="store_true", help="only after the user decided a separate issue is needed")
    t = sub.add_parser("attach"); t.add_argument("--issue", required=True); t.add_argument("--file", required=True)
    t.add_argument("--reviewed", action="store_true", help="the image was opened and checked for sensitive content")
    for name in ("verify", "record"):
        v = sub.add_parser(name); v.add_argument("--issue", required=True); v.add_argument("--parent")
        v.add_argument("--assignee", help="expected account id (Cloud) or user name (Server)"); v.add_argument("--attachment", help="expected file name")
        if name == "record":
            v.add_argument("--jira-dir", required=True, help="<AutomationDir>/Jira")
            v.add_argument("--meta", help="JSON with testcase, workbook, evidence and triage fields to store")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
    log.info("Command %s started", args.cmd)
    try:
        src = jira_source(args.jira_source)
        jira = Jira(args.site or src.get("base_url", ""), args.deployment or src.get("deployment", "cloud"))
    except Exception as error:  # noqa: BLE001
        print(f"ERROR {error}")
        return 2
    handlers = {"access": cmd_access, "find-epic": cmd_find_epic, "find-bugs": cmd_find_bugs, "create": cmd_create,
                "attach": cmd_attach, "verify": cmd_verify, "record": cmd_record}
    return handlers[args.cmd](jira, args)


if __name__ == "__main__":
    sys.exit(main())
