import { PageHeader } from "@/components/ui";
import { MasterDataCrud } from "@/components/master/master-crud";
import { getClients } from "@/services/master-service";
import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
} from "@/app/actions/master-actions";

export const metadata = {
  title: "Clients · Air Production DB",
};

export default async function ClientsPage() {
  const clients = await getClients();

  const rows = clients.map((client) => ({
    id: client.id,
    name: client.name,
    address: client.address ?? "",
    phone: client.phone ?? "",
    notes: client.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Client yang bekerja langsung dengan Air Production dan dikaitkan ke job sebagai counterparty."
      />

      <MasterDataCrud
        entityLabel="Client"
        icon="clients"
        emptyTitle="Belum ada client"
        emptyDescription="Data client yang tersimpan akan tampil di sini beserta kontak dan catatannya."
        columns={[
          { key: "name", label: "Nama Client" },
          { key: "address", label: "Alamat" },
          { key: "phone", label: "Kontak" },
          { key: "notes", label: "Catatan" },
        ]}
        rows={rows}
        fields={[
          { key: "name", label: "Nama Client", required: true },
          { key: "address", label: "Alamat" },
          { key: "phone", label: "Kontak" },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        createAction={createClientAction}
        updateAction={updateClientAction}
        deleteAction={deleteClientAction}
      />
    </div>
  );
}
