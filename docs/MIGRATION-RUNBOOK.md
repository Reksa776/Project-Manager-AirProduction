# MIGRATION RUNBOOK — 0001 Rollout & Historical Import (P0D-1 planning)

> **PARTLY ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).**
> **Part B (historical data import) is cancelled / not required.**
> **Part A (migration `0001` schema rollout) is still relevant**, because the
> canonical MySQL financial services require the nullable `cashflows.job_id`,
> `idempotency_key` and `idempotency_fingerprint` from `0001` — but it now serves
> the Fresh Start path and requires a **new, separate approval** (P0E-2), not the
> cancelled historical-import approval. See
> `docs/PHASE-P0D-CLOSE-FRESH-START-TRANSITION.md` and
> `docs/FRESH-START-MYSQL-PLAN.md`.

**Phase:** P0D-1. This document is a **plan**. It does not authorize execution:
nothing here has been run against production, and migration `0001` has **not**
been applied to `database-airprod`.

Inherited state (verified in P0C-3 and re-verified in P0D-1):

| Item | Value |
| --- | --- |
| Production DB | `database-airprod` — 14 tables; `cashflows.job_id` still `NOT NULL`; no idempotency columns; no UNIQUE on `cashflows` |
| Applied migrations (prod) | `0000_magical_true_believers` (and `__drizzle_migrations`) only |
| Migrations on disk | `drizzle/0000_magical_true_believers.sql`, `drizzle/0001_dizzy_sunspot.sql` (journal + snapshots consistent, `db:check` clean) |
| Test DB | `airprod_test` — both migrations applied by `tests/setup.ts` on every run |

### P0D-2A — read-only tooling now available

| Tool | Command | Notes |
| --- | --- | --- |
| Production preflight | `npm run migration:preflight` | `SELECT`/`information_schema` only; refuses any database other than `database-airprod`; prints the A.2 baseline and the P0D-2B readiness checklist |
| Source snapshot + fixed-snapshot dry-run | `npm run migration:snapshot` | Read-only (`spreadsheets.readonly`, `values.batchGet` only); fails closed without credentials (exit 3); `--write-raw` archives the raw snapshot into the gitignored `.migration-snapshots/` |

Verified read-only preflight result (2026-10-14): 14 tables (all `0` rows),
journal = `0000` only, `cashflows.job_id` `NOT NULL`, idempotency columns and
UNIQUE index absent, FK intact, defaults `0.00`, no drift. **`0001` was not
applied and no data was written.** Source-ID collision checking and the real
dry-run remain BLOCKED pending read-only credentials.

---

## PART A — Migration `0001` rollout (schema only)

### A.1 Expected schema changes (`drizzle/0001_dizzy_sunspot.sql`)

```sql
ALTER TABLE `cashflows` MODIFY COLUMN `job_id` varchar(36);                      -- becomes NULLABLE (FK kept)
ALTER TABLE `crew`      MODIFY COLUMN `default_payment` decimal(15,2) NOT NULL DEFAULT '0.00';
ALTER TABLE `job_crews` MODIFY COLUMN `agreed_amount`   decimal(15,2) NOT NULL DEFAULT '0.00';
ALTER TABLE `cashflows` ADD `idempotency_key` varchar(190);                      -- NULL allowed (many NULLs OK on UNIQUE)
ALTER TABLE `cashflows` ADD `idempotency_fingerprint` char(64);
ALTER TABLE `cashflows` ADD CONSTRAINT `uq_cashflows_idempotency_key` UNIQUE(`idempotency_key`);
```

Semantics: only loosening `NOT NULL` on `cashflows.job_id`, two equivalent
`DEFAULT 0` → `DEFAULT '0.00'` normalisations, and two new nullable columns plus
one UNIQUE index. **No column is dropped, no row is modified, no CHECK is removed.**
The FK `cashflows.job_id → jobs.id (RESTRICT)` is retained.

### A.2 Preflight checks (must all pass)

1. `npx drizzle-kit check` → clean (also proves snapshots match the schema).
2. Confirm the production journal state equals `0000` and no manual DDL drift:
   `SELECT * FROM __drizzle_migrations ORDER BY id;`
3. Row-count baseline per table (`clients, vendors, crew, crew_roles, jobs, job_crews, deliveries, cashflows, client_payments, vendor_payments, admins, sessions, job_sequences`).
4. Confirm `cashflows.job_id` is currently `NOT NULL` and idempotency columns are absent (baseline fingerprint of the schema).
5. Verify the maintenance window and that the Google Sheets runtime (still the active data source) is idle or read-only for the window.
6. Confirm a restore point exists (A.3) **before** any DDL.

### A.3 Backup / restore requirements

- **Logical dump of the whole database** (`mysqldump --single-transaction --routines --triggers --databases database-airprod`) stored outside the app host, checksum recorded.
- Record the pre-migration schema fingerprint (row counts + `information_schema` snapshot for `cashflows`, `crew`, `job_crews`).
- Restore rehearsal: import the dump into a throwaway database and confirm the row counts match before proceeding.
- Keep the dump until post-migration verification (A.6) is signed off.

### A.4 Order of operations

1. Freeze writes (Google Sheets app is the only writer today; MySQL is inactive).
2. Take the backup + record the baseline (A.2 items 3–4).
3. Apply `0001` with the committed journal (`npx drizzle-kit migrate`) — no hand-edited SQL.
4. Run the post-migration verification (A.6).
5. Unfreeze.

An alternative equivalent path is an ALTER script generated from the same
migration file; hand-written variants are not permitted because they would break
journal determinism.

### A.5 Failure handling

