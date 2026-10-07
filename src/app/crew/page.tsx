import { PageHeader } from "@/components/ui";
import { MasterDataCrud } from "@/components/master/master-crud";
import { getCrew } from "@/services/master-service";
import { formatCurrency } from "@/lib/utils";
import {
  createCrewAction,
  deleteCrewAction,
  updateCrewAction,
} from "@/app/actions/master-actions";

export const metadata = {
  title: "Crew · Air Production DB",
};

export default async function CrewPage() {
  const crew = await getCrew();

  const rows = crew.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    defaultPayment: String(member.defaultPayment),
    phone: member.phone ?? "",
    notes: member.notes ?? "",
    defaultPaymentLabel: formatCurrency(member.defaultPayment),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crew"
        description="Data master crew beserta default payment. Payment aktual untuk suatu job dicatat pada assignment Job-Crew."
      />

      <MasterDataCrud
        entityLabel="Crew"
        icon="crew"
        emptyTitle="Belum ada crew"
        emptyDescription="Data crew yang tersimpan akan tampil di sini beserta role dan default payment-nya."
        columns={[
          { key: "name", label: "Nama Crew" },
          { key: "role", label: "Role" },
          { key: "defaultPaymentLabel", label: "Default Payment" },
          { key: "phone", label: "Telepon" },
          { key: "notes", label: "Catatan" },
        ]}
        rows={rows}
        fields={[
          { key: "name", label: "Nama Crew", required: true },
          { key: "role", label: "Role", required: true },
          { key: "defaultPayment", label: "Default Payment", type: "number", hint: "Contoh: 1500000 atau 1.500.000" },
          { key: "phone", label: "Telepon" },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        createAction={createCrewAction}
        updateAction={updateCrewAction}
        deleteAction={deleteCrewAction}
      />
    </div>
  );
}
