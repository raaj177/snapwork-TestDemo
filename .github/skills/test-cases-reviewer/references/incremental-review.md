# Hash-based incremental re-review

Use [review_cache.py](../scripts/review_cache.py) to reduce repeated semantic reading, not to skip review gates. The helper uses SHA-256, reads Excel with `openpyxl`, stores fingerprints only, and never modifies a source workbook. It does not perform semantic review or verify a review report.

## Preparation

- Keep one local manifest per document at `<WorkspaceRoot>/orchestration/.review-cache/<Doc>.json`. Do not share or commit this directory; it contains local evidence paths and fingerprints. Exclude `orchestration/.review-cache/` in the workspace's Git ignore rules before recording a cache. Do not copy caches into a reusable kit.
- Include every authoritative and supporting evidence file, approved BA answer, constitution, and local design/API export with repeated `--source` arguments. Save any conversational decisions affecting review into an approved local evidence file and include it. If evidence exists only in chat or a mutable remote link and cannot be fingerprinted, perform a full review and do not record a reusable cache.
- Use identical explicit scope and platform strings across revisions. The helper also hashes all Markdown, Python, JSON, and YAML files in the reviewer, generator, and review-cycle skills, including their contracts and gate configuration.
- Discover all workbook sheets as usual. The helper recognizes a `Test Case ID` header and hashes every raw value/formula in each testcase row, with its headers and sheet identity. Unsupported headers, extraction gaps, or malformed rows mean no reuse: disclose the error and do the full review.
- Caches are optimization hints, not authority. Require a previous review for the same document, independently verified under Gate 10. Do not accept a manifest from an untrusted source.

## Before every review

Run from the workspace root, replacing placeholders with actual paths:

```powershell
python ".github\skills\test-cases-reviewer\scripts\review_cache.py" plan --workbook "<current workbook.xlsx>" --source "<approved story.docx>" --scope "<resolved scope>" --platform "<selected platform>" --cache "orchestration\.review-cache\<Doc>.json"
```

Add a `--source "<path>"` for each additional evidence file. Save the returned `inputs_sha256` until the review completes; recording rejects inputs that changed after planning. The result is compact JSON:

- `mode = full`: missing cache, changed evidence/rules/scope/platform/schema, or missing/changed prior report. Run every gate without reuse. The reason is explicit.
- `mode = incremental`: review all `review_case_ids` (new or changed); remove old contributions for `removed_case_ids`; `reusable_case_ids` are candidates for reuse from the fingerprint-matched previous report, not automatically valid cases.
- A nonzero exit, malformed cache, unreadable file, missing dependency, or incomplete extraction must be surfaced. Continue with a full review only if its required evidence can still be read; otherwise stop with the evidence limitation. Never call it an incremental success.

## Safe reuse boundaries

1. Reuse an unchanged case's individual quality assessment only if the previous report actually records that assessment and its justified mappings. Missing prior detail means re-review that case. Do not reuse the generator's conclusions.
2. Resolve impacted requirements from both old and new semantic mappings of changed, added, and removed cases. Reassess those requirements using **all** their current cases, including unchanged ones. If the mapping dependency closure cannot be established, reassess all requirements.
3. Check changed/added cases against the entire current suite for semantic duplicates. Revisit affected canonical/duplicate dispositions, including unchanged cases and groups whose primary case was removed. If groups cannot be reconstructed, run the full duplicate adjudication.
4. Always inventory the complete current scope, account for every requirement, rerun schema/enum/formula checks and dashboard recounts, reconcile test-data dependencies, and recompute the full RTM, heatmap, coverage metrics, score, and verdict. Structural and data checks are never cached.
5. Always generate and verify a new version-matched review workbook and re-review delta. Do not copy a previous coverage percentage or infer that an old finding is resolved from hashes.
6. Report `Review mode: FULL / INCREMENTAL`, the fallback reason when applicable, changed/removed/reused case counts, and which dependency checks were rerun. Zero changed cases still requires the global checks above.

## After successful Gate 10 verification

Re-run with exactly the same inputs and `record`, adding the verified report:

```powershell
python ".github\skills\test-cases-reviewer\scripts\review_cache.py" record --workbook "<current workbook.xlsx>" --source "<approved story.docx>" --scope "<resolved scope>" --platform "<selected platform>" --cache "orchestration\.review-cache\<Doc>.json" --report "<new review.xlsx>" --inputs-sha256 "<value returned by plan>" --verified
```

`--verified` is the reviewer's attestation, not an automated verification result. Record only after reviewing stable inputs, confirming the workbook was unchanged, and passing Gate 10; never record a failed or incomplete review artifact. A negative review verdict is allowed if the review itself completed successfully. The manifest is replaced atomically only after the new report exists and can be hashed.

Delete scratch extractions, plan output, and intermediate JSON at cleanup. Retain only the local manifest and the normal review workbook. Deleting the manifest simply forces the next review to be full.
