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

Jika pekerjaan dilanjutkan oleh OpenCode, kondisi terakhir:- Project berada di root repository dan sudah menggunakan Git. Baseline Phase 0 + Phase 1 sudah di-commit pada commit `283c893` ("Bangun UI foundation Air Production DB (Phase 0 + Phase 1)"); working tree bersih.
- Commit tersebut belum di-push ke remote (tidak diminta).
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

---

# FREEBUFF AUDIT — PHASE 1.5 (UI VISUAL REFINEMENT)

## 1. Status

**COMPLETED**

Phase ini hanya menyentuh visual/UI. Tidak ada business logic, struktur data,
repository, service, maupun routing yang diubah.

## 2. Perubahan Visual yang Dilakukan

**Surface dan warna**

- Background aplikasi menjadi `#F7F7F7` (sebelumnya abu kebiruan).
- Surface/card, sidebar, dan topbar menjadi putih `#FFFFFF`.
- Sidebar yang sebelumnya gelap (`#101828`) **dihapus total** dan diganti sidebar putih.
- Teks: primary `#171717`, secondary `#737373`, muted `#A3A3A3`.
- Border sangat tipis `#E8E8E8` (sebelumnya `#E5E7EB` / `#D1D5DB`).
- Accent dikurangi menjadi satu: `#2F5FE0`, dipakai hanya untuk link, focus ring,
  dan badge "brand". Warna lain hanya untuk status semantik (netral, amber halus,
  hijau halus, merah halus) dan tetap soft.
- Gradient, glassmorphism, dan warna neon: tidak ada.

**Shadow dan radius**

- Card memakai `shadow-sm` saja; shadow kustom yang lebih pekat dihapus.
- `shadow-lg` / `shadow-md` hanya pada elemen overlay yang memang butuh elevasi:
  modal, dropdown menu, dan drawer sidebar mobile.
- Radius moderat: card `rounded-xl` (12px), kontrol `rounded-lg` (8px).
  `rounded-full` hanya untuk avatar, titik status, ikon empty state, dan spinner.

**Tipografi dan spacing**

- Page title 24px weight 600; section title 15px weight 600; body 14px;
  teks sekunder 12-13px. Hanya memakai weight 400/500/600 (weight 700 dihapus).
- Padding horizontal halaman 24px (`px-6`) di desktop dan 16px (`px-4`) di mobile.
- Jarak antar section 24-32px (`space-y-6` pada halaman biasa, `space-y-8` pada Dashboard).
- Padding internal card 20-24px (`px-6 py-5`, `p-6`).
- Cell tabel `px-6 py-4`, padding vertikal dinaikkan agar baris lebih lega.

**Application Shell**

- Sidebar: putih, `border-r` tipis, tinggi item 36px, ada whitespace pada grup
  "Menu Utama". Active state berupa background abu sangat muda (`#F5F5F5`) dan
  teks lebih tegas, tanpa blok warna besar maupun indikator mencolok.
- Topbar: tinggi 56px (`h-14`), putih, hanya berisi label section kecil dan info
  admin. Tombol notifikasi dihapus karena tidak memiliki fungsi.
- Efek `backdrop-blur` pada topbar dihapus.

**Dashboard**

- Summary card disederhanakan: tanpa chip ikon dekoratif, hanya label kecil,
  angka besar (30px), dan hint 12px, semuanya putih dengan `shadow-sm`.
- Tabel Incoming Wedding dipangkas menjadi 4 kolom (Tanggal, Job, Client/Vendor,
  Status); nama venue menjadi baris sekunder di bawah nama job.
- Tabel Incoming Editing dipangkas menjadi 3 kolom (Deadline, Delivery, Status);
  nama job menjadi baris sekunder.
