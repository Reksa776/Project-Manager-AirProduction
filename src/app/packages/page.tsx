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

export const metadata = { title: "Packages · Air Production DB" };
export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const admin = await requireAuthenticatedAdmin();
  const packages = await getPackages();
  const rows = packages.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    sortOrder: String(item.sortOrder),
    isActive: String(item.isActive),
    status: item.isActive ? "Active" : "Inactive",
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
          searchPlaceholder="Search package name or description..."
          emptyTitle="No packages yet"
          emptyDescription="Add at least one active package before sharing the client form."
          columns={[
            { key: "name", label: "Package Name" },
            { key: "description", label: "Description" },
            { key: "sortOrder", label: "Sort Order" },
            { key: "status", label: "Status" },
          ]}
          rows={rows}
          fields={[
            { key: "name", label: "Package Name", required: true },
            { key: "description", label: "Description", type: "textarea" },
            { key: "sortOrder", label: "Sort Order", type: "number", defaultValue: "0" },
            {
              key: "isActive",
              label: "Status",
              type: "select",
              defaultValue: "true",
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
          ]}
          createAction={createPackageAction}
          updateAction={updatePackageAction}
          deleteAction={deletePackageAction}
        />
      </div>
    </AppShell>
  );
}
