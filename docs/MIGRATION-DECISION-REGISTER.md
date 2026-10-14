# MIGRATION DECISION REGISTER — D1…D12 (P0D-2A)

> **ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).** D1–D12 are
> **historical-import gates only**. They are **not** prerequisites of the Fresh
> Start path and must **not** be applied to new MySQL data. The business needs
> behind them (crew roles, ledger integrity, job numbering, auth, venue removal,
> client form, Vercel connectivity) are tracked separately in
> `docs/FRESH-START-MYSQL-PLAN.md` §2.

**Phase:** P0D-2A. **Nothing here is approved.** No decision may be marked
`APPROVED` without explicit written owner authorisation naming the approver.

Machine-readable source of truth: `src/migration/decision-register.ts`
(`DECISION_DEFINITIONS`, `buildDecisionRegister`, `migrationBlockers`,
`assertApprovalsAreAuthorized`). Rows marked *BLOCKED* mean the evidence cannot
be produced without a read-only snapshot of the real spreadsheet — see
`docs/MIGRATION-SNAPSHOT-INVENTORY.md`.

## Register state

| Decision | Affected rows | Approval state | Blocks | Required approver |
| --- | --- | --- | --- | --- |
| D1 — Approved crew-role dictionary & ambiguous spellings | **BLOCKED** (`null`) | `BLOCKED_SOURCE_UNAVAILABLE` | **whole migration** | Owner operasi (data master) |
| D2 — Venue archive: conflicting & blank names | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner operasi (venue) |
| D3 — Jobs referencing unknown venue IDs | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner operasi (venue) |
| D4 — Cash proposed from `PAID` + `paid_date` | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | **whole migration** | Owner keuangan |
| D5 — Unknown amounts for `PARTIAL` schedules | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner keuangan |
| D6 — Unmatched `CREW`/`VENDOR` expenses | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner keuangan |
| D7 — Crew payment evidence & potential duplicates | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner keuangan + owner operasi |
| D8 — Orphan references | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner operasi |
| D9 — Operational expenses without `job_id` | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner keuangan |
| D10 — Duplicate payment schedules | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner keuangan |
| D11 — Legacy admin rows & password-hash compatibility | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner sistem + P1A |
| D12 — Historical job-number sequence seeding | **BLOCKED** | `BLOCKED_SOURCE_UNAVAILABLE` | rows | Owner operasi + P2A |

`affectedRowCount: null` is deliberate: the count is **not guessed**. When a
snapshot exists, the same builder fills exact counts and sanitised evidence, and
`buildDecisionRegister` reports `NOT_APPROVED` for anything without an approval
record (`approvedBy` non-empty **and** `approvedAt` non-empty).

## Register detail

Each entry below lists: affected rows, available evidence (sanitised), the safe
options, the consequence of each option, the current approval state, the required
approver, and whether the issue blocks the whole migration or only rows.

### D1 — Approved crew-role dictionary & ambiguous spellings
- **Affected rows:** BLOCKED — all rows of `crew` and `job_crews` until the dictionary exists.
- **Evidence:** BLOCKED. To be produced: distinct `role` values with occurrence counts (`crew` + `job_crews`) plus `AMBIGUOUS_ROLE` pairs (similar but not identical spellings, edit distance ≤ 2 or containment). `proposeCrewRoleDictionary()` returns `approvalStatus: "PROPOSED_NOT_APPROVED"` and preserves every original spelling.
- **Options / consequences:**
  1. `APPROVE_DICTIONARY` — approve canonical names + spelling mapping → crew/assignment rows become mappable; unmapped spellings stay held.
  2. `DEFER` — every crew and job-crew row stays `RECONCILIATION_REQUIRED` (`ROLE_DICTIONARY_NOT_APPROVED`).
- **Approval state:** NOT APPROVED (blocked: source). **Approver:** Owner operasi. **Blocks:** whole migration.

### D2 — Venue archive: conflicting & blank names
- **Affected rows:** BLOCKED — `venue_id`s present with >1 distinct name or with a blank name.
- **Evidence:** to be produced from the `venues` worksheet (`VENUE_ARCHIVE_CONFLICT`, `VENUE_ARCHIVE_BLANK_NAME`).
- **Options:** `PICK_AUTHORITATIVE` (name the authoritative value per id → affected jobs can be filled) or `LEAVE_EMPTY` (affected jobs remain held).
- **Approver:** Owner operasi (venue). **Blocks:** affected rows only.

### D3 — Jobs referencing unknown venue IDs
- **Affected rows:** BLOCKED — jobs whose `venue_id` is absent from the `venues` archive.
- **Evidence:** to be produced (`VENUE_NAME_MISSING`); names are never invented.
- **Options:** `CORRECT_SOURCE` (fix in the sheet) or `ACCEPT_EMPTY` (import with `legacy_venue_name` empty; the historical `venue_id` survives only as audit metadata).
- **Approver:** Owner operasi (venue). **Blocks:** affected rows only.

