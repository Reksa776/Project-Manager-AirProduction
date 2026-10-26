import { AppShell } from "@/components/layout/app-shell";
import { MasterDataCrud } from "@/components/master/master-crud";
import { PageHeader } from "@/components/ui";
import {
  createPackageAction,
  deletePackageAction,
  updatePackageAction,
} from "@/app/actions/master-actions";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import { getPackages } from "@/services/master-service";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Packages · Air Production DB" };
export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const admin = await requireAuthenticatedAdmin();
  const packages = await getPackages();
  const rows = packages.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price ?? "",
    priceLabel: item.price ? formatCurrency(item.price) : "",
    vendorPrice: item.vendorPrice ?? "",
    vendorPriceLabel: item.vendorPrice ? formatCurrency(item.vendorPrice) : "",
    deliverables: item.deliverables?.split(/\r?\n/).filter(Boolean).join(" • ") ?? "",
  }));

  return (
    <AppShell adminName={admin.name}>
      <div className="space-y-6">
        <PageHeader
          title="Packages"
          description="Manage the packages available to assign to jobs."
        />
        <MasterDataCrud
          entityLabel="Package"
          icon="inbox"
          searchPlaceholder="Search package name or deliverables..."
          emptyTitle="No packages yet"
          emptyDescription="Add at least one active package before sharing the client form."
          columns={[
            { key: "name", label: "Package Name" },
            { key: "priceLabel", label: "Price" },
            { key: "vendorPriceLabel", label: "Vendor Price" },
            { key: "deliverables", label: "Deliverables" },
          ]}
          rows={rows}
          fields={[
            { key: "name", label: "Package Name", required: true },
            { key: "price", label: "Harga Client (opsional)", type: "number" },
            { key: "vendorPrice", label: "Harga Vendor (opsional)", type: "number" },
            { key: "deliverables", label: "Daftar deliverable", type: "repeatable", hint: "Setiap input menjadi satu item Delivery di job." },
          ]}
          createAction={createPackageAction}
          updateAction={updatePackageAction}
          deleteAction={deletePackageAction}
        />
      </div>
    </AppShell>
  );
}
