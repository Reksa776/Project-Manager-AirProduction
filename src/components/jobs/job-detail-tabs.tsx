"use client";

import { useState, type ReactNode } from "react";

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
} from "@/components/ui";
import {
  CLIENT_PAYMENT_TERM_LABEL,
  DELIVERY_STATUS_LABEL,
  JOB_CATEGORY_LABEL,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";
import type { BadgeTone } from "@/components/ui";
import type { Crew, JobCrew, PaymentStatus } from "@/lib/types";
import type { JobDetail } from "@/services/types";
import {
  createDeliveryAction,
  createJobCrewAction,
  deleteDeliveryAction,
  deleteJobCrewAction,
  updateDeliveryAction,
  updateJobCrewAction,
} from "@/app/actions/job-detail-actions";
import { cn, formatCurrency, formatShortDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "crew", label: "Crew" },
  { id: "delivery", label: "Delivery" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "expense", label: "Expense" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const deliveryStatusOptions = [
  { value: "NOT_STARTED", label: DELIVERY_STATUS_LABEL.NOT_STARTED },
  { value: "IN_PROGRESS", label: DELIVERY_STATUS_LABEL.IN_PROGRESS },
  { value: "COMPLETED", label: DELIVERY_STATUS_LABEL.COMPLETED },
];

const paymentStatusOptions = [
  { value: "UNPAID", label: PAYMENT_STATUS_LABEL.UNPAID },
  { value: "PARTIAL", label: PAYMENT_STATUS_LABEL.PARTIAL },
  { value: "PAID", label: PAYMENT_STATUS_LABEL.PAID },
];

const paymentTone: Record<PaymentStatus, BadgeTone> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
};

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-panel shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PanelHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1 px-6 py-5">
      <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      {description ? (
        <p className="text-[13px] text-ink-soft">{description}</p>
      ) : null}
    </div>
  );
}

