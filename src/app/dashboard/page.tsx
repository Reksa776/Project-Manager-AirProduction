import Link from "next/link";

import { SummaryCard } from "@/components/dashboard/summary-card";
import {
  Card,
  CardHeader,
  DeliveryStatusBadge,
  EmptyState,
  JobStatusBadge,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { getDashboardData } from "@/services/dashboard-service";
import { formatCountdown, formatShortDate } from "@/lib/utils";

export const metadata = {
  title: "Dashboard · Air Production DB",
};

export default async function DashboardPage() {
  const { summary, incomingWeddings, incomingEditing } =
    await getDashboardData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional Air Production: pekerjaan aktif, jadwal wedding terdekat, dan delivery yang harus diselesaikan."
      />

      {/* Ringkasan job sekaligus status job dalam satu baris yang ringkas. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Jobs"
          value={summary.totalJobs}
          hint="Seluruh pekerjaan tercatat"
        />
        <SummaryCard
          label="Belum Dikerjakan"
          value={summary.notStarted}
          hint="Menunggu dijadwalkan"
        />
        <SummaryCard
          label="Sedang Dikerjakan"
          value={summary.inProgress}
          hint="Sedang dalam proses"
        />
        <SummaryCard
          label="Sudah Dikerjakan"
          value={summary.completed}
          hint="Pekerjaan selesai"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Incoming Wedding"
            description="Jadwal wedding terdekat berdasarkan tanggal pelaksanaan."
            action={
              <Link
                href="/jobs"
                className="text-[13px] font-medium text-brand hover:underline"
              >
                Lihat semua job
              </Link>
            }
          />
          {incomingWeddings.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Belum ada jadwal wedding"
              description="Jadwal wedding akan muncul di sini setelah job kategori Wedding ditambahkan."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tanggal</TH>
                  <TH>Job</TH>
                  <TH>Client/Vendor</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {incomingWeddings.map((item) => (
                  <TR key={item.jobNumber}>
                    <TD className="whitespace-nowrap">
                      <span className="font-medium text-ink">
                        {formatShortDate(item.executionDate)}
                      </span>
                      <span className="ml-1.5 text-[12px] text-ink-muted">
                        {formatCountdown(item.executionDate)}
                      </span>
                    </TD>
                    <TD>
                      <Link
                        href={`/jobs/${item.jobNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {item.jobName}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {item.venueName ?? item.jobNumber}
                      </p>
                    </TD>
                    <TD className="text-ink-soft">{item.counterpartyName}</TD>
                    <TD>
                      <JobStatusBadge status={item.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Incoming Editing"
            description="Delivery belum selesai berdasarkan deadline terdekat."
          />
          {incomingEditing.length === 0 ? (
            <EmptyState
              icon="film"
              title="Tidak ada editing yang menunggu"
              description="Semua delivery sudah selesai. Delivery baru akan tampil di sini beserta deadline-nya."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Deadline</TH>
                  <TH>Delivery</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {incomingEditing.map((item) => (
                  <TR key={item.deliveryId}>
                    <TD className="whitespace-nowrap">
                      <span className="font-medium text-ink">
                        {formatShortDate(item.deadline)}
                      </span>
                      <span className="ml-1.5 text-[12px] text-ink-muted">
                        {formatCountdown(item.deadline)}
                      </span>
                    </TD>
                    <TD>
                      <Link
                        href={`/jobs/${item.jobNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {item.deliveryName}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {item.jobName}
                      </p>
                    </TD>
                    <TD>
                      <DeliveryStatusBadge status={item.status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
