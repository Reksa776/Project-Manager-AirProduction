# PHASE P0B — MySQL Repository Implementation

**Phase type:** Strictly locked implementation of the MySQL repository layer. No activation, no schema change, no app/UI/action change.
**Date:** 2026-10-13
**Branch / HEAD:** `main` @ `7c4cc410979aa0bcc79e0d04143ecc7463341939`
**Depends on:** `docs/PHASE-P0A-MYSQL-RECOVERY.md` (recovered MySQL/Drizzle foundation)
**Engine:** MySQL-compatible MariaDB via Drizzle ORM + `mysql2`

**Final verdict: PASS WITH LIMITATIONS** (see §13). Every contract method is either implemented or explicitly BLOCKED with a reason — none are silently omitted. The only non-code limitation remains the external Google Sheets prerender dependency at `next build`.

---

## 1. Baseline Repository State

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `7c4cc410979aa0bcc79e0d04143ecc7463341939` |
| Working tree at start | P0A changes present and preserved (15 modified `src/db`+`tests` files, 2 untracked docs) |
| P0A changes | Preserved unmodified and uncommitted; nothing reset/checked out/discarded |
| Active data source | Google Sheets — `src/repositories/index.ts` returns `googleRepositories` |
| DB | MariaDB 11.8.8 @ `127.0.0.1:3306`, db `database-airprod` (14 tables incl. migration table) |

Documents read before coding: `docs/FULL-PROJECT-AUDIT.md`,
`docs/PHASE-MYSQL-REDESIGN.md`, `docs/PHASE-1-MYSQL-FOUNDATION.md`,
`docs/PHASE-P0A-MYSQL-RECOVERY.md`, plus the live source of
`src/repositories/types.ts`, `src/repositories/index.ts`,
`src/repositories/google/**`, `src/lib/types.ts`, and the service layer.

---

## 2. Repository Contract Inventory

The contract is `src/repositories/types.ts` → `DataRepositories` (11 entities).
Method counts below are exhaustive (no method omitted from the matrix in §5).

| Entity | Contract interface | Methods |
|---|---|---|
| jobs | `JobRepository` (Read + `getByJobNumber` + create/update/delete) | 6 |
| clients | `ClientRepository` (WritableRepository) | 5 |
| vendors | `VendorRepository` (WritableRepository) | 5 |
| venues | `VenueRepository` (WritableRepository) | 5 |
| crew | `CrewRepository` (WritableRepository) | 5 |
| deliveries | `DeliveryRepository` (+ `getByJobId`) | 6 |
| jobCrews | `JobCrewRepository` (+ `getByJobId`) | 6 |
| clientPayments | `ClientPaymentRepository` (+ `getByJobId`) | 6 |
| vendorPayments | `VendorPaymentRepository` (+ `getByJobId`) | 6 |
| expenses | `ExpenseRepository` (+ `getByJobId`) | 6 |
| admins | `AdminRepository` (Read only) | 2 |
| **Total** | | **58** |

**Totals after P0B:** implemented **41** / blocked **17** (see §4, §5, §6).

---

## 3. Files Created and Modified

**Created (all additive; P0B only):**
- `src/repositories/mysql/errors.ts` — `RepositoryError`, `RepositoryNotFoundError`, `RepositoryBlockedError`.
- `src/repositories/mysql/mapping.ts` — row→domain mappers with enum/number validation.
- `src/repositories/mysql/index.ts` — the 11 repository implementations + `mysqlRepositories` aggregate.
- `tests/mysql-repository.test.ts` — 22 integration tests.
- `docs/PHASE-P0B-MYSQL-REPOSITORY.md` — this report.

**Modified:** none.
**Explicitly untouched:** `src/repositories/index.ts` (still `googleRepositories`),
`src/repositories/google/**`, all pages/layouts/components/navigation, all
Server Actions, `src/services/**`, `src/db/schema/**` (P0A frozen), migrations,
`drizzle.config.ts`, `package.json`.

Verified: `git status` shows only P0A's previously modified files plus the new
untracked P0B files. `getRepositories()` still returns `googleRepositories`
(`src/repositories/index.ts:16`).

---

## 4. Implemented Methods

### Fully implemented (41 methods)

