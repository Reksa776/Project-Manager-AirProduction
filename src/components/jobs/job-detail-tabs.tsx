"use client";

import { useState, type ReactNode } from "react";

import {
  Badge,
  DeliveryStatusBadge,
  EmptyState,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import {
  CLIENT_PAYMENT_TERM_LABEL,
  JOB_CATEGORY_LABEL,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";
import type { BadgeTone } from "@/components/ui";
import type { PaymentStatus } from "@/lib/types";
import type { JobDetail } from "@/services/types";
import { cn, formatCurrency, formatShortDate } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "crew", label: "Crew" },
  { id: "delivery", label: "Delivery" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "expense", label: "Expense" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

export function JobDetailTabs({ detail }: { detail: JobDetail }) {
  const [active, setActive] = useState<TabId>("overview");
  const { job, assignments } = detail;

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
          {assignments.length === 0 ? (
            <EmptyState
              icon="crew"
              title="Belum ada crew yang ditugaskan"
              description="Crew yang ditugaskan pada job ini akan tampil beserta role dan payment aktualnya."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nama Crew</TH>
                  <TH>Role</TH>
                  <TH>Default Payment</TH>
                  <TH>Payment Aktual</TH>
                </TR>
              </THead>
              <TBody>
                {assignments.map(({ assignment, crew }) => (
                  <TR key={assignment.id}>
                    <TD className="font-medium text-ink">
                      {crew?.name ?? "Crew tidak dikenal"}
                    </TD>
                    <TD>{assignment.role}</TD>
                    <TD className="tabular-nums">
                      {formatCurrency(crew?.defaultPayment ?? 0)}
                    </TD>
                    <TD className="tabular-nums font-medium text-ink">
                      {formatCurrency(assignment.actualPayment)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Panel>
      ) : null}

      {active === "delivery" ? (
        <Panel className="overflow-hidden">
          {detail.deliveries.length === 0 ? (
            <EmptyState
              icon="film"
              title="Belum ada delivery"
              description="Delivery untuk job ini akan tampil di sini beserta deadline dan statusnya."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Nama Delivery</TH>
                  <TH>Deadline</TH>
                  <TH>Tanggal Kirim</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {detail.deliveries.map((delivery) => (
                  <TR key={delivery.id}>
                    <TD className="font-medium text-ink">{delivery.name}</TD>
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
                  </TR>
                ))}
              </TBody>
            </Table>
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
