# PHASE P0D-2A — REAL SOURCE SNAPSHOT & RECONCILIATION GATE

> **ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).** The historical
> snapshot/dry-run gate described here is **cancelled**: no historical import is
> required. `BLOCKED ON SOURCE ACCESS` remains the correct historical verdict of
> this phase and is preserved unchanged. Google Sheets credentials are no longer
> required for any active work. See
> `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md`.

**Verdict: BLOCKED ON SOURCE ACCESS** (tooling, tests and read-only preflight
delivered and verified separately — see §15, §16).
**Scope:** P0D-2A only. **No historical row was imported, no Google Sheets cell
was written, migration `0001` was not applied, and the runtime is still Google
Sheets.** Nothing was committed, pushed, or deployed. P0D-2B was **not** started.

Master milestone **P0D remains IN PROGRESS**; master progress stays **5/18
(27.8 %)**.

Companion documents created in this phase:
`docs/MIGRATION-DECISION-REGISTER.md`, `docs/MIGRATION-SNAPSHOT-INVENTORY.md`.

---

## 1. Baseline branch, HEAD, working-tree state

| Item | Value |
| --- | --- |
| Branch / HEAD | `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939` (unchanged) |
| Working tree | All P0A→P0D-1 uncommitted work preserved; nothing reset, stashed, cleaned, reverted, committed, pushed, or deployed |
| Active repository | `getRepositories()` still returns `googleRepositories` — Google Sheets remains the runtime (`src/repositories/index.ts` unmodified) |
| New migration generated | **No** — `drizzle/` still contains exactly `0000_magical_true_believers.sql` + `0001_dizzy_sunspot.sql` |
| Test baseline (before this phase) | **174 / 174** (measured, not assumed) |

## 2. Files created and modified

Created:

| File | Purpose |
| --- | --- |
| `src/migration/source/types.ts` | Snapshot/provenance/change-report types (pure) |
| `src/migration/source/snapshot.ts` | `buildSnapshot`, header/schema/row fingerprints, `compareSnapshots`, raw serialize/deserialize |
| `src/migration/source/sanitize.ts` | `SENSITIVE_COLUMNS`, `SAFE_DISTINCT_COLUMNS`, `sanitizeSnapshot`, opaque row refs, `assertNoSensitiveData` |
| `src/migration/source/index.ts` | Barrel |
| `src/migration/decision-register.ts` | D1–D12 definitions, `buildDecisionRegister`, approval gating, blockers |
| `src/migration-cli/gateway.ts` | `ReadOnlySheetsGateway` interface (read operations only) |
| `src/migration-cli/read-only-sheets.ts` | Live read-only adapter (read-only OAuth scope, `values.batchGet` only, fail closed, sanitized errors) |
| `src/migration-cli/snapshot-runner.ts` | Snapshot acquisition + fixed-snapshot dry-run + raw-archive handling |
| `src/migration-cli/preflight.ts` | Production MySQL read-only preflight + P0D-2B readiness checklist |
| `src/migration-cli/cli.ts` | Explicit CLI entry point (`snapshot`, `preflight`, `help`) |
| `tests/migration-snapshot.test.ts` | 39 new tests |
| `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md` (this file), `docs/MIGRATION-DECISION-REGISTER.md`, `docs/MIGRATION-SNAPSHOT-INVENTORY.md` | Phase documentation |

Modified:

| File | Change |
| --- | --- |
| `src/migration/expense-reconciliation.ts` | **Duplicate-rule correction** (§9): `READY` / `PROVEN_DUPLICATE` / `POTENTIAL_DUPLICATE` / `RECONCILIATION_REQUIRED`, explicit-source-reference and approved-owner-decision evidence |
| `src/migration/dry-run.ts` | Consumes the corrected rule; only `PROVEN_DUPLICATE` may be `SKIP_DUPLICATE`; `duplicateEvidence` counter; `runSnapshotDryRun` / `sourceRowsFromSnapshot` |
| `src/migration/mapping-spec.ts` | Expense-category disposition text updated to the corrected rule |
| `src/migration/index.ts` | Exports the new modules/types |
| `tests/migration-planning.test.ts` | Assertions in 3 tests that encoded the superseded equal-amount rule updated (see §15); 1 test added |
| `package.json` | Added `migration:snapshot` and `migration:preflight` scripts (no dependency changes) |
| `.gitignore` | Added `.migration-snapshots/` (raw snapshots contain personal data); existing rules untouched |
| `docs/MIGRATION-RECONCILIATION.md`, `docs/MIGRATION-MAPPING.md`, `docs/MIGRATION-RUNBOOK.md`, `docs/PHASE-P0D1-MIGRATION-PLANNING.md` | Corrected duplicate rule, read-only preflight results, P0D-2A references |
| `docs/PROJECT-PROGRESS.md` | Tracker updated (P0D-2A recorded; history preserved) |

