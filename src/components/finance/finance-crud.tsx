"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import type { FinanceActionResult } from "@/app/actions/finance-actions";

export interface FinanceFieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "date" | "textarea";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
}

export interface FinanceCrudProps {
  title: string;
  description: string;
  entityLabel: string;
  columns: Array<{ key: string; label: string }>;
  /** Setiap row berisi `id`, key kolom display, sekaligus raw value field form. */
  rows: Array<Record<string, string>>;
  fields: FinanceFieldConfig[];
  filter?: { key: string; options: Array<{ value: string; label: string }> };
  totals?: Array<{ label: string; value: string }>;
  createAction: (values: Record<string, string>) => Promise<FinanceActionResult>;
  updateAction: (id: string, values: Record<string, string>) => Promise<FinanceActionResult>;
  deleteAction: (id: string) => Promise<FinanceActionResult>;
}

function emptyDraft(fields: FinanceFieldConfig[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

export function FinanceCrud({
  title,
  description,
  entityLabel,
  columns,
  rows,
  fields,
  filter,
  totals,
  createAction,
  updateAction,
  deleteAction,
}: FinanceCrudProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => emptyDraft(fields));
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, string> | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q || Object.values(row).some((v) => v.toLowerCase().includes(q));
    const matchFilter = !filter || !filterValue || row[filter.key] === filterValue;
    return matchQuery && matchFilter;
  });

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft(fields));
    setModalError(null);
    setModalOpen(true);
  }
  function openEdit(row: Record<string, string>) {
    setEditingId(row.id);
    setDraft(Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? ""])));
    setModalError(null);
    setModalOpen(true);
  }
  async function handleSubmit() {
    setBusy(true);
    setModalError(null);
    const result = editingId ? await updateAction(editingId, draft) : await createAction(draft);
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

  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={description} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="min-w-52 flex-1 sm:max-w-xs">
          <Input
            aria-label={`Cari ${entityLabel}`}
            placeholder={`Cari ${entityLabel.toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filter ? (
          <div className="w-full sm:w-44">
            <Select
              aria-label={`Filter ${entityLabel}`}
              options={[{ value: "", label: "Semua" }, ...filter.options]}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          </div>
        ) : null}
        <p className="text-[13px] text-ink-muted">{filtered.length} dari {rows.length}</p>
        <Button size="sm" variant="primary" onClick={openCreate}>
          Tambah
        </Button>
      </div>
      {totals && totals.length > 0 ? (
        <div className="flex flex-wrap gap-6 border-b border-line bg-app/40 px-6 py-3">
          {totals.map((t) => (
            <div key={t.label} className="space-y-0.5">
              <p className="text-[11px] text-ink-muted">{t.label}</p>
              <p className="text-sm font-semibold tabular-nums text-ink">{t.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon="finance"
          title={`Belum ada ${entityLabel.toLowerCase()}`}
          description="Data yang tersimpan akan tampil di sini."
          action={
            <Button size="sm" variant="secondary" onClick={openCreate}>
              Tambah {entityLabel}
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="finance"
          title="Tidak ditemukan"
          description={`Tidak ada ${entityLabel.toLowerCase()} yang cocok dengan pencarian/filter saat ini.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                {columns.map((col) => (
                  <TH key={col.key}>{col.label}</TH>
                ))}
                <TH>Aksi</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((row) => (
                <TR key={row.id}>
                  {columns.map((col) => (
                    <TD key={col.key} className={col.key === columns[0].key ? "font-medium text-ink" : undefined}>
                      {row[col.key] || "-"}
                    </TD>
                  ))}
                  <TD>
                    <div className="flex gap-2">
                      <button type="button" className="text-[13px] text-brand hover:underline" onClick={() => openEdit(row)} disabled={busy}>
                        Edit
                      </button>
                      <button type="button" className="text-[13px] text-[#a1352b] hover:underline" onClick={() => { setDeleteError(null); setDeleteTarget(row); }} disabled={busy}>
                        Hapus
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? `Edit ${entityLabel}` : `Tambah ${entityLabel}`}
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
          {fields.map((field) => {
            if (field.type === "select") {
              return (
                <Select
                  key={field.key}
                  label={field.label}
                  options={field.options ?? []}
                  placeholder={field.placeholder ?? "-- Pilih --"}
                  value={draft[field.key] ?? ""}
                  onChange={(e) => setDraft((p) => ({ ...p, [field.key]: e.target.value }))}
                />
              );
            }
            if (field.type === "textarea") {
              return (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-ink-soft">{field.label}</label>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/5"
                    value={draft[field.key] ?? ""}
                    onChange={(e) => setDraft((p) => ({ ...p, [field.key]: e.target.value }))}
                  />
                </div>
              );
            }
            return (
              <Input
                key={field.key}
                label={field.label}
                type="text"
                inputMode={field.type === "number" ? "numeric" : field.type === "date" ? "text" : undefined}
                hint={field.hint}
                placeholder={field.type === "date" ? "YYYY-MM-DD" : undefined}
                value={draft[field.key] ?? ""}
                onChange={(e) => setDraft((p) => ({ ...p, [field.key]: e.target.value }))}
              />
            );
          })}
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Hapus ${entityLabel}`}
        description="Yakin ingin menghapus item ini? Tindakan tidak dapat dibatalkan."
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
