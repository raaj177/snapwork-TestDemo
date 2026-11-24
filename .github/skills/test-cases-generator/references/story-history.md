# Story History Registry & Delta Impact (QA-DELTA-001)

Load only when a Story ID is supplied and `history_registry.py lookup` finds it. For `Brownfield — Existing App, From Scratch`, test cases for the updated user story are generated from scratch while copying the rest of the designated test bank as-is. Purpose: reuse prior knowledge without duplicating unchanged rows, and generate only the delta. Does not weaken readiness, COPILOT, traceability, scoring, or human approval (rules R31–R36).

## Project-context source rule
Before registry lookup, inspect any accessible project knowledge/context for the same Story ID or semantically matching feature. In Claude Projects, Project Context is an authoritative comparison source when available. Match Story ID first, then module/feature and AC/business-rule semantics. Never claim context review when the host does not expose it.

## Commands
```bash
python scripts/history_registry.py lookup   --registry assets/story_history_registry.json --story-id US-101
python scripts/history_registry.py compare  --registry assets/story_history_registry.json --story-id US-101 --story current_story.txt
python scripts/history_registry.py baseline --registry assets/story_history_registry.json --story-id US-101 --story current_story.txt --version 1.1 --tests cases.json --approved
```
`compare` reports hash change only; semantic impact is QA work. `baseline` refuses without `--approved` (Human QA sign-off).

## COPILOT contract
**C** last Human-QA-approved baseline + current story/AC/rules. **O** detect meaningful delta and test impact; reuse unchanged, design only new/modified/impacted. **P** Senior QA Change Impact Analyst. **I** mandatory: Story ID, current story, ACs, rules, registry entry; supporting: approved scenarios/tests, API/design/NFR/security changes, defects, release context. **L** below. **O** output below. **T** `Story ID → AC/Rule → Delta → Scenario/Test impact → Disposition`; no delta test without source traceability.

## Logic boundaries
1. Text difference ≠ behavior difference.
2. Never rewrite an Existing case. Retain it as-is.
3. Never silently delete tests for removed requirements → `invalidated`.
4. Compare against the last Human-QA-approved baseline only.
5. Requirement delta: `UNCHANGED` · `ADDED` · `MODIFIED` · `REMOVED` · `IMPACTED` (text same, shared rule/role/API/state/NFR changed) · `NO_MEANINGFUL_CHANGE`.
6. Test disposition is the Brownfield Test Case Type: `existing` · `modified` · `invalidated` · `new`. `BLOCKED` stays a Source Type when the expected result is unknown, not a fifth disposition.
7. Local registry missing/unreliable → `HISTORY UNAVAILABLE`; first check accessible Claude Project Context / Codex / ChatGPT / Cursor / Cloud Agent context for a matching prior story. If reliable prior context exists, perform semantic delta from that context instead of full regeneration. Full governed generation is for Greenfield, for `Brownfield — Existing App, From Scratch`, or when no reliable prior context exists. The from-scratch brownfield mode always generates the complete set from the provided requirements and does not use this delta.
8. Duplicate-check against the approved bank before any `NEW`.
9. Preserve Working AC ID governance and source text.
10. Only Human-QA-approved results update history; append change history, never overwrite.

Impact scan for a changed item: ACs, rules/validations/boundaries, roles, states, API/integration contracts, shared dependencies, security/NFR/compliance, defect/regression links. Skip detailed rescans of ACs whose fingerprint and dependencies are unchanged; still run a lightweight global duplicate/traceability pass.

## Output
1. **History Lookup** — Story ID, baseline found, version/hash/date, previous approved TC count.
2. **Requirement Delta Register** — | Item ID | Previous Ref | Current Ref | Delta Type | Change Summary | Impact |
3. **Test Impact Register** — | Existing TC | Requirement Ref | Disposition | Reason | Required Action |
4. **New Coverage Needed** — | New/Changed Ref | Scenario Needed | Risk | Priority | Source Type |
5. **Summary** — Existing, Modified, Invalidated, New; counts Previous / Updated (Existing + Modified + New); requirement questions; human approval status.

Then route the revision through the normal Generate gates. Follow the Brownfield story-update rule in SKILL.md.

## Registry record (minimum fields)
`story_id`, `current_version`, `requirement_hash`, `approved_requirement_snapshot`, `acceptance_criteria` (per-AC fingerprints), `business_rules`, `scenario_ids`, `test_case_ids`, `test_case_count`, `approved_test_case_count`, `blocked_test_count`, `coverage_status`, `regression_candidates`, `automation_candidates`, `requirement_questions`, `last_approved_at`, `change_history`. Preserve where available: AC ID + AC ID Type (SOURCE ID / WORKING ID) + AC Source Text + Approval Status, Business Rule ID, Scenario ID, Test Case ID, Test Level/Type, Source Type, Priority/Risk, regression and automation classification/status, review status, execution evidence. Working IDs are never promoted to source IDs without the human owner's approval. Story ID missing → request it; proceed without history only if the user accepts.
