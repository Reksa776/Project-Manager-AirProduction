import {
  Card,
  EmptyState,
  PageHeader,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
} from "@/components/ui";
import { getCrew } from "@/services/master-service";
import { formatCurrency } from "@/lib/utils";

export const metadata = {
  title: "Crew · Air Production DB",
};

export default async function CrewPage() {
  const crew = await getCrew();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crew"
        description="Data master crew beserta default payment. Payment aktual untuk suatu job dicatat pada assignment Job-Crew."
      />

      <Card>
        {crew.length === 0 ? (
          <EmptyState
            icon="crew"
            title="Belum ada crew"
            description="Data crew yang tersimpan akan tampil di sini beserta role dan default payment-nya."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Nama Crew</TH>
                <TH>Role</TH>
                <TH>Default Payment</TH>
                <TH>Telepon</TH>
              </TR>
            </THead>
            <TBody>
              {crew.map((member) => (
                <TR key={member.id}>
                  <TD className="font-medium text-ink">{member.name}</TD>
                  <TD className="text-ink-soft">{member.role}</TD>
                  <TD className="tabular-nums text-ink">
                    {formatCurrency(member.defaultPayment)}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {member.phone ?? "-"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
