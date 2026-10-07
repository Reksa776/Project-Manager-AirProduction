import { PageHeader } from "@/components/ui";
import { MasterDataCrud } from "@/components/master/master-crud";
import { getVendors } from "@/services/master-service";
import {
  createVendorAction,
  deleteVendorAction,
  updateVendorAction,
} from "@/app/actions/master-actions";

export const metadata = {
  title: "Vendors · Air Production DB",
};

export default async function VendorsPage() {
  const vendors = await getVendors();

  const rows = vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    phone: vendor.phone ?? "",
    notes: vendor.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Vendor adalah pihak yang memberikan pekerjaan kepada Air Production, terpisah dari relasi client."
      />

      <MasterDataCrud
        entityLabel="Vendor"
        icon="vendors"
        emptyTitle="Belum ada vendor"
        emptyDescription="Data vendor yang tersimpan akan tampil di sini beserta kontak dan catatannya."
        columns={[
          { key: "name", label: "Nama Vendor" },
          { key: "phone", label: "Kontak" },
          { key: "notes", label: "Catatan" },
        ]}
        rows={rows}
        fields={[
          { key: "name", label: "Nama Vendor", required: true },
          { key: "phone", label: "Kontak" },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        createAction={createVendorAction}
        updateAction={updateVendorAction}
        deleteAction={deleteVendorAction}
      />
    </div>
  );
}