export function JobDetailTabs({ detail, crew }: { detail: JobDetail; crew: Crew[] }) {
  const [active, setActive] = useState<TabId>("overview");
  const { job, assignments } = detail;
  const router = useRouter();

  /* Crew modal */
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<JobCrew | null>(null);
  const [crewDraft, setCrewDraft] = useState<Record<string, string>>({});
  const [crewModalError, setCrewModalError] = useState<string | null>(null);
  const [crewBusy, setCrewBusy] = useState(false);
  const [deletingCrew, setDeletingCrew] = useState<JobCrew | null>(null);
  const [crewDeleteError, setCrewDeleteError] = useState<string | null>(null);

  function openCreateCrew() {
    setEditingCrew(null);
    setCrewDraft({ crewId: "", role: "", actualPayment: "", paymentStatus: "UNPAID" });
    setCrewModalError(null);
    setCrewModalOpen(true);
  }
  function openEditCrew(assignment: JobCrew) {
    setEditingCrew(assignment);
    setCrewDraft({
      crewId: assignment.crewId,
      role: assignment.role,
      actualPayment: String(assignment.actualPayment),
      paymentStatus: assignment.paymentStatus ?? "UNPAID",
    });
    setCrewModalError(null);
    setCrewModalOpen(true);
  }
  async function handleSubmitCrew() {
    setCrewBusy(true);
    setCrewModalError(null);
    const result = editingCrew
      ? await updateJobCrewAction(editingCrew.id, job.id, crewDraft)
      : await createJobCrewAction(job.id, crewDraft);
    setCrewBusy(false);
    if (!result.ok) { setCrewModalError(result.error); return; }
    setCrewModalOpen(false);
    router.refresh();
  }
  async function handleDeleteCrew() {
    if (!deletingCrew) return;
    setCrewBusy(true);
    setCrewDeleteError(null);
    const result = await deleteJobCrewAction(deletingCrew.id, job.id);
    setCrewBusy(false);
    if (!result.ok) { setCrewDeleteError(result.error); return; }
    setDeletingCrew(null);
    router.refresh();
  }

  /* Delivery modal */
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<string | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<Record<string, string>>({});
  const [deliveryModalError, setDeliveryModalError] = useState<string | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(null);
  const [deliveryDeleteError, setDeliveryDeleteError] = useState<string | null>(null);

  function openCreateDelivery() {
    setEditingDelivery(null);
    setDeliveryDraft({ name: "", deliveryType: "", quantity: "", deadline: "", status: "NOT_STARTED", notes: "" });
    setDeliveryModalError(null);
    setDeliveryModalOpen(true);
  }
  function openEditDelivery(delivery: (typeof detail.deliveries)[number]) {
    setEditingDelivery(delivery.id);
    setDeliveryDraft({
      name: delivery.name,
      deliveryType: delivery.deliveryType ?? "",
      quantity: delivery.quantity === undefined ? "" : String(delivery.quantity),
      deadline: delivery.deadline,
      status: delivery.status,
      notes: delivery.notes ?? "",
    });
    setDeliveryModalError(null);
    setDeliveryModalOpen(true);
  }
  async function handleSubmitDelivery() {
    setDeliveryBusy(true);
    setDeliveryModalError(null);
    const result = editingDelivery
      ? await updateDeliveryAction(editingDelivery, job.id, deliveryDraft)
      : await createDeliveryAction(job.id, deliveryDraft);
    setDeliveryBusy(false);
    if (!result.ok) { setDeliveryModalError(result.error); return; }
    setDeliveryModalOpen(false);
    router.refresh();
  }
  async function handleDeleteDelivery() {
    if (!deletingDeliveryId) return;
    setDeliveryBusy(true);
    setDeliveryDeleteError(null);
    const result = await deleteDeliveryAction(deletingDeliveryId, job.id);
    setDeliveryBusy(false);
    if (!result.ok) { setDeliveryDeleteError(result.error); return; }
    setDeletingDeliveryId(null);
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
          <PanelHeading title="Informasi Job" />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 border-t border-line px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem
              label="Kategori"
              value={JOB_CATEGORY_LABEL[job.category]}
            />
            <DetailItem
              label={detail.counterparty.type === "VENDOR" ? "Vendor" : detail.counterparty.type === "CLIENT" ? "Client" : "Counterparty"}
              value={detail.counterparty.name}
            />
            <DetailItem
              label="Venue"
              value={detail.venue?.name ?? "-"}
            />
            <DetailItem
              label="Location"
              value={job.location ?? "-"}
            />
            <DetailItem label="Nomor Job" value={job.jobNumber} mono />
            <DetailItem label="Dibuat" value={formatShortDate(job.createdAt)} />
            <DetailItem
              label="Diperbarui"
              value={formatShortDate(job.updatedAt)}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <DetailItem label="Catatan" value={job.notes ?? "-"} />
            </div>
          </dl>
        </Panel>
      ) : null}

      {active === "crew" ? (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <p className="text-[13px] text-ink-soft">
              {assignments.length} crew ditugaskan
            </p>
            <Button size="sm" variant="primary" onClick={openCreateCrew}>
              Tambah Crew
            </Button>
          </div>
          {assignments.length === 0 ? (
            <EmptyState
              icon="crew"
              title="Belum ada crew yang ditugaskan"
              description="Crew yang ditugaskan pada job ini akan tampil beserta role dan payment aktualnya."
              action={
                <Button size="sm" variant="secondary" onClick={openCreateCrew}>
                  Tambah Crew
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Nama Crew</TH>
                    <TH>Role</TH>
                    <TH>Payment Aktual</TH>
                    <TH>Status Pembayaran</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {assignments.map(({ assignment, crew: member }) => (
                    <TR key={assignment.id}>
                      <TD className="font-medium text-ink">
                        {member?.name ?? "Crew tidak dikenal"}
                      </TD>
                      <TD>{assignment.role}</TD>
                      <TD className="tabular-nums">
                        {formatCurrency(assignment.actualPayment)}
                      </TD>
                      <TD>
                        {assignment.paymentStatus ? (
                          <Badge tone={paymentTone[assignment.paymentStatus]}>
                            {PAYMENT_STATUS_LABEL[assignment.paymentStatus]}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <button type="button" className="text-[13px] text-brand hover:underline" onClick={() => openEditCrew(assignment)} disabled={crewBusy}>
                            Edit
                          </button>
                          <button type="button" className="text-[13px] text-[#a1352b] hover:underline" onClick={() => { setCrewDeleteError(null); setDeletingCrew(assignment); }} disabled={crewBusy}>
                            Hapus
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
            <p className="text-[13px] text-ink-soft">
              {detail.deliveries.length} delivery
            </p>
            <Button size="sm" variant="primary" onClick={openCreateDelivery}>
              Tambah Delivery
            </Button>
          </div>
          {detail.deliveries.length === 0 ? (
            <EmptyState
              icon="film"
              title="Belum ada delivery"
              description="Delivery untuk job ini akan tampil di sini beserta deadline dan statusnya."
              action={
                <Button size="sm" variant="secondary" onClick={openCreateDelivery}>
                  Tambah Delivery
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Item</TH>
                    <TH>Type</TH>
                    <TH>Quantity</TH>
                    <TH>Deadline</TH>
                    <TH>Tanggal Kirim</TH>
                    <TH>Status</TH>
                    <TH>Notes</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.deliveries.map((delivery) => (
                    <TR key={delivery.id}>
                      <TD className="font-medium text-ink">{delivery.name}</TD>
                      <TD>{delivery.deliveryType ?? "-"}</TD>
                      <TD className="tabular-nums">{delivery.quantity ?? "-"}</TD>
                      <TD className="whitespace-nowrap">
                        {formatShortDate(delivery.deadline)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {delivery.deliveredAt
                          ? formatShortDate(delivery.deliveredAt)
                          : "-"}
                      </TD>
                      <TD>
                        <DeliveryStatusBadge status={delivery.status} />
                      </TD>
                      <TD className="max-w-xs text-ink-muted">
                        {delivery.notes ?? "-"}
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <button type="button" className="text-[13px] text-brand hover:underline" onClick={() => openEditDelivery(delivery)} disabled={deliveryBusy}>
                            Edit
                          </button>
                          <button type="button" className="text-[13px] text-[#a1352b] hover:underline" onClick={() => { setDeliveryDeleteError(null); setDeletingDeliveryId(delivery.id); }} disabled={deliveryBusy}>
                            Hapus
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

      {active === "cashflow" ? (
        <Panel>
          <PanelHeading
            title="Pembayaran Client"
            description="Termin 1 = DP, Termin 2, dan Termin 3 = Pelunasan."
          />
          {detail.clientPayments.length === 0 ? (
            <EmptyState
              icon="finance"
              title="Belum ada pembayaran client"
              description="Termin pembayaran dari client akan tercatat di sini."
            />
          ) : (
            <div className="border-t border-line">
              <Table>
                <THead>
                  <TR>
                    <TH>Termin</TH>
                    <TH>Jumlah</TH>
                    <TH>Jatuh Tempo</TH>
                    <TH>Tanggal Bayar</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.clientPayments.map((payment) => (
                    <TR key={payment.id}>
                      <TD className="font-medium text-ink">
                        {CLIENT_PAYMENT_TERM_LABEL[payment.term]}
                      </TD>
                      <TD className="tabular-nums text-ink">
                        {formatCurrency(payment.amount)}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {payment.dueDate ? formatShortDate(payment.dueDate) : "-"}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {payment.paidDate
                          ? formatShortDate(payment.paidDate)
                          : "-"}
                      </TD>
                      <TD>
                        <Badge tone={paymentTone[payment.status]}>
                          {PAYMENT_STATUS_LABEL[payment.status]}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}

          <div className="border-t border-line">
            <PanelHeading
              title="Pembayaran Vendor"
              description="Pembayaran ke vendor terdiri dari DP dan Pelunasan."
            />
            {detail.vendorPayments.length === 0 ? (
              <EmptyState
                icon="finance"
                title="Belum ada pembayaran vendor"
                description="DP dan pelunasan ke vendor akan tercatat di sini."
              />
            ) : (
              <div className="border-t border-line">
                <Table>
                  <THead>
                    <TR>
                      <TH>Jenis</TH>
                      <TH>Jumlah</TH>
                      <TH>Jatuh Tempo</TH>
                      <TH>Tanggal Bayar</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {detail.vendorPayments.map((payment) => (
                      <TR key={payment.id}>
                        <TD className="font-medium text-ink">
                          {VENDOR_PAYMENT_TYPE_LABEL[payment.type]}
                        </TD>
                        <TD className="tabular-nums text-ink">
                          {formatCurrency(payment.amount)}
                        </TD>
                        <TD className="whitespace-nowrap">
                          {payment.dueDate
                            ? formatShortDate(payment.dueDate)
                            : "-"}
                        </TD>
                        <TD className="whitespace-nowrap">
                          {payment.paidDate
                            ? formatShortDate(payment.paidDate)
                            : "-"}
                        </TD>
                        <TD>
                          <Badge tone={paymentTone[payment.status]}>
                            {PAYMENT_STATUS_LABEL[payment.status]}
                          </Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </div>
        </Panel>
      ) : null}

      {active === "expense" ? (
        <Panel className="overflow-hidden">
          {detail.expenses.length === 0 ? (
            <EmptyState
              icon="finance"
              title="Belum ada expense"
              description="Pengeluaran untuk job ini akan tercatat di sini."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tanggal</TH>
                  <TH>Deskripsi</TH>
                  <TH>Kategori</TH>
                  <TH>Jumlah</TH>
                </TR>
              </THead>
              <TBody>
                {detail.expenses.map((expense) => (
                  <TR key={expense.id}>
                    <TD className="whitespace-nowrap">
                      {formatShortDate(expense.date)}
                    </TD>
                    <TD className="font-medium text-ink">
                      {expense.description}
                    </TD>
                    <TD>{expense.category}</TD>
                    <TD className="tabular-nums text-ink">
                      {formatCurrency(expense.amount)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>
      ) : null}

      <Modal
        open={crewModalOpen}
        onClose={() => setCrewModalOpen(false)}
        title={editingCrew ? "Edit Assignment Crew" : "Tambah Crew"}
        description="Payment aktual disimpan di job_crews.payment dan terpisah dari defaultPayment pada master crew."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCrewModalOpen(false)} disabled={crewBusy}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSubmitCrew} disabled={crewBusy}>
              {crewBusy ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {crewModalError ? (
            <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
              {crewModalError}
            </p>
          ) : null}
          <Select
            label="Crew"
            options={crew.map((c) => ({ value: c.id, label: `${c.name} — ${c.role}` }))}
            placeholder="-- Pilih Crew --"
            value={crewDraft.crewId ?? ""}
            onChange={(e) => { setCrewDraft((p) => { const selected = crew.find((c) => c.id === e.target.value); return { ...p, crewId: e.target.value, role: selected?.role ?? p.role, actualPayment: selected ? String(selected.defaultPayment) : p.actualPayment }; }); }}
          />
          <Input label="Role" value={crewDraft.role ?? ""} onChange={(e) => setCrewDraft((p) => ({ ...p, role: e.target.value }))} />
          <Input label="Payment Aktual" hint="Default diisi dari master crew; ubah sesuai kebutuhan job." value={crewDraft.actualPayment ?? ""} inputMode="numeric" onChange={(e) => setCrewDraft((p) => ({ ...p, actualPayment: e.target.value }))} />
          <Select label="Status Pembayaran" options={paymentStatusOptions} value={crewDraft.paymentStatus ?? "UNPAID"} onChange={(e) => setCrewDraft((p) => ({ ...p, paymentStatus: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={deletingCrew !== null}
        onClose={() => setDeletingCrew(null)}
        title="Hapus Assignment Crew"
        description={`Yakin ingin menghapus assignment crew "${deletingCrew ? crew.find((c) => c.id === deletingCrew.crewId)?.name ?? '' : ''}" dari job ini?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingCrew(null)} disabled={crewBusy}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDeleteCrew} disabled={crewBusy}>
              {crewBusy ? "Menghapus..." : "Hapus"}
            </Button>
          </>
        }
      >
        {crewDeleteError ? (
          <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
            {crewDeleteError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title={editingDelivery ? "Edit Delivery" : "Tambah Delivery"}
        description="Delivery memiliki status sendiri, terpisah dari status job."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeliveryModalOpen(false)} disabled={deliveryBusy}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSubmitDelivery} disabled={deliveryBusy}>
              {deliveryBusy ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {deliveryModalError ? (
            <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
              {deliveryModalError}
            </p>
          ) : null}
          <Input label="Item Name" value={deliveryDraft.name ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Delivery Type" hint="Mis: VIDEO, PHOTO, ALBUM" value={deliveryDraft.deliveryType ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, deliveryType: e.target.value }))} />
          <Input label="Quantity" inputMode="numeric" value={deliveryDraft.quantity ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, quantity: e.target.value }))} />
          <Input label="Deadline (YYYY-MM-DD)" value={deliveryDraft.deadline ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, deadline: e.target.value }))} />
          <Select label="Status" options={deliveryStatusOptions} value={deliveryDraft.status ?? "NOT_STARTED"} onChange={(e) => setDeliveryDraft((p) => ({ ...p, status: e.target.value }))} />
          <Input label="Notes" value={deliveryDraft.notes ?? ""} onChange={(e) => setDeliveryDraft((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={deletingDeliveryId !== null}
        onClose={() => setDeletingDeliveryId(null)}
        title="Hapus Delivery"
        description="Yakin ingin menghapus delivery ini? Tindakan tidak dapat dibatalkan."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingDeliveryId(null)} disabled={deliveryBusy}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleDeleteDelivery} disabled={deliveryBusy}>
              {deliveryBusy ? "Menghapus..." : "Hapus"}
            </Button>
          </>
        }
      >
        {deliveryDeleteError ? (
          <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
            {deliveryDeleteError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "text-sm text-ink",
          mono && "font-mono text-[13px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
