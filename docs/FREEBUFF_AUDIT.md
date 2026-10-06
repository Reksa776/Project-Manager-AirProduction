# FREEBUFF AUDIT

## Informasi

- Nama Project: Air Production DB
- Phase: Phase 0 + Phase 1
- Tanggal: 6 Oktober 2026
- Agent: Freebuff

## Status Project

Repository awal **kosong** (tidak ada file dan belum menggunakan Git).
Project dibangun dari nol menggunakan Next.js 16 (App Router), React 19,
TypeScript strict, dan Tailwind CSS v4.

Saat ini aplikasi sudah dapat dijalankan, memiliki Application Shell
(Sidebar + Topbar), design system dasar, halaman Dashboard, halaman Jobs,
halaman Job Detail, serta halaman master (Clients, Vendors, Crew, Venues,
Finance) yang semuanya menampilkan **mock data** realistis.

Google Sheets **belum** diimplementasikan dan tidak ada credential/API client
Google yang dibuat. Architecture sudah disiapkan agar integrasi Google Sheets
pada phase berikutnya tidak membongkar UI.

Semua route utama sudah diverifikasi berjalan pada server produksi
(status HTTP 200). Belum seluruh aspek UI diperiksa secara visual di browser
sungguhan (lihat bagian Known Issues).

## Yang Sudah Dikerjakan

- Phase 0 — inspeksi repository (kosong), verifikasi environment
  (Node v22.19.0, npm 10.9.3), dan inisialisasi Git baseline.
- Phase 0 — scaffold Next.js 16 + TypeScript + Tailwind v4 + ESLint (App Router, `src/`).
- Phase 0 — verifikasi `dev`, `typecheck`, `lint`, dan `build` berjalan.
- Phase 1 — tipe domain lengkap (`lib/types.ts`) untuk seluruh entity.
- Phase 1 — lapisan mock data realistis (`data/mock/`).
- Phase 1 — lapisan repository (kontrak + implementasi mock) yang siap diganti Google Sheets.
- Phase 1 — lapisan service sebagai satu-satunya jembatan UI ke data.
- Phase 1 — design system reusable (Button, Input, Select, Card, Badge, Status
  Badge, Table, Modal, Dropdown, Page Header, Empty State, Loading State).
- Phase 1 — Application Shell: Sidebar (active state, responsive drawer) + Topbar
  (judul halaman, info Admin mock) + Main Content.
- Phase 1 — halaman Dashboard (summary cards, Incoming Wedding, Incoming Editing).
- Phase 1 — halaman Jobs (search, filter status, tabel) dan Job Detail
  (tab Overview, Crew, Delivery, Cash Flow, Expense).
- Phase 1 — halaman master Clients, Vendors, Crew, Venues, dan Finance (tampilan data).
- Phase 1 — halaman `not-found` (404) dan `loading` state global.
- Phase 1 — dokumentasi README dan audit ini.

## Yang Belum Dikerjakan

- Integrasi Google Sheets (repository Google Sheets, auth service account, mapping sheet).
- Operasi tulis data (CRUD) untuk seluruh entity.
- Kalkulasi finansial (income, expense, profit, sisa pembayaran, dsb).
- Authentication dan multi-user/role system.
- Task management, TODO system, timeline/schedule, dan JobVendor.
- Verifikasi visual/responsive di browser sungguhan.

## File yang Dibuat

Konfigurasi & root:

- `README.md`
- `docs/FREEBUFF_AUDIT.md`

`src/lib/`:

- `src/lib/types.ts`
- `src/lib/labels.ts`
- `src/lib/utils.ts`
- `src/lib/navigation.ts`

`src/data/mock/`:

- `src/data/mock/clients.ts`
- `src/data/mock/vendors.ts`
- `src/data/mock/venues.ts`
- `src/data/mock/crew.ts`
- `src/data/mock/jobs.ts`
- `src/data/mock/job-crews.ts`
- `src/data/mock/deliveries.ts`
- `src/data/mock/finance.ts`
- `src/data/mock/admins.ts`

`src/repositories/`:

- `src/repositories/types.ts`
- `src/repositories/index.ts`
- `src/repositories/mock/index.ts`

`src/services/`:

- `src/services/types.ts`
- `src/services/shared.ts`
- `src/services/job-service.ts`
- `src/services/dashboard-service.ts`
- `src/services/master-service.ts`

`src/components/`:

- `src/components/icons.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/topbar.tsx`
- `src/components/dashboard/summary-card.tsx`
- `src/components/jobs/jobs-table.tsx`
- `src/components/jobs/job-detail-tabs.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/status-badge.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/modal.tsx`
- `src/components/ui/dropdown.tsx`
- `src/components/ui/page-header.tsx`
- `src/components/ui/empty-state.tsx`
- `src/components/ui/loading-state.tsx`
- `src/components/ui/index.ts`

`src/app/`:

- `src/app/loading.tsx`
- `src/app/not-found.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/jobs/page.tsx`
- `src/app/jobs/[jobNumber]/page.tsx`
- `src/app/clients/page.tsx`
- `src/app/vendors/page.tsx`
- `src/app/crew/page.tsx`
- `src/app/venues/page.tsx`
- `src/app/finance/page.tsx`

