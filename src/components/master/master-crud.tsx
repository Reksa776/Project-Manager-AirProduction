"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import type { MasterActionResult } from "@/app/actions/master-actions";

export interface MasterFieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
  hint?: string;
}

export interface MasterCrudProps {
  entityLabel: string;
  columns: Array<{ key: string; label: string }>;
  /** Setiap row berisi `id` plus nilai terformat untuk kolom & form. */
  rows: Array<Record<string, string>>;
  fields: MasterFieldConfig[];
  icon: "clients" | "vendors" | "venues" | "crew" | "inbox";
  emptyTitle: string;
  emptyDescription: string;
  createAction: (values: Record<string, string>) => Promise<MasterActionResult>;
  updateAction: (id: string, values: Record<string, string>) => Promise<MasterActionResult>;
  deleteAction: (id: string) => Promise<MasterActionResult>;
}

function emptyDraft(fields: MasterFieldConfig[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""]));
}

export function MasterDataCrud({
  entityLabel,
  columns,
  rows,
  fields,
  icon,
  emptyTitle,
  emptyDescription,
  createAction,
  updateAction,
  deleteAction,
}: MasterCrudProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => emptyDraft(fields));
  const [modalError, setModalError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    const result = editingId
      ? await updateAction(editingId, draft)
      : await createAction(draft);
    setBusy(false);
    if (!result.ok) {
      setModalError(result.error);
      return;
    }
    setModalOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm(`Hapus ${entityLabel.toLowerCase()} ini? Tindakan tidak dapat dibatalkan.`)) {
      return;
    }
    setBusy(true);
    setPageError(null);
    const result = await deleteAction(id);
    setBusy(false);
    if (!result.ok) {
      setPageError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <p className="text-[13px] text-ink-soft">
          {rows.length} {entityLabel.toLowerCase()} terdaftar
        </p>
        <Button size="sm" variant="primary" onClick={openCreate}>
          Tambah
        </Button>
      </div>

      {pageError ? (
        <div className="border-b border-line bg-[#fdf3f2] px-6 py-3 text-[13px] text-[#a1352b]">
          {pageError}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button size="sm" variant="secondary" onClick={openCreate}>
              Tambah {entityLabel}
            </Button>
          }
        />
      ) : (
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
            {rows.map((row) => (
              <TR key={row.id}>
                {columns.map((col) => (
                  <TD key={col.key} className={col.key === columns[0].key ? "font-medium text-ink" : undefined}>
                    {row[col.key] ?? "-"}
                  </TD>
                ))}
                <TD>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[13px] text-brand hover:underline"
                      onClick={() => openEdit(row)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[13px] text-[#a1352b] hover:underline"
                      onClick={() => handleDelete(row.id)}
                      disabled={busy}
                    >
                      Hapus
                    </button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
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
          {fields.map((field) =>
            field.type === "textarea" ? (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-ink-soft">{field.label}</label>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/5"
                  value={draft[field.key] ?? ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              </div>
            ) : (
              <Input
                key={field.key}
                label={field.label}
                type={field.type === "number" ? "text" : "text"}
                inputMode={field.type === "number" ? "numeric" : undefined}
                hint={field.hint}
                value={draft[field.key] ?? ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
              />
            ),
          )}
        </div>
      </Modal>
    </Card>
  );
}
