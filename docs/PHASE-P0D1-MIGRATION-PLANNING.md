# PHASE P0D-1 — HISTORICAL MIGRATION PLANNING & RECONCILIATION

> **ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).** Historical Google
> Sheets migration is **not required** and is **no longer an active prerequisite**.
> This report is retained as historical evidence and is not rewritten or erased.
> Source-access requirements (`GOOGLE_SHEETS_ID` etc.) no longer block any
> planning or delivery work. See `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md`
> and `docs/FRESH-START-MYSQL-PLAN.md`.

Status: **PASS WITH LIMITATIONS**
Scope: P0D-1 only — migration *planning* (inventory, mapping, venue archive,
crew-role proposal, financial reconciliation rules, ordering, idempotency,
dry-run tooling, tests, documentation, tracker).
**No historical record was imported. No data was migrated. Migration `0001` was
not applied to production. MySQL was not activated. No commit/push.**

Master milestone **P0D remains IN PROGRESS** (subphase P0D-1 only).

Companion documents created in this phase:
`docs/MIGRATION-MAPPING.md`, `docs/MIGRATION-RECONCILIATION.md`,
`docs/MIGRATION-RUNBOOK.md`.

> **Superseded rule (see P0D-2A).** The equal-amount duplicate rule described in
> this report (§7) and in `docs/MIGRATION-RECONCILIATION.md` was **tightened in
> P0D-2A**: an equal amount is only a candidate duplicate and never auto-skips a
> row. The corrected rule lives in `docs/MIGRATION-RECONCILIATION.md` §3 and
> `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md` §9. Everything else in this report
> stands unchanged.

---

## 1. Baseline Repository State

| Item | Value |
| --- | --- |
| Branch / HEAD | `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939` (unchanged) |
| Working tree | All P0A/P0B/P0C-1/P0C-2/P0C-3 uncommitted work preserved — nothing reset/stashed/cleaned |
| Active repositories | `getRepositories()` still returns `googleRepositories` — **Google Sheets remains the runtime** |
| Production DB | `database-airprod` — 14 tables, `cashflows.job_id` `NOT NULL`, no idempotency columns, no UNIQUE on `cashflows` |
| Migrations | `0000_magical_true_believers`, `0001_dizzy_sunspot` — unchanged; **no new migration generated** |
| Test baseline | 129/129 passing |
| TypeScript / Lint | 0 errors / 0 errors (1 pre-existing warning) |
| Build | Fails at static prerender on missing `GOOGLE_SHEETS_ID` (pre-existing) |
| Source data | **BLOCKED** — `GOOGLE_SHEETS_ID` is not set in this environment (verified: the only Google/DB-related variable present is `DATABASE_URL`) |

Sources inspected directly (not only via reports): `src/repositories/google/{index,mapping}.ts`,
`src/lib/types.ts`, `src/repositories/types.ts`, `src/domain/{types,inputs,money,finance,validation,reconciliation,legacy-compat}.ts`,
`src/repositories/contract/types.ts`, `src/repositories/mysql/**`, `src/services/**`,
`src/db/schema/**`, `drizzle/0000_*.sql`, `drizzle/0001_*.sql`, `drizzle/meta/*`,
`tests/**`, and all prior phase reports including `docs/PROJECT-PROGRESS.md`.

---

## 2. Files Created / Modified

Created:

- `src/migration/types.ts` — migration plan types (entities, row status, source identity)
- `src/migration/mapping-spec.ts` — **static source→target inventory spec**, `MIGRATION_ORDER`, `validateSpecCoverage`, `validateMigrationOrder`
- `src/migration/identity.ts` — deterministic identity, fingerprints, idempotency keys, run-conflict/duplicate detection
- `src/migration/venue-archive.ts` — historical venue archive + `legacy_venue_name` resolution
- `src/migration/crew-roles.ts` — role normalization + **proposed (unapproved)** dictionary + approved-dictionary resolver
- `src/migration/expense-reconciliation.ts` — legacy expense classification + duplicate-payment detection
- `src/migration/payment-evidence.ts` — stored-status vs evidenced-cash reconciliation for schedules and crew assignments
- `src/migration/totals.ts` — decimal-safe reconciliation totals (per job/category/reference, obligations, outstanding, grand totals) + discrepancy comparison
- `src/migration/inventory.ts` — read-only inventory utilities, cross-sheet reference checks, source-availability guard
- `src/migration/dry-run.ts` — read-only dry-run planner (`runDryRun`, `fingerprintsBySource`)
- `src/migration/index.ts` — barrel
- `tests/migration-planning.test.ts` — 45 tests
- `docs/PHASE-P0D1-MIGRATION-PLANNING.md` (this file), `docs/MIGRATION-MAPPING.md`, `docs/MIGRATION-RECONCILIATION.md`, `docs/MIGRATION-RUNBOOK.md`

