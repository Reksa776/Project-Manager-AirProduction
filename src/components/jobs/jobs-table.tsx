"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import {
  Card,
  Dropdown,
  EmptyState,
  Input,
  JobStatusBadge,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { JOB_CATEGORY_LABEL, JOB_STATUS_LABEL } from "@/lib/labels";
import type { JobStatus } from "@/lib/types";
import type { JobListItem } from "@/services/types";
import { formatShortDate } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "NOT_STARTED", label: JOB_STATUS_LABEL.NOT_STARTED },
  { value: "IN_PROGRESS", label: JOB_STATUS_LABEL.IN_PROGRESS },
  { value: "COMPLETED", label: JOB_STATUS_LABEL.COMPLETED },
];

export function JobsTable({ jobs }: { jobs: JobListItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "">("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (status && job.status !== status) return false;
      if (!keyword) return true;
      return (
        job.jobName.toLowerCase().includes(keyword) ||
        job.jobNumber.toLowerCase().includes(keyword) ||
        job.counterparty.name.toLowerCase().includes(keyword)
      );
    });
  }, [jobs, query, status]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Input
            aria-label="Cari job"
            placeholder="Cari job, nomor, atau client/vendor…"
            leading={<Icon name="search" className="h-4 w-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter status job"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => setStatus(event.target.value as JobStatus | "")}
          />
        </div>
        <p className="text-[13px] text-ink-muted sm:ml-auto">
          {filtered.length} dari {jobs.length} job
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="jobs"
          title="Tidak ada job yang cocok"
          description="Ubah kata kunci pencarian atau filter status untuk menemukan job yang dimaksud."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Job Number</TH>
              <TH>Job Name</TH>
              <TH>Client/Vendor</TH>
              <TH>Kategori</TH>
              <TH>Execution Date</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((job) => (
              <TR key={job.id}>
                <TD className="whitespace-nowrap font-mono text-[12px] text-ink-muted">
                  {job.jobNumber}
                </TD>
                <TD>
                  <Link
                    href={`/jobs/${job.jobNumber}`}
                    className="font-medium text-ink hover:text-brand hover:underline"
                  >
                    {job.jobName}
                  </Link>
                  {job.venueName ? (
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {job.venueName}
                    </p>
                  ) : null}
                </TD>
                <TD>
                  <span className="text-ink-soft">{job.counterparty.name}</span>
                  <p className="mt-0.5 text-[12px] text-ink-muted">
                    {job.counterparty.type === "CLIENT"
                      ? "Client"
                      : job.counterparty.type === "VENDOR"
                        ? "Vendor"
                        : "Tidak diketahui"}
                  </p>
                </TD>
                <TD className="text-ink-soft">
                  {JOB_CATEGORY_LABEL[job.category]}
                </TD>
                <TD className="whitespace-nowrap text-ink-soft">
                  {formatShortDate(job.executionDate)}
                </TD>
                <TD>
                  <JobStatusBadge status={job.status} />
                </TD>
                <TD className="text-right">
                  <Dropdown
                    align="right"
                    trigger={
                      <button
                        type="button"
                        aria-label={`Aksi untuk ${job.jobNumber}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-app hover:text-ink"
                      >
                        Aksi
                        <Icon name="chevronDown" className="h-3.5 w-3.5" />
                      </button>
                    }
                    items={[
                      {
                        label: "Lihat Detail",
                        onSelect: () => router.push(`/jobs/${job.jobNumber}`),
                      },
                      {
                        label: "Tampilkan Semua Job",
                        onSelect: () => router.push("/jobs"),
                      },
                    ]}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
