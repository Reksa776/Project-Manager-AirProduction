import { PageHeader } from "@/components/ui";
import { MasterDataCrud } from "@/components/master/master-crud";
import { getVenues } from "@/services/master-service";
import {
  createVenueAction,
  deleteVenueAction,
  updateVenueAction,
} from "@/app/actions/master-actions";

export const metadata = {
  title: "Venues · Air Production DB",
};

export default async function VenuesPage() {
  const venues = await getVenues();

  const rows = venues.map((venue) => ({
    id: venue.id,
    name: venue.name,
    address: venue.address ?? "",
    contact: venue.contact ?? "",
    notes: venue.notes ?? "",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues"
        description="Lokasi pelaksanaan pekerjaan dokumentasi yang digunakan pada job."
      />

      <MasterDataCrud
        entityLabel="Venue"
        icon="venues"
        searchPlaceholder="Cari nama, alamat, kontak, atau catatan..."
        emptyTitle="Belum ada venue"
        emptyDescription="Data venue yang tersimpan akan tampil di sini beserta alamat dan kontaknya."
        columns={[
          { key: "name", label: "Nama Venue" },
          { key: "address", label: "Alamat" },
          { key: "contact", label: "Kontak" },
          { key: "notes", label: "Catatan" },
        ]}
        rows={rows}
        fields={[
          { key: "name", label: "Nama Venue", required: true },
          { key: "address", label: "Alamat" },
          { key: "contact", label: "Kontak" },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        createAction={createVenueAction}
        updateAction={updateVenueAction}
        deleteAction={deleteVenueAction}
      />
    </div>
  );
}
