import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
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
import { requireAuthenticatedAdmin } from "@/lib/auth";

export const metadata = {
  title: "Dashboard · Air Production DB",
};

// Data dibaca dari database saat runtime — jangan diprerender statis (build harus
// bebas kredensial eksternal dan bebas koneksi database).
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const admin = await requireAuthenticatedAdmin();
  const { summary, incomingWeddings, projectMonitoring } =
    await getDashboardData();

  return (
    <AppShell adminName={admin.name}>
    <div className="space-y-8">
      <PageHeader
        title="Overview acara"
        description="Track jobs, upcoming weddings, and deliverables that need attention."
      />

      {/* Overview job sekaligus status job dalam satu baris yang ringkas. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total jobs"
          value={summary.totalJobs}
          hint="All events and productions"
        />
        <SummaryCard
          label="Not started"
          value={summary.notStarted}
          hint="Ready to be planned"
        />
        <SummaryCard
          label="In progress"
          value={summary.inProgress}
          hint="Dalam persiapan atau produksi"
        />
        <SummaryCard
          label="Selesai"
          value={summary.completed}
          hint="Produksi telah dituntaskan"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Upcoming Weddings"
            description="Upcoming events, sorted by event date."
            action={
              <Link
                href="/jobs"
                className="text-[13px] font-medium text-brand hover:underline"
              >
                View all jobs
              </Link>
            }
          />
          {incomingWeddings.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No upcoming weddings"
              description="Recorded weddings will appear here, sorted by event date."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
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
                        {item.jobNumber}
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
          title="Project Monitoring"
          description="Track deliverable progress and deadlines across all projects."
          />
          {projectMonitoring.length === 0 ? (
            <EmptyState
              icon="film"
              title="No project activity yet"
              description="Add deliverables to jobs to monitor project progress here."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Project</TH>
                  <TH>Delivery</TH>
                  <TH>Deadline</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {projectMonitoring.map((item) => (
                  <TR key={item.deliveryId}>
                    <TD>
                      <Link
                        href={`/jobs/${item.jobNumber}`}
                        className="font-medium text-ink hover:text-brand hover:underline"
                      >
                        {item.jobName}
                      </Link>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {item.jobNumber}
                      </p>
                    </TD>
                    <TD className="max-w-56 break-words">{item.deliveryName}</TD>
                    <TD className="whitespace-nowrap">
                      <span className="font-medium text-ink">{formatShortDate(item.deadline)}</span>
                      <span className="ml-1.5 text-[12px] text-ink-muted">{formatCountdown(item.deadline)}</span>
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
    </AppShell>
  );
}
