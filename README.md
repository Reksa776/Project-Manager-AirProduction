# Air Production DB

Sistem manajemen operasional internal untuk production/documentation business.

> Status saat ini: **Phase 2E**.
> Data aktif berasal dari **Google Sheets** (read-only). Mock repository
> tetap tersedia sebagai fallback/testing di `src/repositories/mock`.

## Menjalankan Project

```bash
npm install
npm run dev
```

Buka http://localhost:3000 — halaman akan diarahkan otomatis ke `/dashboard`.

Perintah lain:

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint
npm run build       # Production build
npm run start       # Menjalankan hasil build
```

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- Tanpa dependency UI tambahan (komponen ditulis sendiri)

## Struktur

```
src/
├── app/                 # Route (App Router)
│   ├── dashboard/       # Halaman utama
│   ├── jobs/            # Daftar job + detail job
│   ├── clients/ vendors/ crew/ venues/ finance/
│   ├── layout.tsx       # Application shell
│   └── globals.css      # Design token
├── components/
│   ├── layout/          # Sidebar, Topbar, AppShell
│   ├── ui/              # Design system reusable
│   ├── dashboard/       # Komponen khusus dashboard
│   ├── jobs/            # Tabel job & tab detail job
│   └── icons.tsx        # Ikon SVG internal
├── data/mock/           # Mock data (sementara)
├── lib/                 # Tipe domain, label, util, navigasi
├── repositories/        # Kontrak repository + implementasi mock & Google
└── services/            # Logic baca data untuk UI
```

## Architecture

```
UI (app/ + components/)
      ↓
Service (services/)
      ↓
Repository (repositories/)
      ↓
Google Sheets  ← sumber data aktif (read-only, via googleRepositories)
```

UI hanya bergantung pada Service. Service hanya bergantung pada kontrak
Repository. Sumber data aktif ditentukan di satu tempat:
`src/repositories/index.ts`.

Untuk mengganti ke Google Sheets cukup menambahkan implementasi repository
baru dan mengubah fungsi `getRepositories()` — UI tidak perlu diubah.

## Business Rules yang Sudah Dikunci

- Satu Job wajib memiliki **Client ATAU Vendor**, tidak boleh keduanya
  sekaligus, dan tidak boleh kosong.
- Status Job hanya: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`.
- Client Payment: Termin 1 = DP, Termin 2, Termin 3 = Pelunasan.
- Vendor Payment: DP dan Pelunasan.
- Crew memiliki default payment di master Crew; payment aktual dicatat pada
  assignment Job-Crew.
- Delivery memiliki status sendiri (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`)
  dan tidak boleh disamakan dengan status Job.

## Dokumentasi Audit

Lihat [`docs/FREEBUFF_AUDIT.md`](docs/FREEBUFF_AUDIT.md) untuk catatan
pekerjaan, keputusan teknis, dan hasil validasi.
