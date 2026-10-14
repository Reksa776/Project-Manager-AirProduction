# MIGRATION SNAPSHOT INVENTORY — Google Sheets (P0D-2A)

> **ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).** The historical
> source inventory is no longer a prerequisite; the `BLOCKED ON SOURCE ACCESS`
> status is preserved as historical evidence. The tooling described here stays in
> the repository (archived, not deleted) and must not be invoked as part of the
> runtime.

**Phase:** P0D-2A — real source snapshot & reconciliation gate (read-only).
**Status of the real source inventory: BLOCKED ON SOURCE ACCESS** — see §3.
**Nothing in this document was imported, written, formatted, or deleted.**

Implementation:

| Concern | Module |
| --- | --- |
| Pure snapshot build/validate/fingerprint/compare | `src/migration/source/{types,snapshot,sanitize,index}.ts` |
| Sanitisation policy (no PII in reports) | `src/migration/source/sanitize.ts` |
| Read-only Sheets adapter (only writer of network calls) | `src/migration-cli/read-only-sheets.ts` |
| Snapshot runner (fixed-snapshot dry-run, raw-artifact handling) | `src/migration-cli/snapshot-runner.ts` |
| CLI entry point | `src/migration-cli/cli.ts` (`npm run migration:snapshot`) |
| Production MySQL read-only preflight | `src/migration-cli/preflight.ts` (`npm run migration:preflight`) |

---

## 1. Snapshot process (reproducible)

```
npm run migration:snapshot                     # read-only read + fixed-snapshot dry-run
npm run migration:snapshot -- --write-raw      # also archive the RAW snapshot locally
npm run migration:snapshot -- --previous=<id>  # compare against a previous snapshot
```

Order of operations (all read-only):

1. Load `.env`; **fail closed** if `GOOGLE_SHEETS_ID` /
   `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` are missing
   (`assertReadOnlySourceAccess` → `SourceDataUnavailableError`, **no network call**).
2. Read the 11 worksheets with **one** read API call
   (`spreadsheets.values.batchGet`) using a JWT limited to the
   `spreadsheets.readonly` scope. No write method exists in the adapter.
3. Probe every worksheet and **preserve provenance** — worksheet and 1-based row
   number — while validating headers against `SHEET_HEADERS`.
4. Compute fingerprints; run the P0D-1 planner against the **fixed** snapshot
   (never re-reading a live sheet between reconciliation steps).
5. Print a **sanitised** summary + dry-run summary + the D1–D12 register state.
6. Optionally archive the raw snapshot (contains personal data) into
   `.migration-snapshots/`, which is in `.gitignore`.

Determinism: the snapshot ID **is** the deterministic content fingerprint
(no timestamps mixed in), so two reads of unchanged data produce the same ID;
`acquiredAt` is recorded separately and can be pinned with `MIGRATION_SNAPSHOT_AT`
for reproducible test runs.

## 2. Snapshot security

| Rule | Enforcement |
| --- | --- |
| Read-only | Only `spreadsheets.values.batchGet`; scope `…/auth/spreadsheets.readonly`; no `update`/`append`/`clear`/`batchUpdate` in the adapter |
| Fail closed | Missing credentials abort **before** any network call |
| No credential leakage | Spreadsheet ID is redacted from error messages (`sanitizeSourceError`); credentials are never printed |
| Raw data never committed | Raw archives go to `.migration-snapshots/` (gitignored, added in P0D-2A); the raw archive is never copied into Markdown/reports |
| No PII in reports | `sanitizeSnapshot` emits counts, fingerprints, and an allow-list of controlled columns only (`SAFE_DISTINCT_COLUMNS`); `assertNoSensitiveData` verifies the summary against every sensitive cell value found in the snapshot before it is reported |
| Opaque identifiers | Reports/decision-register use `worksheet#row (id:<hash8>)` references — never raw IDs |
| Personal-data columns never reported | `SENSITIVE_COLUMNS`: name, contact, contact_person, email, phone, address, city, notes, description, location, job_name, password_hash, company_name |

Controlled columns whose **values** may be reported (needed for D1 and §3):
crew role, job_crews role/payment_status, job_type, status (jobs/deliveries),
delivery_type, client_payments term/status, vendor_payments type/status,
expenses category.

## 3. Real source inventory — status per required check

`GOOGLE_SHEETS_ID` is **not set** in this environment (verified: `.env` contains
only `DATABASE_URL`; `.env.example` lists the Google variables as placeholders).
Every data-dependent check below is therefore **BLOCKED**, not estimated.
`npm run migration:snapshot` exits with code `3` and prints
`BLOCKED ON SOURCE ACCESS`.