**Not modified:** `getRepositories()`, `src/repositories/**`, `src/lib/google-sheets/client.ts`,
any page/layout/Server Action/component, any schema file, any existing migration,
all pre-existing test files other than `tests/migration-planning.test.ts`.

## 3. Source access status

**BLOCKED.** `GOOGLE_SHEETS_ID` is **not set** in this environment (verified:
`.env` contains only `DATABASE_URL`; `.env.example` lists `GOOGLE_SHEETS_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` as placeholders).

`npm run migration:snapshot` therefore exits `3` with
`BLOCKED ON SOURCE ACCESS` and performs **no** network call — the adapter fails
closed before authenticating. No credential, spreadsheet ID, or source value is
reproduced anywhere in this phase. A synthetic fixture is used by tests only and
is explicitly **not** the real snapshot.

## 4. Snapshot acquisition method and security

Documented in `docs/MIGRATION-SNAPSHOT-INVENTORY.md` §1–§2. Summary:
one read-only API call (`spreadsheets.values.batchGet`) on the 11 worksheets with
a JWT scoped to `spreadsheets.readonly`; header validation against `SHEET_HEADERS`;
provenance (worksheet + 1-based row) and per-row fingerprints preserved; raw
archives only under the gitignored `.migration-snapshots/`; reports sanitised and
checked by `assertNoSensitiveData` against every sensitive cell value present in
the snapshot; identifiers in reports are opaque (`worksheet#row (id:<hash8>)`).
The dry-run consumes the **fixed** snapshot and never re-reads a live sheet.
The read-only adapter is the only module on the migration path that touches the
network, and it lives outside `src/migration/**`.

## 5. Real worksheet inventory — **BLOCKED**

`docs/MIGRATION-SNAPSHOT-INVENTORY.md` §3 lists all 12 required inventory checks,
each marked **BLOCKED**, together with the statically verified parts (11 header
contracts) and the machine-checked validations that will run once a snapshot
exists. **No row count, distinct value, duplicate, or total is estimated.** The
per-worksheet row counts in §11 are from a synthetic fixture and are labelled as
such.

## 6. Source validation results

Implemented and unit-tested (synthetic fixtures):

| Validation | Behaviour |
| --- | --- |
| Header mismatch (missing/extra/order) | `HEADER_MISMATCH` (and `EXTRA_COLUMNS`); data is **not** repaired |
| Malformed row (cell count ≠ header count) | `MALFORMED_ROW`, row still reported verbatim |
| Empty source ID | `EMPTY_SOURCE_ID` (identity cannot be formed) |
| Duplicate source ID | `DUPLICATE_SOURCE_ID` with all row numbers |
| Absent worksheet | `MISSING_WORKSHEET`, sheet snapshot empty — nothing invented |
| Empty row | skipped (`skippedEmptyRows`), never counted as data |
| Missing required business cell | surfaces through the existing mappers as `SOURCE_PARSE_ERROR` (e.g. `jobs` requires `created_at`/`updated_at`) |

Verification of the **real** source is part of the BLOCKED §5 inventory.

## 7. Venue archive evidence

Strategy unchanged (`docs/MIGRATION-RECONCILIATION.md` §1): the `venues`
worksheet is archived in memory (`id → name`), `VENUE_ARCHIVE_CONFLICT` and
`VENUE_ARCHIVE_BLANK_NAME` are reported, unknown referenced ids →
`VENUE_NAME_MISSING`, and the historical `venue_id` is retained as
`audit.source_venue_id`. **Real archive evidence is BLOCKED** (needs the
snapshot); the archive is a *proposal* requiring owner sign-off (D2/D3).

## 8. Crew-role proposal and approval state

`proposeCrewRoleDictionary()` still returns
`approvalStatus: "PROPOSED_NOT_APPROVED"` and preserves every original spelling.
Deterministic normalisation only (trim, collapse whitespace, uppercase key);
similar-but-different spellings are flagged `AMBIGUOUS_ROLE` and never merged.
Until an `ApprovedCrewRoleDictionary` (`approvedBy` non-empty) exists, every
`crew`/`job_crews` row is `RECONCILIATION_REQUIRED`
(`ROLE_DICTIONARY_NOT_APPROVED`) — visible in the fixture dry-run (§11). The real
spelling list (and therefore the dictionary content) is **BLOCKED** (D1).

