import { parseAmount } from "@/domain/money";
import type { ReconciliationIssue } from "@/domain/reconciliation";
import {
  legacyClientPaymentToCreateInput,
  legacyClientToCreateInput,
  legacyCrewToCreateInput,
  legacyDeliveryToCreateInput,
  legacyJobCrewToCreateInput,
  legacyJobToCreateInput,
  legacyVendorPaymentToCreateInput,
  legacyVendorToCreateInput,
} from "@/domain/legacy-compat";
import {
  SHEET_HEADERS,
  mapAdmin,
  mapClient,
  mapClientPayment,
  mapCrew,
  mapDelivery,
  mapExpense,
  mapJob,
  mapJobCrew,
  mapVendor,
  mapVendorPayment,
  mapVenue,
  rowToRecord,
  type SheetTitle,
} from "@/repositories/google/mapping";
import {
  isApprovedDictionary,
  proposeCrewRoleDictionary,
  resolveCrewRoleId,
  type ApprovedCrewRoleDictionary,
  type CrewRoleDictionaryProposal,
} from "./crew-roles";
import {
  classifyLegacyExpense,
  isProvenDuplicate,
  type ApprovedDuplicateDecision,
  type PaymentCandidate,
  type PaymentCandidateIndex,
} from "./expense-reconciliation";
import {
  findDuplicateSourceIds,
  migrationIdempotencyKey,
  sourceFingerprint,
  deterministicMigrationId,
  snapshotFingerprint,
} from "./identity";
import {
  validateSourceReferences,
  type SourceReferenceIssue,
  type SourceRows,
} from "./inventory";
import {
  buildDecisionRegister,
  type DecisionRegisterEntry,
  type OwnerApproval,
} from "./decision-register";
import { MIGRATION_ORDER, SHEET_MAPPING_SPECS } from "./mapping-spec";
import { compareSnapshots } from "./source/snapshot";
import type {
  SnapshotChangeReport,
  ValidatedSnapshot,
} from "./source/types";
import {
  reconcileCrewAssignmentPayment,
  reconcileSchedulePayment,
} from "./payment-evidence";
import { computeReconciliationTotals, type CashflowLike, type ObligationLike, type ReconciliationTotals } from "./totals";
import type { MigrationEntity, MigrationPlanEntry, MigrationRowStatus, SourceIdentity } from "./types";
import {
  buildVenueArchive,
  type VenueArchive,
  type VenueArchiveRow,
} from "./venue-archive";

/**
 * DRY-RUN MIGRASI (P0D-1) — READ-ONLY.
 *
 * Menghasilkan RENCANA (data) dari snapshot sumber: identitas deterministik,
 * sidik jari, status per baris, dan daftar rekonsiliasi. Fungsi di file ini
 * TIDAK menulis ke Google Sheets maupun MySQL: `writesAttempted` selalu `false`
 * dan tidak ada import repository MySQL/Google di sini.
 *
 * Baris yang tidak dapat dipetakan dengan pasti SELALU menjadi
 * `RECONCILIATION_REQUIRED`; tidak ada nilai yang dikarang dan tidak ada
 * pembayaran yang dicatat dua kali.
 */

export interface DryRunInput {
  source: SourceRows;
  /** Arsip venue; bila kosong diambil dari worksheet `venues` pada snapshot. */
  venueArchiveRows?: readonly VenueArchiveRow[];
  /** Kamus crew role yang DISETUJUI (wajib sebelum baris crew/assignment siap). */
  approvedCrewRoleDictionary?: ApprovedCrewRoleDictionary;
  /** Sidik jari run sebelumnya (restart safety). */
  previousRunFingerprints?: Readonly<Record<string, string>>;
  /**
   * Keputusan baris-level owner untuk membuktikan duplikat expense.
   * Tanpa ini, nominal yang sama HANYA menjadi kandidat (P0D-2A §6).
   */
  approvedDuplicateDecisions?: readonly ApprovedDuplicateDecision[];
}

export interface MigrationRunComparison {
  newSources: SourceIdentity[];
  changedSources: SourceIdentity[];
  disappearedSources: SourceIdentity[];
}

