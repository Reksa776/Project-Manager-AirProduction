"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  DeliveryStatusBadge,
  EmptyState,
  Input,
  Modal,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  type BadgeTone,
} from "@/components/ui";
import {
  CLIENT_PAYMENT_TERM_LABEL,
  DELIVERY_STATUS_LABEL,
  GENERAL_EXPENSE_CATEGORIES,
  JOB_CATEGORY_LABEL,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";
import { CASHFLOW_CATEGORY_LABEL } from "@/lib/labels";
import type { Crew, CrewRole, PaymentStatus } from "@/domain/types";
import type { JobDetail } from "@/services/types";
import {
  createDeliveryAction,
  createJobCrewAction,
  deleteDeliveryAction,
  deleteJobCrewAction,
  recordCrewPaymentAction,
  updateDeliveryAction,
  updateJobCrewAction,
} from "@/app/actions/job-detail-actions";
import {
  createClientScheduleAction,
  createVendorScheduleAction,
  recordClientPaymentAction,
  recordExpenseAction,
  recordVendorPaymentAction,
  updateClientScheduleAction,
  updateVendorScheduleAction,
} from "@/app/actions/finance-actions";
import { cn, formatCurrency, formatShortDate } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "crew", label: "Crew" },
  { id: "delivery", label: "Delivery" },
  { id: "finance", label: "Schedules & Cashflow" },
  { id: "expense", label: "Expense" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const deliveryStatusOptions = [
  { value: "NOT_STARTED", label: DELIVERY_STATUS_LABEL.NOT_STARTED },
  { value: "IN_PROGRESS", label: DELIVERY_STATUS_LABEL.IN_PROGRESS },
  { value: "COMPLETED", label: DELIVERY_STATUS_LABEL.COMPLETED },
];

const clientTermOptions = [
  { value: "TERMIN_1", label: CLIENT_PAYMENT_TERM_LABEL.TERMIN_1 },
  { value: "TERMIN_2", label: CLIENT_PAYMENT_TERM_LABEL.TERMIN_2 },
  { value: "TERMIN_3", label: CLIENT_PAYMENT_TERM_LABEL.TERMIN_3 },
];

const vendorTypeOptions = [
  { value: "DP", label: VENDOR_PAYMENT_TYPE_LABEL.DP },
  { value: "PELUNASAN", label: VENDOR_PAYMENT_TYPE_LABEL.PELUNASAN },
];

const expenseCategoryOptions = GENERAL_EXPENSE_CATEGORIES.map((c) => ({
  value: c,
  label: CASHFLOW_CATEGORY_LABEL[c],
}));

const paymentTone: Record<PaymentStatus, BadgeTone> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
};

/** Idempotency key dibuat di klien saat modal dibuka → double-submit aman. */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-line bg-panel shadow-sm", className)}>
      {children}
    </section>
  );
}

function PanelHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1 px-6 py-5">
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {description ? <p className="text-[13px] text-ink-soft">{description}</p> : null}
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
      {message}
    </p>
  );
}

function FooterButton({
  label,
  busy,
  onCancel,
  onSubmit,
  variant = "primary",
}: {
  label: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  variant?: "primary" | "danger";
}) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button variant={variant} onClick={onSubmit} disabled={busy}>
        {busy ? "Saving..." : label}
      </Button>
    </>
  );
}

