"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateJobAction } from "@/app/actions/job-actions";
import {
  Button,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { JOB_CATEGORY_LABEL, JOB_STATUS_LABEL } from "@/lib/labels";
import type { Job } from "@/lib/types";

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

export function EditJobButton({
  job,
  counterpartyType,
  counterpartyId,
  clients,
  vendors,
  venues,
}: {
  job: Job;
  counterpartyType: "CLIENT" | "VENDOR" | "UNKNOWN";
  counterpartyId?: string;
  clients: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  venues: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  function openModal() {
    setDraft({
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      category: job.category,
      status: job.status,
      counterpartyType: counterpartyType === "UNKNOWN" ? "CLIENT" : counterpartyType,
      counterpartyId: counterpartyId ?? "",
      venueId: job.venueId ?? "",
      executionDate: job.executionDate,
      location: job.location ?? "",
      notes: job.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    const result = await updateJobAction(job.id, draft);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const counterpartyOptions =
    draft.counterpartyType === "VENDOR"
      ? vendors.map((v) => ({ value: v.id, label: v.name }))
      : clients.map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <Button size="sm" variant="secondary" onClick={openModal}>
        Edit Job
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Job"
        description="Job wajib memiliki Client ATAU Vendor (tidak keduanya)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <p className="rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-[13px] text-[#a1352b]">
              {error}
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
    </>
  );
}
