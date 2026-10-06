import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { JobDetailTabs } from "@/components/jobs/job-detail-tabs";
import { JobStatusBadge, PageHeader } from "@/components/ui";
import { getJobDetail } from "@/services/job-service";

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

  const { job, counterparty } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        Kembali ke daftar Jobs
      </Link>

      <PageHeader
        title={job.jobName}
        description={`${job.jobNumber} · ${
          counterparty.type === "VENDOR" ? "Vendor" : "Client"
        }: ${counterparty.name}`}
        actions={<JobStatusBadge status={job.status} />}
      />

      <JobDetailTabs detail={detail} />
    </div>
  );
}