Modified: `docs/PROJECT-PROGRESS.md` (tracker updated; previous entries preserved).

**Not modified:** `getRepositories()`, the Google repository, any page/UI/Server
Action, any schema file, any migration file, `package.json`, the P0C-1/P0C-2/P0C-3
source modules, and every pre-existing test file.

---

## 3. Source Inventory

### 3.1 Statically verified (from the repository contract)

11 worksheets with exact column contracts (`SHEET_HEADERS`) → target tables are
enumerated in `docs/MIGRATION-MAPPING.md` §1–§2. Coverage is machine-checked:
`validateSpecCoverage()` fails if any worksheet column lacks an explicit
disposition or if the spec mentions a column the worksheet does not have. It
passes (asserted by test).

### 3.2 BLOCKED (requires live source data)

These cannot be verified without reading the real spreadsheet and are therefore
**BLOCKED**, not estimated:

| Blocked check | Reason |
| --- | --- |
| Row counts per worksheet | `GOOGLE_SHEETS_ID` unset; `assertSourceDataAvailable()` reports `SourceDataUnavailableError` |
| Distinct historical crew-role spellings | requires the real `crew.role` / `job_crews.role` values |
| Distinct expense categories | requires the real `expenses.category` values |
| Real duplicate IDs / duplicate `job_number` / duplicate `admins.email` | requires real rows |
| Real orphan references (jobs without client/vendor, payments without job) | requires real rows |
| Real financial totals to reconcile against | requires real rows |

No row count, customer name, phone number, e-mail, or credential is reproduced
anywhere in this phase's documentation. **All figures quoted in §10 come from a
synthetic fixture used by `tests/migration-planning.test.ts` and are explicitly
not historical data.**

### 3.3 Verified static vs unverified historical assumptions

| Verified now | Still an assumption (must be confirmed with real data in P0D-2) |
| --- | --- |
| Column contracts of all 11 worksheets | actual row content and volume |
| FK/CHECK/UNIQUE constraints of the target schema | which historical rows violate XOR/UNIQUE |
| Mapping disposition of every source column | whether `CREW`/`VENDOR` expenses really duplicate schedules |
| Deterministic identity/idempotency/fingerprint mechanics | the approved crew-role dictionary and venue archive contents |
| Reconciliation rules and decimal-safe totals | the actual money totals that must match after import |

---

## 4. Source-to-Target Mapping

Full per-column tables (with transforms, FK dependencies, nullable fields,
duplicate risks and reconciliation requirements): **`docs/MIGRATION-MAPPING.md`**.
Summary of renames and semantic shifts:

| Source | Target | Note |
| --- | --- | --- |
| `clients.contact` | `clients.phone` | rename; `email`/`contact_person`/`client_type` have no source → NULL |
| `jobs.description` | `jobs.notes` | rename |
| `jobs.venue_id` | `jobs.legacy_venue_name` | archive lookup, never invented |
| `jobs.job_type` | `jobs.category` | enum-validated |
| `deliveries.item_name` | `deliveries.name` | rename; `delivered_at` → NULL |
| `crew.role` | `crew.crew_role_id` | dictionary lookup (no implicit role creation) |
| `job_crews.payment` | `job_crews.agreed_amount` | **obligation**, not cash |
| `job_crews.payment_status` | — | **derived**; never stored, only reconciled |
| `client_payments.status` / `vendor_payments.status` | — | **derived**; never stored, only reconciled |
| `expenses.expense_date` | `cashflows.occurred_on` | rename |
| `expenses.notes` | — | no target column → audit metadata |
| `venues.*` | — | archived into job snapshots (no venue table) |

---

## 5. Venue Archive Strategy

`docs/MIGRATION-RECONCILIATION.md` §1 and `src/migration/venue-archive.ts`.

- Format/provenance: rows of the same spreadsheet's `venues` worksheet (`id` +
  `name`), read read-only in P0D-2; the archive is a derived, in-memory map.
