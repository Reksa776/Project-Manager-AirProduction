# MIGRATION MAPPING — Google Sheets → MySQL Contract v2

> **ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).** This historical
> source→target mapping is retained as evidence only. No historical row is mapped
> or imported on the selected Fresh Start path; new MySQL data follows
> `docs/FRESH-START-MYSQL-PLAN.md`.

**Phase:** P0D-1 (planning only — nothing is imported by this document)
**Source of truth for source columns:** `SHEET_HEADERS` in `src/repositories/google/mapping.ts`
(11 worksheets, the contract actually used by the active Google repository)
**Machine-readable spec + validators:** `src/migration/mapping-spec.ts`
(`SHEET_MAPPING_SPECS`, `MIGRATION_ORDER`, `validateSpecCoverage`, `validateMigrationOrder`)

Legend — column disposition:
`MAPPED` = has a target column · `ARCHIVED` = preserved outside a target column (venue) ·
`NOT_MIGRATED` = intentionally dropped (derived status) · `UNAVAILABLE_IN_TARGET` = no target column exists.

---

## 1. Source inventory (static, verified from the repository)

| # | Worksheet | Columns (exact order from `SHEET_HEADERS`) | Target table | Rows |
| --- | --- | --- | --- | --- |
| 1 | `clients` | `id, name, address, contact, notes, created_at, updated_at` | `clients` | **BLOCKED** (no source data) |
| 2 | `vendors` | `id, name, contact, notes, created_at, updated_at` | `vendors` | **BLOCKED** |
| 3 | `venues` | `id, name, address, contact, notes, created_at, updated_at` | *(none — archive)* | **BLOCKED** |
| 4 | `crew` | `id, name, role, contact, default_payment, notes, created_at, updated_at` | `crew` | **BLOCKED** |
| 5 | `jobs` | `id, job_number, client_id, vendor_id, venue_id, job_name, job_type, execution_date, location, status, description, created_at, updated_at` | `jobs` | **BLOCKED** |
| 6 | `job_crews` | `id, job_id, crew_id, role, payment, payment_status, created_at, updated_at` | `job_crews` | **BLOCKED** |
| 7 | `deliveries` | `id, job_id, item_name, delivery_type, quantity, deadline, status, notes, created_at, updated_at` | `deliveries` | **BLOCKED** |
| 8 | `client_payments` | `id, job_id, term, amount, due_date, paid_date, status, notes, created_at, updated_at` | `client_payments` | **BLOCKED** |
| 9 | `vendor_payments` | `id, job_id, type, amount, due_date, paid_date, status, notes, created_at, updated_at` | `vendor_payments` | **BLOCKED** |
| 10 | `expenses` | `id, job_id, category, description, amount, expense_date, notes, created_at, updated_at` | `cashflows` | **BLOCKED** |
| 11 | `admins` | `id, name, email, password_hash, created_at, updated_at` | `admins` | **BLOCKED** |

**Why row counts / distinct values are BLOCKED:** live Google Sheets credentials
are not present in this environment (`GOOGLE_SHEETS_ID` is unset — verified).
`assertSourceDataAvailable()` reports this explicitly instead of inventing
numbers. All *static* mapping work below is verified from the repository
contract; all *data-dependent* checks (row counts, distinct role spellings,
distinct expense categories, real duplicates) remain **BLOCKED** until P0D-2.

No credentials, spreadsheet IDs, customer names, phone numbers, or emails are
reproduced in this document.

---

## 2. Field mapping per worksheet

### 2.1 `clients` → `clients` (FK: none)

| Source | Target | Transform |
| --- | --- | --- |
| `id` | `id` | preserved (varchar(36)); ID collision → conflict, never overwrite |
| `name` | `name` | trim, required (varchar(120)) |
| `address` | `address` | optional |
| `contact` | `phone` | **rename** `contact` → `phone` |
| `notes` | `notes` | optional |
| `created_at` / `updated_at` | same | preserved strings |

Target-only columns: `company_name`, `contact_person`, `email`, `client_type` → **NULL** (no source; enum not guessed).
Duplicate risk: duplicate client names (no UNIQUE). Financial reconciliation: none.