| Failure | Action |
| --- | --- |
| DDL fails mid-way (e.g. lock timeout) | stop immediately; do not retry blindly; verify which statements applied, then restore from the dump (MySQL DDL is not transactional in this MariaDB version) |
| UNIQUE creation fails (duplicate `idempotency_key`) | impossible while all values are NULL; if it fails, the column was pre-populated by drift → investigate before retrying |
| Long lock on a large `cashflows` table | re-run inside the maintenance window; ALTER TABLE ... MODIFY on `varchar(36)` may rebuild the table |
| Any doubt about state | restore from the dump and start over |

### A.6 Post-migration verification

1. Table count still 14; `journal` now contains `0001_dizzy_sunspot`.
2. `cashflows.job_id` is `IS_NULLABLE = YES`; FK to `jobs.id` still present.
3. `idempotency_key` + `idempotency_fingerprint` exist; `uq_cashflows_idempotency_key` is UNIQUE.
4. `crew.default_payment` and `job_crews.agreed_amount` defaults read `0.00`.
5. Row counts identical to the baseline for every table (A.2 item 3).
6. Spot-check totals: `SELECT SUM(amount) FROM cashflows;` equals the pre-migration sum.
7. Application still runs on Google Sheets (`getRepositories()` unchanged) — no runtime switch in this phase.

### A.7 Rollback / restore strategy

There is **no down-migration**. Rollback = restore the logical dump (A.3) into a
recreated database, then re-point the app connection. Because `0001` is additive
and non-destructive, a restore is only required if DDL fails or the verification
in A.6 finds data loss.

### A.8 Required approval

Execution requires an explicit, written approval naming: the maintenance window,
the responsible operator, the backup location, and the go/no-go decision.
**No such approval has been given; `0001` remains unapplied.**

---

## PART B — Historical data import (P0D-2, not started)

### B.1 Identity, idempotency, restart safety

| Mechanism | Implementation |
| --- | --- |
| Stable source identity | `(worksheet, source id)` → `sourceIdentityString` |
| Deterministic target id | `deterministicMigrationId(sheet, id)` — UUIDv5-style SHA-256 derivation, verified by `isDeterministicMigrationId` |
| Change detection | `sourceFingerprint(record)` (SHA-256 over sorted `column=value`); `detectRunConflict(previous, next)` |
| Run integrity | `snapshotFingerprint(plan)` over all `(sheet:id:fingerprint)` |
| Cashflow idempotency | `migrationIdempotencyKey(sheet, id)` = `migration:<sheet>:<id>` (≤190 chars) written to `cashflows.idempotency_key` (`UNIQUE`) with the payload fingerprint in `idempotency_fingerprint` |
| Restart | per-row checkpoints keyed by `(sheet, id)` storing status + fingerprint; a rerun skips `UNCHANGED`, flags `CHANGED`, and reports `disappearedSources` |
| Conflicts | existing target row with a different fingerprint → conflict report; **never** an unconditional overwrite |

`cashflows.source = 'MIGRATION'` is supported by the schema
(`chk_cashflows_source` allows `MIGRATION`); migrated rows therefore stay
distinguishable from `MANUAL` rows, and random idempotency keys are never
generated per rerun.

### B.2 Execution order

Follow `MIGRATION_ORDER` (admins → crewRoles → clients → vendors → crew → jobs →
jobCrewAssignments → deliveries → clientPaymentSchedules →
vendorPaymentSchedules → cashflows), inside the transaction boundaries recommended
below, with a checkpoint written after each entity completes.

Per-entity transaction strategy: one transaction **per source row** (so a single
bad row cannot roll back an entire entity), plus a short verification query after
each batch. `cashflows` additionally relies on the UNIQUE idempotency index rather
than pre-reads (the P0C-2 race-safe pattern).

### B.3 Preconditions before any write

1. PART A completed and verified (otherwise idempotency/`job_id` support is absent).
2. **Approved crew-role dictionary** (`approvedBy` non-empty) — otherwise every crew/assignment row stays `RECONCILIATION_REQUIRED`.
3. **Approved legacy venue archive** (conflicts and blank names resolved) — otherwise venue jobs stay `RECONCILIATION_REQUIRED`.
4. **Approved decision on `RECONCILIATION_REQUIRED` rows** (see the unresolved decisions in the phase report). Nothing ambiguous is imported by default.
5. **Approved policy for proposed cash** from `PAID`+`paid_date` schedules.
6. Dry-run report produced from the real snapshot and reviewed (counts, reconciliations, totals, run comparison).
7. Backup + restore rehearsal (A.3) repeated for the data import.

### B.4 Dry-run first, always

`runDryRun({ source, approvedCrewRoleDictionary, previousRunFingerprints })`
produces the plan, per-entity summary, reconciliation list, totals and snapshot
fingerprint **without writing anything** (`writesAttempted: false`). The real
snapshot must be run through this first, and the resulting report attached to the
P0D-2 approval request.

### B.5 Verification after import

- `compareTotals(dryRunTotals, postImportTotals)` → `matched: true` expected; any discrepancy is listed per job/category/reference.
- Row counts per target table equal the number of `READY` plan entries per entity.
- `SELECT source, COUNT(*) FROM cashflows GROUP BY source;` shows exactly the planned `MIGRATION` rows.
- Re-run the dry-run with `previousRunFingerprints` → no `changedSources`, proving idempotency.
- Confirm the Google Sheets runtime is still the active provider (`getRepositories()`), and that `database-airprod` was only written by the approved import.

### B.6 Rollback

Migrated rows are identifiable by identity: target id = `deterministicMigrationId(...)`
and `cashflows.source = 'MIGRATION'` with `migration:`-prefixed idempotency keys.
Rollback = delete exactly those rows in reverse FK order (cashflows → schedules →
assignments → deliveries → jobs → crew → vendors/clients), or restore the pre-import dump. No destructive statement may run without the written approval.
