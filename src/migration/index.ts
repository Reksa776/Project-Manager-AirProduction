/**
 * PERENCANAAN MIGRASI HISTORIS (P0D-1) — READ-ONLY.
 *
 * Modul ini menghasilkan spesifikasi, rencana (dry-run), dan laporan
 * rekonsiliasi. Tidak ada modul di folder ini yang:
 * - menulis ke Google Sheets (sumber) atau MySQL (target);
 * - mengimpor repository Google/MySQL atau mengubah `getRepositories()`;
 * - membuat baris kas tanpa bukti atau menebak nilai historis.
 *
 * Eksekusi migrasi sebenarnya adalah P0D-2 dan memerlukan persetujuan eksplisit.
 */

export {
  MIGRATION_ENTITIES,
  MIGRATION_ROW_STATUSES,
} from "./types";
export type {
  MigrationEntity,
  MigrationIssue,
  MigrationPlanEntry,
  MigrationRowStatus,
  MigrationSourceSnapshot,
  SourceIdentity,
} from "./types";

export {
  detectRunConflict,
  deterministicMigrationId,
  findDuplicateSourceIds,
  isDeterministicMigrationId,
  migrationIdempotencyKey,
  MIGRATION_NAMESPACE,
  snapshotFingerprint,
  sourceFingerprint,
  sourceIdentityString,
} from "./identity";
export type { RunConflict } from "./identity";

export { buildVenueArchive, resolveLegacyVenueName } from "./venue-archive";
export type { LegacyVenueResolution, VenueArchive, VenueArchiveRow } from "./venue-archive";

export {
  isApprovedDictionary,
  normalizeRoleKey,
  proposeCrewRoleDictionary,
  resolveCrewRoleId,
} from "./crew-roles";
export type {
  ApprovedCrewRoleDictionary,
  CrewRoleDictionaryProposal,
  CrewRoleSourceValue,
  ProposedCrewRole,
} from "./crew-roles";

export {
  classifyLegacyExpense,
  isAmbiguousExpenseCategory,
  isImportableExpense,
  isProvenDuplicate,
  summarizeExpenseClassifications,
} from "./expense-reconciliation";
export type {
  ApprovedDuplicateDecision,
  ClassifyExpenseOptions,
  ExpenseClassification,
  ExpenseDuplicateEvidence,
  LegacyExpenseClassification,
  LegacyExpenseInput,
  PaymentCandidate,
  PaymentCandidateIndex,
} from "./expense-reconciliation";

export {
  reconcileCrewAssignmentPayment,
  reconcileSchedulePayment,
  summarizeScheduleReconciliations,
} from "./payment-evidence";
export type {
  CrewAssignmentReconciliation,
  PaymentEvidenceStatus,
  ProposedCashEvidence,
  SchedulePaymentReconciliation,
} from "./payment-evidence";

export { compareTotals, computeReconciliationTotals, totalAmounts } from "./totals";
export type {
  CashflowLike,
  FinancialTotals,
  ObligationLike,
  ReconciliationTotals,
  TotalDiscrepancy,
  TotalsComparison,
} from "./totals";

export {
  assertSourceDataAvailable,
  buildSourceInventory,
  inventorySheet,
  isSourceDataAvailable,
  MigrationScopeError,
  SourceDataUnavailableError,
  validateSourceReferences,
} from "./inventory";
export type { SheetInventory, SourceReferenceIssue, SourceRowInput, SourceRows } from "./inventory";

export {
  MIGRATION_ORDER,
  SHEET_MAPPING_SPECS,
  unmappedSourceColumns,
  validateMigrationOrder,
  validateSpecCoverage,
} from "./mapping-spec";
export type {
  SheetMappingSpec,
  SourceColumnDisposition,
  TargetOnlyColumn,
  ValidationOutcome,
} from "./mapping-spec";

export {
  fingerprintsBySource,
  runDryRun,
  runSnapshotDryRun,
  sourceRowsFromSnapshot,
} from "./dry-run";
export type {
  DryRunInput,
  DryRunReport,
  EntityPlanSummary,
  MigrationRunComparison,
  SnapshotDryRunInput,
  SnapshotDryRunReport,
} from "./dry-run";

/* -------------------------------------------------------------------------- */
/* Register keputusan owner D1–D12 (P0D-2A)                                    */
/* -------------------------------------------------------------------------- */

export {
  assertApprovalsAreAuthorized,
  blockingDecisions,
  buildDecisionRegister,
  DECISION_DEFINITIONS,
  DECISION_EVIDENCE_SHEETS,
  DECISION_IDS,
  decisionEvidenceHeaders,
  isDecisionApproved,
  migrationBlockers,
} from "./decision-register";
export type {
  DecisionApprovalState,
  DecisionBlockingScope,
  DecisionDefinition,
  DecisionId,
  DecisionOption,
  DecisionRegisterEntry,
  DecisionRegisterInput,
  OwnerApproval,
} from "./decision-register";

/* -------------------------------------------------------------------------- */
/* Adapter sumber read-only & snapshot (P0D-2A) — MURNI, tanpa I/O             */
/* -------------------------------------------------------------------------- */

export {
  assertNoSensitiveData,
  buildSnapshot,
  collectSensitiveValues,
  compareSnapshots,
  deserializeSnapshot,
  hashId,
  headerFingerprint,
  opaqueRowRef,
  redactValue,
  SAFE_DISTINCT_COLUMNS,
  sanitizeSheet,
  sanitizeSnapshot,
  schemaFingerprint,
  SENSITIVE_COLUMNS,
  serializeSnapshot,
} from "./source";
export type {
  BuildSnapshotOptions,
  RawWorksheetMatrix,
  RowReference,
  SanitizedSheetSummary,
  SanitizedSnapshotSummary,
  SheetSnapshot,
  SnapshotChangeReport,
  SnapshotIssue,
  SnapshotSource,
  SourceRowSnapshot,
  ValidatedSnapshot,
} from "./source";