export function JobDetailTabs({
  detail,
  crew,
  crewRoles,
}: {
  detail: JobDetail;
  crew: Crew[];
  crewRoles: CrewRole[];
}) {
  const [active, setActive] = useState<TabId>("overview");
  const { job, totals } = detail;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [crewModal, setCrewModal] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [crewDraft, setCrewDraft] = useState<Record<string, string>>({});

  const [crewPayFor, setCrewPayFor] = useState<string | null>(null);
  const [crewPayDraft, setCrewPayDraft] = useState<Record<string, string>>({});

  const [deliveryModal, setDeliveryModal] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [deliveryDraft, setDeliveryDraft] = useState<Record<string, string>>({});

  const [clientScheduleModal, setClientScheduleModal] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [clientScheduleDraft, setClientScheduleDraft] = useState<Record<string, string>>({});

  const [vendorScheduleModal, setVendorScheduleModal] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [vendorScheduleDraft, setVendorScheduleDraft] = useState<Record<string, string>>({});

  const [clientPayOpen, setClientPayOpen] = useState(false);
  const [clientPayDraft, setClientPayDraft] = useState<Record<string, string>>({});

  const [vendorPayOpen, setVendorPayOpen] = useState(false);
  const [vendorPayDraft, setVendorPayDraft] = useState<Record<string, string>>({});

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDraft, setExpenseDraft] = useState<Record<string, string>>({});

  const crewRoleOptions = crewRoles.map((role) => ({ value: role.id, label: role.name }));

  async function submit(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    onSuccess: () => void,
  ) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-[13px] transition-colors",
              active === tab.id
                ? "border-ink font-medium text-ink"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "overview" ? (
        <Panel>
          <PanelHeading title="Job Information" />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-line px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Event Date" value={formatShortDate(job.executionDate)} />
            <DetailItem
              label={detail.counterparty.type === "VENDOR" ? "Vendor" : "Client"}
              value={detail.counterparty.name}
            />
            <DetailItem label="Location" value={job.location ?? "-"} />
            <DetailItem label="Job Number" value={job.jobNumber} mono />
            <DetailItem label="Category" value={JOB_CATEGORY_LABEL[job.category]} />
            <DetailItem label="Dibuat" value={formatShortDate(job.createdAt)} />
            <DetailItem label="Diperbarui" value={formatShortDate(job.updatedAt)} />
            <div className="sm:col-span-2 lg:col-span-4">
              <DetailItem label="Notes" value={job.notes ?? "-"} />
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-6 border-t border-line px-6 py-5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Income" value={formatCurrency(totals.income)} />
            <Stat label="Expense" value={formatCurrency(totals.expense)} />
            <Stat label="Net" value={formatCurrency(totals.net)} />
            <Stat label="Client Obligation" value={formatCurrency(totals.clientObligation)} />
            <Stat label="Vendor Obligation" value={formatCurrency(totals.vendorObligation)} />
            <Stat label="Crew Agreement" value={formatCurrency(totals.crewAgreed)} />
          </div>
        </Panel>
      ) : null}

      {active === "crew" ? (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <p className="text-[13px] text-ink-soft">
              {detail.crewAssignments.length} crew ditugaskan — status dihitung from kas aktual.
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setCrewDraft({ crewId: "", crewRoleId: "", agreedAmount: "", notes: "" });
                setCrewModal({ open: true, id: null });
              }}
            >
              Add Crew
            </Button>
          </div>
          {detail.crewAssignments.length === 0 ? (
            <EmptyState
              icon="crew"
              title="No crew assigned yet"
              description="Crew agreements are recorded here; actual payments are tracked separately."
            />
          ) : (
            <div className="min-w-0 max-w-full overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Crew Name</TH>
                    <TH>Role</TH>
                    <TH>Agreed Amount</TH>
                    <TH>Paid</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.crewAssignments.map((view) => (
                    <TR key={view.assignment.id}>
                      <TD className="font-medium text-ink">
                        {view.crew?.name ?? "Unknown crew member"}
                      </TD>
                      <TD>{view.roleName}</TD>
                      <TD className="tabular-nums">{formatCurrency(view.agreedAmount)}</TD>
                      <TD className="tabular-nums">{formatCurrency(view.paidAmount)}</TD>
                      <TD>
                        <Badge tone={paymentTone[view.status]}>
                          {PAYMENT_STATUS_LABEL[view.status]}
                        </Badge>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-[13px] text-brand hover:underline"
                            disabled={busy}
                            onClick={() => {
                              setCrewDraft({
                                crewId: view.assignment.crewId,
                                crewRoleId: view.assignment.crewRoleId ?? "",
                                agreedAmount: view.agreedAmount,
                                notes: view.assignment.notes ?? "",
                              });
                              setCrewModal({ open: true, id: view.assignment.id });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-[13px] text-ink-soft hover:underline"
                            disabled={busy}
                            onClick={() => {
                              setCrewPayDraft({
                                amount: view.remainingAmount,
                                occurredOn: "",
                                description: "",
                                idempotencyKey: newIdempotencyKey(),
                              });
                              setCrewPayFor(view.assignment.id);
                            }}
                          >
                            Record Kas
                          </button>
                          <button
                            type="button"
                            className="text-[13px] text-[#a1352b] hover:underline"
                            disabled={busy}
                            onClick={() =>
                              submit(
                                () => deleteJobCrewAction(view.assignment.id, job.id),
                                () => undefined,
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Panel>
      ) : null}

      {active === "delivery" ? (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <p className="text-[13px] text-ink-soft">{detail.deliveries.length} delivery</p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setDeliveryDraft({
                  name: "",
                  deliveryType: "",
                  quantity: "",
                  deadline: "",
                  status: "NOT_STARTED",
                  notes: "",
                });
                setDeliveryModal({ open: true, id: null });
              }}
            >
              Add Delivery
            </Button>
          </div>
          {detail.deliveries.length === 0 ? (
            <EmptyState
              icon="film"
              title="No data yet delivery"
              description="Deliverables for this job will appear here with their deadlines and statuses."
            />
          ) : (
            <div className="min-w-0 max-w-full overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH>Type</TH>
                    <TH>Quantity</TH>
                    <TH>Deadline</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.deliveries.map((delivery) => (
                    <TR key={delivery.id}>
                      <TD className="font-medium text-ink">{delivery.name}</TD>
                      <TD>{delivery.deliveryType ?? "-"}</TD>
                      <TD className="tabular-nums">{delivery.quantity ?? "-"}</TD>
                      <TD className="whitespace-nowrap">{formatShortDate(delivery.deadline)}</TD>
                      <TD>
                        <DeliveryStatusBadge status={delivery.status} />
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-[13px] text-brand hover:underline"
                            disabled={busy}
                            onClick={() => {
                              setDeliveryDraft({
                                name: delivery.name,
                                deliveryType: delivery.deliveryType ?? "",
                                quantity: delivery.quantity === undefined ? "" : String(delivery.quantity),
                                deadline: delivery.deadline,
                                status: delivery.status,
                                notes: delivery.notes ?? "",
                              });
                              setDeliveryModal({ open: true, id: delivery.id });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-[13px] text-[#a1352b] hover:underline"
                            disabled={busy}
                            onClick={() =>
                              submit(() => deleteDeliveryAction(delivery.id, job.id), () => undefined)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Panel>
      ) : null}

      {active === "finance" ? (
        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Client Billing Schedule</h3>
                <p className="text-[13px] text-ink-soft">
                  Obligasi (bukan kas). Status dihitung from kas aktual.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => {
                  setClientPayDraft({ scheduleId: "", amount: "", occurredOn: "", description: "", idempotencyKey: newIdempotencyKey() });
                  setClientPayOpen(true);
                }}>
                  Record Client Payment
                </Button>
                <Button size="sm" variant="primary" onClick={() => {
                  setClientScheduleDraft({ term: "TERMIN_1", amount: "", dueDate: "", notes: "" });
                  setClientScheduleModal({ open: true, id: null });
                }}>
                  Add Schedule
                </Button>
              </div>
            </div>
            {detail.clientSchedules.length === 0 ? (
              <EmptyState icon="finance" title="No client schedules yet" description="Client payment installments will appear here." />
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Installment</TH>
                      <TH>Obligation</TH>
                      <TH>Paid</TH>
                      <TH>Due Date</TH>
                      <TH>Status</TH>
                      <TH>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {detail.clientSchedules.map((schedule) => (
                      <TR key={schedule.id}>
                        <TD className="font-medium text-ink">
                          {CLIENT_PAYMENT_TERM_LABEL[schedule.term]}
                        </TD>
                        <TD className="tabular-nums">{formatCurrency(schedule.amount)}</TD>
                        <TD className="tabular-nums">{formatCurrency(schedule.paidAmount)}</TD>
                        <TD className="whitespace-nowrap">
                          {schedule.dueDate ? formatShortDate(schedule.dueDate) : "-"}
                        </TD>
                        <TD>
                          <Badge tone={paymentTone[schedule.status]}>
                            {PAYMENT_STATUS_LABEL[schedule.status]}
                          </Badge>
                        </TD>
                        <TD>
                          <button
                            type="button"
                            className="text-[13px] text-brand hover:underline"
                            disabled={busy}
                            onClick={() => {
                              setClientScheduleDraft({
                                term: schedule.term,
                                amount: schedule.amount,
                                dueDate: schedule.dueDate ?? "",
                                notes: schedule.notes ?? "",
                              });
                              setClientScheduleModal({ open: true, id: schedule.id });
                            }}
                          >
                            Edit
                          </button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Vendor Payment Schedule</h3>
                <p className="text-[13px] text-ink-soft">Vendor deposit and final payment obligations.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => {
                  setVendorPayDraft({ scheduleId: "", amount: "", occurredOn: "", description: "", idempotencyKey: newIdempotencyKey() });
                  setVendorPayOpen(true);
                }}>
                  Record Vendor Payment
                </Button>
                <Button size="sm" variant="primary" onClick={() => {
                  setVendorScheduleDraft({ type: "DP", amount: "", dueDate: "", notes: "" });
                  setVendorScheduleModal({ open: true, id: null });
                }}>
                  Add Schedule
                </Button>
              </div>
            </div>
            {detail.vendorSchedules.length === 0 ? (
              <EmptyState icon="finance" title="No vendor schedules yet" description="Vendor deposit and final payments will appear here." />
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>Type</TH>
                      <TH>Obligation</TH>
                      <TH>Paid</TH>
                      <TH>Due Date</TH>
                      <TH>Status</TH>
                      <TH>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {detail.vendorSchedules.map((schedule) => (
                      <TR key={schedule.id}>
                        <TD className="font-medium text-ink">
                          {VENDOR_PAYMENT_TYPE_LABEL[schedule.type]}
                        </TD>
                        <TD className="tabular-nums">{formatCurrency(schedule.amount)}</TD>
                        <TD className="tabular-nums">{formatCurrency(schedule.paidAmount)}</TD>
                        <TD className="whitespace-nowrap">
                          {schedule.dueDate ? formatShortDate(schedule.dueDate) : "-"}
                        </TD>
                        <TD>
                          <Badge tone={paymentTone[schedule.status]}>
                            {PAYMENT_STATUS_LABEL[schedule.status]}
                          </Badge>
                        </TD>
                        <TD>
                          <button
                            type="button"
                            className="text-[13px] text-brand hover:underline"
                            disabled={busy}
                            onClick={() => {
                              setVendorScheduleDraft({
                                type: schedule.type,
                                amount: schedule.amount,
                                dueDate: schedule.dueDate ?? "",
                                notes: schedule.notes ?? "",
                              });
                              setVendorScheduleModal({ open: true, id: schedule.id });
                            }}
                          >
                            Edit
                          </button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeading
              title="Job Cashflow"
              description="Actual cash movements. Records cannot be edited or deleted."
            />
            {detail.cashflows.length === 0 ? (
              <EmptyState icon="finance" title="No cashflow recorded yet" description="Client, vendor, and crew payments and expenses will appear here." />
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto border-t border-line">
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Direction</TH>
                      <TH>Category</TH>
                      <TH>Description</TH>
                      <TH>Amount</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {detail.cashflows.map((flow) => (
                      <TR key={flow.id}>
                        <TD className="whitespace-nowrap">{formatShortDate(flow.occurredOn)}</TD>
                        <TD>{flow.direction === "INCOME" ? "Incoming" : "Outgoing"}</TD>
                        <TD>{CASHFLOW_CATEGORY_LABEL[flow.category]}</TD>
                        <TD className="text-ink-soft">{flow.description}</TD>
                        <TD className="tabular-nums">{formatCurrency(flow.amount)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {active === "expense" ? (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Job Expenses</h3>
              <p className="text-[13px] text-ink-soft">
                Expenses are recorded as cash outflows in the cashflow ledger.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => {
              setExpenseDraft({ category: "OTHER", description: "", amount: "", occurredOn: "", idempotencyKey: newIdempotencyKey() });
              setExpenseOpen(true);
            }}>
              Record Expense
            </Button>
          </div>
          {detail.cashflows.filter((flow) => flow.direction === "EXPENSE").length === 0 ? (
            <EmptyState icon="finance" title="No expenses yet" description="Expenses for this job will appear here." />
          ) : (
            <div className="min-w-0 max-w-full overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Category</TH>
                    <TH>Description</TH>
                    <TH>Amount</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.cashflows
                    .filter((flow) => flow.direction === "EXPENSE")
                    .map((flow) => (
                      <TR key={flow.id}>
                        <TD className="whitespace-nowrap">{formatShortDate(flow.occurredOn)}</TD>
                        <TD>{CASHFLOW_CATEGORY_LABEL[flow.category]}</TD>
                        <TD className="font-medium text-ink">{flow.description}</TD>
                        <TD className="tabular-nums">{formatCurrency(flow.amount)}</TD>
                      </TR>
                    ))}
                </TBody>
              </Table>
            </div>
          )}
        </Panel>
      ) : null}

      <ErrorNote message={error} />

      {/* Crew obligation modal */}
      <Modal
        open={crewModal.open}
        onClose={() => setCrewModal({ open: false, id: null })}
        title={crewModal.id ? "Edit Crew Assignment" : "Add Crew"}
        description="Record the agreement only. Actual payments are tracked separately."
        footer={
          <FooterButton
            label="Save"
            busy={busy}
            onCancel={() => setCrewModal({ open: false, id: null })}
            onSubmit={() =>
              submit(
                () =>
                  crewModal.id
                    ? updateJobCrewAction(crewModal.id, job.id, crewDraft)
                    : createJobCrewAction(job.id, crewDraft),
                () => setCrewModal({ open: false, id: null }),
              )
            }
          />
        }
      >
        <div className="space-y-4">
          <Select
            label="Crew"
            options={crew.map((member) => ({ value: member.id, label: member.name }))}
            placeholder="-- Select Crew --"
            value={crewDraft.crewId ?? ""}
            onChange={(e) => setCrewDraft((p) => ({ ...p, crewId: e.target.value }))}
          />
          <Select
            label="Override Role (optional)"
            options={[{ value: "", label: "-- Use crew member default role --" }, ...crewRoleOptions]}
            value={crewDraft.crewRoleId ?? ""}
            onChange={(e) => setCrewDraft((p) => ({ ...p, crewRoleId: e.target.value }))}
          />
          <Input
            label="Nilai Kesepakatan"
            hint="Contoh: 750000 atau 750000.55"
            inputMode="numeric"
            value={crewDraft.agreedAmount ?? ""}
            onChange={(e) => setCrewDraft((p) => ({ ...p, agreedAmount: e.target.value }))}
          />
          <Input
            label="Notes"
            value={crewDraft.notes ?? ""}
            onChange={(e) => setCrewDraft((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Crew cash payment modal */}
      <Modal
        open={crewPayFor !== null}
        onClose={() => setCrewPayFor(null)}
        title="Record Crew Payment"
        description="Record an outgoing payment. The agreed amount remains unchanged."
        footer={
          <FooterButton
            label="Record"
            busy={busy}
            onCancel={() => setCrewPayFor(null)}
            onSubmit={() =>
              submit(
                () => recordCrewPaymentAction(crewPayFor!, job.id, crewPayDraft),
                () => setCrewPayFor(null),
              )
            }
          />
        }
      >
        <div className="space-y-4">
          <Input label="Amount" hint="Example: 500,000" inputMode="numeric" value={crewPayDraft.amount ?? ""} onChange={(e) => setCrewPayDraft((p) => ({ ...p, amount: e.target.value }))} />
          <Input label="Payment Date" type="date" value={crewPayDraft.occurredOn ?? ""} onChange={(e) => setCrewPayDraft((p) => ({ ...p, occurredOn: e.target.value }))} />
          <Input label="Description (optional)" value={crewPayDraft.description ?? ""} onChange={(e) => setCrewPayDraft((p) => ({ ...p, description: e.target.value }))} />
        </div>
      </Modal>

      {/* Delivery modal */}
      <Modal
        open={deliveryModal.open}
        onClose={() => setDeliveryModal({ open: false, id: null })}
        title={deliveryModal.id ? "Edit Deliverable" : "Add Delivery"}
        description="Delivery memiliki status sendiri, terpisah from status job."
        footer={
          <FooterButton
            label="Save"
            busy={busy}
            onCancel={() => setDeliveryModal({ open: false, id: null })}
            onSubmit={() =>
              submit(
                () =>
                  deliveryModal.id
                    ? updateDeliveryAction(deliveryModal.id, job.id, deliveryDraft)
                    : createDeliveryAction(job.id, deliveryDraft),
                () => setDeliveryModal({ open: false, id: null }),
              )
            }
          />
        }
      >
        <div className="space-y-4">
          <Input label="Item Name" value={deliveryDraft.name ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Delivery Type" hint="Mis: VIDEO, PHOTO, ALBUM" value={deliveryDraft.deliveryType ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, deliveryType: e.target.value }))} />
          <Input label="Quantity" inputMode="numeric" value={deliveryDraft.quantity ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, quantity: e.target.value }))} />
          <Input label="Deadline" type="date" value={deliveryDraft.deadline ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, deadline: e.target.value }))} />
          <Select label="Status" options={deliveryStatusOptions} value={deliveryDraft.status ?? "NOT_STARTED"} onChange={(e) => setDeliveryDraft((p) => ({ ...p, status: e.target.value }))} />
        </div>
      </Modal>

      {/* Client schedule modal */}
      <Modal
        open={clientScheduleModal.open}
        onClose={() => setClientScheduleModal({ open: false, id: null })}
        title={clientScheduleModal.id ? "Edit Client Schedule" : "Add Client Schedule"}
        description="Save a payment obligation, not a cash movement."
        footer={
          <FooterButton
            label="Save"
            busy={busy}
            onCancel={() => setClientScheduleModal({ open: false, id: null })}
            onSubmit={() =>
              submit(
                () =>
                  clientScheduleModal.id
                    ? updateClientScheduleAction(clientScheduleModal.id, { ...clientScheduleDraft, jobId: job.id })
                    : createClientScheduleAction({ ...clientScheduleDraft, jobId: job.id }),
                () => setClientScheduleModal({ open: false, id: null }),
              )
            }
          />
        }
      >
        <div className="space-y-4">
          <Select label="Installment" options={clientTermOptions} value={clientScheduleDraft.term ?? "TERMIN_1"} onChange={(e) => setClientScheduleDraft((p) => ({ ...p, term: e.target.value }))} />
          <Input label="Amount" hint="Example: 1,000,000" inputMode="numeric" value={clientScheduleDraft.amount ?? ""} onChange={(e) => setClientScheduleDraft((p) => ({ ...p, amount: e.target.value }))} />
          <Input label="Due Date (optional)" type="date" value={clientScheduleDraft.dueDate ?? ""} onChange={(e) => setClientScheduleDraft((p) => ({ ...p, dueDate: e.target.value }))} />
          <Input label="Notes" value={clientScheduleDraft.notes ?? ""} onChange={(e) => setClientScheduleDraft((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* Vendor schedule modal */}
      <Modal
        open={vendorScheduleModal.open}
        onClose={() => setVendorScheduleModal({ open: false, id: null })}
        title={vendorScheduleModal.id ? "Edit Vendor Schedule" : "Add Vendor Schedule"}
        description="Save a payment obligation, not a cash movement."
        footer={
          <FooterButton
            label="Save"
            busy={busy}
            onCancel={() => setVendorScheduleModal({ open: false, id: null })}
            onSubmit={() =>
              submit(
                () =>
                  vendorScheduleModal.id
                    ? updateVendorScheduleAction(vendorScheduleModal.id, { ...vendorScheduleDraft, jobId: job.id })
                    : createVendorScheduleAction({ ...vendorScheduleDraft, jobId: job.id }),
                () => setVendorScheduleModal({ open: false, id: null }),
              )
            }
          />
        }
      >
        <div className="space-y-4">
          <Select label="Type" options={vendorTypeOptions} value={vendorScheduleDraft.type ?? "DP"} onChange={(e) => setVendorScheduleDraft((p) => ({ ...p, type: e.target.value }))} />
          <Input label="Amount" hint="Example: 400,000" inputMode="numeric" value={vendorScheduleDraft.amount ?? ""} onChange={(e) => setVendorScheduleDraft((p) => ({ ...p, amount: e.target.value }))} />
          <Input label="Due Date (optional)" type="date" value={vendorScheduleDraft.dueDate ?? ""} onChange={(e) => setVendorScheduleDraft((p) => ({ ...p, dueDate: e.target.value }))} />
          <Input label="Notes" value={vendorScheduleDraft.notes ?? ""} onChange={(e) => setVendorScheduleDraft((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* Client payment (cash) modal */}
      <Modal
        open={clientPayOpen}
        onClose={() => setClientPayOpen(false)}
        title="Record Client Payment"
        description="Record an incoming payment. Duplicate submissions are prevented."
        footer={
          <FooterButton
            label="Record"
            busy={busy}
            onCancel={() => setClientPayOpen(false)}
            onSubmit={() =>
              submit(() => recordClientPaymentAction(clientPayDraft), () => setClientPayOpen(false))
            }
          />
        }
      >
        <div className="space-y-4">
          <Select
            label="Client Schedule"
            options={detail.clientSchedules.map((s) => ({
              value: s.id,
              label: `${CLIENT_PAYMENT_TERM_LABEL[s.term]} — ${formatCurrency(s.amount)} (${PAYMENT_STATUS_LABEL[s.status]})`,
            }))}
            placeholder="-- Select Schedule --"
            value={clientPayDraft.scheduleId ?? ""}
            onChange={(e) => setClientPayDraft((p) => ({ ...p, scheduleId: e.target.value }))}
          />
          <Input label="Amount" hint="Example: 500,000" inputMode="numeric" value={clientPayDraft.amount ?? ""} onChange={(e) => setClientPayDraft((p) => ({ ...p, amount: e.target.value }))} />
          <Input label="Payment Date" type="date" value={clientPayDraft.occurredOn ?? ""} onChange={(e) => setClientPayDraft((p) => ({ ...p, occurredOn: e.target.value }))} />
          <Input label="Description (optional)" value={clientPayDraft.description ?? ""} onChange={(e) => setClientPayDraft((p) => ({ ...p, description: e.target.value }))} />
        </div>
      </Modal>

      {/* Vendor payment (cash) modal */}
      <Modal
        open={vendorPayOpen}
        onClose={() => setVendorPayOpen(false)}
        title="Record Vendor Payment"
        description="Record an outgoing payment. Duplicate submissions are prevented."
        footer={
          <FooterButton
            label="Record"
            busy={busy}
            onCancel={() => setVendorPayOpen(false)}
            onSubmit={() =>
              submit(() => recordVendorPaymentAction(vendorPayDraft), () => setVendorPayOpen(false))
            }
          />
        }
      >
        <div className="space-y-4">
          <Select
            label="Vendor Schedule"
            options={detail.vendorSchedules.map((s) => ({
              value: s.id,
              label: `${VENDOR_PAYMENT_TYPE_LABEL[s.type]} — ${formatCurrency(s.amount)} (${PAYMENT_STATUS_LABEL[s.status]})`,
            }))}
            placeholder="-- Select Schedule --"
            value={vendorPayDraft.scheduleId ?? ""}
            onChange={(e) => setVendorPayDraft((p) => ({ ...p, scheduleId: e.target.value }))}
          />
          <Input label="Amount" hint="Example: 400,000" inputMode="numeric" value={vendorPayDraft.amount ?? ""} onChange={(e) => setVendorPayDraft((p) => ({ ...p, amount: e.target.value }))} />
          <Input label="Payment Date" type="date" value={vendorPayDraft.occurredOn ?? ""} onChange={(e) => setVendorPayDraft((p) => ({ ...p, occurredOn: e.target.value }))} />
          <Input label="Description (optional)" value={vendorPayDraft.description ?? ""} onChange={(e) => setVendorPayDraft((p) => ({ ...p, description: e.target.value }))} />
        </div>
      </Modal>

      {/* Expense (canonical cashflow) modal */}
      <Modal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Record Expense"
        description="Record an expense. Expenses can also be added without a job from the Finance page."
        footer={
          <FooterButton
            label="Record"
            busy={busy}
            onCancel={() => setExpenseOpen(false)}
            onSubmit={() =>
              submit(
                () => recordExpenseAction({ ...expenseDraft, jobId: job.id }),
                () => setExpenseOpen(false),
              )
            }
          />
        }
      >
        <div className="space-y-4">
          <Select label="Category" options={expenseCategoryOptions} value={expenseDraft.category ?? "OTHER"} onChange={(e) => setExpenseDraft((p) => ({ ...p, category: e.target.value }))} />
          <Input label="Description" value={expenseDraft.description ?? ""} onChange={(e) => setExpenseDraft((p) => ({ ...p, description: e.target.value }))} />
          <Input label="Amount" hint="Contoh: 250000" inputMode="numeric" value={expenseDraft.amount ?? ""} onChange={(e) => setExpenseDraft((p) => ({ ...p, amount: e.target.value }))} />
          <Input label="Expense Date" type="date" value={expenseDraft.occurredOn ?? ""} onChange={(e) => setExpenseDraft((p) => ({ ...p, occurredOn: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd className={cn("text-sm text-ink", mono && "font-mono text-[13px]")}>{value}</dd>
    </div>
  );
}
