import { derivePaymentStatus, deriveSettlement } from "@/domain/finance";
import type {
  CreateClientPaymentScheduleInput,
  CreateDeliveryInput,
  CreateJobCrewAssignmentInput,
  CreateJobInput,
  CreateVendorPaymentScheduleInput,
} from "@/domain/inputs";
import { addAmounts, subtractAmounts, sumAmounts, type Amount } from "@/domain/money";
import type {
  Cashflow,
  CashflowCategory,
  CashflowReferenceType,
  Delivery,
  Job,
  JobCategory,
  JobCrewAssignment,
  JobStatus,
  ClientPaymentSchedule,
  VendorPaymentSchedule,
} from "@/domain/types";
import { buildLookup, resolveCounterparty } from "@/services/shared";
import { getApplication } from "@/services/runtime";
import {
  listClientsForRequest,
  listCrewForRequest,
  listCrewRolesForRequest,
  listJobsForRequest,
  listVendorsForRequest,
} from "@/services/read-cache";
import type {
  CashflowRowView,
  ClientScheduleView,
  Counterparty,
  CrewAssignmentView,
  FinanceOverview,
  JobDetail,
  JobListItem,
  JobFinancialTotals,
  VendorScheduleView,
} from "@/services/types";

/**
 * Service Job & relasi KANONIK (Contract v2).
 *
 * - Job memakai invariant kanonik: client XOR vendor (divalidasi repository +
 *   CHECK DB). `jobNumber` tetap input manual (generator otomatis = P2A).
 * - Venue tidak ada di form; hanya `legacyVenueName` sebagai snapshot histori.
 * - OBLIGASI (jadwal/`agreedAmount`) terpisah dari KAS (`cashflows`).
 * - Status pembayaran SELALU diturunkan dari kas nyata (tidak pernah disimpan).
 * - Semua tulis finansial lewat service finansial kanonik (atomic + idempotent).
 */

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

/** Total kas nyata untuk satu referensi dari daftar kas yang sudah dibaca. */
function paidAmountsByReference(
  cashflows: readonly Cashflow[],
  referenceType: CashflowReferenceType,
): Map<string, Amount> {
  const totals = new Map<string, Amount>();
  for (const flow of cashflows) {
    if (flow.referenceType !== referenceType || !flow.referenceId) continue;
    totals.set(flow.referenceId, addAmounts(totals.get(flow.referenceId) ?? "0.00", flow.amount));
  }
  return totals;
}

function sumCashflows(
  cashflows: readonly Cashflow[],
  matches: (flow: Cashflow) => boolean,
): Amount {
  return sumAmounts(cashflows.filter(matches).map((flow) => flow.amount));
}

