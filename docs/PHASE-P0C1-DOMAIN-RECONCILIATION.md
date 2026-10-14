# PHASE P0C-1 — DOMAIN & REPOSITORY CONTRACT RECONCILIATION

Status: **PASS WITH LIMITATIONS**
Scope: P0C-1 only (canonical domain, repository contract, financial operation
contracts, compatibility mapping, pure helpers, focused tests). No P0C-2 work.

---

## 1. Baseline and Repository State

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD | `7c4cc410979aa0bcc79e0d04143ecc7463341939` (last approved) |
| Working tree | Uncommitted P0A/P0B work preserved (schema, `src/db/*`, mysql repo, tests) — **not reset, not stashed, not overwritten** |
| Production DB | `database-airprod` — **14 tables before and after** (verified via `information_schema`) |
| Migration folder | `drizzle/` clean — **no migration generated or applied** |
| Active repositories | `getRepositories()` still returns `googleRepositories` (`src/repositories/index.ts:16`) — **unchanged** |

Documents read: `docs/FULL-PROJECT-AUDIT.md`, `docs/PHASE-MYSQL-REDESIGN.md`,
`docs/PHASE-P0A-MYSQL-RECOVERY.md`, `docs/PHASE-P0B-MYSQL-REPOSITORY.md`.

The approved MySQL foundation (13 domain tables + `job_sequences`) was preserved
as-is. No schema, repository (Google/MySQL), page, UI, service, or Server Action
file was modified in this phase.

---

## 2. Files Created / Modified

New (all P0C-1):

- `src/domain/money.ts` — decimal-safe money (`Amount` + BigInt minor units)
- `src/domain/types.ts` — canonical domain entity/enum types
- `src/domain/inputs.ts` — canonical write-operation input types
- `src/domain/finance.ts` — pure financial calculations (status/settlement/aggregate)
- `src/domain/validation.ts` — enums, type guards, domain invariants
- `src/domain/reconciliation.ts` — reconciliation state + historical resolvers
- `src/domain/legacy-compat.ts` — legacy → canonical adapters
- `src/repositories/contract/types.ts` — canonical repository contract v2
- `src/repositories/contract/index.ts` — contract barrel export
- `tests/domain-contract.test.ts` — 31 focused domain/contract tests
- `docs/PHASE-P0C1-DOMAIN-RECONCILIATION.md` — this report

Modified: **none.** Everything else in `git status` is preserved, pre-existing
P0A/P0B work.

---

## 3. Canonical Domain Definitions

Written in `src/domain/types.ts` against the approved MySQL schema. Key
decisions:

- **Money** = `Amount` = canonical decimal **string** (`"1500000.55"`), never
  `number`. Arithmetic is done in BigInt minor units (cents) in `money.ts`, so
  `decimal(15,2)` values (up to 9,999,999,999,999.99) never lose precision.
- **Entities:** `Client`, `Vendor`, `CrewRole`, `Crew`, `Job`, `Delivery`,
  `JobCrewAssignment`, `ClientPaymentSchedule`, `VendorPaymentSchedule`,
  `Cashflow`, `Admin`, `SessionRecord`.
- **Enums** mirror the DB CHECK constraints exactly
  (`JOB_STATUS`, `CASHFLOW_DIRECTION`, `CASHFLOW_CATEGORY`, `ADMIN_ROLE`, …).
- **No `Venue` type. No `Expense` type.**
- **Payment status is not stored** on schedules or assignments.
- `Crew.crewRoleId` is the normalized FK; display role comes from `CrewRole.name`.
- `Job.legacyVenueName` is a historical snapshot string.

Rounding policy (`money.ts`): **half-up, away from zero, to 2 decimals**,
applied once at parse time. `ROUNDING_POLICY` is exported as the single source
of truth.

---

## 4. Legacy vs New Contract Comparison

| Concern | Legacy (`src/repositories/types.ts`) | New (`src/repositories/contract`) |
| --- | --- | --- |
| Venue | `venues: VenueRepository` (CRUD) | **excluded** — `Job.legacyVenueName` |
| Expense | `expenses: ExpenseRepository` (CRUD) | **excluded** — `cashflows` |
| Crew role | `Crew.role: string` (free text) | `Crew.crewRoleId` (FK) + `crewRoles` repo |
| Job↔Crew | `JobCrew.actualPayment: number` | `agreedAmount: Amount`; cash via `cashflows` |
| Payment status | stored `status: PaymentStatus` | derived; not a field |
| Client/Vendor payment | single CRUD repo w/ stored status | separate **schedule** repos + `cashflows` |
| Money | `number` | `Amount` (decimal string) |
| Sessions | absent | `sessions` repo type (auth impl = P1A) |
| Version | — | `REPOSITORY_CONTRACT_VERSION = 2` |