export interface EntityPlanSummary {
  total: number;
  ready: number;
  reconciliation: number;
  skipped: number;
  deferred: number;
}

export interface DryRunReport {
  order: readonly MigrationEntity[];
  plan: MigrationPlanEntry[];
  byEntity: Record<MigrationEntity, EntityPlanSummary>;
  reconciliations: Array<{ entity: MigrationEntity; source: SourceIdentity; issues: ReconciliationIssue[] }>;
  referenceIssues: SourceReferenceIssue[];
  duplicateSourceIds: Array<{ sheet: SheetTitle; sourceId: string; rowNumbers: number[] }>;
  venueArchive: {
    entries: number;
    conflicts: number;
    blankNames: number;
    issues: ReconciliationIssue[];
  };
  crewRoleProposal: CrewRoleDictionaryProposal;
  totals: ReconciliationTotals;
  snapshotFingerprint: string;
  runComparison?: MigrationRunComparison;
  /**
   * Bukti duplikat expense: `proven` boleh dilewati, `potential` TIDAK.
   * Hanya `proven` yang boleh menjadi `SKIP_DUPLICATE`.
   */
  duplicateEvidence: { proven: number; potential: number };
  /** Selalu `false`: dry-run tidak pernah menulis. */
  writesAttempted: false;
}

function emptySummary(): EntityPlanSummary {
  return { total: 0, ready: 0, reconciliation: 0, skipped: 0, deferred: 0 };
}

function emptyByEntity(): Record<MigrationEntity, EntityPlanSummary> {
  return Object.fromEntries(
    MIGRATION_ORDER.map((entity) => [entity, emptySummary()]),
  ) as Record<MigrationEntity, EntityPlanSummary>;
}

function bump(summary: EntityPlanSummary, status: MigrationRowStatus, issues: number): void {
  summary.total += 1;
  if (status === "READY") summary.ready += 1;
  else if (status === "RECONCILIATION_REQUIRED") summary.reconciliation += 1;
  else if (status === "SKIP_DUPLICATE") summary.skipped += 1;
  else summary.deferred += 1;
  void issues;
}

interface RowContext {
  sheet: SheetTitle;
  rowNumber: number;
  record: Record<string, string>;
}