## File yang Diubah

Diperbarui dari hasil scaffold `create-next-app`:

- `package.json` — nama project diubah menjadi `air-production-db`, ditambah script `typecheck`.
- `src/app/layout.tsx` — diganti menjadi Root Layout Air Production DB yang memakai AppShell.
- `src/app/page.tsx` — diganti menjadi redirect ke `/dashboard`.
- `src/app/globals.css` — diganti menjadi design token Tailwind v4 Air Production DB.
- `README.md` — ditulis ulang sesuai project.

Dihapus (hanya artefak scaffold, tidak berisi pekerjaan pengguna):

- `AGENTS.md`, `CLAUDE.md`, folder `scaffold-tmp/` (folder scaffold sementara).

## Architecture

Architecture aktual yang diterapkan:

```
UI (src/app, src/components)
        ↓
Service (src/services)
        ↓
Repository (src/repositories)
        ↓
Mock data (src/data/mock)   ← saat ini
Google Sheets               ← phase berikutnya
```

- UI tidak pernah mengimpor data mock secara langsung; UI hanya memanggil service.
- Service hanya bergantung pada interface repository (`src/repositories/types.ts`).
- Sumber data aktif ditentukan di satu titik: `getRepositories()` pada
  `src/repositories/index.ts`. Untuk pindah ke Google Sheets cukup menambah
  implementasi repository baru dan mengubah fungsi tersebut.
- Halaman utama (`Dashboard`, `Jobs`, `Job Detail`) adalah Server Component yang
  mengambil data melalui service. Komponen interaktif (tabel pencarian, tab,
  dropdown, modal) dijadikan Client Component terpisah.

## Business Rules

Business rules yang saat ini sudah dikunci pada tipe dan tampilan:

- Job wajib memiliki **Client ATAU Vendor**: tidak boleh keduanya sekaligus dan
  tidak boleh kosong (diterapkan melalui field `clientId?` / `vendorId?` dan
  fungsi `resolveCounterparty`).
- Status Job hanya tiga: `NOT_STARTED` (Belum Dikerjakan),
  `IN_PROGRESS` (Sedang Dikerjakan), `COMPLETED` (Sudah Dikerjakan).
  Tidak ada status lain.
- Client Payment memakai termin: Termin 1 = DP, Termin 2, Termin 3 = Pelunasan.
- Vendor Payment hanya: DP dan Pelunasan.
- Crew memiliki default payment di master Crew; payment aktual untuk suatu Job
  disimpan di assignment Job-Crew.
