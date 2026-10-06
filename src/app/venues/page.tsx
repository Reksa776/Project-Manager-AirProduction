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
import { getVenues } from "@/services/master-service";

export const metadata = {
  title: "Venues · Air Production DB",
};

export default async function VenuesPage() {
  const venues = await getVenues();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues"
        description="Lokasi pelaksanaan pekerjaan dokumentasi yang digunakan pada job."
      />

      <Card className="overflow-hidden">
        {venues.length === 0 ? (
          <EmptyState
            icon="venues"
            title="Belum ada venue"
            description="Data venue yang tersimpan akan tampil di sini beserta alamat dan kapasitasnya."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Nama Venue</TH>
                <TH>Alamat</TH>
                <TH>Kota</TH>
                <TH>Kapasitas</TH>
              </TR>
            </THead>
            <TBody>
              {venues.map((venue) => (
                <TR key={venue.id}>
                  <TD className="font-medium text-ink">{venue.name}</TD>
                  <TD>{venue.address ?? "-"}</TD>
                  <TD>{venue.city ?? "-"}</TD>
                  <TD className="tabular-nums">
                    {venue.capacity ? `${venue.capacity} orang` : "-"}
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