- Catatan keputusan: bagian "Summary Cards" dan "Job Status Summary" pada brief
  digabung menjadi satu baris 4 card (Total Jobs + 3 status) karena keduanya
  menampilkan data yang sama. Penggabungan ini untuk mengurangi duplikasi visual
  (prinsip LESS BUT BETTER). Tidak ada data atau fitur baru.

**Jobs**

- Search dan filter status dibuat compact serta menyatu di dalam satu card dengan
  tabel, bukan toolbar mengambang yang penuh tombol.
- Kolom: Job Number (mono, muted), Job Name (venue sebagai baris sekunder),
  Client/Vendor (keterangan Client/Vendor sebagai baris sekunder), Kategori,
  Execution Date, Status, Action.
- Badge "Client/Vendor" berwarna dihapus dan diganti teks sekunder agar tidak
  menambah warna.
- Action per baris disederhanakan menjadi satu menu teks "Aksi" tanpa border,
  bukan deretan ikon.

**Job Detail**

- Hierarki baru: nomor job (mono, muted), nama job (24px), badge status di kanan,
  lalu satu white card berisi meta penting (Client/Vendor, Execution Date, Location).
- Tabs tetap underline sederhana, bukan pill besar; active state memakai border
  dan teks `ink` yang halus.
- Panel Overview memakai satu card berisi definition list.
- Panel Cash Flow menggabungkan "Pembayaran Client" dan "Pembayaran Vendor" dalam
  satu card yang dipisahkan sub-judul dan divider, bukan dua card terpisah.

**Master Data dan Finance**

- Semua halaman memakai pola identik: PageHeader dan deskripsi, lalu Card putih
  `overflow-hidden`, lalu Table.
- Tidak ada lagi style khusus per halaman; seluruh tampilan tabel berasal dari
  shared component.

