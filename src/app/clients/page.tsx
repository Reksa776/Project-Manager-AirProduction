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
import { getClients } from "@/services/master-service";

export const metadata = {
  title: "Clients · Air Production DB",
};

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Client yang bekerja langsung dengan Air Production dan dikaitkan ke job sebagai counterparty."
      />

      <Card className="overflow-hidden">
        {clients.length === 0 ? (
          <EmptyState
            icon="clients"
            title="Belum ada client"
            description="Data client yang tersimpan akan tampil di sini beserta kontak dan catatannya."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Nama Client</TH>
                <TH>Contact Person</TH>
                <TH>Telepon</TH>
                <TH>Email</TH>
                <TH>Catatan</TH>
              </TR>
            </THead>
            <TBody>
              {clients.map((client) => (
                <TR key={client.id}>
                  <TD className="font-medium text-ink">{client.name}</TD>
                  <TD>{client.contactPerson ?? "-"}</TD>
                  <TD className="whitespace-nowrap">{client.phone ?? "-"}</TD>
                  <TD>{client.email ?? "-"}</TD>
                  <TD className="max-w-xs text-ink-muted">
                    {client.notes ?? "-"}
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
