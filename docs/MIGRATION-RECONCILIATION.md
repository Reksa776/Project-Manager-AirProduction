# MIGRATION RECONCILIATION — Historical Data (P0D-1)

> **ARCHIVED — OWNER DECISION P0D-CLOSE (FRESH START MYSQL).** These
> reconciliation rules are historical-import rules. They are **not** active
> prerequisites and must **not** be applied to new MySQL data. Retained as
> evidence; see `docs/FRESH-START-MYSQL-PLAN.md`.

**Phase:** P0D-1 (rules and planning only — no data is imported by this document)
**Helpers:** `src/migration/{venue-archive,crew-roles,expense-reconciliation,payment-evidence,identity,totals,inventory}.ts`
**Inherited helpers (P0C-1):** `src/domain/reconciliation.ts` (`reconcileLegacyVenue`,
`reconcileLegacyCrewRole`, `reconcileLegacyExpenseCategory`, `reconcileStoredPaymentStatus`)

Core invariant, unchanged from P0C-1/P0C-2:

> **OBLIGATION** = money that should move (schedules, `job_crews.agreed_amount`).
> **CASHFLOW** = money that actually moved (`cashflows`).
> A stored `PAID` status is **not** evidence of cash. Ambiguity is reported as
> `RECONCILIATION_REQUIRED`; it is never converted into a cashflow.

---

## 1. Historical venue preservation

| Aspect | Rule |
| --- | --- |
| Archive format | Rows of the `venues` worksheet: column `id` (historical `venue_id`) + column `name`. Provenance = the same spreadsheet as every other source (snapshot is read read-only in P0D-2). |
| Construction | `buildVenueArchive()` → `venue_id → name` map, `sourceRowsById`, `conflicts`, `blankNameIds`, `issues`. |
| Deterministic normalisation | none — the historical name is preserved with whitespace trimmed. |
| Conflict | The same `venue_id` with two different non-blank names → `VENUE_ARCHIVE_CONFLICT`; the id is **excluded** from the usable map and the job is `RECONCILIATION_REQUIRED`. |
| Blank name | `VENUE_ARCHIVE_BLANK_NAME`; the job is `RECONCILIATION_REQUIRED`. |
| Unknown reference | `venue_id` referenced by a job but absent from the archive → `VENUE_NAME_MISSING` (`RECONCILIATION_REQUIRED`). No name is invented. |
| Audit | Every job entry keeps `audit.source_venue_id` even though `jobs` has no venue column, so the historical link survives. |
| Forbidden | Creating an active venue master table; deleting the venue UI (both explicitly out of scope in P0D-1). |

---

## 2. Crew Role normalisation (PROPOSED — not approved)

Source values: `crew.role` and `job_crews.role` (free text).

Deterministic normalisation only:
1. `trim`;
2. collapse internal whitespace runs to a single space;
3. comparison key = `UPPERCASE` (`normalizeRoleKey`).

Preserved: every original spelling in `sourceValues` (audit).

Not done automatically:
- spelling variants that are *similar but not identical* (e.g. `VIDEOGRAPHER` vs
  `VIDEOGRAFER`) → **flagged `AMBIGUOUS_ROLE`**, never merged (edit-distance ≤ 2 or containment heuristic);
- empty role → `EMPTY_ROLE` issue, no default role;
- unknown role → `UNKNOWN_ROLE`, never created implicitly.

`proposeCrewRoleDictionary()` returns `approvalStatus: "PROPOSED_NOT_APPROVED"`.
Resolving a role for migration requires **`ApprovedCrewRoleDictionary`**
(`{ roles: [{id, name}], approvedBy }`); without it every crew/assignment row is
`RECONCILIATION_REQUIRED` with `ROLE_DICTIONARY_NOT_APPROVED`.

**Proposed dictionary for approval:** the distinct normalised keys with their
historical spellings — to be produced from the real snapshot in P0D-2 and sent
for approval. See `docs/PHASE-P0D1-MIGRATION-PLANNING.md` §4 for the template.

---

## 3. Legacy Expenses → Cashflow

> **Rule corrected in P0D-2A.** Until P0D-2A, an equal amount on the same job was
treated as proof of a duplicate and the expense was skipped automatically. That
was too strong: **an equal amount is only a candidate.** The current rule is
below and is the only one that may be implemented.

`classifyLegacyExpense()` returns one of four statuses, each carrying an
`evidence` marker (`EQUAL_AMOUNT_CANDIDATE`, `EXPLICIT_SOURCE_REFERENCE`,
`APPROVED_ROW_DECISION`, `NONE`):

| Classification | Trigger | Migration behaviour |
| --- | --- | --- |
| `READY` | category `TRANSPORT` / `EQUIPMENT` / `OTHER` (deterministic) | import as `cashflows` row: `direction=EXPENSE`, `source=MIGRATION`, category preserved, `occurred_on = expense_date` |
| `PROVEN_DUPLICATE` | an **explicit source reference** pointing at a matching `job_crew` / `vendor_payment` on the same job, **or** a documented, approved row-level owner decision (`ApprovedDuplicateDecision` with a non-empty `approvedBy`) | the **only** status allowed to become `SKIP_DUPLICATE`; the cash comes from the schedule's evidence path so the payment is not recorded twice |
| `POTENTIAL_DUPLICATE` | category `CREW`/`VENDOR` with an **equal amount** (decimal-safe) on the same job, but no explicit reference and no approved decision | **never** `SKIP_DUPLICATE`, **never** a cashflow → `RECONCILIATION_REQUIRED`, listed with its candidate references for a human decision |
| `RECONCILIATION_REQUIRED` | category `CREW`/`VENDOR` with **no** matching obligation; or an unknown/unmappable category | not converted; listed for manual decision |