| Entity | Implemented methods | Table(s) |
|---|---|---|
| jobs | getAll, getById, getByJobNumber, create, update, delete | `jobs` |
| clients | getAll, getById, create, update, delete | `clients` |
| vendors | getAll, getById, create, update, delete | `vendors` |
| crew | getAll, getById, create, update, delete | `crew` + `crew_roles` (join) |
| deliveries | getAll, getById, getByJobId, create, update, delete | `deliveries` |
| jobCrews | getAll, getById, getByJobId, create, update, delete | `job_crews` + `crew` + `crew_roles` (join) |
| clientPayments | getAll, getById, getByJobId *(read; status derived)* | `client_payments` + `cashflows` |
| vendorPayments | getAll, getById, getByJobId *(read; status derived)* | `vendor_payments` + `cashflows` |
| admins | getAll, getById | `admins` |

Implementation properties: strict TypeScript; Drizzle parameterized queries;
`crypto.randomUUID()` IDs; driver errors propagated unchanged; domain errors
(`RepositoryError`/`RepositoryNotFoundError`) explicit; `null`↔`undefined`
normalised for optional fields; enum and numeric values validated (no blind
casts); no mock fallback; no hardcoded records; no float arithmetic.

---

## 5. Domain/Schema Compatibility Matrix

Legend: **OK** = direct mapping; **ADAPT** = mapped via a documented, unambiguous adapter; **BLOCKED** = cannot be mapped without a business decision.

| Entity | Contract field (domain) | MySQL representation | Status | Note |
|---|---|---|---|---|
| Client | name, contactPerson, phone, email, address, notes | same columns | OK | `company_name`/`client_type` exist in schema but are not in the domain → not surfaced |
| Vendor | name, contactPerson, phone, email, notes | same columns | OK | — |
| Crew | name, phone, notes, defaultPayment | direct columns | OK | — |
| Crew | `role` (free string) | `crew_role_id` FK → `crew_roles.name` | **ADAPT** | read = join to `crew_roles.name`; write = resolve existing role by name (no implicit creation; unknown role → explicit error) |
| Job | jobNumber, jobName, category, clientId, vendorId, executionDate, status, location, notes, createdAt, updatedAt | same columns | OK | — |
| Job | `venueId` | no column (`legacy_venue_name` only, archive) | **ADAPT** | read → `undefined`; write with non-empty `venueId` → explicit error |
| Delivery | name, deliveryType, quantity, deadline, status, deliveredAt, notes | same columns | OK | — |
| JobCrew | jobId, crewId, notes | same columns | OK | — |
| JobCrew | `role` | `crew_role_id` (override, NULL = follow crew) | **ADAPT** | read = `override ?? crew.role`; write sets NULL when equal to crew role, else resolves role id |
| JobCrew | `actualPayment` | `agreed_amount` | **ADAPT** | redesign defines `agreed_amount` as the replacement of the sheet `payment`; semantic = agreement, actual cash lives in `cashflows` |
| JobCrew | `paymentStatus` (optional) | not stored (derived from cashflows) | **ADAPT** | read → `undefined`; write with a value → explicit error |
| ClientPayment | jobId, term, amount, dueDate, paidDate, notes | same columns | OK | — |
| ClientPayment | `status` (required) | not stored (derived from cashflows) | **ADAPT** | read = derived (`UNPAID`/`PARTIAL`/`PAID`) per redesign §8; writes BLOCKED (§6) |
| VendorPayment | jobId, type, amount, dueDate, paidDate, notes | same columns | OK | — |
| VendorPayment | `status` (required) | not stored (derived) | **ADAPT** | same as ClientPayment |
| Admin | id, name, email | same columns | OK | read-only per contract |
| Venue | all fields | no `venues` table | **BLOCKED** | concept removed |
| Expense | all fields | no `expenses` table (`cashflows` instead) | **BLOCKED** | cashflows not in contract |

**Decimal handling:** all money columns are `decimal(15,2)`, declared in Drizzle
with `mode:"number"`. Values are validated finite on both read and write; no
arithmetic is performed in the repository; aggregated cash totals are read as
strings and converted with `Number()` only for comparison.

---

## 6. Blocked Methods and Reasons

| Entity.method(s) | Count | Reason | Behavior |
|---|---|---|---|
| `venues.*` (getAll, getById, create, update, delete) | 5 | No `venues` table in the MySQL schema (Venue removed in redesign). No persistence representation exists. | throws `RepositoryBlockedError("venues.<method>", …)` |
| `expenses.*` (getAll, getById, getByJobId, create, update, delete) | 6 | No `expenses` table; redesign replaces expenses with `cashflows` (direction=EXPENSE), which is not part of the `DataRepositories` contract. | throws `RepositoryBlockedError("expenses.<method>", …)` |
| `clientPayments.create/update/delete` | 3 | Contract requires a **stored** `status`, but the schema intentionally derives it from cashflows. Persisting a schedule while accepting an unpersisted `status` would hide a real semantic difference. | throws `RepositoryBlockedError("client_payments.<method>", …)` |
| `vendorPayments.create/update/delete` | 3 | Same as client payments. | throws `RepositoryBlockedError("vendor_payments.<method>", …)` |
| **Total** | **17** | | |

