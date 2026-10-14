import { PageHeader } from "@/components/ui";
import { AppShell } from "@/components/layout/app-shell";
import { MasterDataCrud } from "@/components/master/master-crud";
import { getCrewDirectory, getCrewRoles } from "@/services/master-service";
import { formatCurrency } from "@/lib/utils";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import {
  createCrewAction,
  createCrewRoleAction,
  deleteCrewAction,
  deleteCrewRoleAction,
  updateCrewAction,
  updateCrewRoleAction,
} from "@/app/actions/master-actions";

export const metadata = {
  title: "Crew · Air Production DB",
};

export const dynamic = "force-dynamic";

export default async function CrewPage() {
  const admin = await requireAuthenticatedAdmin();
  const [directory, roles] = await Promise.all([getCrewDirectory(), getCrewRoles()]);

  const roleOptions = roles.map((role) => ({ value: role.id, label: role.name }));

  const crewRows = directory.map(({ crew, role }) => ({
    id: crew.id,
    name: crew.name,
    crewRoleId: crew.crewRoleId,
    roleName: role?.name ?? "-",
    defaultPayment: crew.defaultPayment,
    defaultPaymentLabel: formatCurrency(crew.defaultPayment),
    phone: crew.phone ?? "",
    notes: crew.notes ?? "",
  }));

  const roleRows = roles.map((role) => ({
    id: role.id,
    name: role.name,
    sortOrder: String(role.sortOrder),
    isActive: role.isActive ? "true" : "false",
    isActiveLabel: role.isActive ? "Active" : "Inactive",
  }));

  return (
    <AppShell adminName={admin.name}>
    <div className="space-y-6">
      <PageHeader
        title="Crew"
        description="Manage crew and canonical roles. Actual payments for each job are recorded on the Job-Crew assignment."
      />

      <MasterDataCrud
        entityLabel="Crew"
        icon="crew"
        searchPlaceholder="Search name, role, contact, or notes..."
        emptyTitle="No crew yet"
        emptyDescription="Saved crew members will appear here with their roles and default payments."
        columns={[
          { key: "name", label: "Crew Name" },
          { key: "roleName", label: "Role" },
          { key: "defaultPaymentLabel", label: "Default Payment" },
          { key: "phone", label: "Phone" },
        ]}
        rows={crewRows}
        fields={[
          { key: "name", label: "Crew Name", required: true },
          {
            key: "crewRoleId",
            label: "Role",
            type: "select",
            options: roleOptions,
            required: true,
            hint: roles.length === 0 ? "Add a role below or run `npm run db:seed` to add Editor and Videographer." : undefined,
          },
          {
            key: "defaultPayment",
            label: "Default Payment",
            type: "number",
            hint: "Contoh: 1500000 atau 1500000.55",
          },
          { key: "phone", label: "Phone" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        createAction={createCrewAction}
        updateAction={updateCrewAction}
        deleteAction={deleteCrewAction}
      />

      <MasterDataCrud
        entityLabel="Crew Role"
        icon="crew"
        searchPlaceholder="Search role names..."
        emptyTitle="No crew roles yet"
        emptyDescription="Crew roles are shared across the workspace and are required when adding crew members."
        columns={[
          { key: "name", label: "Role Name" },
          { key: "sortOrder", label: "Sort Order" },
          { key: "isActiveLabel", label: "Status" },
        ]}
        rows={roleRows}
        fields={[
          { key: "name", label: "Role Name", required: true },
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
        createAction={createCrewRoleAction}
        updateAction={updateCrewRoleAction}
        deleteAction={deleteCrewRoleAction}
      />
    </div>
    </AppShell>
  );
}
