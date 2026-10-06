"use client";

import { useState } from "react";

import {
  Badge,
  DeliveryStatusBadge,
  EmptyState,
  JobStatusBadge,
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

export function JobDetailTabs({ detail }: { detail: JobDetail }) {
  const [active, setActive] = useState<TabId>("overview");
  const { job, counterparty, venue, assignments } = detail;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "overview" ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 rounded-xl border border-line bg-panel p-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Nomor Job" value={job.jobNumber} mono />
          <DetailItem label="Nama Job" value={job.jobName} />
          <DetailItem label="Kategori" value={JOB_CATEGORY_LABEL[job.category]} />
          <DetailItem
            label={counterparty.type === "VENDOR" ? "Vendor" : "Client"}
            value={counterparty.name}
          />
          <DetailItem label="Venue" value={venue?.name ?? "-"} />
          <DetailItem
            label="Tanggal Pelaksanaan"
            value={formatShortDate(job.executionDate)}
          />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Status
            </dt>
            <dd className="mt-1.5">
              <JobStatusBadge status={job.status} />
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <DetailItem label="Catatan" value={job.notes ?? "-"} />
          </div>
        </dl>
      ) : null}

      {active === "crew" ? (
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
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
                    <TD className="text-ink-soft">
                      {assignment.role}
                    </TD>
                    <TD className="text-ink-soft">
                      {formatCurrency(crew?.defaultPayment ?? 0)}
                    </TD>
                    <TD className="font-medium text-ink">
                      {formatCurrency(assignment.actualPayment)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>
      ) : null}

      {active === "delivery" ? (
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
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
                    <TD className="whitespace-nowrap text-ink-soft">
                      {formatShortDate(delivery.deadline)}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-soft">
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
        </section>
      ) : null}

      {active === "cashflow" ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <h3 className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">
              Pembayaran Client
            </h3>
            {detail.clientPayments.length === 0 ? (
              <EmptyState
                icon="finance"
                title="Belum ada pembayaran client"
                description="Termin pembayaran dari client akan tercatat di sini."
              />
            ) : (
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
                      <TD className="whitespace-nowrap text-ink-soft">
                        {payment.dueDate ? formatShortDate(payment.dueDate) : "-"}
                      </TD>
                      <TD className="whitespace-nowrap text-ink-soft">
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
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-line bg-panel">
            <h3 className="border-b border-line px-5 py-3.5 text-sm font-semibold text-ink">
              Pembayaran Vendor
            </h3>
            {detail.vendorPayments.length === 0 ? (
              <EmptyState
                icon="finance"
                title="Belum ada pembayaran vendor"
                description="DP dan pelunasan ke vendor akan tercatat di sini."
              />
            ) : (
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
                      <TD className="whitespace-nowrap text-ink-soft">
                        {payment.dueDate ? formatShortDate(payment.dueDate) : "-"}
                      </TD>
                      <TD className="whitespace-nowrap text-ink-soft">
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
            )}
          </section>
        </div>
      ) : null}

      {active === "expense" ? (
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
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
                    <TD className="whitespace-nowrap text-ink-soft">
                      {formatShortDate(expense.date)}
                    </TD>
                    <TD className="font-medium text-ink">
                      {expense.description}
                    </TD>
                    <TD className="text-ink-soft">{expense.category}</TD>
                    <TD className="tabular-nums text-ink">
                      {formatCurrency(expense.amount)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </section>
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
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1.5 text-sm text-ink",
          mono && "font-mono text-[13px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