function parseRow<T>(sheet: SheetTitle, row: { rowNumber: number; values: string[] }, mapper: (record: Record<string, string>, sheet: SheetTitle, rowNumber: number) => T):
  | { ok: true; value: T; context: RowContext }
  | { ok: false; context: RowContext; error: string } {
  const record = rowToRecord(SHEET_HEADERS[sheet], row.values);
  const context: RowContext = { sheet, rowNumber: row.rowNumber, record };
  try {
    return { ok: true, value: mapper(record, sheet, row.rowNumber), context };
  } catch (error) {
    return {
      ok: false,
      context,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function valuesOf(record: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = value === undefined ? null : value;
  }
  return result;
}

function baseEntry(
  entity: MigrationEntity,
  sheet: SheetTitle,
  rowNumber: number,
  sourceId: string,
  record: Record<string, string>,
): Omit<MigrationPlanEntry, "status" | "issues" | "values"> {
  return {
    entity,
    targetTable: SHEET_MAPPING_SPECS[sheet].targetTable ?? "(tidak ada tabel)",
    targetId: deterministicMigrationId(sheet, sourceId),
    source: { sheet, sourceId, rowNumber },
    fingerprint: sourceFingerprint(record),
  };
}

export function runDryRun(input: DryRunInput): DryRunReport {
  const source = input.source;
  const byEntity = emptyByEntity();
  const plan: MigrationPlanEntry[] = [];
  const reconciliations: DryRunReport["reconciliations"] = [];

  /* ------------------------------- arsip venue ------------------------------ */
  const venueRows: VenueArchiveRow[] =
    input.venueArchiveRows !== undefined
      ? [...input.venueArchiveRows]
      : (source.venues ?? []).flatMap((row) => {
          const parsed = parseRow("venues", row, mapVenue);
          return parsed.ok ? [{ id: parsed.value.id, name: parsed.value.name, rowNumber: row.rowNumber }] : [];
        });
  const venueArchive: VenueArchive = buildVenueArchive(venueRows);

  /* ------------------------- kandidat & proposal role ---------------------- */
  const approvedDictionary = isApprovedDictionary(input.approvedCrewRoleDictionary)
    ? input.approvedCrewRoleDictionary
    : undefined;

  const roleValues: Array<{ value: string; sourceId?: string }> = [];
  for (const row of source.crew ?? []) {
    const record = rowToRecord(SHEET_HEADERS.crew, row.values);
    if (record.role) roleValues.push({ value: record.role, sourceId: record.id });
  }
  for (const row of source.job_crews ?? []) {
    const record = rowToRecord(SHEET_HEADERS.job_crews, row.values);
    if (record.role) roleValues.push({ value: record.role, sourceId: record.id });
  }
  const crewRoleProposal = proposeCrewRoleDictionary(roleValues);

  /* --------------------------- kandidat dedup kas -------------------------- */
  const candidates: PaymentCandidate[] = [];
  for (const row of source.vendor_payments ?? []) {
    const record = rowToRecord(SHEET_HEADERS.vendor_payments, row.values);
    if (record.id && record.job_id && record.amount) {
      candidates.push({
        referenceType: "vendor_payment",
        referenceId: record.id,
        jobId: record.job_id,
        amount: parseAmount(record.amount.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, ".")),
      });
    }
  }
  for (const row of source.client_payments ?? []) {
    const record = rowToRecord(SHEET_HEADERS.client_payments, row.values);
    if (record.id && record.job_id && record.amount) {
      candidates.push({
        referenceType: "client_payment",
        referenceId: record.id,
        jobId: record.job_id,
        amount: parseAmount(record.amount.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, ".")),
      });
    }
  }
  for (const row of source.job_crews ?? []) {
    const record = rowToRecord(SHEET_HEADERS.job_crews, row.values);
    if (record.id && record.job_id && record.payment) {
      candidates.push({
        referenceType: "job_crew",
        referenceId: record.id,
        jobId: record.job_id,
        amount: parseAmount(record.payment.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, ".")),
      });
    }
  }
  const candidateIndex: PaymentCandidateIndex = { candidates };

  /* --------------------------------- admins -------------------------------- */
  for (const row of source.admins ?? []) {
    const parsed = parseRow("admins", row, mapAdmin);
    const record = rowToRecord(SHEET_HEADERS.admins, row.values);
    const sourceId = record.id ?? "";
    const base = baseEntry("admins", "admins", row.rowNumber, sourceId, record);
    const entry: MigrationPlanEntry =
      parsed.ok && sourceId !== ""
        ? {
            ...base,
            status: "DEFERRED",
            issues: [
              {
                code: "ADMIN_MIGRATION_DEFERRED",
                message:
                  "Baris admin disiapkan tetapi DITUNDA: autentikasi/otorisasi adalah P1A, dan Contract v2 hanya membaca admin.",
                field: "password_hash",
              },
            ],
            values: valuesOf({
              id: base.targetId,
              name: parsed.value.name,
              email: parsed.value.email,
              password_hash: record.password_hash,
              role: "ADMIN",
              is_active: true,
            }),
          }
        : {
            ...base,
            status: "RECONCILIATION_REQUIRED",
            issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.ok ? "id admin kosong." : parsed.error }],
            values: {},
          };
    plan.push(entry);
    bump(byEntity.admins, entry.status, entry.issues.length);
  }

  /* ---------------------------------- crew --------------------------------- */
  for (const row of source.crew ?? []) {
    const parsed = parseRow("crew", row, mapCrew);
    const record = rowToRecord(SHEET_HEADERS.crew, row.values);
    const base = baseEntry("crew", "crew", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.crew, entry.status, entry.issues.length);
      continue;
    }

    const role = resolveCrewRoleId(parsed.value.role, approvedDictionary);
    if (role.status !== "OK" || !role.value) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: role.issues,
        values: {},
        audit: { source_role: parsed.value.role },
      };
      plan.push(entry);
      bump(byEntity.crew, entry.status, entry.issues.length);
      continue;
    }

    const mapped = legacyCrewToCreateInput(parsed.value, approvedDictionary!.roles);
    if (mapped.status !== "OK" || !mapped.value) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: mapped.issues,
        values: {},
        audit: { source_role: parsed.value.role },
      };
      plan.push(entry);
      bump(byEntity.crew, entry.status, entry.issues.length);
      continue;
    }

    const entry: MigrationPlanEntry = {
      ...base,
      status: "READY",
      issues: [],
      values: valuesOf({
        id: base.targetId,
        name: mapped.value.name,
        crew_role_id: role.value.crewRoleId,
        default_payment: mapped.value.defaultPayment,
        phone: mapped.value.phone,
        notes: mapped.value.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
      }),
      audit: { source_role: parsed.value.role },
    };
    plan.push(entry);
    bump(byEntity.crew, entry.status, entry.issues.length);
  }

  /* -------------------- clients, vendors, jobs (tanpa FK rumit) ------------ */
  for (const row of source.clients ?? []) {
    const parsed = parseRow("clients", row, mapClient);
    const record = rowToRecord(SHEET_HEADERS.clients, row.values);
    const base = baseEntry("clients", "clients", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.clients, entry.status, entry.issues.length);
      continue;
    }
    const mapped = legacyClientToCreateInput(parsed.value);
    const entry: MigrationPlanEntry = {
      ...base,
      status: "READY",
      issues: mapped.issues,
      values: valuesOf({
        id: base.targetId,
        name: mapped.value!.name,
        contact_person: mapped.value!.contactPerson,
        phone: mapped.value!.phone,
        email: mapped.value!.email,
        address: mapped.value!.address,
        notes: mapped.value!.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
      }),
    };
    plan.push(entry);
    bump(byEntity.clients, entry.status, entry.issues.length);
  }

  for (const row of source.vendors ?? []) {
    const parsed = parseRow("vendors", row, mapVendor);
    const record = rowToRecord(SHEET_HEADERS.vendors, row.values);
    const base = baseEntry("vendors", "vendors", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.vendors, entry.status, entry.issues.length);
      continue;
    }
    const mapped = legacyVendorToCreateInput(parsed.value);
    const entry: MigrationPlanEntry = {
      ...base,
      status: "READY",
      issues: mapped.issues,
      values: valuesOf({
        id: base.targetId,
        name: mapped.value!.name,
        contact_person: mapped.value!.contactPerson,
        phone: mapped.value!.phone,
        email: mapped.value!.email,
        notes: mapped.value!.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
      }),
    };
    plan.push(entry);
    bump(byEntity.vendors, entry.status, entry.issues.length);
  }

  const obligations: ObligationLike[] = [];
  const cashflows: CashflowLike[] = [];

  for (const row of source.jobs ?? []) {
    const parsed = parseRow("jobs", row, mapJob);
    const record = rowToRecord(SHEET_HEADERS.jobs, row.values);
    const base = baseEntry("jobs", "jobs", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.jobs, entry.status, entry.issues.length);
      continue;
    }
    const mapped = legacyJobToCreateInput(parsed.value, {
      venueNameById: venueArchive.nameById,
    });
    if (mapped.status !== "OK" || !mapped.value) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: mapped.issues,
        values: {},
        audit: parsed.value.venueId ? { source_venue_id: parsed.value.venueId } : {},
      };
      plan.push(entry);
      bump(byEntity.jobs, entry.status, entry.issues.length);
      continue;
    }
    const entry: MigrationPlanEntry = {
      ...base,
      status: "READY",
      issues: mapped.issues,
      values: valuesOf({
        id: base.targetId,
        job_number: mapped.value.jobNumber,
        job_name: mapped.value.jobName,
        category: mapped.value.category,
        client_id: mapped.value.clientId,
        vendor_id: mapped.value.vendorId,
        execution_date: mapped.value.executionDate,
        status: mapped.value.status,
        location: mapped.value.location,
        notes: mapped.value.notes,
        legacy_venue_name: mapped.value.legacyVenueName,
        created_at: parsed.value.createdAt,
        updated_at: parsed.value.updatedAt,
      }),
      audit: parsed.value.venueId ? { source_venue_id: parsed.value.venueId } : {},
    };
    plan.push(entry);
    bump(byEntity.jobs, entry.status, entry.issues.length);
  }

  /* ------------------------------- job_crews ------------------------------- */
  for (const row of source.job_crews ?? []) {
    const parsed = parseRow("job_crews", row, mapJobCrew);
    const record = rowToRecord(SHEET_HEADERS.job_crews, row.values);
    const base = baseEntry("jobCrewAssignments", "job_crews", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.jobCrewAssignments, entry.status, entry.issues.length);
      continue;
    }
    const agreed = parseAmount(parsed.value.actualPayment);
    const candidateExpenseIds = (source.expenses ?? []).flatMap((expenseRow) => {
      const expense = rowToRecord(SHEET_HEADERS.expenses, expenseRow.values);
      if (expense.job_id !== parsed.value.jobId) return [];
      if ((expense.category ?? "").trim().toUpperCase() !== "CREW") return [];
      const amount = expense.amount ? parseAmount(expense.amount.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, ".")) : undefined;
      return amount === agreed ? [expense.id ?? ""] : [];
    });
    const paymentCheck = reconcileCrewAssignmentPayment({
      agreedAmount: agreed,
      storedStatus: parsed.value.paymentStatus,
      candidateExpenseIds,
    });

    if (!approvedDictionary) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [
          ...(resolveCrewRoleId(parsed.value.role, undefined).issues),
          ...paymentCheck.issues,
        ],
        values: {},
        audit: { source_role: parsed.value.role, source_payment_status: parsed.value.paymentStatus ?? "" },
      };
      plan.push(entry);
      bump(byEntity.jobCrewAssignments, entry.status, entry.issues.length);
      continue;
    }

    const mapped = legacyJobCrewToCreateInput(parsed.value, approvedDictionary.roles);
    const issues: ReconciliationIssue[] = [...mapped.issues, ...paymentCheck.issues];
    const ready = mapped.status === "OK" && paymentCheck.status === "OBLIGATION_ONLY" && issues.length === 0;
    const entry: MigrationPlanEntry = {
      ...base,
      status: ready ? "READY" : "RECONCILIATION_REQUIRED",
      issues: ready ? [] : issues,
      values: ready
        ? valuesOf({
            id: base.targetId,
            job_id: mapped.value!.jobId,
            crew_id: mapped.value!.crewId,
            crew_role_id: mapped.value!.crewRoleId,
            agreed_amount: mapped.value!.agreedAmount,
            notes: mapped.value!.notes,
            created_at: record.created_at,
            updated_at: record.updated_at,
          })
        : {},
      audit: { source_role: parsed.value.role, source_payment_status: parsed.value.paymentStatus ?? "" },
    };
    if (ready) {
      obligations.push({
        jobId: mapped.value!.jobId,
        kind: "crew",
        referenceId: base.targetId,
        amount: mapped.value!.agreedAmount,
      });
    }
    plan.push(entry);
    bump(byEntity.jobCrewAssignments, entry.status, entry.issues.length);
  }

  /* ------------------------------- deliveries ------------------------------ */
  for (const row of source.deliveries ?? []) {
    const parsed = parseRow("deliveries", row, mapDelivery);
    const record = rowToRecord(SHEET_HEADERS.deliveries, row.values);
    const base = baseEntry("deliveries", "deliveries", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.deliveries, entry.status, entry.issues.length);
      continue;
    }
    const mapped = legacyDeliveryToCreateInput(parsed.value);
    const entry: MigrationPlanEntry = {
      ...base,
      status: "READY",
      issues: mapped.issues,
      values: valuesOf({
        id: base.targetId,
        job_id: mapped.value!.jobId,
        name: mapped.value!.name,
        delivery_type: mapped.value!.deliveryType,
        quantity: mapped.value!.quantity,
        deadline: mapped.value!.deadline,
        status: mapped.value!.status,
        notes: mapped.value!.notes,
      }),
    };
    plan.push(entry);
    bump(byEntity.deliveries, entry.status, entry.issues.length);
  }

  /* --------------------------- payment schedules --------------------------- */
  for (const row of source.client_payments ?? []) {
    const parsed = parseRow("client_payments", row, mapClientPayment);
    const record = rowToRecord(SHEET_HEADERS.client_payments, row.values);
    const base = baseEntry("clientPaymentSchedules", "client_payments", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.clientPaymentSchedules, entry.status, entry.issues.length);
      continue;
    }
    const mapped = legacyClientPaymentToCreateInput(parsed.value);
    const paymentCheck = reconcileSchedulePayment({
      amount: mapped.value?.amount ?? parsed.value.amount,
      storedStatus: parsed.value.status,
      paidDate: parsed.value.paidDate,
    });
    const issues: ReconciliationIssue[] = [...mapped.issues, ...paymentCheck.issues];
    const ready = mapped.status === "OK" && paymentCheck.status !== "RECONCILIATION_REQUIRED";

    if (ready) {
      obligations.push({
        jobId: mapped.value!.jobId,
        kind: "client",
        referenceId: base.targetId,
        amount: mapped.value!.amount,
      });
      if (paymentCheck.proposedCash) {
        cashflows.push({
          jobId: mapped.value!.jobId,
          direction: "INCOME",
          category: "CLIENT_PAYMENT",
          amount: paymentCheck.proposedCash.amount,
          referenceType: "client_payment",
          referenceId: base.targetId,
        });
      }
    }

    const entry: MigrationPlanEntry = {
      ...base,
      status: ready ? "READY" : "RECONCILIATION_REQUIRED",
      issues: ready ? [] : issues,
      values: ready
        ? valuesOf({
            id: base.targetId,
            job_id: mapped.value!.jobId,
            term: mapped.value!.term,
            amount: mapped.value!.amount,
            due_date: mapped.value!.dueDate,
            paid_date: mapped.value!.paidDate,
            notes: mapped.value!.notes,
          })
        : {},
      audit: { source_status: parsed.value.status },
    };
    plan.push(entry);
    bump(byEntity.clientPaymentSchedules, entry.status, entry.issues.length);
  }

  for (const row of source.vendor_payments ?? []) {
    const parsed = parseRow("vendor_payments", row, mapVendorPayment);
    const record = rowToRecord(SHEET_HEADERS.vendor_payments, row.values);
    const base = baseEntry("vendorPaymentSchedules", "vendor_payments", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.vendorPaymentSchedules, entry.status, entry.issues.length);
      continue;
    }
    const mapped = legacyVendorPaymentToCreateInput(parsed.value);
    const paymentCheck = reconcileSchedulePayment({
      amount: mapped.value?.amount ?? parsed.value.amount,
      storedStatus: parsed.value.status,
      paidDate: parsed.value.paidDate,
    });
    const issues: ReconciliationIssue[] = [...mapped.issues, ...paymentCheck.issues];
    const ready = mapped.status === "OK" && paymentCheck.status !== "RECONCILIATION_REQUIRED";

    if (ready) {
      obligations.push({
        jobId: mapped.value!.jobId,
        kind: "vendor",
        referenceId: base.targetId,
        amount: mapped.value!.amount,
      });
      if (paymentCheck.proposedCash) {
        cashflows.push({
          jobId: mapped.value!.jobId,
          direction: "EXPENSE",
          category: "VENDOR_PAYMENT",
          amount: paymentCheck.proposedCash.amount,
          referenceType: "vendor_payment",
          referenceId: base.targetId,
        });
      }
    }

    const entry: MigrationPlanEntry = {
      ...base,
      status: ready ? "READY" : "RECONCILIATION_REQUIRED",
      issues: ready ? [] : issues,
      values: ready
        ? valuesOf({
            id: base.targetId,
            job_id: mapped.value!.jobId,
            type: mapped.value!.type,
            amount: mapped.value!.amount,
            due_date: mapped.value!.dueDate,
            paid_date: mapped.value!.paidDate,
            notes: mapped.value!.notes,
          })
        : {},
      audit: { source_status: parsed.value.status },
    };
    plan.push(entry);
    bump(byEntity.vendorPaymentSchedules, entry.status, entry.issues.length);
  }

  /* -------------------------------- expenses ------------------------------- */
  let provenDuplicates = 0;
  let potentialDuplicates = 0;
  for (const row of source.expenses ?? []) {
    const parsed = parseRow("expenses", row, mapExpense);
    const record = rowToRecord(SHEET_HEADERS.expenses, row.values);
    const base = baseEntry("cashflows", "expenses", row.rowNumber, record.id ?? "", record);
    if (!parsed.ok) {
      const entry: MigrationPlanEntry = {
        ...base,
        status: "RECONCILIATION_REQUIRED",
        issues: [{ code: "SOURCE_PARSE_ERROR", message: parsed.error }],
        values: {},
      };
      plan.push(entry);
      bump(byEntity.cashflows, entry.status, entry.issues.length);
      continue;
    }
    const classification = classifyLegacyExpense(
      {
        id: parsed.value.id,
        jobId: parsed.value.jobId,
        category: parsed.value.category,
        description: parsed.value.description,
        amount: parsed.value.amount,
        date: parsed.value.date,
      },
      candidateIndex,
      { approvedDuplicateDecisions: input.approvedDuplicateDecisions },
    );
    if (classification.status === "PROVEN_DUPLICATE") provenDuplicates += 1;
    else if (classification.status === "POTENTIAL_DUPLICATE") potentialDuplicates += 1;

    if (classification.status === "READY" && classification.category) {
      const amount = parseAmount(parsed.value.amount);
      const idempotencyKey = migrationIdempotencyKey("expenses", parsed.value.id);
      cashflows.push({
        jobId: parsed.value.jobId,
        direction: "EXPENSE",
        category: classification.category,
        amount,
      });
      const entry: MigrationPlanEntry = {
        ...base,
        status: "READY",
        issues: classification.issues,
        idempotencyKey,
        values: valuesOf({
          id: base.targetId,
          job_id: parsed.value.jobId,
          occurred_on: parsed.value.date,
          direction: "EXPENSE",
          category: classification.category,
          amount,
          description: parsed.value.description,
          source: "MIGRATION",
        }),
        audit: {
          source_category: parsed.value.category,
          source_notes: parsed.value.notes ?? "",
        },
      };
      plan.push(entry);
      bump(byEntity.cashflows, entry.status, entry.issues.length);
      continue;
    }

    const entry: MigrationPlanEntry = {
      ...base,
      // HANYA duplikat yang TERBUKTI (`PROVEN_DUPLICATE`) yang boleh dilewati.
      // `POTENTIAL_DUPLICATE` (nominal sama) TIDAK PERNAH menjadi SKIP_DUPLICATE
      // dan tidak menghasilkan kas — selalu RECONCILIATION_REQUIRED.
      status: isProvenDuplicate(classification) ? "SKIP_DUPLICATE" : "RECONCILIATION_REQUIRED",
      issues: classification.issues,
      values: {},
      audit: classification.audit,
    };
    plan.push(entry);
    bump(byEntity.cashflows, entry.status, entry.issues.length);
  }

  for (const entry of plan) {
    if (entry.status === "RECONCILIATION_REQUIRED") {
      reconciliations.push({ entity: entry.entity, source: entry.source, issues: entry.issues });
    }
  }

  const referenceIssues = validateSourceReferences(source);
  const duplicateSourceIds = findDuplicateSourceIds(
    plan.map((entry) => ({
      sheet: entry.source.sheet,
      sourceId: entry.source.sourceId,
      rowNumber: entry.source.rowNumber,
    })),
  );

  const totals = computeReconciliationTotals({ cashflows, obligations });

  const report: DryRunReport = {
    order: MIGRATION_ORDER,
    plan,
    byEntity,
    reconciliations,
    referenceIssues,
    duplicateSourceIds,
    venueArchive: {
      entries: venueArchive.nameById.size,
      conflicts: venueArchive.conflicts.length,
      blankNames: venueArchive.blankNameIds.length,
      issues: venueArchive.issues,
    },
    crewRoleProposal,
    totals,
    snapshotFingerprint: snapshotFingerprint(plan),
    duplicateEvidence: { proven: provenDuplicates, potential: potentialDuplicates },
    writesAttempted: false,
  };

  if (input.previousRunFingerprints) {
    const previous = input.previousRunFingerprints;
    const current = new Map(
      plan.map((entry) => [`${entry.source.sheet}:${entry.source.sourceId}`, entry]),
    );
    const comparison: MigrationRunComparison = {
      newSources: [],
      changedSources: [],
      disappearedSources: [],
    };
    for (const [key, entry] of current) {
      const previousFingerprint = previous[key];
      if (previousFingerprint === undefined) comparison.newSources.push(entry.source);
      else if (previousFingerprint !== entry.fingerprint) comparison.changedSources.push(entry.source);
    }
    for (const key of Object.keys(previous)) {
      if (current.has(key)) continue;
      const [sheet, sourceId] = key.split(":");
      if (sheet && sourceId) {
        comparison.disappearedSources.push({ sheet: sheet as SheetTitle, sourceId, rowNumber: 0 });
      }
    }
    report.runComparison = comparison;
  }

  return report;
}

