# Test Data Sources: Local Overrides, Workbook Values and Synthetic Fallback

Applies to every framework (Mobile, Web, each framework of Mobile + Web). Built at bootstrap as tooling and tests only: no real data, no workbook values, no generated values are written by the bootstrap. Every function follows "Method rules" (no `private`, every method logs start, finish and `describeError` on failure, then rethrows).

## 1. Where a value comes from

For a field a test asks for, the first source that has it wins:

| Order | Source | Notes |
| ----- | ------ | ----- |
| 1 | **Local test data** (`test-data.local.json`, Git-ignored) | private QA data of one machine; overrides single fields only |
| 2 | **Shared test data** (`test-data.json` / `<TEST_DATA_DIR>/<env>.json`) and its `{{env:NAME}}` / `passwordEnv` references | committed; never holds a secret value, only the variable name |
| 3 | **The workbook row's Test Data cell**, only when it holds exactly one explicitly mapped value for that field | opt-in per testcase (section 3) |
| 4 | **Synthetic value (Faker)**, only when that Test Data cell is **blank** | opt-in per testcase, and only for fields with a mapped generator (section 4) |

- Sources 1 and 2 are the normal path for every test (`fixtures.user(key)`, `fixtures.value(key)`). Sources 3 and 4 are reached only through `resolveTestValue(...)` (section 3) from a testcase that opted in; they are **not** a framework-wide fallback, and a fixture lookup that finds nothing still fails as before.
- A nonblank cell that is ambiguous or descriptive (`valid customer id`, `any registered user`, two values, a label that is not mapped) is never guessed and never replaced by a synthetic value: the test throws `BlockedError` naming the testcase and the cell.
- A missing workbook, a missing row (ID + exact title), or a missing `Test Data` header is an **error** (the test fails with that message): it is a setup problem, not a product result.

## 2. Local test data (`test-data.local.json`)

- **Location:** next to the shared file it overrides. Mobile only (flat): `src/data/test-data.local.json`. Shared format (Web only, Mobile + Web): `<TEST_DATA_DIR>/test-data.local.json`, one file for every environment; its sections mirror the shared file (`common`, `overrides.web|android|ios`) and may add an `environments.<env>` section applied last for that `TEST_ENV` only.
- **Committed example:** `test-data.local.example.json` beside it, with the empty structure only (no users, no values). The developer copies it to `test-data.local.json`.
- **Git:** `.gitignore` has `test-data.local.json` (pattern matching at any depth). Bootstrap check: `git check-ignore` reports it ignored. The file is never committed, attached, zipped, uploaded or pasted, and never printed.
- **Optional:** when the file does not exist, the shared data is used unchanged and one `info` line says so. CI normally has no local file.
- **Same schema:** it is validated with the same JSON Schema (zod `fromJSONSchema`) in its override form (`userOverride`, `overrideSection`): every field optional, unknown fields rejected. Invalid JSON or a schema error stops the run before a session, naming the file and the field path, **never the value**.
- **Field-level merge:** the service merges, in order, shared `common` → shared platform override → local `common` → local platform override → local `environments.<TEST_ENV>`. A later layer replaces only the fields it sets; for a user, only that user's fields. Arrays are replaced whole. A field the local file does not set keeps the shared value, including its `{{env:NAME}}` reference, which is still resolved from the environment when used.
- **Secrets stay in the environment:** passwords, OTPs, PINs and API keys are still never stored as values; the local file, like the shared one, only names the variable (`passwordEnv`), and the value lives in `.env` (Git-ignored) or the CI credential store. The local file holds private, non-secret QA data such as a test account's username, customer ID or mobile number.
- **Redaction:** on load, every string value that came from the local file is registered with the `Redactor` (`registerSensitive(value)`), so logs, per-test `Logger` attachments, Allure text attachments, page sources, the results CSV, Jira text and presentation reports (`report:share`, the per-run reports of `npm run smoke` / `npm run regression`) show `***` instead. Identifiers are logged only through `maskValue(...)`. The service logs how many fields the local file overrode and which keys, never the values.

## 3. Workbook Test Data cell (opt-in, explicitly mapped)

`src/services/test-value.service.ts` exports `resolveTestValue({ testCaseId, title, field, specFile })`, used only by testcases that opted in for that field. It:

1. Returns the local or shared value when one exists (section 1, orders 1 and 2), and logs the source.
2. Otherwise reads the workbook: the regression spec's folder name is the workbook's file name without `.xlsx` (`src/tests/regression/<WorkbookFolder>/...`, see the traceability contract), resolved to `testcase/Testcases/<WorkbookFolder>.xlsx` with the same safe-path rules as `workbook-commands.md`. It uses the **project's one workbook reader** (the one `smoke:generate` and `scripts/run/` use), never a second parser. The row is found by **ID and exact title**; the `Test Data` column by its header.
3. Parses the cell against the field's **explicit label map** in `src/data/synthetic-data.ts` (for example field `customerId` ↔ labels `Customer ID`, `Cust ID`). A cell value is "explicitly mapped" only as `<mapped label>: <value>` (or `=`), once, for that field. That value is returned.
4. A blank cell (empty or whitespace only) falls through to the synthetic generator (section 4).
5. Anything else throws `BlockedError('<ID>: Test Data cell for <field> is not one mapped value: <reason>')` with the cell text passed through the `Redactor`.

Values from the workbook are registered with the `Redactor` like local values and logged with `maskValue`.

## 4. Synthetic fallback (`@faker-js/faker`)

- Dependency: `@faker-js/faker`, pinned like every other dependency, part of the one install the user approves.
- `src/data/synthetic-data.ts` holds an explicit map from field name to generator. Each generator builds a value **from the requirement's rules** (length, allowed characters, prefix, format), written in a comment with the requirement reference; no generator for a field means no fallback (an error naming the field).
- Faker is seeded per call from a hash of the testcase ID and field (`faker.seed(...)`), so a rerun of the same testcase gets the same value and failures are reproducible; the seed is logged, the value only through `maskValue`.
- Synthetic values are only for testcases whose outcome does **not** depend on the value existing in the system: format and field-behaviour checks, input validation without submitting, masking, length limits.
- **Never generated:** credentials (passwords, PINs), OTPs, tokens, real or registered contacts (mobile numbers, emails, addresses that may belong to a person), account or card numbers that could be real, values the back end must recognise, and **exact expected values** (expected results come from the requirement and the workbook, never from Faker). A request for such a field throws an error.
- The test records the source in its Actual Result or Automation Remark (`synthetic Customer ID (format per <requirement>)`), never the value.

## 5. Device-free tests (`npm run test-data:test`)

Node's built-in `node --test` (or the project's existing unit-test runner), fixtures under `src/services/__tests__/` (small generated `.xlsx` files, fake values only):

- no local file → shared data unchanged, one info line;
- local file overrides one field of one user; the user's other fields and every other user keep the shared values, and a shared `{{env:NAME}}` field is still resolved from the environment;
- local platform override and `environments.<env>` applied in order;
- malformed JSON and an unknown field each stop with the file and field path, and the error text does not contain the value;
- every local value is redacted by `Redactor.redact` afterwards;
- workbook fallback: one mapped value is returned; blank cell → synthetic value, identical for the same testcase ID and field across two calls, matching the generator's format; descriptive cell, two values and an unmapped label → `BlockedError`; missing workbook, row (ID + title) and `Test Data` header → error;
- Faker is never called when local or shared data has the field; a forbidden field (password, OTP) → error.

Bootstrap validation runs these with typecheck and lint. No device or browser is needed.