- `legacy venue ID → historical name → Job.legacyVenueName`; the source venue id
  is retained as `audit.source_venue_id` even though the target has no venue column.
- Deterministic: trimmed names only; **no name is invented**.
- Conflicts (same id, different names), blank names, and unknown referenced ids →
  `RECONCILIATION_REQUIRED` (`VENUE_ARCHIVE_CONFLICT`, `VENUE_ARCHIVE_BLANK_NAME`,
  `VENUE_NAME_MISSING`).
- No active venue master table is created; the legacy Venue UI is **not** removed in P0D-1.

---

## 6. Proposed Crew Role Dictionary (NOT approved)

Rules in `docs/MIGRATION-RECONCILIATION.md` §2. `proposeCrewRoleDictionary()`
returns `approvalStatus: "PROPOSED_NOT_APPROVED"` and preserves every original
spelling in `sourceValues`.

Approval template to be filled from the real snapshot in P0D-2:

| Proposed canonical name | Normalised key | Historical spellings (audit) | Source rows | Status |
| --- | --- | --- | --- | --- |
| *(to be produced from real data — BLOCKED)* | | | | `PROPOSED` / `AMBIGUOUS` |

Until an `ApprovedCrewRoleDictionary` (`{ roles, approvedBy }`) exists, every
crew and job-crew row is planned as `RECONCILIATION_REQUIRED`
(`ROLE_DICTIONARY_NOT_APPROVED`). Similar-but-different spellings are **never**
merged automatically — they are flagged `AMBIGUOUS_ROLE`.

---

## 7. Financial Reconciliation Rules

Full rules: **`docs/MIGRATION-RECONCILIATION.md`**. Summary:

- **Obligation vs cash is never conflated.** Schedules and `agreed_amount` are
  obligations; only `cashflows` is money.
- **Stored status is not cash evidence.** `PAID` + `paid_date` yields a
  *proposed* cash row that requires approval; `PAID` without `paid_date`,
  `PARTIAL`, `UNPAID` with a date, and unknown values are all
  `RECONCILIATION_REQUIRED`. A `PARTIAL` amount is never invented.
- **Crew payments are never auto-cash**: `job_crews.payment_status` only produces
  a reconciliation item, optionally listing equal-amount `CREW` expenses as
  *candidates* for human decision.
- **`CREW`/`VENDOR` expenses are never imported twice.** ⚠️ **Superseded by P0D-2A:**
  this phase treated an equal-amount obligation on the same job as proof of a
  duplicate (`SKIP_DUPLICATE`). P0D-2A corrected that — an equal amount is only a
  `POTENTIAL_DUPLICATE` (reconciliation, never skipped, no cash); only a
  `PROVEN_DUPLICATE` (explicit source reference or approved row-level owner
  decision) may be skipped. See `docs/MIGRATION-RECONCILIATION.md` §3 and
  `docs/PHASE-P0D2A-REAL-SNAPSHOT-DRY-RUN.md` §9. `TRANSPORT`/`EQUIPMENT`/`OTHER`
  still map deterministically to an `EXPENSE` cashflow.
- **Decimal-safe totals only** (`BigInt` minor units via `src/domain/money.ts`):
  per job, per category, per reference, income/expense/net, obligations, paid,
  outstanding, grand totals. `compareTotals()` lists every difference per scope —
  no difference is aggregated away.
- Rows with `RECONCILIATION_REQUIRED` are **excluded from the totals** so no
  guessed value can inflate a reconciliation figure.

---

## 8. Migration Ordering

`MIGRATION_ORDER` (validated by `validateMigrationOrder()` against declared FK
dependencies and the real constraints in `0000`):

```
admins (DEFERRED) → crewRoles → clients → vendors → crew → jobs →
jobCrewAssignments → deliveries → clientPaymentSchedules →
vendorPaymentSchedules → cashflows
```

`job_sequences` is not migrated from source (derived by job-number generation,
P2A). Venue rows are transformed into `jobs.legacy_venue_name` rather than
restored as a master table. Collision handling (preserved ids, `job_number`
UNIQUE, `admins.email` UNIQUE, duplicate `(job_id, term/type)`) is defined in
`docs/MIGRATION-MAPPING.md` §3 — an existing row with different content is a
reported conflict, never a silent overwrite.

---

## 9. Idempotency & Restart Strategy

