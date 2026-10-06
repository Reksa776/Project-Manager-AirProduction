import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import {
  CLIENT_PAYMENT_TERM_LABEL,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";
import type { BadgeTone } from "@/components/ui";
import type { PaymentStatus } from "@/lib/types";
import { getFinanceOverview } from "@/services/master-service";
import { formatCurrency, formatShortDate } from "@/lib/utils";

export const metadata = {
  title: "Finance · Air Production DB",
};

const paymentTone: Record<PaymentStatus, BadgeTone> = {
  UNPAID: "danger",
  PARTIAL: "warning",
  PAID: "success",
};

export default async function FinancePage() {
  const { clientPayments, vendorPayments, expenses } =
    await getFinanceOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Daftar pembayaran client, pembayaran vendor, dan expense yang tercatat pada job. Phase ini hanya menampilkan data, belum ada kalkulasi."
      />

      <Card>
        <CardHeader
          title="Pembayaran Client"
          description="Termin 1 = DP, Termin 2, dan Termin 3 = Pelunasan."
        />
        {clientPayments.length === 0 ? (
          <EmptyState
            icon="finance"
            title="Belum ada pembayaran client"
            description="Termin pembayaran dari client akan tampil di sini."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Job</TH>
                <TH>Client</TH>
                <TH>Termin</TH>
                <TH>Jumlah</TH>
                <TH>Jatuh Tempo</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {clientPayments.map((payment) => (
                <TR key={payment.id}>
                  <TD className="whitespace-nowrap font-mono text-xs text-ink-soft">
                    {payment.jobNumber}
                  </TD>
                  <TD className="text-ink">{payment.clientName}</TD>
                  <TD className="text-ink-soft">
                    {CLIENT_PAYMENT_TERM_LABEL[payment.term]}
                  </TD>
                  <TD className="tabular-nums text-ink">
                    {formatCurrency(payment.amount)}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {payment.dueDate ? formatShortDate(payment.dueDate) : "-"}
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
      </Card>

      <Card>
        <CardHeader
          title="Pembayaran Vendor"
          description="Pembayaran ke vendor terdiri dari DP dan Pelunasan."
        />
        {vendorPayments.length === 0 ? (
          <EmptyState
            icon="finance"
            title="Belum ada pembayaran vendor"
            description="DP dan pelunasan ke vendor akan tampil di sini."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Job</TH>
                <TH>Vendor</TH>
                <TH>Jenis</TH>
                <TH>Jumlah</TH>
                <TH>Jatuh Tempo</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {vendorPayments.map((payment) => (
                <TR key={payment.id}>
                  <TD className="whitespace-nowrap font-mono text-xs text-ink-soft">
                    {payment.jobNumber}
                  </TD>
                  <TD className="text-ink">{payment.vendorName}</TD>
                  <TD className="text-ink-soft">
                    {VENDOR_PAYMENT_TYPE_LABEL[payment.type]}
                  </TD>
                  <TD className="tabular-nums text-ink">
                    {formatCurrency(payment.amount)}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {payment.dueDate ? formatShortDate(payment.dueDate) : "-"}
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
      </Card>

      <Card>
        <CardHeader
          title="Expense"
          description="Pengeluaran operasional yang tercatat pada job."
        />
        {expenses.length === 0 ? (
          <EmptyState
            icon="finance"
            title="Belum ada expense"
            description="Pengeluaran produksi akan tampil di sini."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Tanggal</TH>
                <TH>Job</TH>
                <TH>Deskripsi</TH>
                <TH>Kategori</TH>
                <TH>Jumlah</TH>
              </TR>
            </THead>
            <TBody>
              {expenses.map((expense) => (
                <TR key={expense.id}>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {formatShortDate(expense.date)}
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-ink-soft">
                    {expense.jobNumber}
                  </TD>
                  <TD className="text-ink">{expense.description}</TD>
                  <TD className="text-ink-soft">{expense.category}</TD>
                  <TD className="tabular-nums text-ink">
                    {formatCurrency(expense.amount)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