### 2.2 `vendors` → `vendors` (FK: none)

Same shape as clients: `id`, `name`, `contact`→`phone`, `notes`, timestamps.
Target-only: `contact_person`, `email` → NULL. Duplicate risk: duplicate vendor names.

### 2.3 `venues` → **archived, no table** (FK: none)

| Source | Disposition |
| --- | --- |
| `id` | `ARCHIVED` — archive key `venue_id → name`, preserved in audit metadata |
| `name` | `ARCHIVED` — the value snapshotted into `jobs.legacy_venue_name` |
| `address`, `contact`, `notes`, `created_at`, `updated_at` | `UNAVAILABLE_IN_TARGET` — venue is not an active entity |

Transform: `buildVenueArchive` (duplicate/differing names and blank names become conflicts).
**No `venues` table is created. The venue UI is not removed in P0D-1.**

### 2.4 `crew` → `crew` (FK: `crew_roles`)

| Source | Target | Transform |
| --- | --- | --- |
| `id` | `id` | preserved |
| `name` | `name` | trim, required |
| `role` | `crew_role_id` | `resolveCrewRoleId` via **approved** dictionary; never creates a role |
| `contact` | `phone` | rename |
| `default_payment` | `default_payment` | `parseAmount` → decimal string (BigInt minor units) |
| `notes` | `notes` | optional |
| timestamps | same | preserved |

Duplicate risk: same crew name; role spelling variants. Reconciliation: `default_payment` is a *default*, never cash → produces no cashflow.

### 2.5 `jobs` → `jobs` (FK: `clients`, `vendors`)

| Source | Target | Transform |
| --- | --- | --- |
| `id` | `id` | preserved |
| `job_number` | `job_number` | verbatim (generator = P2A); **UNIQUE** in target |
| `client_id` | `client_id` | FK, nullable |
| `vendor_id` | `vendor_id` | FK, nullable |
| `venue_id` | `legacy_venue_name` | `resolveLegacyVenueName(venue_id, archive)`; unknown → `RECONCILIATION_REQUIRED` |
| `job_name` | `job_name` | trim, required |
| `job_type` | `category` | enum `WEDDING/PREWEDDING/CORPORATE/EVENT/OTHER` (unknown → reconciliation) |
| `execution_date` | `execution_date` | `YYYY-MM-DD` |
| `location` | `location` | optional |
| `status` | `status` | enum `NOT_STARTED/IN_PROGRESS/COMPLETED` |
| `description` | `notes` | **rename** `description` → `notes` |
| timestamps | same | preserved |

Constraint risks: duplicate `job_number` (UNIQUE); both `client_id` and `vendor_id` set (CHECK XOR); neither set (CHECK XOR).
Audit: `source_venue_id` is preserved in the plan entry even though the column no longer exists.

### 2.6 `job_crews` → `job_crews` (FK: `jobs`, `crew`, `crew_roles`)

| Source | Target | Transform |
| --- | --- | --- |
| `id` | `id` | preserved |
| `job_id` | `job_id` | FK |
| `crew_id` | `crew_id` | FK |
| `role` | `crew_role_id` | resolves to a role id; the canonical repository stores `NULL` when it equals the crew's master role (override = follow crew) |
| `payment` | `agreed_amount` | `parseAmount` — **obligation, not cash** |
| `payment_status` | — | `NOT_MIGRATED`: derived from cashflows; compared via `reconcileCrewAssignmentPayment` |
| timestamps | same | preserved |

Reconciliation: stored `payment_status` never produces cash (no payment reference exists in the source).

### 2.7 `deliveries` → `deliveries` (FK: `jobs`)

`id`, `job_id` (FK), `item_name`→`name`, `delivery_type`, `quantity` (integer ≥ 0), `deadline` (`YYYY-MM-DD`), `status` (enum), `notes`, timestamps.
Target-only: `delivered_at` → NULL (no source).
Duplicate risk: same delivery name on one job (no UNIQUE).

### 2.8 `client_payments` → `client_payments` (FK: `jobs`)