Legacy contract remains fully intact and is still what the app runs on.

---

## 5. Resolution of the 17 Blocked Methods

The 17 methods blocked in P0B (venues 5, expenses 6, clientPayments writes 3,
vendorPayments writes 3) are resolved **architecturally, not by omission**:

- **venues (5):** the venue module is removed from the new contract by design
  (locked decision A). Historical venue names are preserved via
  `Job.legacyVenueName`. The old `Venue` UI/domain is intentionally left in
  place for now (not deleted in P0C-1).
- **expenses (6):** replaced by the unified `cashflows` ledger (locked decision
  B). `RecordGeneralExpenseInput` expresses operational expenses as an
  `EXPENSE` cashflow row.
- **clientPayments writes (3) & vendorPayments writes (3):** the misleading
  "payment with stored status" model is replaced by two separated concepts —
  **schedules** (obligations) and **cashflows** (actual money) — with explicit
  operation contracts in `FinancialOperations` (locked decisions B/C).

**These blocked methods are NOT operational.** They are superseded by contract
definitions only; no live write service exists yet. Activation belongs to P0C-2.

---

## 6. Financial Operation Contracts

Defined (types only, no implementation) in
`src/repositories/contract/types.ts`:

- `FinancialOperations.createClientPaymentSchedule` / `createVendorPaymentSchedule`
- `FinancialOperations.updateClientPaymentSchedule` / `updateVendorPaymentSchedule`
- `recordClientPayment` / `recordVendorPayment` / `recordCrewPayment`
- `recordGeneralExpense`
- `readCashflows(query: PaymentHistoryQuery)`
- `deriveClientPaymentStatus(scheduleId)`
- `deriveCrewSettlement(assignmentId)`

**Obligation vs cash movement is explicit:** schedules and
`JobCrewAssignment.agreedAmount` represent what is owed; `cashflows` rows
represent what actually moved. `RecordPaymentResult` returns
`paidAmount`/`remainingAmount`/`status` **derived** from the ledger — creating a
schedule never implies money moved.

Pure helpers (implemented, tested) in `src/domain/finance.ts`:
`derivePaymentStatus`, `deriveSettlement`, `sumCashAmounts`,
`aggregateCashflows`, `validateCashflow`, `paymentIdempotencyKey`, `isFullyPaid`.

Status semantics (locked): `paid <= 0 → UNPAID`; `0 < paid < obligation →
PARTIAL`; `paid >= obligation → PAID`. Overpayment reports `overpaidAmount`
without silently clamping.

---

## 7. Transaction and Idempotency Requirements

Documented on the contract (rules for P0C-2):

