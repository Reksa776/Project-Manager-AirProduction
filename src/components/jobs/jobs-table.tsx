"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import {
  Button,
  Card,
  Dropdown,
  EmptyState,
  Input,
  JobStatusBadge,
  Modal,
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

const CATEGORY_OPTIONS = [
  { value: "WEDDING", label: JOB_CATEGORY_LABEL.WEDDING },
  { value: "PREWEDDING", label: JOB_CATEGORY_LABEL.PREWEDDING },
  { value: "CORPORATE", label: JOB_CATEGORY_LABEL.CORPORATE },
  { value: "EVENT", label: JOB_CATEGORY_LABEL.EVENT },
  { value: "OTHER", label: JOB_CATEGORY_LABEL.OTHER },
];

const STATUS_FORM_OPTIONS = [
  { value: "NOT_STARTED", label: JOB_STATUS_LABEL.NOT_STARTED },
  { value: "IN_PROGRESS", label: JOB_STATUS_LABEL.IN_PROGRESS },
  { value: "COMPLETED", label: JOB_STATUS_LABEL.COMPLETED },
];

const COUNTERPARTY_TYPE_OPTIONS = [
  { value: "CLIENT", label: "Client" },
  { value: "VENDOR", label: "Vendor" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "NOT_STARTED", label: JOB_STATUS_LABEL.NOT_STARTED },
  { value: "IN_PROGRESS", label: JOB_STATUS_LABEL.IN_PROGRESS },
  { value: "COMPLETED", label: JOB_STATUS_LABEL.COMPLETED },
];

export function JobsTable({
  jobs,
  clients,
  vendors,
  venues,
  createAction,
  updateAction,
  deleteAction,
}: {
  jobs: JobListItem[];
  clients: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  venues: Array<{ id: string; name: string }>;
  createAction: (values: Record<string, string>) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateAction: (id: string, values: Record<string, string>) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteAction: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setEditingId(null);
    setDraft({
      jobNumber: "", jobName: "", category: "WEDDING", status: "NOT_STARTED",
      counterpartyType: "CLIENT", counterpartyId: "", venueId: "",
      executionDate: "", location: "", notes: "",
    });
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(job: JobListItem) {
    setEditingId(job.id);
    setDraft({
      jobNumber: job.jobNumber, jobName: job.jobName, category: job.category,
      status: job.status,
      counterpartyType: job.counterparty.type === "UNKNOWN" ? "CLIENT" : job.counterparty.type,
      counterpartyId: job.counterparty.id ?? "",
      venueId: job.venueId ?? "",
      executionDate: job.executionDate, location: job.location ?? "", notes: job.notes ?? "",
    });
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSubmit() {
    setBusy(true);
    setModalError(null);
    const result = editingId
      ? await updateAction(editingId, draft)
      : await createAction(draft);
    setBusy(false);
    if (!result.ok) { setModalError(result.error); return; }
    setModalOpen(false);
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    const result = await deleteAction(deleteTarget.id);
    setBusy(false);
    if (!result.ok) { setDeleteError(result.error); return; }
    setDeleteTarget(null);
    router.refresh();
  }

  const counterpartyOptions =
    draft.counterpartyType === "VENDOR"
      ? vendors.map((v) => ({ value: v.id, label: v.name }))
      : clients.map((c) => ({ value: c.id, label: c.name }));

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
        <Button size="sm" variant="primary" onClick={openCreate}>
          Tambah Job
        </Button>
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
                        label: "Edit",
                        onSelect: () => openEdit(job),
                      },
                      {
                        label: "Hapus",
                        onSelect: () => { setDeleteError(null); setDeleteTarget(job); },
                      },
                    ]}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Job" : "Tambah Job"}
        description="Job wajib memiliki Client ATAU Vendor (tidak keduanya)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {modalError ? (
            <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
              {modalError}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Job Number" value={draft.jobNumber ?? ""} onChange={(e) => setDraft((p) => ({ ...p, jobNumber: e.target.value }))} />
            <Input label="Job Name" value={draft.jobName ?? ""} onChange={(e) => setDraft((p) => ({ ...p, jobName: e.target.value }))} />
            <Select label="Kategori" options={CATEGORY_OPTIONS} value={draft.category ?? "WEDDING"} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} />
            <Select label="Status" options={STATUS_FORM_OPTIONS} value={draft.status ?? "NOT_STARTED"} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} />
            <Select
              label="Jenis Counterparty"
              options={COUNTERPARTY_TYPE_OPTIONS}
              value={draft.counterpartyType ?? "CLIENT"}
              onChange={(e) => setDraft((p) => ({ ...p, counterpartyType: e.target.value, counterpartyId: "" }))}
            />
            <Select
              label={draft.counterpartyType === "VENDOR" ? "Vendor" : "Client"}
              options={counterpartyOptions}
              placeholder="-- Pilih --"
              value={draft.counterpartyId ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, counterpartyId: e.target.value }))}
            />
            <Select
              label="Venue (opsional)"
              options={[{ value: "", label: "-- Tanpa Venue --" }, ...venues.map((v) => ({ value: v.id, label: v.name }))]}
              value={draft.venueId ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, venueId: e.target.value }))}
            />
            <Input label="Tanggal Eksekusi (YYYY-MM-DD)" value={draft.executionDate ?? ""} onChange={(e) => setDraft((p) => ({ ...p, executionDate: e.target.value }))} />
            <Input label="Lokasi" value={draft.location ?? ""} onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink-soft">Catatan</label>
            <textarea
              className="min-h-20 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/5"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Job"
        description={`Yakin ingin menghapus job "${deleteTarget?.jobName ?? ""}" (${deleteTarget?.jobNumber ?? ""})? Tindakan ini tidak dapat dibatalkan.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} disabled={busy}>
              {busy ? "Menghapus..." : "Hapus"}
            </Button>
          </>
        }
      >
        {deleteError ? (
          <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
            {deleteError}
          </p>
        ) : null}
      </Modal>
    </Card>
  );
}
