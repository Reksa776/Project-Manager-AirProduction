import { PageHeader } from "@/components/ui";
import { AppShell } from "@/components/layout/app-shell";
import { MasterDataCrud } from "@/components/master/master-crud";
import { getVendors } from "@/services/master-service";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import {
  createVendorAction,
  deleteVendorAction,
  updateVendorAction,
} from "@/app/actions/master-actions";

export const metadata = {
  title: "Vendors · Air Production DB",
};

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const admin = await requireAuthenticatedAdmin();
  const vendors = await getVendors();

  const rows = vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    contact: vendor.phone ?? "",
    email: vendor.email ?? "",
    notes: vendor.notes ?? "",
  }));

  return (
    <AppShell adminName={admin.name}>
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Vendors provide services to Air Production and are managed separately from clients."
      />

      <MasterDataCrud
        entityLabel="Vendor"
        icon="vendors"
        searchPlaceholder="Search name, contact, or notes..."
        emptyTitle="No vendors yet"
        emptyDescription="Saved vendors and their contact details will appear here."
        columns={[
          { key: "name", label: "Vendor Name" },
          { key: "contact", label: "Contact" },
          { key: "email", label: "Email" },
        ]}
        rows={rows}
        fields={[
          { key: "name", label: "Vendor Name", required: true },
          { key: "contact", label: "Contact" },
          { key: "email", label: "Email" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        createAction={createVendorAction}
        updateAction={updateVendorAction}
        deleteAction={deleteVendorAction}
      />
    </div>
    </AppShell>
  );
}
