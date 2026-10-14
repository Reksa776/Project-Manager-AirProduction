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
  /**
   * `hidden` = ikut draft tetapi tidak dirender (mis. `idempotencyKey` yang
   * diisi otomatis agar pencatatan kas tetap idempoten tanpa input manual).
   */
  type?: "text" | "number" | "select" | "date" | "textarea" | "hidden";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  hint?: string;
  /** Nilai awal draft (harus string agar aman dilewatkan from server component). */
  defaultValue?: string;
  /**
   * Untuk field kunci idempotensi: buat nilai acak baru SETIAP kali modal
   * tambah dibuka (dijalankan di klien). Ini menjaga pencatatan kas tetap
   * idempoten tanpa input manual dan tanpa fungsi non-serializable from server.
   */
  autoKey?: boolean;
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
  /**
   * Actions bersifat OPSIONAL dan ditampilkan hanya bila diberikan. Ini mencegah
   * tombol Edit/Delete palsu: jadwal kanonik tidak memiliki operasi delete, dan
   * kas kanonik (cashflow) tidak memiliki update/delete.
   */
  createAction?: (values: Record<string, string>) => Promise<FinanceActionResult>;
  updateAction?: (id: string, values: Record<string, string>) => Promise<FinanceActionResult>;
  deleteAction?: (id: string) => Promise<FinanceActionResult>;
}

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyDraft(fields: FinanceFieldConfig[], fresh = false): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.autoKey && fresh ? randomKey() : (f.defaultValue ?? "")]),
  );
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
    setDraft(emptyDraft(fields, true));
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
    let result: FinanceActionResult;
    if (editingId) {
      if (!updateAction) {
        setBusy(false);
        setModalError("Editing is not supported for this item.");
        return;
      }
      result = await updateAction(editingId, draft);
    } else {
      if (!createAction) {
        setBusy(false);
        setModalError("Creating this item is not supported.");
        return;
      }
      result = await createAction(draft);
    }
    setBusy(false);
    if (!result.ok) { setModalError(result.error); return; }
    setModalOpen(false);
    router.refresh();
  }
  async function handleConfirmDelete() {
    if (!deleteTarget || !deleteAction) return;
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
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="w-full min-w-0 flex-1 sm:w-64 sm:max-w-xs">
          <Input
            aria-label={`Search ${entityLabel}`}
            placeholder={`Search ${entityLabel.toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filter ? (
          <div className="w-full sm:w-44">
            <Select
              aria-label={`Filter ${entityLabel}`}
              options={[{ value: "", label: "All" }, ...filter.options]}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          </div>
        ) : null}
        <p className="text-[13px] text-ink-muted">{filtered.length} from {rows.length}</p>
        {createAction ? (
          <Button size="sm" variant="primary" onClick={openCreate}>
            Add
          </Button>
        ) : null}
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
          title={`No data yet ${entityLabel.toLowerCase()}`}
          description="Saved data will appear here."
          action={
            createAction ? (
              <Button size="sm" variant="secondary" onClick={openCreate}>
                Add {entityLabel}
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="finance"
          title="No results found"
          description={`No ${entityLabel.toLowerCase()} yang cocok dengan pencarian/filter saat ini.`}
        />
      ) : (
          <div className="min-w-0 max-w-full overflow-x-auto">
          <Table>
            <THead>
              <TR>
                {columns.map((col) => (
                  <TH key={col.key}>{col.label}</TH>
                ))}
                <TH>Actions</TH>
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
                      {updateAction ? (
                        <button type="button" className="text-[13px] text-brand hover:underline" onClick={() => openEdit(row)} disabled={busy}>
                          Edit
                        </button>
                      ) : null}
                      {deleteAction ? (
                        <button type="button" className="text-[13px] text-[#a1352b] hover:underline" onClick={() => { setDeleteError(null); setDeleteTarget(row); }} disabled={busy}>
                          Delete
                        </button>
                      ) : null}
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
        title={editingId ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={busy}>
              {busy ? "Saving..." : "Save"}
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
            if (field.type === "hidden") return null;
            if (field.type === "select") {
              return (
                <Select
                  key={field.key}
                  label={field.label}
                  options={field.options ?? []}
                  placeholder={field.placeholder ?? "-- Select --"}
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
                type={field.type === "date" ? "date" : "text"}
                inputMode={field.type === "number" ? "numeric" : undefined}
                hint={field.hint}
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
        title={`Delete ${entityLabel}`}
        description="Are you sure you want to delete this item? This action cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete} disabled={busy}>
              {busy ? "Deleting..." : "Delete"}
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
