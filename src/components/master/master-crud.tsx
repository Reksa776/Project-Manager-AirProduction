"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
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
import type { MasterActionResult } from "@/app/actions/master-actions";

export interface MasterFieldConfig {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select";
  /** Opsi untuk `type: "select"` (mis. role crew / jenis client kanonik). */
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  hint?: string;
  /** Nilai awal draft (harus string agar aman dilewatkan from server component). */
  defaultValue?: string;
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
  searchPlaceholder?: string;
  hideCreate?: boolean;
  createAction: (values: Record<string, string>) => Promise<MasterActionResult>;
  updateAction: (id: string, values: Record<string, string>) => Promise<MasterActionResult>;
  deleteAction: (id: string) => Promise<MasterActionResult>;
}

function emptyDraft(fields: MasterFieldConfig[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? ""]));
}

export function MasterDataCrud({
  entityLabel,
  columns,
  rows,
  fields,
  icon,
  emptyTitle,
  emptyDescription,
  searchPlaceholder,
  hideCreate = false,
  createAction,
  updateAction,
  deleteAction,
}: MasterCrudProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => emptyDraft(fields));
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, string> | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredRows = query.trim()
    ? rows.filter((row) =>
        Object.values(row).some((value) =>
          value.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      )
    : rows;

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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    const result = await deleteAction(deleteTarget.id);
    setBusy(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    setPageError(null);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div className="w-full min-w-0 flex-1 sm:w-64 sm:max-w-xs">
          <Input
            placeholder={searchPlaceholder ?? `Search ${entityLabel.toLowerCase()}...`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={`Search ${entityLabel}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[13px] text-ink-muted">
            {filteredRows.length} from {rows.length}
          </p>
          {!hideCreate ? (
            <Button size="sm" variant="primary" onClick={openCreate}>
              Add
            </Button>
          ) : null}
        </div>
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
          action={!hideCreate ? (
            <Button size="sm" variant="secondary" onClick={openCreate}>
              Add {entityLabel}
            </Button>
          ) : undefined}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon="search"
          title="No results found"
          description={`No ${entityLabel.toLowerCase()} yang cocok dengan "${query}".`}
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
              {filteredRows.map((row) => (
                <TR key={row.id}>
                  {columns.map((col) => (
                    <TD
                      key={col.key}
                      className={col.key === columns[0].key ? "font-medium text-ink" : undefined}
                    >
                      {row[col.key] || "-"}
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
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(row);
                        }}
                        disabled={busy}
                      >
                        Delete
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
          {fields.map((field) =>
            field.type === "select" ? (
              <Select
                key={field.key}
                label={field.label}
                options={field.options ?? []}
                placeholder="-- Select --"
                value={draft[field.key] ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            ) : field.type === "textarea" ? (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-ink-soft">{field.label}</label>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/5"
                  value={draft[field.key] ?? ""}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                  }
                />
              </div>
            ) : (
              <Input
                key={field.key}
                label={field.label}
                type="text"
                inputMode={field.type === "number" ? "numeric" : undefined}
                hint={field.hint}
                value={draft[field.key] ?? ""}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            ),
          )}
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${entityLabel}`}
        description={`Yakin ingin menghapus "${deleteTarget?.[columns[0].key] ?? ""}"? This action cannot be undone.`}
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