function summarizeJobFinancials(
  cashflows: readonly Cashflow[],
  clientSchedules: readonly ClientPaymentSchedule[],
  vendorSchedules: readonly VendorPaymentSchedule[],
  assignments: readonly JobCrewAssignment[],
): JobFinancialTotals {
  const income = sumCashflows(cashflows, (flow) => flow.direction === "INCOME");
  const expense = sumCashflows(cashflows, (flow) => flow.direction === "EXPENSE");
  return {
    income,
    expense,
    net: subtractAmounts(income, expense),
    clientObligation: sumAmounts(clientSchedules.map((schedule) => schedule.amount)),
    vendorObligation: sumAmounts(vendorSchedules.map((schedule) => schedule.amount)),
    crewAgreed: sumAmounts(assignments.map((assignment) => assignment.agreedAmount)),
    clientPaid: sumCashflows(cashflows, (flow) => flow.category === "CLIENT_PAYMENT"),
    vendorPaid: sumCashflows(cashflows, (flow) => flow.category === "VENDOR_PAYMENT"),
    crewPaid: sumCashflows(cashflows, (flow) => flow.category === "CREW_PAYMENT"),
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getJobListItems(): Promise<JobListItem[]> {
  const [jobs, clients, vendors] = await Promise.all([
    listJobsForRequest(),
    listClientsForRequest(),
    listVendorsForRequest(),
  ]);
  const clientMap = buildLookup(clients);
  const vendorMap = buildLookup(vendors);

  const items: JobListItem[] = [];
  for (const job of jobs) {
    const counterparty: Counterparty | null = resolveCounterparty(job, clientMap, vendorMap);
    if (!counterparty) continue;
    items.push({
      id: job.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      category: job.category,
      counterparty,
      packageId: job.packageId,
      legacyVenueName: job.legacyVenueName,
      executionDate: job.executionDate,
      status: job.status,
      location: job.location,
      notes: job.notes,
    });
  }
  return items.sort((a, b) => b.jobNumber.localeCompare(a.jobNumber));
}

export async function getJobDetail(jobNumber: string): Promise<JobDetail | null> {
  const app = getApplication();
  const job = await app.services.jobs.getJobByNumber(jobNumber);
  if (!job) return null;

  const [counterparty, crewList, crewRoles, assignments, deliveries, clientSchedules, vendorSchedules, cashflows] =
    await Promise.all([
      resolveJobCounterparty(job),
      listCrewForRequest(),
      listCrewRolesForRequest(),
      app.repositories.jobCrewAssignments.getByJobId(job.id),
      app.services.deliveries.listByJob(job.id),
      app.repositories.clientPaymentSchedules.getByJobId(job.id),
      app.repositories.vendorPaymentSchedules.getByJobId(job.id),
      app.repositories.cashflows.getByJobId(job.id),
    ]);

  const totals = summarizeJobFinancials(cashflows, clientSchedules, vendorSchedules, assignments);
  const crewPaidByAssignment = paidAmountsByReference(cashflows, "job_crew");
  const clientPaidBySchedule = paidAmountsByReference(cashflows, "client_payment");
  const vendorPaidBySchedule = paidAmountsByReference(cashflows, "vendor_payment");

  const crewMap = buildLookup(crewList);
  const roleMap = buildLookup(crewRoles);
  const crewAssignments: CrewAssignmentView[] = assignments.map((assignment) => {
    const crew = crewMap.get(assignment.crewId) ?? null;
    const effectiveRoleId = assignment.crewRoleId ?? crew?.crewRoleId ?? null;
    const settlement = deriveSettlement(assignment.agreedAmount, [
      { amount: crewPaidByAssignment.get(assignment.id) ?? "0.00" },
    ]);
    return {
      assignment,
      crew,
      roleName: effectiveRoleId ? (roleMap.get(effectiveRoleId)?.name ?? "-") : "-",
      agreedAmount: settlement.obligationAmount,
      paidAmount: settlement.paidAmount,
      remainingAmount: settlement.remainingAmount,
      status: settlement.status,
    };
  });

  return {
    job,
    counterparty,
    crewAssignments,
    deliveries: [...deliveries].sort((a, b) => a.deadline.localeCompare(b.deadline)),
    clientSchedules: clientSchedules
      .map((schedule) => toClientScheduleView(schedule, clientPaidBySchedule.get(schedule.id) ?? "0.00"))
      .sort((a, b) => a.term.localeCompare(b.term)),
    vendorSchedules: vendorSchedules
      .map((schedule) => toVendorScheduleView(schedule, vendorPaidBySchedule.get(schedule.id) ?? "0.00"))
      .sort((a, b) => a.type.localeCompare(b.type)),
    cashflows: [...cashflows].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
    totals: toTotalsView(totals),
  };
}

async function resolveJobCounterparty(job: Job): Promise<Counterparty> {
  const app = getApplication();
  if (job.clientId) {
    const client = await app.services.master.getClient(job.clientId);
    return { type: "CLIENT", id: job.clientId, name: client?.name ?? "Client tidak dikenal" };
  }
  if (job.vendorId) {
    const vendor = await app.services.master.getVendor(job.vendorId);
    return { type: "VENDOR", id: job.vendorId, name: vendor?.name ?? "Vendor tidak dikenal" };
  }
  throw new Error(
    `Job '${job.jobNumber}' tidak memiliki client maupun vendor (melanggar aturan XOR).`,
  );
}

function toClientScheduleView(
  schedule: ClientPaymentSchedule,
  paidAmount: Amount,
): ClientScheduleView {
  return { ...schedule, paidAmount, status: derivePaymentStatus(schedule.amount, paidAmount) };
}

function toVendorScheduleView(
  schedule: VendorPaymentSchedule,
  paidAmount: Amount,
): VendorScheduleView {
  return { ...schedule, paidAmount, status: derivePaymentStatus(schedule.amount, paidAmount) };
}

function toTotalsView(totals: JobFinancialTotals): JobFinancialTotals {
  return totals;
}

/** Ringkasan finance (+ daftar kas) untuk halaman Finance. */
export async function getFinanceOverview(): Promise<FinanceOverview> {
  const app = getApplication();
  const [jobs, clientSchedules, vendorSchedules, cashflows] = await Promise.all([
    listJobsForRequest(),
    app.repositories.clientPaymentSchedules.getAll(),
    app.repositories.vendorPaymentSchedules.getAll(),
    app.repositories.cashflows.getAll(),
  ]);
  const totals = {
    income: sumCashflows(cashflows, (flow) => flow.direction === "INCOME"),
    expense: sumCashflows(cashflows, (flow) => flow.direction === "EXPENSE"),
    net: subtractAmounts(
      sumCashflows(cashflows, (flow) => flow.direction === "INCOME"),
      sumCashflows(cashflows, (flow) => flow.direction === "EXPENSE"),
    ),
  };
  const clientPaidBySchedule = paidAmountsByReference(cashflows, "client_payment");
  const vendorPaidBySchedule = paidAmountsByReference(cashflows, "vendor_payment");

  const jobMap = buildLookup(jobs);
  const jobLabel = (jobId: string | undefined): string => {
    if (!hasValue(jobId)) return "-";
    const job = jobMap.get(jobId);
    return job ? `${job.jobNumber} — ${job.jobName}` : "-";
  };
  const jobNumber = (jobId: string): string => jobMap.get(jobId)?.jobNumber ?? "-";

  const cashflowRows: CashflowRowView[] = cashflows
    .map((flow) => ({
      id: flow.id,
      occurredOn: flow.occurredOn,
      direction: flow.direction,
      category: flow.category,
      description: flow.description,
      amount: flow.amount,
      jobLabel: jobLabel(flow.jobId),
    }))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  return {
    clientSchedules: clientSchedules
      .map((schedule) => toClientScheduleView(schedule, clientPaidBySchedule.get(schedule.id) ?? "0.00"))
      .sort((a, b) => jobNumber(a.jobId).localeCompare(jobNumber(b.jobId))),
    vendorSchedules: vendorSchedules
      .map((schedule) => toVendorScheduleView(schedule, vendorPaidBySchedule.get(schedule.id) ?? "0.00"))
      .sort((a, b) => jobNumber(a.jobId).localeCompare(jobNumber(b.jobId))),
    cashflows: cashflowRows,
    totals,
  };
}

/* -------------------------------------------------------------------------- */
/* Job writes                                                                 */
/* -------------------------------------------------------------------------- */

export interface JobInput {
  jobNumber?: string;
  jobName: string;
  category: JobCategory;
  clientId?: string;
  vendorId?: string;
  packageId?: string;
  executionDate: string;
  status: JobStatus;
  location?: string;
  notes?: string;
  legacyVenueName?: string;
}

export async function createJob(input: JobInput): Promise<Job> {
  const app = getApplication();
  return app.services.jobs.createJob(normalizeJobInput(input));
}

export async function updateJob(id: string, input: JobInput): Promise<Job> {
  const app = getApplication();
  const jobNumber = input.jobNumber?.trim() ?? "";
  if (!jobNumber) throw new Error("Job number wajib diisi.");
  const existing = await app.services.jobs.getJobByNumber(jobNumber);
  if (existing && existing.id !== id) {
    throw new Error(`Job number '${jobNumber}' sudah dipakai job lain.`);
  }
  return app.services.jobs.updateJob(id, normalizeJobInput(input));
}

function normalizeJobInput(input: JobInput): CreateJobInput {
  return {
    jobNumber: input.jobNumber?.trim(),
    jobName: input.jobName.trim(),
    category: input.category,
    clientId: hasValue(input.clientId) ? input.clientId : undefined,
    vendorId: hasValue(input.vendorId) ? input.vendorId : undefined,
    packageId: hasValue(input.packageId) ? input.packageId : undefined,
    executionDate: input.executionDate,
    status: input.status,
    location: hasValue(input.location) ? input.location.trim() : undefined,
    notes: hasValue(input.notes) ? input.notes.trim() : undefined,
    legacyVenueName: hasValue(input.legacyVenueName) ? input.legacyVenueName.trim() : undefined,
  };
}

export async function deleteJob(id: string): Promise<void> {
  return getApplication().services.jobs.deleteJob(id);
}

/* -------------------------------------------------------------------------- */
/* Crew assignment writes (obligation only)                                   */
/* -------------------------------------------------------------------------- */

export type JobCrewInput = CreateJobCrewAssignmentInput;

export async function createJobCrew(input: JobCrewInput): Promise<JobCrewAssignment> {
  return getApplication().repositories.jobCrewAssignments.create(input);
}

export async function updateJobCrew(
  id: string,
  input: JobCrewInput,
): Promise<JobCrewAssignment> {
  return getApplication().repositories.jobCrewAssignments.update(id, input);
}

export async function deleteJobCrew(id: string): Promise<void> {
  return getApplication().repositories.jobCrewAssignments.delete(id);
}

/* -------------------------------------------------------------------------- */
/* Delivery writes                                                            */
/* -------------------------------------------------------------------------- */

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  return getApplication().services.deliveries.createDelivery(input);
}

export async function updateDelivery(
  id: string,
  input: CreateDeliveryInput,
): Promise<Delivery> {
  return getApplication().services.deliveries.updateDelivery(id, input);
}

export async function deleteDelivery(id: string): Promise<void> {
  return getApplication().services.deliveries.deleteDelivery(id);
}

/* -------------------------------------------------------------------------- */
/* Payment schedules (obligations — NOT cash)                                 */
/* -------------------------------------------------------------------------- */

export async function createClientSchedule(
  input: CreateClientPaymentScheduleInput,
): Promise<ClientPaymentSchedule> {
  return getApplication().financial.createClientPaymentSchedule(input);
}

export async function updateClientSchedule(
  id: string,
  input: CreateClientPaymentScheduleInput,
): Promise<ClientPaymentSchedule> {
  return getApplication().financial.updateClientPaymentSchedule(id, input);
}

export async function createVendorSchedule(
  input: CreateVendorPaymentScheduleInput,
): Promise<VendorPaymentSchedule> {
  return getApplication().financial.createVendorPaymentSchedule(input);
}

export async function updateVendorSchedule(
  id: string,
  input: CreateVendorPaymentScheduleInput,
): Promise<VendorPaymentSchedule> {
  return getApplication().financial.updateVendorPaymentSchedule(id, input);
}

/* -------------------------------------------------------------------------- */
/* Actual cash (canonical cashflows, idempotent)                              */
/* -------------------------------------------------------------------------- */

export interface RecordClientPaymentInput {
  scheduleId: string;
  amount: Amount;
  occurredOn: string;
  description?: string;
  /** Wajib: idempotensi DIDUKUNG DATABASE (UNIQUE + sidik jari payload). */
  idempotencyKey: string;
}

export interface RecordVendorPaymentInput {
  scheduleId: string;
  amount: Amount;
  occurredOn: string;
  description?: string;
  idempotencyKey: string;
}

export interface RecordCrewPaymentInput {
  assignmentId: string;
  amount: Amount;
  occurredOn: string;
  description?: string;
  idempotencyKey: string;
}

export interface RecordExpenseInput {
  jobId?: string;
  category: Extract<CashflowCategory, "TRANSPORT" | "EQUIPMENT" | "OTHER">;
  amount: Amount;
  occurredOn: string;
  description: string;
  idempotencyKey: string;
}

export async function recordClientPayment(input: RecordClientPaymentInput) {
  return getApplication().financial.recordClientPayment(input);
}

export async function recordVendorPayment(input: RecordVendorPaymentInput) {
  return getApplication().financial.recordVendorPayment(input);
}

export async function recordCrewPayment(input: RecordCrewPaymentInput) {
  return getApplication().financial.recordCrewPayment(input);
}

export async function recordExpense(input: RecordExpenseInput) {
  return getApplication().financial.recordGeneralExpense({
    jobId: hasValue(input.jobId) ? input.jobId : undefined,
    category: input.category,
    amount: input.amount,
    occurredOn: input.occurredOn,
    description: input.description,
    idempotencyKey: input.idempotencyKey,
  });
}