## 3. Component yang Diubah

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
- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/topbar.tsx`
- `src/components/dashboard/summary-card.tsx`
- `src/components/jobs/jobs-table.tsx`
- `src/components/jobs/job-detail-tabs.tsx`
- `src/app/globals.css` (design token)

## 4. Halaman yang Diperbaiki

- `/dashboard`
- `/jobs`
- `/jobs/[jobNumber]`
- `/clients`
- `/vendors`
- `/crew`
- `/venues`
- `/finance`
- `not-found` (404) dan `loading` state global

Total 29 file diubah. File di `src/services/*`, `src/repositories/*`,
`src/data/mock/*`, dan `src/lib/types.ts` **tidak diubah sama sekali**
(diverifikasi dengan `git diff --name-only` yang menghasilkan 0 file).

## 5. Design System yang Digunakan

Token terpusat di `src/app/globals.css` (Tailwind v4 `@theme`):

- Surface: `--color-app: #f7f7f7`, `--color-panel: #ffffff`
- Border: `--color-line: #e8e8e8`
- Teks: `--color-ink: #171717`, `--color-ink-soft: #737373`, `--color-ink-muted: #a3a3a3`
- Accent: `--color-brand: #2f5fe0`, `--color-brand-soft: #eff3fc`
- Shadow: `shadow-sm` untuk card, `shadow-lg` / `shadow-md` khusus overlay
- Radius: `rounded-xl` untuk card, `rounded-lg` untuk kontrol

Semua halaman mengonsumsi token ini melalui shared component di
`src/components/ui/`, sehingga tidak ada style khusus per halaman.

## 6. Validation

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0.
- ESLint: **PASS** — `npx eslint .` exit code 0, tanpa warning.
- Build: **PASS** — `npm run build` (Next.js 16.3.8) exit code 0, 11 route ter-generate.

## 7. Browser Visual Test

**TIDAK DILAKUKAN.** Environment ini tidak memiliki browser automation atau tool
screenshot, sehingga tidak ada pengecekan visual (desktop/tablet/mobile),
pengecekan overflow secara visual, maupun pengecekan console error di browser.

Yang benar-benar dilakukan (bukan pengganti visual test):

- Server produksi dijalankan (`PORT=3102 npm start`), lalu setiap route diminta
  via HTTP: `/dashboard`, `/jobs`, `/jobs/JOB-2026-001`, `/clients`, `/vendors`,
  `/crew`, `/venues`, `/finance` menghasilkan **200**, dan route tidak dikenal
  menghasilkan **404**.
- Log server diperiksa dan tidak menemukan error runtime.
- Bundle CSS hasil build diperiksa: token baru ter-bundle (`#f7f7f7`, `#171717`,
  `#2f5fe0`, `#a3a3a3`, `#737373`, `#e8e8e8`), sedangkan warna lama **tidak ada**
  (`#101828` = 0, `#2f6bed` = 0, `#1d2939` = 0). Ini membuktikan sidebar gelap
  sudah hilang dari CSS final.
- HTML hasil render diperiksa: sidebar memakai `bg-panel` (putih) dan class
  `bg-sidebar` tidak ada lagi; padding halaman `px-4 py-6 sm:px-6 sm:py-8`
  terpasang; tidak ada `shadow-2xl`, `font-bold`, atau `bg-gradient` pada output.
- Jumlah ikon pada Dashboard adalah 8 (7 ikon navigasi dan 1 tombol menu),
  bukan 12, yang berarti chip ikon dekoratif pada summary card sudah hilang.

Kesimpulan: perubahan visual **terverifikasi secara struktural (CSS dan HTML)**,
tetapi **belum terverifikasi secara visual di mata pengguna**.

## 8. Masalah yang Masih Tersisa

1. Visual test belum dilakukan (lihat bagian 7). Perlu pengecekan manual di
   browser pada desktop, tablet, dan mobile, terutama overflow tabel pada layar
   kecil dan proporsi whitespace.
2. `npm audit` masih melaporkan 5 high severity vulnerability pada rantai
   dependency dev (`eslint-config-next` → `fast-glob` → `micromatch` → `braces`).
   Hanya menyentuh tooling dev, bukan runtime. Tidak diperbaiki karena
   `npm audit fix --force` akan menurunkan `eslint-config-next` ke 14.2.35
   (breaking change).
3. Komponen `Modal` dan `Spinner` tersedia di design system tetapi belum dipakai
   di halaman mana pun karena belum ada CRUD (di luar scope).
4. Catatan business rule (sesuai aturan "jangan perbaiki di phase ini, catat saja"):
   aturan "Job wajib memiliki Client ATAU Vendor" masih hanya diimplementasikan
   sebagai tipe opsional dan fallback tampilan "Tanpa Client/Vendor" pada
   `resolveCounterparty`. Belum ada validasi runtime. Ini perlu ditangani pada
   phase integrasi data, bukan pada Phase 1.5.

## 9. Hal yang TIDAK Dilakukan karena Di Luar Scope

- Tidak mengimplementasikan Google Sheets, Google Cloud, atau API client.
- Tidak menambahkan database, authentication, multi-user, atau role/permission.
- Tidak menambahkan task management, TODO, timeline/schedule, maupun JobVendor.
- Tidak menambahkan fitur baru, chart baru, atau kalkulasi finansial.
- Tidak mengubah status Job, struktur payment, struktur data, routing, atau mock data.
- Tidak menghapus halaman yang sudah ada.
- Tidak menambahkan gradient, glassmorphism, neon color, dark sidebar, background
  gelap, shadow berat, maupun radius ekstrem.

## 10. Rekomendasi Next Step

1. Lakukan verifikasi visual manual di browser (desktop, tablet, mobile) terhadap
   `/dashboard`, `/jobs`, `/jobs/JOB-2026-001`, serta halaman master dan finance.
   Perbaiki jika ditemukan overflow atau ketidakseimbangan spacing.
2. Setelah visual disetujui, lanjut ke Phase 2 read-only Google Sheets: tambahkan
   implementasi repository baru dan ubah `getRepositories()` tanpa mengubah
   service maupun UI.