| # | Required inventory check | Status |
| --- | --- | --- |
| 1 | Row counts for all 11 worksheets | **BLOCKED** |
| 2 | Distinct crew-role spellings + occurrence counts | **BLOCKED** |
| 3 | Distinct expense categories + occurrence counts | **BLOCKED** |
| 4 | Duplicate source IDs | **BLOCKED** |
| 5 | Duplicate job numbers | **BLOCKED** |
| 6 | Duplicate admin emails | **BLOCKED** |
| 7 | Missing / orphan foreign-key references | **BLOCKED** |
| 8 | Conflicting or blank venue records | **BLOCKED** |
| 9 | Duplicate payment schedules | **BLOCKED** |
| 10 | Payment-status distributions | **BLOCKED** |
| 11 | Financial totals (BigInt minor units) | **BLOCKED** |
| 12 | Values incompatible with target enums/constraints/dates/lengths/precision | **BLOCKED** |

The checks in §3.1 (contract-level) are **verified statically** and do not need
credentials; the checks in §3.2 require the snapshot and are BLOCKED.

### 3.1 Statically verified (from the repository contract)

| # | Worksheet | Columns (exact order from `SHEET_HEADERS`) | Header fingerprint |
| --- | --- | --- | --- |
| 1 | `clients` | id, name, address, contact, notes, created_at, updated_at | computed at read time |
| 2 | `vendors` | id, name, contact, notes, created_at, updated_at | idem |
| 3 | `venues` | id, name, address, contact, notes, created_at, updated_at | idem |
| 4 | `crew` | id, name, role, contact, default_payment, notes, created_at, updated_at | idem |
| 5 | `jobs` | id, job_number, client_id, vendor_id, venue_id, job_name, job_type, execution_date, location, status, description, created_at, updated_at | idem |
| 6 | `job_crews` | id, job_id, crew_id, role, payment, payment_status, created_at, updated_at | idem |
| 7 | `deliveries` | id, job_id, item_name, delivery_type, quantity, deadline, status, notes, created_at, updated_at | idem |
| 8 | `client_payments` | id, job_id, term, amount, due_date, paid_date, status, notes, created_at, updated_at | idem |
| 9 | `vendor_payments` | id, job_id, type, amount, due_date, paid_date, status, notes, created_at, updated_at | idem |
| 10 | `expenses` | id, job_id, category, description, amount, expense_date, notes, created_at, updated_at | idem |
| 11 | `admins` | id, name, email, password_hash, created_at, updated_at | idem |

Header/schema validation is machine-checked: a mismatch, extra column, or missing
column is reported as `HEADER_MISMATCH` / `EXTRA_COLUMNS` and the data is
**never silently repaired**. Empty IDs (`EMPTY_SOURCE_ID`), duplicate IDs
(`DUPLICATE_SOURCE_ID`), malformed rows (`MALFORMED_ROW`), and absent worksheets
(`MISSING_WORKSHEET`) are reported the same way.

### 3.2 Data-dependent (BLOCKED until a snapshot is read)

Every figure below must come from a real snapshot; **no number is invented**.
Once a snapshot exists, the dry-run report already emits all of them:
per-entity source counts, READY/DEFERRED/RECONCILIATION_REQUIRED, PROVEN/POTENTIAL
duplicates, missing references, source collisions, venue-archive summary, crew-role
dictionary proposal, financial reconciliation by job/category/reference, and the
income/expense/net/obligation/paid/outstanding totals.

## 4. Reproducibility & change detection

| Guarantee | Mechanism |
| --- | --- |
| Schema fingerprint | `schemaFingerprint(headers)` over all 11 header fingerprints |
| Per-row fingerprint | `sourceFingerprint(record)` — SHA-256 over sorted `column=value` |
| Snapshot fingerprint / ID | `snapshotFingerprint(...)` over all `worksheet:id:fingerprint` |
| Same data ⇒ same ID | Verified by test (two builds, and a serialize/deserialize round-trip) |
| Change detection | `compareSnapshots(previous, next)` → `newRows`, `changedRows`, `disappearedRows`, `schemaChanged` keyed by `(worksheet, id)` so row reordering is not a change |
| Fixed-snapshot dry-run | `runSnapshotDryRun()` consumes the snapshot, never a live sheet |

## 5. What this document does NOT claim

- No real historical row was read, counted, imported, or reconciled.
- The dry-run numbers in `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md` §11 come from
  a **synthetic fixture** and prove the *logic*, not the state of production data.
- The read-only adapter is implemented and unit-tested with a fake gateway; its
  live path has never been executed here because the credentials are absent.