### D4 — Cash proposed from `PAID` + `paid_date`
- **Affected rows:** BLOCKED — every schedule stored as `PAID` with a `paid_date`.
- **Evidence:** to be produced (`reconcileSchedulePayment` → `PROPOSED_CASH`, `requiresApproval: true`).
- **Options:** `APPROVE_PROPOSED_CASH` (cash = full amount on `paid_date`) or `OBLIGATION_ONLY` (no historical cash).
- **Approver:** Owner keuangan. **Blocks:** whole migration (the cash model affects every total).

### D5 — Unknown amounts for `PARTIAL` schedules
- **Affected rows:** BLOCKED — schedules stored as `PARTIAL` (the partial amount is not stored in the source).
- **Evidence:** to be produced (`PARTIAL_AMOUNT_UNKNOWN`).
- **Options:** `SUPPLY_AMOUNTS` (owner supplies per-row amounts) or `OBLIGATION_ONLY`.
- **Approver:** Owner keuangan. **Blocks:** affected rows only.

### D6 — Unmatched `CREW`/`VENDOR` expenses
- **Affected rows:** BLOCKED — `CREW`/`VENDOR` expenses with no equal-amount candidate on the same job, plus unmappable categories.
- **Evidence:** to be produced (`AMBIGUOUS_EXPENSE_CATEGORY`, `UNMAPPABLE_EXPENSE_CATEGORY`).
- **Options:** `TREAT_AS_CASH`, `TREAT_AS_GENERAL` (category must be supplied), `EXCLUDE`.
- **Approver:** Owner keuangan. **Blocks:** affected rows only.

### D7 — Crew payment evidence & potential duplicates
- **Affected rows:** BLOCKED — crew assignments with a stored `payment_status` (plus equal-amount `CREW` expense candidates).
- **Evidence:** to be produced (`CREW_PAYMENT_STATUS_STORED`, `CANDIDATE_EXPENSE_EVIDENCE`). A stored crew status is **never** cash evidence, and an equal amount is only a candidate (see the corrected rule in `docs/MIGRATION-RECONCILIATION.md` §3).
- **Options:** `APPROVE_EVIDENCE` (per-row cash approval) or `OBLIGATION_ONLY`.
- **Approver:** Owner keuangan + owner operasi. **Blocks:** affected rows only.

### D8 — Orphan references
- **Affected rows:** BLOCKED — `MISSING_CLIENT/VENDOR/VENUE/JOB/CREW_REFERENCE`.
- **Evidence:** to be produced (`referenceIssues`).
- **Options:** `FIX_SOURCE` or `SKIP_ROWS`.
- **Approver:** Owner operasi. **Blocks:** affected rows only.

### D9 — Operational expenses without `job_id`
- **Affected rows:** BLOCKED — `expenses` rows with an empty/unknown `job_id`.
- **Evidence:** to be produced. Note this option depends on migration `0001` making `cashflows.job_id` nullable — **`0001` is still unapplied**.
- **Options:** `ALLOW_NULL_JOB` or `SKIP_ROWS`.
- **Approver:** Owner keuangan. **Blocks:** affected rows only.

### D10 — Duplicate payment schedules
- **Affected rows:** BLOCKED — repeated `(job_id, term)` in `client_payments` and `(job_id, type)` in `vendor_payments`.
- **Evidence:** to be produced. (The target schema has no UNIQUE constraint on those pairs, so duplicates would import silently without a decision.)
- **Options:** `IMPORT_BOTH`, `MERGE` (amounts must be supplied, never invented), `SKIP_DUPLICATE`.
- **Approver:** Owner keuangan. **Blocks:** affected rows only.

### D11 — Legacy admin rows & password-hash compatibility
- **Affected rows:** BLOCKED — every `admins` row (currently planned as `DEFERRED`).
- **Evidence:** to be produced; hash format acceptance is a P1A decision.
- **Options:** `DEFER_TO_P1A` or `IMPORT_NOW` (requires a hash-compatibility decision before runtime activation).
- **Approver:** Owner sistem + P1A. **Blocks:** affected rows only.

### D12 — Historical job-number sequence seeding
- **Affected rows:** BLOCKED — distinct historical `job_number`s (seeding `job_sequences` is P2A work).
- **Evidence:** to be produced.
- **Options:** `SEED_FROM_MAX` (recommended) or `SEED_FROM_COUNT` (collision risk if numbers are missing).
- **Approver:** Owner operasi + P2A. **Blocks:** rows only (not the P0D dry-run).

## Approval procedure

1. Produce the real snapshot (`npm run migration:snapshot`).
2. Review the register emitted with the dry-run (`runSnapshotDryRun().decisionRegister`).
3. Record the decision in an `OwnerApproval` record:
   `{ decisionId, optionId, approvedBy, approvedAt, note? }`.
4. Re-run with the approvals to confirm `migrationBlockers()` is empty before any import is considered.
   Until then, **`D1` and `D4` block the entire migration** and every other
   decision blocks its rows.

## Guard rails

- `assertApprovalsAreAuthorized()` throws if any entry is `APPROVED` without an approver.
- Nothing in `src/migration/**` writes to Google Sheets or MySQL; the register is data, not an action.
- No decision is auto-approved by tooling, by tests, or by this document.