/** Sidik jari per identitas sumber (untuk perbandingan antar-run). */
export function fingerprintsBySource(report: DryRunReport): Record<string, string> {
  return Object.fromEntries(
    report.plan.map((entry) => [
      `${entry.source.sheet}:${entry.source.sourceId}`,
      entry.fingerprint,
    ]),
  );
}

/* -------------------------------------------------------------------------- */
/* Dry-run dari SNAPSHOT TETAP (P0D-2A)                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mengubah snapshot tervalidasi menjadi `SourceRows` untuk perencana.
 * Snapshot yang sama menghasilkan baris yang sama (deterministik), sehingga
 * langkah rekonsiliasi tidak pernah membaca ulang sheet live.
 */
export function sourceRowsFromSnapshot(snapshot: ValidatedSnapshot): SourceRows {
  const source: SourceRows = {};
  for (const sheet of Object.values(snapshot.sheets)) {
    source[sheet.sheet] = sheet.rows.map((row) => ({
      rowNumber: row.rowNumber,
      values: [...row.values],
    }));
  }
  return source;
}

export interface SnapshotDryRunInput {
  /** Snapshot TETAP yang dipakai dry-run (bukan pembacaan live berulang). */
  snapshot: ValidatedSnapshot;
  /** Snapshot sebelumnya untuk deteksi perubahan sumber antar-run. */
  previousSnapshot?: ValidatedSnapshot;
  approvedCrewRoleDictionary?: ApprovedCrewRoleDictionary;
  approvedDuplicateDecisions?: readonly ApprovedDuplicateDecision[];
  /** Keputusan owner yang sudah disetujui (D1–D12). */
  approvals?: readonly OwnerApproval[];
  previousRunFingerprints?: Readonly<Record<string, string>>;
}