| Source | Target | Transform |
| --- | --- | --- |
| `id`, `job_id`, `term`, `due_date`, `notes`, timestamps | same | preserved / enum-validated |
| `amount` | `amount` | `parseAmount` — **obligation** (CHECK `amount > 0`) |
| `paid_date` | `paid_date` | date evidence for proposed cash |
| `status` | — | `NOT_MIGRATED`: derived; compared via `reconcileSchedulePayment` |

Duplicate risk: duplicate `(job_id, term)` (no UNIQUE in target) → reported.
Reconciliation: `PAID`+`paid_date` → proposed cash (needs approval); `PAID` without date → reconciliation; `PARTIAL` → reconciliation (partial amount is not stored); `UNPAID`+date → contradiction.

### 2.9 `vendor_payments` → `vendor_payments` (FK: `jobs`)

Identical to `client_payments` with `type` (`DP`/`PELUNASAN`) instead of `term`.
Additional reconciliation: a `VENDOR` expense may duplicate this schedule → dedup by equal amount on the same job.

### 2.10 `expenses` → `cashflows` (FK: `jobs` nullable)

| Source | Target | Transform |
| --- | --- | --- |
| `id` | `idempotency_key` / fingerprint | `migrationIdempotencyKey("expenses", id)` + source fingerprint |
| `job_id` | `job_id` | FK (nullable only if approved) |
| `category` | `category` | `classifyLegacyExpense` (rule corrected in P0D-2A): `TRANSPORT/EQUIPMENT/OTHER` → `READY` (cash); `CREW/VENDOR` → `PROVEN_DUPLICATE` (explicit reference or approved owner decision → skipped), `POTENTIAL_DUPLICATE` (equal amount only → reconciliation, never skipped, no cash), or `RECONCILIATION_REQUIRED` |
| `description` | `description` | required (varchar(190)) |
| `amount` | `amount` | `parseAmount` (CHECK `amount > 0`) |
| `expense_date` | `occurred_on` | **rename** `expense_date` → `occurred_on` |
| `notes` | — | `UNAVAILABLE_IN_TARGET` (recorded in audit metadata) |
| timestamps | same | preserved |

Target-only: `direction` = always `EXPENSE`; `reference_type`/`reference_id` only for proven dedup; `source` = always `MIGRATION`.
Duplicate risks: `CREW`/`VENDOR` expenses duplicating `job_crews`/`vendor_payments`; one payment represented by both a PAID schedule and an expense. An equal amount alone is **circumstantial** (`POTENTIAL_DUPLICATE`) and never sufficient to skip a row — see `docs/MIGRATION-RECONCILIATION.md` §3.

### 2.11 `admins` → `admins` (FK: none)

`id`, `name`, `email` (UNIQUE → duplicate detection), `password_hash` (format verification = P1A), timestamps.
Target-only: `role` → DEFAULT `ADMIN`, `is_active` → DEFAULT `true`, `last_login_at` → NULL.
**Status: `DEFERRED`** — Contract v2 reads admins only; authentication is P1A. Admin rows are prepared but not written in P0D-1.

---

## 3. Migration order (foreign-key safe)

Verified by `validateMigrationOrder()` against the declared dependencies and the
actual FK constraints in `drizzle/0000_magical_true_believers.sql`:

```
1. admins                  (no FK; DEFERRED)
2. crewRoles               (no FK; comes from the APPROVED dictionary, not from a worksheet)
3. clients                 (no FK)
4. vendors                 (no FK)
5. crew                    → crew_roles
6. jobs                    → clients | vendors (CHECK XOR)
7. jobCrewAssignments      → jobs, crew, crew_roles
8. deliveries              → jobs
9. clientPaymentSchedules  → jobs
10. vendorPaymentSchedules → jobs
11. cashflows              → jobs (nullable); polymorphic reference to 7/9/10
```

`job_sequences` is **not** migrated from source: it is derived from job-number
generation (P2A). Venue rows are transformed into `jobs.legacy_venue_name`, not
restored as a table.

**Collision handling:** preserved source IDs are inserted only if the target row
does not already exist; a differing existing row is a **conflict**, reported —
never silently overwritten. `(job_id, term)`/`(job_id, type)` duplicates are
reported for review. `job_number` and `admins.email` collisions surface as
UNIQUE violations and must be resolved before writing.