Additional non-method, explicitly-rejected incompatibilities (throw
`RepositoryError`, never silent): `Job.venueId` on write, `JobCrew.paymentStatus`
on write, crew role that does not exist in `crew_roles`.

No blocked method returns an empty array, a fake success, or discards a field.

---

## 7. Transaction Implementation

Transactions use Drizzle's `db.transaction(async (tx) => …)` on the mysql2 pool.
They wrap the multi-statement operations that must be atomic:

- `jobs.create` / `jobs.update` — INSERT/UPDATE + re-select of DB-generated
  timestamps (`created_at`/`updated_at`).
- `clients` / `vendors` / `deliveries` create/update — write + re-select.
- `crew.create` / `crew.update` — role lookup (`crew_roles`) + INSERT/UPDATE +
  joined re-select.
- `jobCrews.create` / `jobCrews.update` — crew/role lookups + INSERT/UPDATE +
  joined re-select.

No new abstraction was introduced; `tx` is used directly. No schema change was
made to simplify implementation. FK/CHECK/UNIQUE constraints are relied upon for
integrity and their errors propagate to the caller.

---

## 8. Test Results

`tests/mysql-repository.test.ts` (new, 22 tests) plus the retained
`tests/db-foundation.test.ts` (22 tests).

`npm test`:

```
✓ tests/mysql-repository.test.ts (22 tests) 329ms
✓ tests/db-foundation.test.ts (22 tests) 1332ms
Test Files  2 passed (2)
     Tests  44 passed (44)
```

Repository test coverage:

| Area | Case(s) |
|---|---|
| Contract compatibility | all 11 entities present; blocked entities/types throw |
| clients CRUD | create/getById/getAll/update/delete; missing id → null; update/delete missing → error |
| vendors CRUD | create/update/delete |
| crew + roles | role resolved; unknown role → error; blank role → error; non-finite payment → error; decimal round-trip (1500000.55) |
| jobs | create/getByJobNumber/timestamps; `venueId` rejected; duplicate `jobNumber` → UNIQUE; XOR (client+vendor) → CHECK; update/delete; delete missing |
| deliveries | create/getByJobId/getById |
| job_crews | role-equal → override NULL; role-different → override stored; `paymentStatus` rejected; FK missing job → error propagated |
| payments read | status derived UNPAID→PARTIAL→PAID from cashflows; decimal amount read (1000.5) |
| transaction | ROLLBACK leaves no rows; COMMIT persists exactly one row |
| error propagation | Drizzle-wrapped driver errors inspected via `error.cause` |

Test isolation: `tests/setup.ts` guards `DATABASE_URL` → `database-airprod`,
creates/reset/migrates **`airprod_test`** only. Verified after the run:
`database-airprod` still has **14 tables** (unchanged); all mutation occurred in
`airprod_test`.

---

## 9. TypeScript / Lint / Build Results

| Command | Result | Exit |
|---|---|---|
| `npx tsc --noEmit` | **0 errors** | 0 |
| `npm run lint` | **0 errors**, 1 pre-existing warning (`Job` unused import in `src/app/actions/job-actions.ts`, out of scope) | 0 |
| `npm run db:check` | `Everything's fine` | 0 |
| `npm test` | **44 passed / 44** | 0 |
| `npm run build` | **Compile ✓**, **TypeScript ✓**, fails at **prerender** | 1 |

Build breakdown (as required by §5 of the brief):
1. **Compilation errors:** none — `✓ Compiled successfully in 3.3s`.
2. **TypeScript errors:** none — `Finished TypeScript in 19.2s`.
3. **Existing Google Sheets prerender failure:** unchanged external blocker —
   `Error: Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi pada environment.`
   at `/dashboard`. No fake credentials and no mock fallback were introduced.

---

## 10. Database Isolation Evidence

- `src/repositories/mysql` never writes to `database-airprod`; it uses `getDb()`,
  which is pointed at the process `DATABASE_URL` (test setup repoints it to
  `airprod_test` during tests).
