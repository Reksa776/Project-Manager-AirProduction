import Link from "next/link";

import { Card, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
          Halaman tidak ditemukan
        </h1>
        <p className="text-sm text-ink-soft">
          Alamat yang Anda buka tidak tersedia atau data yang dicari tidak ada.
        </p>
      </div>
      <Card>
        <EmptyState
          icon="alert"
          title="Data not found"
          description="Check the link or return to the dashboard to continue."
          action={
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#2e2e2e]"
            >
              Back ke Dashboard
            </Link>
          }
        />
      </Card>
    </div>
  );
}
