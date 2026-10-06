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
import { getVendors } from "@/services/master-service";

export const metadata = {
  title: "Vendors · Air Production DB",
};

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Vendor adalah pihak yang memberikan pekerjaan kepada Air Production. Relasi vendor berbeda dengan client."
      />

      <Card>
        {vendors.length === 0 ? (
          <EmptyState
            icon="vendors"
            title="Belum ada vendor"
            description="Data vendor yang tersimpan akan tampil di sini beserta kontak dan catatannya."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Nama Vendor</TH>
                <TH>Contact Person</TH>
                <TH>Telepon</TH>
                <TH>Email</TH>
                <TH>Catatan</TH>
              </TR>
            </THead>
            <TBody>
              {vendors.map((vendor) => (
                <TR key={vendor.id}>
                  <TD className="font-medium text-ink">{vendor.name}</TD>
                  <TD className="text-ink-soft">
                    {vendor.contactPerson ?? "-"}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {vendor.phone ?? "-"}
                  </TD>
                  <TD className="text-ink-soft">{vendor.email ?? "-"}</TD>
                  <TD className="max-w-xs text-ink-muted">
                    {vendor.notes ?? "-"}
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