## 9. Financial duplicate-rule correction

Corrected exactly as required:

| Classification | Trigger | Migration behaviour |
| --- | --- | --- |
| `READY` | deterministic general category (`TRANSPORT`/`EQUIPMENT`/`OTHER`) | imported as `cashflows` `EXPENSE`, `source=MIGRATION` |
| `PROVEN_DUPLICATE` | **explicit source reference** pointing at a matching candidate **or** a documented, approved row-level owner decision (`ApprovedDuplicateDecision` with non-empty `approvedBy`) | the **only** case allowed to become `SKIP_DUPLICATE` (the schedule evidence provides the cash) |
| `POTENTIAL_DUPLICATE` | equal amount / other circumstantial similarity | **never** `SKIP_DUPLICATE`, **never** a cashflow → `RECONCILIATION_REQUIRED` |
| `RECONCILIATION_REQUIRED` | insufficient or conflicting evidence (ambiguous category without a matching obligation, unmappable category) | not converted; listed for decision |

Every classification carries `evidence` (`EQUAL_AMOUNT_CANDIDATE`,
`EXPLICIT_SOURCE_REFERENCE`, `APPROVED_ROW_DECISION`, `NONE`) plus the original
source rows/candidate references in `audit`. The dry-run counts
`duplicateEvidence: { proven, potential }`. P0C-2 ledger semantics and its
production repository implementation are untouched.

## 10. D1–D12 decision status

Full register: `docs/MIGRATION-DECISION-REGISTER.md`. Machine-readable source:
`src/migration/decision-register.ts`.

All 12 decisions are **NOT APPROVED**; because no real snapshot exists they
report `approvalState: "BLOCKED_SOURCE_UNAVAILABLE"` and `affectedRowCount: null`
(counts are never guessed). Two decisions block the **entire** migration
(`blockingScope: "MIGRATION"`): **D1** (approved crew-role dictionary) and **D4**
(approved cash rule for `PAID` + `paid_date`); the other ten block their rows.
`assertApprovalsAreAuthorized()` throws if any entry is `APPROVED` without an
approver, and approvals are only recognised with non-empty `approvedBy` **and**
`approvedAt`. No decision was auto-approved.

## 11. Dry-run results and snapshot fingerprint

**Real dry-run: BLOCKED** — it requires the real snapshot, which cannot be read
(§3). No real dry-run is claimed.

The planner was exercised end-to-end against a **synthetic fixture** through the
new `runSnapshotDryRun()` path to prove the logic. Fixture: 2 clients, 1 vendor,
2 venues, 2 crew, 1 job, 1 assignment, 1 delivery, 1 client schedule, 1 vendor
schedule, 4 expenses, 1 admin — 17 data rows.

| Metric | Value (synthetic — **not historical data**) |
| --- | --- |
| Snapshot ID / fingerprint | `02d27027d635bf47006f8d52885d3307d381497f07dea21e771b0a77a7de90ba` |
| Schema fingerprint | `3288de6e0ad3cf2893dfbe393de2481c0e8f8ad1e6fe5c0af6a279fa7c12a7d0` |
| clients / vendors | 2 ready / 1 ready |
| crew | 0 ready, 2 `RECONCILIATION_REQUIRED` (`ROLE_DICTIONARY_NOT_APPROVED` — no approved dictionary) |
| jobs / deliveries | 1 ready / 1 ready |
| jobCrewAssignments | 0 ready, 1 `RECONCILIATION_REQUIRED` (role dictionary, obligation-only payment) |
| clientPaymentSchedules / vendorPaymentSchedules | 1 ready / 1 ready (both `PAID` + `paid_date` → proposed cash) |
| cashflows (from `expenses`) | 1 ready (`TRANSPORT`), 3 `RECONCILIATION_REQUIRED` (1 `POTENTIAL_DUPLICATE`, 1 unmappable category, 1 missing `job_id`) |
| admins | 1 `DEFERRED` |
| `SKIP_DUPLICATE` rows | **0** (equal amounts never auto-skip) |
| Duplicate evidence | proven `0`, potential `1` |
| Missing references | 0 in this fixture |
| `writesAttempted` | `false` |

A second fixture run (tests) proves: identical input ⇒ identical plan and
fingerprint; changed/removed rows are reported via `snapshotChangeReport`; an
owner-approved duplicate decision turns the `POTENTIAL` row into
`SKIP_DUPLICATE` **without** adding cash; and every `RECONCILIATION_REQUIRED`
entry carries **empty** `values` (no executable payload). **This is not
approval to import.**