`docs/MIGRATION-RUNBOOK.md` §B.1 and `src/migration/identity.ts`.

| Requirement | Mechanism |
| --- | --- |
| Stable source identity | `(worksheet, id)` via `sourceIdentityString` |
| Deterministic target mapping | `deterministicMigrationId` (UUIDv5-style SHA-256) — same input → same target id, no randomness |
| Duplicate detection | `findDuplicateSourceIds` + `duplicates` section in the dry-run report |
| Change detection | `sourceFingerprint` + `detectRunConflict` |
| Restart safety | per-source fingerprint map; `runComparison` reports new/changed/disappeared sources |
| Integrity proof | `snapshotFingerprint(plan)` |
| Cashflow idempotency | `migrationIdempotencyKey(sheet, id)` = `migration:<sheet>:<id>`, stored in the UNIQUE `cashflows.idempotency_key`; `source = 'MIGRATION'` |
| Conflict handling | existing differing row → conflict report; no unconditional overwrite; no random keys per rerun |

`cashflows.source = 'MIGRATION'` **is supported** by the current schema
(`chk_cashflows_source in ('MANUAL','MIGRATION')`), so no additional migration and
no schema change is required for the idempotency design.

---

## 10. Dry-Run Results and Limitations

`runDryRun()` is exercised by the test suite over a **synthetic fixture**
(`tests/migration-planning.test.ts`, 1 client / 1 vendor / 2 venues / 2 crew /
2 jobs / 1 assignment / 1 delivery / 3 client schedules / 1 vendor schedule /
4 expenses). Observed plan and totals (synthetic — **not** historical data):

| Metric | Value |
| --- | --- |
| Plan rows | 16 |
| clients / vendors | 1 ready / 1 ready |
| crew | 2 ready (role spellings normalised through the approved fixture dictionary) |
| jobs | 1 ready, 1 `RECONCILIATION_REQUIRED` (venue id absent from archive) |
| jobCrewAssignments / deliveries | 1 ready / 1 ready |
| clientPaymentSchedules | 2 ready, 1 `RECONCILIATION_REQUIRED` (`PARTIAL_AMOUNT_UNKNOWN`) |
| vendorPaymentSchedules | 1 ready |
| cashflows (from `expenses`) | 1 ready (general expense), 2 `SKIP_DUPLICATE`, 1 `RECONCILIATION_REQUIRED` (unmappable category) |
| Reconciliation items | 3 |
| income / expense / net | `1000.00` / `475.50` / `524.50` |
| obligation total / paid total / outstanding total | `501650.00` / `1400.00` / `500250.00` |
| Snapshot fingerprint | `74ade28b755de06950cc5c291da30761366d56c6162d24d3428f09445b3719e3` |
| `writesAttempted` | `false` |

Verified properties of the dry run: no write path exists (module boundary test),
re-running identical input produces an identical plan and fingerprint, changed or
removed source rows are reported through `runComparison`, and every
`RECONCILIATION_REQUIRED` entry carries **empty** `values` (nothing converted).

**Limitations:**
1. These numbers come from synthetic fixtures and prove the *logic*, not the state
   of the real historical data.
2. The real snapshot has not been read (no credentials, and live reading is a
   P0D-2 activity); real counts, role spellings, expense categories, duplicates
   and totals remain **BLOCKED**.
3. `admins` rows are planned as `DEFERRED` (authentication = P1A).
4. Migration `0001` is not applied to production, so the migration cannot yet be
   executed against the production target even with approval.
5. Migration execution, checkpoints, and the production reconciliation run are
   P0D-2 work.

---

## 11. Migration `0001` Rollout Plan

Full plan: **`docs/MIGRATION-RUNBOOK.md` Part A**. Summary:

- **Expected changes:** `cashflows.job_id` → nullable (FK kept); two
  `DEFAULT '0.00'` normalisations; `idempotency_key varchar(190)` +
  `idempotency_fingerprint char(64)` + UNIQUE on `idempotency_key`. Additive and
  non-destructive — no column dropped, no row modified, no CHECK removed.
- **Preflight:** `db:check` clean; journal state = `0000`; row-count baseline per
  table; schema fingerprint (nullability + absence of idempotency columns);
  maintenance window; verified restore point.
- **Backup:** full logical dump, checksummed, stored off-host, restore rehearsed
  against a throwaway database.
