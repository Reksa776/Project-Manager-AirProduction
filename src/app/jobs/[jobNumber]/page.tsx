import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { JobDetailTabs } from "@/components/jobs/job-detail-tabs";
import { JobStatusBadge } from "@/components/ui";
import { getJobDetail } from "@/services/job-service";
import { formatShortDate } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ jobNumber: string }>;
}) {
  const { jobNumber } = await params;
  return { title: `${jobNumber} · Air Production DB` };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobNumber: string }>;
}) {
  const { jobNumber } = await params;
  const detail = await getJobDetail(jobNumber);

  if (!detail) {
    notFound();
  }

  const { job, counterparty, venue } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        Kembali ke daftar Jobs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[12px] text-ink-muted">{job.jobNumber}</p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            {job.jobName}
          </h1>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <dl className="grid grid-cols-1 gap-6 rounded-xl border border-line bg-panel px-6 py-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <MetaItem
          label={counterparty.type === "VENDOR" ? "Vendor" : "Client"}
          value={counterparty.name}
        />
        <MetaItem
          label="Execution Date"
          value={formatShortDate(job.executionDate)}
        />
        <MetaItem label="Location" value={venue?.name ?? "-"} />
      </dl>

      <JobDetailTabs detail={detail} />
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