export interface SnapshotDryRunReport extends DryRunReport {
  snapshotId: string;
  schemaFingerprint: string;
  snapshotChangeReport?: SnapshotChangeReport;
  decisionRegister: DecisionRegisterEntry[];
}

/**
 * Dry-run dari snapshot tetap. Membaca snapshot (bukan sheet live), lalu:
 * - menjalankan perencana P0D-1 (dengan aturan duplikat yang diperketat);
 * - menambahkan perbandingan snapshot dan register keputusan D1–D12.
 * Tidak ada penulisan: `writesAttempted` tetap `false`.
 */
export function runSnapshotDryRun(input: SnapshotDryRunInput): SnapshotDryRunReport {
  const report = runDryRun({
    source: sourceRowsFromSnapshot(input.snapshot),
    approvedCrewRoleDictionary: input.approvedCrewRoleDictionary,
    approvedDuplicateDecisions: input.approvedDuplicateDecisions,
    previousRunFingerprints: input.previousRunFingerprints,
  });

  return {
    ...report,
    snapshotId: input.snapshot.snapshotId,
    schemaFingerprint: input.snapshot.schemaFingerprint,
    snapshotChangeReport: input.previousSnapshot
      ? compareSnapshots(input.previousSnapshot, input.snapshot)
      : undefined,
    decisionRegister: buildDecisionRegister({
      snapshot: input.snapshot,
      report,
      approvals: input.approvals,
      sourceAvailable: true,
    }),
  };
}