- **Order:** freeze writes → backup + baseline → `drizzle-kit migrate` → verify → unfreeze.
- **Verification:** table count 14; journal contains `0001`; `job_id` nullable; FK
  intact; idempotency column + UNIQUE present; defaults `0.00`; row counts equal
  baseline; `SUM(amount)` unchanged; runtime still Google Sheets.
- **Failure handling:** stop, inspect which statements applied (DDL is not
  transactional here), restore from the dump if state is uncertain.
- **Rollback:** restore the dump (there is no down-migration).
- **Approval:** explicit written approval required (window, operator, backup
  location, go/no-go). **Not requested and not granted; `0001` remains unapplied.**

---

## 12. Unresolved Decisions Requiring Approval

Each item below blocks part of the import; none of them has been decided by this
phase, and none has been silently defaulted.

| # | Decision needed | Blocked rows if undecided | Evidence needed |
| --- | --- | --- | --- |
| D1 | Owner of the **approved crew-role dictionary** (and resolution of `AMBIGUOUS_ROLE` pairs such as `VIDEOGRAPHER`/`VIDEOGRAFER`) | all `crew`, `job_crews` | distinct role values from the real snapshot |
| D2 | Venue archive sign-off: which historical names are authoritative when an id has multiple names, and what to do with blank names | jobs with conflicting/blank venue names | `venues` worksheet + owner confirmation |
| D3 | Policy for jobs referencing **unknown venue ids** (leave snapshot empty vs resolve manually) | those jobs | real `jobs.venue_id` values |
| D4 | Whether `PAID` + `paid_date` schedules may be imported as full-amount cash (**proposed**, not approved) | all `PAID` schedules | owner approval of the evidence rule |
| D5 | How to treat `PARTIAL` schedules (the partial amount is not stored) — leave obligation-only, or supply the amounts | all `PARTIAL` schedules | missing source data / manual entry |
| D6 | Whether a `CREW`/`VENDOR` expense with **no matching obligation** is an actual payment or a mislabeled general expense | those expenses | list of unmatched expenses + owner decision |
| D7 | Whether equal-amount `CREW` expenses may be accepted as crew cash evidence | `PAID` crew assignments | list of candidate evidences |
| D8 | Handling of orphan references (`MISSING_CLIENT/VENDOR/JOB/CREW_REFERENCE`) — skip the row or fix the source | affected rows | list of orphans |
| D9 | Whether operational expenses with an empty/unknown `job_id` may be imported with `job_id = NULL` | those expenses | owner approval of the null-job rule |
| D10 | Duplicate `(job_id, term)` / `(job_id, type)` schedules — import both, or merge | duplicates | real duplicate list |
| D11 | Admin rows (defer to P1A vs import now) and acceptance of the legacy password-hash format | `admins` | P1A decision |
| D12 | `job_sequences` seeding strategy from historical job numbers | none in P0D (P2A) | P2A decision |

---

## 13. P0D-2 Prerequisites

1. Written approval for the **migration `0001` rollout** (Runbook Part A) and its execution.
2. Read-only snapshot access to the real spreadsheet for the dry-run (credentials supplied by the owner, values never printed into reports).
3. Approved crew-role dictionary (D1) and venue archive (D2/D3).
4. Decisions D4–D10 recorded, with the resulting `RECONCILIATION_REQUIRED` rows either resolved or explicitly excluded.
5. A reviewed dry-run report generated from the **real** snapshot (per-entity counts, reconciliations, totals, snapshot fingerprint).
6. Backup + restore rehearsal repeated for the data import; checkpoints storage location agreed.
7. Confirmation that the application stays on Google Sheets throughout P0D-2 (no activation; activation is P0E).

---

## 14. Verification Evidence

Commands run in this phase (from the project root):

| Command | Result | Exit |
| --- | --- | --- |
| `npx tsc --noEmit` | **0 errors** | 0 |
| `npm run lint` | **0 errors**, 1 pre-existing warning (`src/app/actions/job-actions.ts:8`, untouched file) | 0 |
| `npm run db:check` | `Everything's fine 🐶🔥` | 0 |
| `npx vitest run` | **174 passed / 174** (6 files) | 0 |
| `npm run build` | Compile ✓ (3.4 s), TypeScript ✓, then **fails at static prerender** | 1 |