## 12. Financial totals and discrepancies

Decimal-safe (`BigInt` minor units) totals from the synthetic dry-run
(**not historical**):

| Total | Value |
| --- | --- |
| income / expense / net | `1000.00` / `475.50` / `524.50` |
| by category | `CLIENT_PAYMENT 1000.00`, `TRANSPORT 75.50`, `VENDOR_PAYMENT 400.00` |
| obligation (client/vendor/crew/total) | `1000.00` / `400.00` / `0.00` / `1400.00` |
| paid (client/vendor/crew/total) | `1000.00` / `400.00` / `0.00` / `1400.00` |
| outstanding (client/vendor/crew/total) | `0.00` / `0.00` / `0.00` / `0.00` |

No discrepancy is netted away: `compareTotals()` lists every difference per
`grand` / job / category / reference / obligation / paid / outstanding scope, and
`RECONCILIATION_REQUIRED` rows are **excluded** from totals so no guessed value
can inflate a reconciliation figure. Real totals remain **BLOCKED**; there is
therefore **no real reconciliation result to sign off yet**.

## 13. Production MySQL read-only preflight

Executed with `npm run migration:preflight` (SELECT / `information_schema` only;
every statement is checked by `assertReadOnlyQuery`; the run is restricted to
`database-airprod`). Result at 2026-10-14:

| Check | Result |
| --- | --- |
| Database | `database-airprod` |
| Tables | **14** (all row counts `0` — the target is still empty) |
| Applied migration journal | **1 row (`0000` only**) → `0001` **not applied** |
| `cashflows.job_id` | `IS_NULLABLE = NO` (unchanged) |
| Idempotency columns | **absent** (`idempotency_key`, `idempotency_fingerprint`) |
| UNIQUE index on `idempotency_key` | **absent** |
| FK on `cashflows` | `cashflows_job_id_jobs_id_fk: job_id → jobs.id` (intact) |
| Defaults | `crew.default_payment = 0.00`, `job_crews.agreed_amount = 0.00` |
| Schema drift | none detected |
| Planned source-ID collisions | **BLOCKED** (`null` — requires the real snapshot) |

No DDL/DML was executed and migration `0001` was **not** applied.

## 14. P0D-2B prerequisites and approval gates

From `buildP0D2BReadinessChecklist()` (12 items; `null` = not verifiable
read-only and therefore **not** satisfied). Currently green: journal = `0000`,
`job_id` still `NOT NULL`, idempotency columns/index absent, no drift, row-count
baseline captured. Still open:

1. **BLOCKED — real snapshot + reviewed dry-run report** (needs read-only credentials).
2. **BLOCKED — source-ID collision check** against the target.
3. **Keputusan D1–D12** approved or their rows explicitly excluded (D1 and D4 block everything).
4. **Written approval** for the `0001` rollout (window, operator, backup location, go/no-go) — per `docs/MIGRATION-RUNBOOK.md` Part A.
5. **Backup + restore rehearsal** repeated for the data import, storage agreed.
6. Runtime stays on Google Sheets throughout (activation is P0E).

## 15. Test results before and after

| | Files | Tests |
| --- | --- | --- |
| Before P0D-2A | 6 | **174 / 174** |
| After P0D-2A | 7 | **214 / 214** |

Breakdown after: `db-foundation` 22 · `mysql-repository` 22 · `domain-contract` 31 ·
`finance-service` 23 · `mysql-service-integration` 31 · `migration-planning` **46** ·
`migration-snapshot` **39 (new)**. No test was skipped or weakened; no assertion
was relaxed to make anything pass.

Required new coverage, all present: read-only adapter boundaries; credential
absence fails closed; header mismatch; duplicate and malformed rows; snapshot/
fingerprint reproducibility (including serialize→deserialize); changed/disappeared
source detection; no sensitive data in sanitized reports (plus a deliberate
leak-detector test); no Sheets write API use (grep-based, comments stripped);
equal amount does **not** prove a duplicate; proven duplicate requires stronger
evidence/approval; unapproved D1–D12 remain blocked; financial totals use BigInt
minor units; unresolved rows have no executable payload; dry-run performs zero
writes; production database cannot be selected as a test-write target.

**Rule-change disclosure:** the assertions in three pre-existing tests in
`tests/migration-planning.test.ts` encoded the superseded rule (equal amount ⇒
`DUPLICATE_OF_SCHEDULE_PAYMENT` ⇒ skipped). They were **updated, not deleted**, to
assert the corrected behaviour required by §6 (equal amount ⇒ `POTENTIAL_DUPLICATE`,
skipped only with explicit evidence), and a new test was added for the proven
path. Test coverage in that file went from 45 to 46.