Also reported (without changing `READY`): a general expense whose amount equals an
existing schedule/assignment on the same job → `SAME_AMOUNT_AS_SCHEDULE` (verify
it is not a duplicate).

Every classification keeps the original source category, amount, and candidate
references in its `audit` metadata. `expenses.notes` has no target column: it is
retained in the audit metadata only.

The dry-run reports the split as `duplicateEvidence: { proven, potential }`; in
the fixture dry-run `potential = 1`, `proven = 0`, and **zero** rows are skipped.

---

## 4. Stored payment status → evidenced cash

### 4.1 Client / vendor schedules (`reconcileSchedulePayment`)

| Stored status | `paid_date` | Outcome |
| --- | --- | --- |
| `PAID` | present | **`PROPOSED_CASH`** — full amount on that date; `requiresApproval: true` (the amount/date pairing must be approved) |
| `PAID` | absent | `RECONCILIATION_REQUIRED` (`MISSING_PAID_DATE`) |
| `PARTIAL` | present or absent | `RECONCILIATION_REQUIRED` (`PARTIAL_AMOUNT_UNKNOWN`) — the partial amount is **not stored** and must not be invented |
| `UNPAID` | present | `RECONCILIATION_REQUIRED` (`STATUS_EVIDENCE_CONFLICT`) |
| `UNPAID` | absent | `NO_CASH` (obligation only) |
| unknown value | — | `RECONCILIATION_REQUIRED` (`UNKNOWN_STORED_STATUS`) |

Derived status always comes from `derivePaymentStatus()` (domain, BigInt) and is
cross-checked with `reconcileStoredPaymentStatus()` (P0C-1). A mismatch is
reported, never silently corrected.

### 4.2 Crew assignments (`reconcileCrewAssignmentPayment`)

`job_crews.payment` → `agreed_amount` = **obligation**. Stored
`payment_status` is never cash evidence (the source has no crew payment
reference). Therefore:

- absent/`UNPAID` → `OBLIGATION_ONLY` (imported, no cash);
- `PAID`/`PARTIAL`/other → `RECONCILIATION_REQUIRED`
  (`CREW_PAYMENT_STATUS_STORED`), plus `CANDIDATE_EXPENSE_EVIDENCE` listing any
  `CREW` expense with an equal amount on the same job (candidates only — a human
  decides), plus `PARTIAL_AMOUNT_UNKNOWN` for `PARTIAL`.

---

## 5. Financial totals & reconciliation output

`computeReconciliationTotals()` produces, with **decimal-safe `BigInt` minor-unit
arithmetic only** (`src/domain/money.ts`; no JavaScript floating-point summation):

- `grand`: `income`, `expense`, `net`;
- `byJob`: the same triple per `jobId` (keys sorted);
- `byCategory`: cash total per cashflow category (sorted);
- `byReference`: cash total per `referenceType:referenceId` (sorted);
- `obligation`: `client`, `vendor`, `crew`, `total`;
- `paid`: `client`, `vendor`, `crew`, `total`;
- `outstanding`: obligation − paid per kind, floored at `0.00`, plus `total`.

Only rows whose plan entry is `READY` (i.e. evidenced and unambiguous) enter the
totals; every `RECONCILIATION_REQUIRED` row is excluded until a decision is made
— so the totals are never inflated by guessed values.

`compareTotals(expected, actual)` returns **every** difference
(`scope` = `grand` / `obligation` / `paid` / `outstanding` / `job:<id>` /
`category:<c>` / `reference:<r>`, with `expected`, `actual`, `difference`).
Nothing is aggregated away: discrepancies are visible per scope.

---

## 6. Reconciliation categories in the dry-run report

`runDryRun()` emits (see `docs/PHASE-P0D1-MIGRATION-PLANNING.md` §8):

| Output | Content |
| --- | --- |
| `reconciliations[]` | every `RECONCILIATION_REQUIRED` entry with `entity`, `source` (`sheet:id`, row) and its issues |
| `referenceIssues[]` | missing cross-sheet references (`MISSING_CLIENT_REFERENCE`, `MISSING_VENDOR_REFERENCE`, `MISSING_VENUE_REFERENCE`, `MISSING_JOB_REFERENCE`, `MISSING_CREW_REFERENCE`) |
| `duplicateSourceIds[]` | the same `id` appearing twice in one worksheet |
| `venueArchive` | archive size, conflicts, blank names, issues |
| `crewRoleProposal` | PROPOSED dictionary + ambiguity issues |
| `runComparison` | new / changed / disappeared sources versus the previous run |
| `totals` | §5, computed from `READY` rows only |
| `writesAttempted` | always `false` |

---

## 7. Rules that must not be broken during P0D-2

1. A stored payment status alone never creates a cashflow row.
2. A `PARTIAL` amount is never guessed.
3. An **equal amount never proves a duplicate**: only `PROVEN_DUPLICATE`
   (explicit source reference or approved owner decision) may be skipped, and
   `POTENTIAL_DUPLICATE` neither skips nor creates cash. A `CREW`/`VENDOR`
   expense is therefore never silently double-counted *or* silently dropped.
4. An unknown venue name is never invented; the job stays `RECONCILIATION_REQUIRED`.
5. Crew roles are never created implicitly and never defaulted.
6. Money is never converted to a JavaScript `number` in the migration path.
7. Every planned row keeps a deterministic identity + fingerprint so reruns are
   idempotent and changed source rows are reported, not silently overwritten.
