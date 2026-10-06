import Link from "next/link";

import { Card, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Halaman tidak ditemukan
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Alamat yang Anda buka tidak tersedia atau data yang dicari tidak ada.
        </p>
      </div>
      <Card>
        <EmptyState
          icon="alert"
          title="Data tidak ditemukan"
          description="Periksa kembali tautan atau kembali ke Dashboard untuk melanjutkan pekerjaan."
          action={
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-[#2559d0]"
            >
              Kembali ke Dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}