## 16. TypeScript, lint, db:check and build

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | **0 errors** | 0 |
| `npm run lint` | **0 errors**, 1 pre-existing warning (`src/app/actions/job-actions.ts:8`, untouched file) | 0 |
| `npm run db:check` | `Everything's fine 🐶🔥` | 0 |
| `npm run migration:preflight` | preflight report above (see §13) | 0 |
| `npm run migration:snapshot` | `BLOCKED ON SOURCE ACCESS` (expected, §3) | 3 |
| `npx vitest run` | **214 passed / 214** | 0 |
| `npm run build` | compile ✓, TypeScript ✓ (19.6 s), then **static prerender fails** | 1 |

**Build failure reported separately (inherited, unchanged):** `next build`
prerenders `/clients` (and other pages) through `src/services/master-service.ts`
→ `src/lib/google-sheets/client.ts`, which throws
`Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi`.
Pre-existing since P0A, unrelated to P0D-2A, and independently confirms the
runtime is still Google Sheets. **No fake credentials, mock fallback, or
suppression was added** to make the build green.

## 17. Proof that no production/source writes occurred

- **Google Sheets:** the only network call implemented is
  `spreadsheets.values.batchGet` with the `spreadsheets.readonly` scope; no
  `update`/`append`/`clear`/`batchUpdate` exists in the adapter (enforced by test).
  In this environment the adapter **aborted before any call** (missing
  credentials). No worksheet was read from the real spreadsheet either — even
  reads did not happen.
- **MySQL:** the only new database code is the read-only preflight, which
  executes only `SELECT`/`information_schema` statements
  (`assertReadOnlyQuery` rejects any DDL/DML keyword before execution) and is
  restricted to `database-airprod`. No row was inserted, updated, or deleted;
  all 14 tables remain at `0` rows; migration `0001` is still unapplied
  (§13). All write tests continue to run against `airprod_test` only.
- **Repository:** `src/migration/**` contains no write path and no import of the
  Google client, the DB layer, or `getRepositories()` (test-enforced, now
  recursive); `git status` shows no change to `getRepositories()`, the Google
  repository, the Google client, or any page/Server Action.
- **Nothing was committed or pushed.**

## 18. Known limitations

1. **The real snapshot was never read** (no credentials): every data-dependent
   check (row counts, real role spellings, real categories, real duplicates,
   real orphans, real totals, real venue conflicts, source collisions) is
   **BLOCKED**, not estimated.
2. **No real dry-run and no real financial reconciliation** exist yet; §11–§12
   numbers are synthetic fixtures that prove logic only.
3. **The read-only adapter's live path is unexecuted here** — it is covered by
   unit tests with a fake gateway and a grep-based no-write-API test, but no
   end-to-end live read has run.
4. **D1–D12 are all unapproved**; D1 and D4 block the whole migration.
5. **Migration `0001` is still unapplied**, so even an approved import could not
   run yet; D9 additionally depends on it.
6. **`npm run build` still fails at prerender** on the missing `GOOGLE_SHEETS_ID`
   (inherited; separately reported).
7. The CLI requires Node ≥ 22.18/24 for TypeScript type-stripping plus the
   project resolver in `scripts/`; it is a local operator tool, not part of the
   application build.
8. No commit, push, or deployment was performed; P0D-2B has not started.

## 19. Final verdict

### **BLOCKED ON SOURCE ACCESS**

P0D-2A delivered, and verified, everything that is possible without the real
source: a read-only, fail-closed source adapter; a reproducible snapshot process
with header/schema/row/snapshot fingerprints and change detection; sanitised
reporting proven free of personal data; the corrected financial duplicate rule
(equal amount is only a *potential* duplicate and can never auto-skip or create
cash); the D1–D12 decision register with strict approval gating; fixed-snapshot
dry-run tooling; a strictly read-only production MySQL preflight with a P0D-2B
readiness checklist; 40 new/updated tests (**214/214**); and three new
documents — all without touching production data, source data, or the running
application.

The real historical inventory and dry-run **could not** be performed because
`GOOGLE_SHEETS_ID` is not available, so they are reported as **BLOCKED** rather
than fabricated. **No claim is made that a real historical dry-run succeeded.**

**P0D remains IN PROGRESS; master progress 5/18 (27.8 %); P0D-2B NOT STARTED and
approval-gated. Awaiting explicit owner approval (source credentials + D1–D12
decisions + `0001` rollout plan).**
