import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Card, PageHeader } from "@/components/ui";
import { getClients, getPackages } from "@/services/master-service";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import { MasterDataCrud } from "@/components/master/master-crud";
import { createClientAction, deleteClientAction, updateClientAction } from "@/app/actions/master-actions";

export const metadata = {
  title: "Client Submissions · Air Production DB",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const admin = await requireAuthenticatedAdmin();
  const [clients, packages] = await Promise.all([getClients(), getPackages()]);
  const packageOptions = packages.map((item) => ({ value: item.id, label: item.name }));
  const rows = clients.map((client) => ({
    id: client.id, name: [client.cpw, client.cpp].filter(Boolean).join(" & ") || client.name,
    cpw: client.cpw ?? "", cpwNickname: client.cpwNickname ?? "", cpwInstagram: client.cpwInstagram ?? "",
    cpp: client.cpp ?? "", cppNickname: client.cppNickname ?? "", cppInstagram: client.cppInstagram ?? "",
    phone: client.phone ?? "", address: client.address ?? "",
    eventDate: client.eventDate ?? "", packageId: client.packageId ?? "", notes: client.notes ?? "",
  }));

  return (
    <AppShell adminName={admin.name}>
      <div className="space-y-6">
        <PageHeader
          title="Client Submissions"
          description="View client information submitted through the separate intake form."
        />

        <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-ink">Client intake form</p>
            <p className="mt-1 text-xs text-ink-muted">Share this form route with clients: /client-form</p>
          </div>
          <Link
            href="/client-form"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#2e2e2e]"
          >
            Open Form
          </Link>
        </Card>

        <MasterDataCrud
          entityLabel="Client"
          icon="clients"
          searchPlaceholder="Cari nama, kontak, atau alamat client..."
          emptyTitle="Belum ada data client"
          emptyDescription="Data yang dikirim melalui formulir akan muncul di sini."
          columns={[{ key: "name", label: "Pengantin" }, { key: "phone", label: "Nomor HP" }, { key: "eventDate", label: "Tanggal acara" }]}
          rows={rows}
          fields={[
            { key: "cpw", label: "Nama lengkap pengantin wanita", required: true },
            { key: "cpwNickname", label: "Nama panggilan pengantin wanita" },
            { key: "cpwInstagram", label: "Instagram pengantin wanita" },
            { key: "cpp", label: "Nama lengkap pengantin pria", required: true },
            { key: "cppNickname", label: "Nama panggilan pengantin pria" },
            { key: "cppInstagram", label: "Instagram pengantin pria" },
            { key: "phone", label: "Nomor HP" }, { key: "address", label: "Alamat acara", type: "textarea" },
            { key: "eventDate", label: "Tanggal acara", type: "date" },
            { key: "packageId", label: "Paket", type: "select", options: packageOptions },
            { key: "notes", label: "Catatan", type: "textarea" },
          ]}
          createAction={createClientAction} updateAction={updateClientAction} deleteAction={deleteClientAction}
        />
      </div>
    </AppShell>
  );
}