- Recording cash = **one transaction** inserting exactly one `cashflows` row
  (plus, when relevant, setting a schedule's `paid_date`). Failure →
  `ROLLBACK`; no orphan cash row.
- Recording a payment **never mutates or deletes the schedule** (obligation
  persists).
- Each cash record must reference exactly one of
  `client_payment | vendor_payment | job_crew` (matches DB `chk_cashflows_reference`).
- A deterministic `idempotencyKey` (see `paymentIdempotencyKey`) detects
  repeated submissions.
- **Schema prerequisite:** `cashflows` currently has no idempotency column or
  UNIQUE index on `(reference_type, reference_id)`; a schema decision is a P0C-2
  prerequisite (no migration applied here).

---

## 8. Historical Migration Mapping

Implemented as pure adapters in `src/domain/legacy-compat.ts`. Every mapping is
documented; ambiguous data yields `RECONCILIATION_REQUIRED` instead of a guess.

| Legacy field | Canonical target | Rule |
| --- | --- | --- |
| `Job.venueId` | `Job.legacyVenueName` | name from venue archive → OK; id with no name → reconciliation required |
| `Crew.role` | `Crew.crewRoleId` | lookup by name; unknown/empty → reconciliation required (no implicit create) |
| `JobCrew.actualPayment` | `JobCrewAssignment.agreedAmount` | same value, re-typed to `Amount`; **not** treated as paid |
| `JobCrew.paymentStatus` | *(none)* | stored status cannot map to derived status → reconciliation required |
| `ClientPayment.status` | *(none)* | dropped; `amount` → schedule, status derived from cashflow |
| `VendorPayment.status` | *(none)* | dropped; `amount` → schedule, status derived from cashflow |
| `Expense` row | `Cashflow(direction=EXPENSE)` | category mapped; `CREW`/`VENDOR` ambiguous → reconciliation required |
| `Job.jobNumber` | `Job.jobNumber` | preserved verbatim (generator = P2A) |

Reconciliation resolvers in `src/domain/reconciliation.ts`:
`reconcileLegacyVenue`, `reconcileLegacyCrewRole`,
`reconcileLegacyExpenseCategory`, `reconcileStoredPaymentStatus`.

---

## 9. Compatibility Strategy

- The legacy domain (`src/lib/types.ts`) and legacy contract
  (`src/repositories/types.ts`) are **untouched**; `getRepositories()` still
  returns `googleRepositories`.
- Compatibility is achieved through **explicit adapters** (`legacy-compat.ts`)
  that return `Reconciled<T>` — no `any`, no forced casts, and no accidental
  semantic changes to existing fields.
- The canonical types live in a separate module tree (`src/domain/**`,
  `src/repositories/contract/**`) that nothing in the running app imports, so
  existing pages/services/actions compile and run exactly as before (proved by
  `tsc`, `lint`, and the preserved 44 tests still passing).

---

## 10. Test Results

Command: `npx vitest run` (isolated `airprod_test` only).

| File | Tests |
| --- | --- |
| `tests/db-foundation.test.ts` | 22 (retained) |
| `tests/mysql-repository.test.ts` | 22 (retained) |
| `tests/domain-contract.test.ts` | **31 (new)** |
| **Total** | **75 passed / 75** |

New coverage: decimal-safe money (0.1+0.2, half-up, large values, invalid
input), status derivation, agreed vs paid, remaining amount, zero-payment,
overpayment, negative-cash rejection, idempotency-key stability, cashflow
aggregation + invariant validation, Job XOR invariant, positive-amount
validation, venue/crew-role/expense/stored-status reconciliation, all
legacy→canonical adapters, and contract shape (v2, excludes venues/expenses,
separates schedules from cashflows).

Before: 44 passing. After: 75 passing (no regression).

---

## 11. TypeScript / Lint / Build Results

- `npx tsc --noEmit` → **0 errors**.
- `npm run lint` → **0 errors** (1 pre-existing warning in
  `src/app/actions/job-actions.ts`, out of scope).
- `npm run db:check` → `Everything's fine 🐶🔥` (schema consistency OK).
- `npm run build` → **fails at static prerender** with
  `Konfigurasi Google Sheets tidak lengkap: GOOGLE_SHEETS_ID belum diisi`.
  This is the **pre-existing Google Sheets dependency**, not a P0C-1
  regression: compilation ✓ and TypeScript ✓ both pass. No fake credentials or
  mock fallback were introduced to hide it.

---

## 12. Remaining Risks and Blockers

1. **Build requires real Google credentials** (or dynamic data pages) to go
   green — inherited, not introduced here.
2. **`cashflows.job_id` is NOT NULL (FK RESTRICT).** General operational
   expenses with no job cannot be represented yet; `RecordGeneralExpenseInput`
   documents this and marks it a schema-decision prerequisite.
3. **No idempotency column/UNIQUE index** in `cashflows` — application-level key
   only until a schema decision is made.
4. **Historical venue archive** is required to turn `venueId`-only jobs into
   `legacy_venue_name` snapshots; otherwise reconciliation is required.
5. **`CREW`/`VENDOR` legacy expense categories** risk double-counting against
   `job_crews`/`vendor_payments`; flagged as reconciliation-required.
6. **Crew roles must pre-exist** in `crew_roles` before crew/assignment records
   can map; no implicit creation.
7. The canonical contract has **no live implementation** yet, so nothing in the
   running app depends on it.

---

## 13. P0C-2 Prerequisites

- Decide the `cashflows.job_id` nullability (or an operational-expense path) to
  support non-job expenses.
- Decide and, if approved, migrate the idempotency mechanism
  (`(reference_type, reference_id, occurred_on, amount)` uniqueness).
- Provide/parse the historical venue archive for `legacy_venue_name` backfill.
- Finalize the crew-role list and the `CREW`/`VENDOR` expense reconciliation rule.
- Only then implement the live financial write service and a MySQL repository
  that satisfies `MySqlRepositories` + `FinancialOperations`, inside
  transactions, with tests.

---

## 14. Final Verdict

**PASS WITH LIMITATIONS.**

Acceptance criteria 1–12 are met: canonical domain defined; new contract
excludes Venue/Expenses; obligations and cash movements are explicitly
separated; payment-status semantics are unambiguous; historical venue data is
preserved by design; Google Sheets paths are unchanged; no production data or
migration was modified; all 44 existing tests still pass (75 total); new
contract tests pass; TypeScript and lint are clean; no subsequent phase was
started.

**Limitations:** the build fails only on the pre-existing missing
`GOOGLE_SHEETS_ID`; the 17 formerly-blocked methods are superseded by the new
contract but are **not operational** — they are deliberately deferred to P0C-2
along with the schema decisions in section 13.