Test files after this phase: `db-foundation` 22 · `mysql-repository` 22 ·
`domain-contract` 31 · `finance-service` 23 · `mysql-service-integration` 31 ·
`migration-planning` **45 (new)** — before: 129, after: 174, no regression, no
skipped tests, no weakened assertions.

New coverage (all 13 required areas): spec coverage + migration ordering (incl.
negative cases), venue mapping/unknown/conflicting/blank, crew-role
normalisation + ambiguity + unapproved dictionary, duplicate source identity,
deterministic target id and idempotency key, fingerprint stability + run
conflict, payment-status reconciliation (all five branches), crew-assignment
evidence, `CREW`/`VENDOR` duplicate-payment detection, decimal-safe totals
(`0.1+0.2`, 13-digit values, per-job/category/reference, outstanding), totals
discrepancy reporting, missing FK references, source inventory (missing cells,
duplicate ids, distinct values), rerun consistency (identical plan/fingerprint,
new/changed/disappeared sources), `RECONCILIATION_REQUIRED` handling (empty
values, nothing converted, `writesAttempted: false`), and a module-boundary test
proving the migration sources never import the Google repository, the DB layer,
or `getRepositories`.

**Build blocker (reported separately):** `next build` prerenders `/dashboard`,
which calls the Google Sheets repository through `src/services/master-service.ts`
→ `src/lib/google-sheets/client.ts`, and throws
`Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi`.
Inherited, pre-existing, unrelated to P0D-1; no credentials or mock fallback were
introduced. It also independently confirms the runtime is still Google Sheets.

---

## 15. Production Data Safety

Verified in this phase:

- `database-airprod` still has **14 tables**.
- `cashflows.job_id` is still `IS_NULLABLE = NO`; `idempotency_key` /
  `idempotency_fingerprint` are absent; `cashflows` has **no UNIQUE constraint**
  → migration `0001` has **not** been applied.
- `drizzle/meta/_journal.json` still lists exactly `0000` and `0001` and
  `drizzle/` contains exactly those two SQL files → **no new migration was
  generated**.
- No historical record was imported: P0D-1 contains no write path to MySQL, and no
  Google Sheets read occurred (the migration module never imports the Sheets
  client — enforced by test).
- Google Sheets remains the active runtime (`getRepositories()` unchanged).

---

## 16. Final Verdict

### Acceptance criteria check

| Criterion | Result |
| --- | --- |
| Static migration mapping complete | ✅ every worksheet column has an explicit disposition (machine-checked) |
| Source inventory documented to the extent accessible | ✅ static contract documented; data-dependent checks explicitly **BLOCKED** |
| Venue archive strategy defined | ✅ `docs/MIGRATION-RECONCILIATION.md` §1 + implementation |
| Crew Role mapping proposed | ✅ proposed dictionary (explicitly NOT approved) |
| Financial reconciliation rules defined / unresolved items blocked | ✅ rules implemented; 12 decisions listed as unresolved (D1–D12) |
| No ambiguous historical payment silently converted | ✅ `RECONCILIATION_REQUIRED` entries carry empty target values (tested) |
| Idempotency and rerun strategy defined | ✅ deterministic ids/keys/fingerprints + restart comparison |
| Migration `0001` rollout documented | ✅ `docs/MIGRATION-RUNBOOK.md` Part A |
| Tests pass | ✅ 174/174 |
| TypeScript and lint zero errors | ✅ |
| Production data unchanged | ✅ re-verified |
| No migration execution occurred | ✅ **nothing was imported or applied** |

### Verdict

**PASS WITH LIMITATIONS.**

P0D-1 delivered a complete, machine-checked static migration mapping, a
deterministic and restart-safe identity/idempotency design, explicit and
conservative financial-reconciliation rules, a read-only dry-run planner with
evidence, a documented `0001` rollout plan, and 45 new tests — all without
touching production data, source data, or the running application.

**Limitations (why not a plain PASS):** the live source data is unavailable, so
every data-dependent verification (row counts, real role spellings, real expense
categories, real duplicates, real totals) is **BLOCKED**; the crew-role
dictionary and venue archive are proposed but not approved; 12 reconciliation
decisions (D1–D12) remain open; migration `0001` is still not applied to
production, so even an approved import could not run yet; and the inherited
build/prerender blocker (missing `GOOGLE_SHEETS_ID`) is unchanged.

**P0D remains IN PROGRESS; master milestone progress stays 5/18 (27.8%).**