- After the full test run (which includes many writes): production
  `database-airprod` = 14 tables (13 app + `__drizzle_migrations`); test
  `airprod_test` = 14 tables. Confirmed by read-only `information_schema` query.
- No destructive command was run against any production database; no migration
  was generated, applied, or altered.

---

## 11. Remaining Risks

1. **Build still cannot exit 0** — external Google credentials required at
   prerender (unchanged from P0A). Not a P0B/P0A code defect.
2. **`JobCrew.actualPayment` ↔ `agreed_amount`** is a documented semantic shift
   (agreement vs actual cash). Services that consume it must not treat it as paid
   cash; this will matter when `getRepositories()` is switched.
3. **Payment `status` is derived**, so any UI relying on stored status will
   observe `UNPAID` until cashflows exist.
4. **Crew role must pre-exist** in `crew_roles`; the repository deliberately does
   not auto-create roles. The seed list (Editor, Videographer, …) from the
   redesign is a later-phase data task.
5. **`venueId` is unsupported**; switching the repository to MySQL while the
   Venue UI still exists would break venue selection — Venue removal (V2) must
   land with/before the repository switch.
6. **`pg`/`@types/pg` remain installed** but unused (out of scope).
7. **`mysqlRepositories` includes throwing BLOCKED stubs**, so it is not
   activatable as-is; activation requires resolving §6 blockers.

---

## 12. P0B Acceptance Criteria

| # | Criterion | Status |
|---|---|---|
| 1 | MySQL repository implemented over recovered foundation | ✅ |
| 2 | Uses Drizzle + mysql2 + existing schema + existing `DataRepositories` contract | ✅ |
| 3 | `getRepositories()` NOT switched to MySQL | ✅ (still `googleRepositories`) |
| 4 | Complete contract inventory + compatibility matrix | ✅ (§2, §5) |
| 5 | Every method implemented or explicitly BLOCKED with reason (none silently omitted) | ✅ (41 / 17) |
| 6 | Domain/schema mismatches documented, no invented behavior | ✅ (§5, §6) |
| 7 | Strict typing, parameterized queries, no mock/hardcoded data, `randomUUID` IDs | ✅ |
| 8 | Decimal-safe financial handling | ✅ |
| 9 | Transactions for atomic operations; no schema change | ✅ (§7) |
| 10 | Integration tests on isolated `airprod_test`; existing 22 tests retained | ✅ (44 total) |
| 11 | TypeScript passes; lint 0 errors | ✅ |
| 12 | Production data untouched; no app/UI/action changes | ✅ |
| 13 | Build: distinguish compile / TS / Google prerender | ✅ (both code stages pass) |

---

## 13. Final Verdict

### **PASS WITH LIMITATIONS**

All P0B code acceptance criteria are met. The repository layer is implemented
with explicit, documented handling of the domain↔schema differences, and blocked
methods fail loudly rather than concealing incompatibility. Tests, TypeScript,
lint, and `db:check` are green.

**Limitations:** (a) `next build` still cannot exit 0 because of the external
Google Sheets prerender dependency (no fake credentials/fallback); (b) 17 of 58
contract methods are intentionally BLOCKED (venues, expenses, payment writes)
pending business decisions; (c) `mysqlRepositories` is therefore not activatable
yet. The application is **not** claimed production-ready, and `getRepositories()`
remains unchanged.

---

## 14. P0C Prerequisites

Before activating the MySQL repository (`getRepositories()` switch), P0C must:

1. Resolve or formally defer the §6 blockers:
   - decide expense → cashflow mapping and add a cashflow service/repository;
   - decide payment `status` semantics (derived-only) and provide write adapters;
   - confirm Venue handling (complete removal V2 or archival).
2. Implement the data migration Sheets → MySQL (M1–M5) with reconciliation.
3. Implement the payment write path inside transactions (cashflow + schedule
   update) once cashflows are in scope.
4. Keep the Google repository until M4 sign-off; then flip `getRepositories()`
   in one reviewed change and run the full verification suite.
5. Provide real Google credentials (or make data-reading pages dynamic) so a
   green `next build` can be demonstrated.

---

### Appendix — Key Commands

```
$ npx tsc --noEmit          # exit 0
$ npm run lint              # 0 errors, 1 warning
$ npm run db:check          # Everything's fine
$ npm test                  # 44 passed (22 foundation + 22 repository)
$ npm run build             # compile ✓, TypeScript ✓, prerender ✗ (GOOGLE_SHEETS_ID)
$ grep getRepositories src/repositories/index.ts   # return googleRepositories;
```