- Delivery memiliki status sendiri (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`)
  dan tidak boleh disamakan dengan status Job.

Catatan asumsi (karena belum ditentukan di brief): Incoming Wedding difilter dari
job berkategori `WEDDING` dengan `executionDate >= hari ini`. Kategori job
(Wedding/Pre-Wedding/Corporate/Event/Lainnya) ditambahkan sebagai atribut
tampilan. Asumsi ini hanya memengaruhi UI dan mudah disesuaikan.

## Mock Data

Mock data realistis tersedia di `src/data/mock/` untuk seluruh entity:
clients, vendors, venues, crew, jobs, job-crews, deliveries, client payments,
vendor payments, expenses, dan admins.

Contoh yang digunakan: Andrea & Lola, Hasna & Dio, Rani & Bimo, Nadia & Yoga,
Lumina Pictures, Kirana Wedding Organizer, Grand Ballroom, The Glass House,
Highlight Video, Full Video, Cinematic Prewedding, dan crew seperti
Bagas Prasetya (Photographer) serta Dinda Larasati (Videographer).

Mock data hanya untuk visualisasi dan **bukan** database final.

## Database

**Google Sheets BELUM diimplementasikan pada phase ini.** Tidak ada Google API
client, tidak ada credential, dan tidak ada pemanggilan ke spreadsheet mana pun.
Seluruh data yang tampil berasal dari mock data lokal.

Struktur sheet yang direncanakan untuk phase berikutnya (belum dibuat):
`clients`, `vendors`, `venues`, `crew`, `jobs`, `job_crews`, `deliveries`,
`client_payments`, `vendor_payments`, `expenses`, `admins`.

## Validation

- Typecheck: **BERHASIL** — `npx tsc --noEmit` keluar dengan exit code 0.
  Sebelumnya ditemukan 1 error pada `src/components/ui/input.tsx`
  (`leading && "pl-9"` bertipe tidak sesuai) dan sudah diperbaiki.
- Lint: **BERHASIL** — `npx eslint .` keluar dengan exit code 0, tanpa warning.
- Build: **BERHASIL** — `npm run build` (Next.js 16.3.8) sukses, 11 halaman
  ter-generate (`/`, `/dashboard`, `/jobs`, `/jobs/[jobNumber]`, `/clients`,
  `/vendors`, `/crew`, `/venues`, `/finance`, `/_not-found`).
- Manual UI check: **SEBAGIAN** — server produksi (`npm start`) dijalankan pada
  port 3100/3101 dan setiap route diperiksa:
  - `/`, `/dashboard`, `/jobs`, `/jobs/JOB-2026-001`, `/clients`, `/vendors`,
    `/crew`, `/venues`, `/finance` → HTTP 200.
  - Route tidak dikenal → HTTP 404 dan menampilkan halaman "Halaman tidak ditemukan".
  - Konten diverifikasi lewat HTML: sidebar (Dashboard, Jobs, Clients, Vendors,
    Crew, Venues, Finance), Topbar + "Admin Produksi", Incoming Wedding
    ("Andrea & Lola"), Incoming Editing ("Highlight Video"), tabel Jobs
    ("JOB-2026-001", "Belum Dikerjakan"), dan Job Detail
    (tab Overview/Cash Flow, "Grand Ballroom", "Bagas Prasetya").
  - Pengecekan visual/responsive di browser sungguhan **belum dilakukan**
    (tidak tersedia otomasi browser pada environment ini). Layout responsive
    diimplementasikan dengan kelas Tailwind (`sm:`, `lg:`, `xl:`) dan belum
    diverifikasi secara visual.

## Known Issues

1. Belum ada verifikasi visual/responsive di browser sungguhan; hanya dilakukan
   pengecekan HTTP dan konten HTML. Perlu pengecekan manual pada desktop,
   tablet, dan mobile.
2. `npm audit` melaporkan 5 high severity vulnerabilities yang berasal dari
   rantai dependency dev `eslint-config-next → @next/eslint-plugin-next →
   fast-glob → micromatch → braces` (advisory DoS `braces`). Ini hanya
   menyentuh tooling dev, bukan runtime aplikasi. `npm audit fix --force`
   disarankan menurunkan `eslint-config-next` ke 14.2.35 (breaking change),
   sehingga **tidak** diterapkan.
3. Isi tab Job Detail selain Overview belum ada pada HTML awal karena tab
   dirender di client (perilaku normal, bukan bug).
4. `Modal` dan beberapa komponen design system (mis. `Modal`, `Spinner`)
   sudah tersedia tetapi belum dipakai di halaman mana pun pada phase ini,
   karena belum ada fitur CRUD.

## Keputusan Teknis

- Repository awal kosong, sehingga dipilih stack Next.js 16 + TypeScript strict
  + Tailwind CSS v4 (App Router) sesuai arahan.
- Tidak menambah dependency UI (tanpa shadcn/Radix/lucide); ikon dibuat sebagai
  SVG internal dan komponen UI ditulis sendiri agar sesuai kebutuhan sederhana.
- UI memakai Server Component untuk pengambilan data dan Client Component hanya
  untuk interaksi (search, filter, tab, dropdown, modal).
- Service dibuat `async` sejak awal agar penggantian ke Google Sheets (I/O
  jaringan) tidak mengubah signature yang dipakai UI.
- Satu titik konfigurasi sumber data (`getRepositories()`) untuk memudahkan
  pemasangan repository Google Sheets nanti.
- Tema terang netral dengan satu warna accent (`brand`) dan warna status
  berbeda untuk Job vs Delivery, memenuhi prinsip clean, professional, dan
  information-dense.
- Redirect `/` → `/dashboard` agar Dashboard menjadi halaman utama.

## Next Step

Phase berikutnya (Phase 2) yang seharusnya dikerjakan:

1. Implementasi repository Google Sheets untuk operasi baca (read) terlebih dahulu,
   terhubung ke `getRepositories()` tanpa mengubah service/UI.
2. Setup service account Google dan membaca konfigurasi dari environment variable
   (belum ada credential apa pun saat ini).
3. Mapping kolom sheet ke tipe domain yang sudah ada di `src/lib/types.ts`.
4. Setelah read stabil, lanjut ke operasi tulis (CRUD) dengan tampilan form/modal
   yang sudah memiliki komponen dasarnya.

## Catatan untuk OpenCode

Jika pekerjaan dilanjutkan oleh OpenCode, kondisi terakhir:

- Project berada di root repository dan sudah menggunakan Git (belum ada commit
  akhir saat audit ini ditulis; baseline akan di-commit setelah audit).
- `npm install` sudah dijalankan; seluruh validasi (typecheck, lint, build) lulus
  pada kondisi ini.
- Sumber data aktif adalah **mock** di `src/repositories/mock/index.ts`, dipilih
  melalui `src/repositories/index.ts` (`getRepositories()`). Titik inilah yang
  harus diubah saat integrasi Google Sheets.
- Tidak ada file environment (`.env`) dan tidak ada credential Google.
- Untuk melanjutkan ke Google Sheets: buat implementasi baru di bawah
  `src/repositories/`, jaga agar `src/services/*` dan UI tidak berubah.
- Halaman belum diverifikasi secara visual di browser; disarankan menjalankan
  `npm run dev` lalu memeriksa `/dashboard`, `/jobs`, dan `/jobs/JOB-2026-001`
  pada ukuran desktop, tablet, dan mobile.
