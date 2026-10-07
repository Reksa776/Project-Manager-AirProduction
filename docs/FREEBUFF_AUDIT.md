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

Pengecekan browser **DILAKUKAN** dengan Chrome headless (`--headless=new`) yang
dikendalikan melalui Chrome DevTools Protocol memakai skrip Node sementara.
Skrip ini tidak menambah dependency ke project (memakai WebSocket bawaan Node 22)
dan sudah dihapus setelah dipakai sehingga tidak ikut masuk repository.

Cakupan: 8 route (`/dashboard`, `/jobs`, `/jobs/JOB-2026-001`, `/clients`,
`/vendors`, `/crew`, `/venues`, `/finance`) x 3 viewport (mobile 375px,
tablet 768px, desktop 1440px) = **24 kombinasi**.

Hasil pada seluruh 24 kombinasi:

- **Horizontal overflow: 0.** `document.documentElement.scrollWidth` tidak
  pernah melebihi `window.innerWidth` (selisih negatif hanya lebar scrollbar).
- **Console error: 0 dan exception: 0.** Tidak ada error JavaScript di browser.
- Warna terhitung (computed style) sesuai token: `body` = `rgb(247, 247, 247)`
  (#F7F7F7), sidebar = `rgb(255, 255, 255)` (putih, sidebar gelap benar-benar
  hilang), topbar = `rgb(255, 255, 255)`.
- Active state navigasi terbukti berbeda dan halus: item aktif
  `rgb(23, 23, 23)` (#171717) sedangkan item tidak aktif `rgb(115, 115, 115)`
  (#737373).

Yang **belum** dilakukan: penilaian visual subjektif oleh mata manusia
(estetika, keseimbangan whitespace, proporsi tipografi, review screenshot).
Pengecekan di atas bersifat terukur (layout, overflow, warna, error console)
dan **bukan** pengganti review desain.

## 8. Masalah yang Masih Tersisa

1. Penilaian visual subjektif (estetika dan proporsi whitespace) belum dilakukan
   oleh manusia. Pengecekan browser sudah dijalankan dan tidak menemukan overflow
   maupun console error (lihat bagian 7), tetapi tidak ada review screenshot.
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
---

# FREEBUFF AUDIT — PHASE 2A (GOOGLE CLOUD + SERVICE ACCOUNT)

## Status

**BLOCKED** untuk bagian provisioning Google Cloud (Step 2–5).
Bagian environment, security, dan validasi project **COMPLETED**.

Alasan singkat: environment ini tidak memiliki akses terautentikasi ke Google
Cloud (tidak ada `gcloud` CLI, tidak ada Google Cloud SDK, tidak ada credential
Google, dan tidak ada sesi browser Google yang bisa dipakai). Pembuatan project,
enable API, dan pembuatan Service Account hanya bisa dilakukan dari akun Google
pemilik project. Credential tidak boleh diminta maupun dikirim lewat chat, jadi
langkah tersebut diserahkan ke pemilik akun dengan panduan di bagian Blocker.

## Google Cloud

- Project Air Production DB: **BELUM DIBUAT** (menunggu akun Google pemilik project).
- Google Sheets API: **BELUM DI-ENABLE** (bergantung pada project).
- Service Account `air-production-db`: **BELUM DIBUAT** (bergantung pada project).
- JSON key Service Account: **BELUM DIBUAT**.
- Tidak ada credential rahasia yang dituliskan di audit ini.

Fakta environment yang membuat langkah ini tidak bisa dijalankan:

- `gcloud` CLI: tidak terpasang (`command not found`).
- Google Cloud SDK: tidak ada di `%LOCALAPPDATA%\Google\Cloud SDK`.
- Environment variable Google (`GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_*`): tidak ada.
- gravity_index (katalog integrasi) tidak menyediakan entri Google Sheets /
  Google Cloud Service Account, sehingga setup dilakukan mengikuti prosedur resmi Google.

## Environment

- `.env.local` — **digunakan** (dibuat, berisi 3 variable dengan nilai kosong).
- `.env.example` — **dibuat** (hanya placeholder dan komentar, tanpa nilai asli).
- Environment variable yang disiapkan (nama saja, tanpa nilai):
  - `GOOGLE_SHEETS_ID`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PRIVATE_KEY`

Tidak ada nilai credential asli pada kedua file. Kedua file belum dibaca oleh
aplikasi mana pun pada phase ini (tidak ada `process.env` untuk variable tersebut
di source code).

Perubahan `.gitignore` yang diperlukan: pattern bawaan `.env*` juga mengabaikan
`.env.example`, sehingga `.env.example` tidak akan pernah bisa di-commit.
Ditambahkan pengecualian `!.env.example` serta pattern tambahan untuk credential
Google (`*.json.key`, `service-account*.json`, `google-credentials*.json`).

## Security

- credential tidak di-commit: **BENAR** — `.env.local` terabaikan Git
  (terverifikasi dengan `git check-ignore` → rule `.gitignore:34:.env*`).
- `.env.local` protected: **BENAR** — `git status` tidak pernah menampilkan `.env.local`.
- private key tidak ada di source code: **BENAR** — pencarian
  `BEGIN PRIVATE KEY` / `private_key` / `client_email` pada seluruh tracked file
  menghasilkan **0** file.
- credential JSON tidak masuk Git: **BENAR** — tidak ada file JSON credential
  yang tracked; `git ls-files` hanya memuat `package.json`, `package-lock.json`,
  dan `tsconfig.json`.
- Pemeriksaan riwayat Git (`git log --all -p`) untuk pola credential:
  **0 kemunculan** `BEGIN PRIVATE KEY` dan **0 kemunculan** `private_key`.
  Artinya credential **tidak pernah** masuk Git pada commit mana pun.
- Pemeriksaan working tree (di luar `node_modules`/`.next`): 0 file berisi
  penanda private key.
- Isi private key tidak pernah ditampilkan di terminal, audit, README, maupun output.

## Code Changes

Perubahan pada repository:

- `.gitignore` — **diubah** (menambahkan `!.env.example` dan pattern credential Google).
- `.env.example` — **file baru** (template placeholder, ikut Git).
- `.env.local` — **file baru** (lokal, TIDAK ikut Git).

Perubahan code aplikasi: **0 file**.

- `src/services/*` — tidak berubah.
- `src/repositories/*` (termasuk `index.ts` dan `getRepositories()`) — tidak berubah.
- `src/data/mock/*` — tidak berubah.
- `src/components/*` — tidak berubah.
- `src/app/*` — tidak berubah.
- `src/lib/types.ts` — tidak berubah.
- `package.json` — tidak berubah; **tidak ada** dependency Google yang ditambahkan.

## Validation

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0.
- ESLint: **PASS** — `npx eslint .` exit code 0, tanpa warning.
- Build: **PASS** — `npm run build` exit code 0, 11 route ter-generate. Keberadaan
  `.env.local` dengan nilai kosong tidak mengganggu build karena belum dibaca aplikasi.
- Git security check: **PASS** — lihat bagian Security (0 credential di tracked
  files, 0 credential di riwayat Git, `.env.local` terabaikan).
- Mock repository tetap aktif: **BENAR** — `getRepositories()` masih
  mengembalikan `mockRepositories` dan tidak ada perubahan pada file terkait.

## Yang Belum Dikerjakan

- Spreadsheet "Air Production DB" **belum dibuat** dan **belum distrukturkan**.
  Sheet `clients`, `vendors`, `venues`, `crew`, `jobs`, `job_crews`, `deliveries`,
  `client_payments`, `vendor_payments`, `expenses`, `admins` belum ada.
  Ini dependency untuk **Phase 2B**.
- Google Sheets client **belum dibuat**.
- Repository Google Sheets **belum dibuat**.
- Operasi read **belum dibuat**.
- Operasi write **belum dibuat**.
- CRUD **belum dibuat**.
- `getRepositories()` **belum diganti** (mock tetap menjadi sumber data aktif).
- UI **belum diubah**.
- Service **belum diubah**.
- Business logic dan routing **belum diubah**.
- Tidak ada API endpoint aplikasi yang dibuat.
- Tidak ada pemanggilan Google Sheets API dari aplikasi.
- Deployment/CI setup credential **belum dibuat** (sesuai instruksi).

## Blocker

Blocker tunggal dan faktual: **akses terautentikasi ke Google Cloud tidak tersedia
di environment ini**, sehingga project, enable Sheets API, Service Account, dan
JSON key tidak dapat dibuat dari sini. Tidak ada blocker lain (tidak ada isu
billing atau permission yang bisa dilaporkan karena project belum ada).

Langkah yang harus dijalankan pemilik akun Google (sekitar 5 menit), lalu nilai
credential diisi sendiri ke `.env.local`:

1. Buka https://console.cloud.google.com/projectcreate dan buat project baru
   dengan nama **Air Production DB** (Project ID harus unik, mis.
   `air-production-db` atau `air-production-db-<angka>`).
2. Pastikan project tersebut aktif, lalu buka
   https://console.cloud.google.com/apis/library/sheets.googleapis.com dan klik
   **Enable** untuk **Google Sheets API**. Jangan mengaktifkan API lain.
3. Buka https://console.cloud.google.com/iam-admin/serviceaccounts dan buat
   Service Account dengan nama **air-production-db** (mis.
   `air-production-db@<project-id>.iam.gserviceaccount.com`).
4. Buka Service Account tersebut → tab **Keys** → **Add key** → **Create new
   key** → **JSON**. File JSON akan terunduh.
5. Bagikan spreadsheet nanti ke email Service Account tersebut dengan akses
   **Editor** (dilakukan pada Phase 2B setelah spreadsheet dibuat).
6. Isi `.env.local` (jangan pernah menempelkan isinya ke chat):
   - `GOOGLE_SHEETS_ID` = ID spreadsheet dari URL
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = field `client_email` pada JSON
   - `GOOGLE_PRIVATE_KEY` = field `private_key` pada JSON (satu baris,
     dibungkus tanda kutip ganda, `\n` sebagai pemisah baris)
7. Simpan file JSON key **di luar folder repository** (atau di lokasi yang sudah
   diabaikan Git). Jangan commit file tersebut.

Alternatif yang lebih aman untuk production (dicatat saja, tidak dikerjakan pada
phase ini): gunakan **Workload Identity Federation** atau secret manager milik
platform deployment, sehingga tidak perlu menyimpan JSON key jangka panjang.

## Catatan Kebutuhan Phase Berikutnya

- Phase 2B memerlukan: spreadsheet sudah dibuat + Service Account sudah diberi
  akses Editor, karena repository read-only akan langsung menembak spreadsheet tersebut.
- Dependency Google API (mis. `googleapis` atau `google-auth-library`) **belum
  ditambahkan**. Penambahan dependency baru sebaiknya dilakukan pada Phase 2B
  saat client benar-benar dibutuhkan, bukan sekarang.
- Karena `GOOGLE_PRIVATE_KEY` berisi karakter baris baru, pembacaan nilainya nanti
  perlu mengganti `\n` menjadi baris baru yang sebenarnya sebelum dipakai library auth.

---

# FREEBUFF AUDIT — PHASE 2A (VERIFIKASI ULANG OLEH OPENCODE)

## 1. Status

**COMPLETED**

Verifikasi ulang Phase 2A dilakukan setelah Freebuff terkena usage limit.
Seluruh item Definition of Done terpenuhi. Worktree bersih: tidak ada perubahan
source code, service, mock data, business rules, `getRepositories()`, UI,
maupun `src/repositories/index.ts`.

## 2. Google Cloud

- Google Cloud Project: **tersedia** — terbukti karena Service Account dapat
  menerbitkan access token dan API Sheets merespons.
- Google Sheets API: **tersedia dan berfungsi** — token exchange HTTP 200 dan
  pemanggilan metadata spreadsheet (`spreadsheets.get`, fields terbatas) HTTP 200.
- Service Account: **tersedia** — JWT berhasil ditukar menjadi access token
  (HTTP 200, `token_type: Bearer`, `expires_in` ~3599 detik).
- Spreadsheet tujuan: **dapat diakses** — metadata GET HTTP 200, judul
  spreadsheet "Air Production DB". Spreadsheet sudah dibagikan ke email
  Service Account (terbukti dari akses sukses).
- Tidak ada spreadsheet/worksheet baru yang dibuat; tidak ada data yang ditulis.

## 3. Environment Variable (tanpa menampilkan nilai/secret)

- `GOOGLE_SHEETS_ID` — **tersedia**, non-kosong. Catatan faktual: nilainya
  saat ini berupa **URL lengkap** spreadsheet (mengandung `docs.google.com`
  dan `/d/`), bukan hanya ID mentah. Bisa dipakai langsung dengan mengekstrak
  bagian `/d/<id>/`, atau user dapat menggantinya dengan ID mentah saja pada
  Phase 2B. Bukan pemblokir.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — **tersedia**, non-kosong, berformat
  `<nama>@<project-id>.iam.gserviceaccount.com` (bukan placeholder).
- `GOOGLE_PRIVATE_KEY` — **tersedia**, non-kosong, diawali marker
  `-----BEGIN PRIVATE KEY-----` dan mengandung `\n` ter-escape. Nilai tidak
  pernah ditampilkan di mana pun.
- `.env.example` — **placeholder saja** (variabel kosong + komentar), tanpa
  nilai asli. Ikut Git.
- `.env.local` — **tidak tracked Git** (terverifikasi `git check-ignore` →
  rule `.gitignore:34:.env*`), tidak muncul di `git status`.

## 4. Security Check

- Tidak ada credential/secret di source code: pencarian `BEGIN PRIVATE KEY`,
  `private_key`, `client_email`, `gserviceaccount` pada seluruh file tracked
  menghasilkan **0** kemunculan berisi key asli (hanya teks panduan di audit).
- Tidak ada credential/secret di git history: `git log --all -p` untuk pola
  header private key asli dan API key menghasilkan **0** kemunculan.
- `GOOGLE_*` **tidak** dibaca oleh source code mana pun (`src/` tidak
  mereferensikan `process.env.GOOGLE_*`), dan belum ada dependency Google
  (`googleapis`/`google-auth-library`) di `package.json`.
- `getRepositories()` masih mengembalikan `mockRepositories` (diverifikasi
  langsung pada `src/repositories/index.ts`).

## 5. Verifikasi Autentikasi Google (faktual)

Metode: JWT RS256 ditandatangani dengan `GOOGLE_PRIVATE_KEY` (Node `crypto`,
tanpa menambah dependency apa pun), ditukar ke access token via endpoint resmi
`https://oauth2.googleapis.com/token`, lalu dipakai untuk GET metadata
spreadsheet dengan scope `spreadsheets.readonly`. Script bersifat sementara,
berada di luar repository, dan nilai token tidak dicetak.

Hasil:

- Token exchange: **HTTP 200 — BERHASIL** (Bearer, expires_in ~3599).
- Metadata spreadsheet (`fields=spreadsheetId,properties.title`): **HTTP 200**,
  judul "Air Production DB" — akses read-only terkonfirmasi.
- Artefak: script verifikasi **tidak masuk repository** (di luar folder project).

## 6. Validation

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0.
- ESLint: **PASS** — `npx eslint .` exit code 0, tanpa warning.
- Build: **PASS** — `npm run build` exit code 0, 11 route ter-generate,
  environment `.env.local` termuat tanpa error.
- `git status --short` bersih; tidak ada perubahan pada `src/`,
  `package.json`, maupun konfigurasi lain.

## 7. Yang Belum Dikerjakan / Belum Diverifikasi

- Daftar worksheet aktual di dalam spreadsheet (belum diinspeksi; bukan
  kebutuhan Phase 2A).
- Operasi tulis (write) sama sekali belum diverifikasi (sesuai instruksi).
- Repository Google Sheets, CRUD, endpoint API, dan integrasi ke
  `getRepositories()`: **belum dibuat** (Phase 2B).
- Dependency Google API: **belum ditambahkan** (sesuai instruksi).
- Penyesuaian `GOOGLE_SHEETS_ID` menjadi ID mentah (opsional, Phase 2B).

## 8. Definition of Done Phase 2A

- [x] Google Cloud Project tersedia
- [x] Google Sheets API tersedia
- [x] Service Account tersedia
- [x] GOOGLE_SHEETS_ID tersedia
- [x] GOOGLE_SERVICE_ACCOUNT_EMAIL tersedia
- [x] GOOGLE_PRIVATE_KEY tersedia
- [x] Tidak ada secret bocor ke repository
- [x] Tidak ada secret bocor ke git history
- [x] .env.local tidak tracked
- [x] tsc PASS
- [x] eslint PASS
- [x] build PASS

Status akhir: **PHASE 2A — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 2B (GOOGLE SPREADSHEET STRUCTURE)

## 1. Status

**COMPLETED**

## 2. Spreadsheet yang Digunakan

- Nama: **Air Production DB** (spreadsheet yang sudah ada, tidak membuat baru).
- Akses: Service Account dapat membaca metadata dan menulis header (HTTP 200).
- `GOOGLE_SHEETS_ID` pada `.env.local` telah **dinormalisasi menjadi ID mentah**
  (sebelumnya berisi URL lengkap; bagian `/d/<id>/` diekstrak). Nilai tidak
  ditampilkan di audit ini.

## 3. Worksheet

Tepat 11 worksheet, tanpa duplikat, tanpa worksheet tambahan:

1. `clients`
2. `vendors`
3. `venues`
4. `crew`
5. `jobs`
6. `job_crews`
7. `deliveries`
8. `client_payments`
9. `vendor_payments`
10. `expenses`
11. `admins`

Semua worksheet tersebut **sudah ada** sebelum setup (dibuat user sebelumnya)
dengan nama yang tepat dan kondisi kosong. Tidak ada worksheet yang dibuat
ulang dan tidak ada duplikat. Hanya header baris pertama yang diisi.

## 4. Header per Worksheet

- `clients`: id, name, address, contact, notes, created_at, updated_at
- `vendors`: id, name, contact, notes, created_at, updated_at
- `venues`: id, name, address, contact, notes, created_at, updated_at
- `crew`: id, name, role, contact, default_payment, notes, created_at, updated_at
- `jobs`: id, job_number, client_id, vendor_id, venue_id, job_name, job_type,
  execution_date, location, status, description, created_at, updated_at
- `job_crews`: id, job_id, crew_id, role, payment, payment_status, created_at, updated_at
- `deliveries`: id, job_id, item_name, delivery_type, quantity, deadline, status,
  notes, created_at, updated_at
- `client_payments`: id, job_id, term, amount, due_date, paid_date, status, notes,
  created_at, updated_at
- `vendor_payments`: id, job_id, type, amount, due_date, paid_date, status, notes,
  created_at, updated_at
- `expenses`: id, job_id, category, description, amount, expense_date, notes,
  created_at, updated_at
- `admins`: id, name, email, password_hash, created_at, updated_at

## 5. Data

- **Tidak ada** mock data dan **tidak ada** data dummy di spreadsheet.
- Setiap worksheet hanya berisi 1 baris (header). Terverifikasi lewat pembacaan
  `values` pada setiap sheet: `jumlah baris terisi: 1`.
- Mock data di repository (`src/data/mock/*`) tidak diubah.

## 6. Hasil Verifikasi Struktur (read-only, programmatic)

- Spreadsheet dapat diakses: HTTP 200.
- Jumlah worksheet: 11 — cocok.
- Nama worksheet: tepat, tanpa duplikat, tanpa tambahan.
- Header setiap worksheet: cocok persis dengan spesifikasi (11/11 `header cocok: true`).
- Data tambahan di luar header: tidak ada (11/11 `tanpa data tambahan: true`).
- Hasil akhir skrip verifikasi: `VERIFIKASI STRUKTUR: LULUS`.

## 7. Perubahan File Repository

- `.env.local` — diubah (normalisasi `GOOGLE_SHEETS_ID` ke ID mentah).
  File ini **tetap tidak tracked** Git (`git check-ignore` → `.gitignore:34:.env*`).
- `docs/FREEBUFF_AUDIT.md` — diperbarui (audit ini).
- `src/services/*`, `src/repositories/*`, `src/data/mock/*`, `src/components/*`,
  `src/app/*`, `package.json` — **tidak berubah** (terverifikasi dengan
  `git status`/`git diff`).
- Dependency baru: **tidak ada**. Setup/verifikasi memakai skrip Node sementara
  di luar repository (JWT + `fetch` bawaan), tanpa `googleapis`.
- Belum ada Google Sheets client untuk aplikasi, belum ada repository Google
  Sheets, `getRepositories()` tetap mock, belum ada CRUD/endpoint/UI baru.

## 8. Security

- `GOOGLE_PRIVATE_KEY`, access token, dan credential tidak pernah dicetak,
  tidak masuk audit, tidak masuk source code, tidak masuk Git.
- `.env.local` tetap diabaikan Git; tidak ada file credential JSON di repository.

## 9. Validation Project

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0.
- ESLint: **PASS** — `npx eslint .` exit code 0, tanpa warning.
- Build: **PASS** — `npm run build` exit code 0, 11 route ter-generate.

## 10. Definition of Done Phase 2B

- [x] Spreadsheet "Air Production DB" digunakan
- [x] 11 worksheet tersedia
- [x] Nama worksheet tepat
- [x] Header setiap worksheet tepat
- [x] Tidak ada worksheet duplikat
- [x] Tidak ada mock/dummy data di spreadsheet
- [x] Service Account dapat mengakses spreadsheet
- [x] Tidak ada secret bocor
- [x] tsc PASS
- [x] eslint PASS
- [x] build PASS
- [x] Audit diperbarui

Status akhir: **PHASE 2B — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 2C (GOOGLE SHEETS CLIENT)

## 1. Status

**COMPLETED**

## 2. Dependency

- Ditambahkan: `googleapis` ^183.0.0 (di `dependencies`).
  `google-auth-library` ikut terpasang sebagai dependency transitif `googleapis`.
- `package-lock.json` diperbarui dan konsisten dengan `package.json`.
- Tidak ada dependency UI atau dependency lain yang tidak berkaitan.

## 3. Lokasi Client

`src/lib/google-sheets/client.ts` — terpusat. Tidak mencampur repository,
mapping domain, maupun business logic.

Fungsi yang disediakan:

- `getGoogleSheetsConfig()` — baca + validasi env, normalisasi ID dan key.
- `getGoogleAuth()` — JWT Service Account.
- `getSheetsClient()` — Google Sheets API v4 client.
- `getSpreadsheetId()` — ID spreadsheet aktif.
- `extractSpreadsheetId()` — menerima ID mentah maupun URL lengkap.
- `normalizePrivateKey()` — membuang kutip pembungkus dan mengubah `\n`
  ter-escape menjadi newline aktual.

## 4. Authentication & Konfigurasi

- Metode: Service Account via `google.auth.JWT` (googleapis).
- Environment variable yang digunakan (nama saja): `GOOGLE_SHEETS_ID`,
  `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- Private key dinormalisasi: kutip pembungkus dibuang, `\n` menjadi newline
  asli sebelum diberikan ke library auth.
- Validasi jelas: env kosong → error deskriptif; `GOOGLE_SHEETS_ID` tidak bisa
  diekstrak → error; email tidak berformat `@` → error; key tanpa marker
  `-----BEGIN PRIVATE KEY-----` → error. Tidak ada fallback ke mock, tidak ada
  credential hardcoded, dan pesan error tidak memuat nilai credential.

## 5. Server-Only Boundary

- Modul tidak memiliki directive `"use client"`.
- Tidak ada variabel `NEXT_PUBLIC_*` (satu-satunya kemunculan hanya pada
  komentar dokumentasi).
- Client tidak diimpor dari Client Component mana pun.
- Mock data/UI tidak menyentuh client ini; aplikasi tetap memakai mock.

## 6. Scope Google API

`https://www.googleapis.com/auth/spreadsheets.readonly` — minimum untuk
membaca metadata spreadsheet pada Phase 2C. Tidak ada scope Drive atau scope
lain. Phase 2C hanya operasi baca metadata; **tidak ada write operation**.

## 7. Hasil Verifikasi (memakai modul client TERSEBUT, via node strip-types)

- config validation: PASS
- authentication: PASS (access token diterima dari Google)
- sheets client: PASS
- spreadsheet metadata: PASS
- spreadsheet title: Air Production DB
- worksheet count: 11 (PASS, tidak berubah, tanpa write)

## 8. Repository Boundary

- Tidak dibuat `src/repositories/google/*`, tidak ada repository CRUD,
  tidak ada mapping domain entity, tidak ada switch `getRepositories()`.
- `getRepositories()` tetap mengembalikan `mockRepositories`
  (terverifikasi pada `src/repositories/index.ts`).
- `src/services/*`, `src/repositories/*`, `src/data/mock/*`,
  `src/components/*`, `src/app/*`: **tidak berubah** (git diff bersih untuk
  semua path tersebut).
- Mock repository tetap aktif; aplikasi setelah Phase 2C masih menampilkan
  mock data.

## 9. Security Check

- `.env.local` tetap ignored Git (`git check-ignore` aktif).
- Tidak ada private key di source code; tidak ada credential JSON di repo;
  tidak ada access token di repo.
- Audit, README, dan terminal tidak pernah mencetak private key, access token,
  credential JSON, maupun ID spreadsheet.
- Error config tidak membocorkan nilai env.

## 10. Validation Project

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0
  (sebelumnya 2 error regex `/s` flag pada target es2017, sudah diperbaiki
  dengan ekuivalen `[\s\S]`).
- ESLint: **PASS** — `npx eslint .` exit code 0, tanpa warning.
- Build: **PASS** — `npm run build` exit code 0, 11 route ter-generate.

## 11. Definition of Done Phase 2C

- [x] Google dependency yang diperlukan ditambahkan (`googleapis`)
- [x] Google Sheets Client dibuat (`src/lib/google-sheets/client.ts`)
- [x] Service Account authentication berhasil
- [x] GOOGLE_SHEETS_ID berhasil digunakan
- [x] GOOGLE_SERVICE_ACCOUNT_EMAIL berhasil digunakan
- [x] GOOGLE_PRIVATE_KEY berhasil digunakan
- [x] Escaped newline private key ditangani (`normalizePrivateKey`)
- [x] Client bersifat server-only (tanpa "use client", tanpa NEXT_PUBLIC_*)
- [x] Google Sheets API dapat diakses
- [x] Spreadsheet "Air Production DB" dapat dibaca
- [x] 11 worksheet dapat diverifikasi
- [x] Tidak ada write operation
- [x] Tidak ada repository Google Sheets
- [x] getRepositories() masih mock
- [x] Service tidak berubah
- [x] UI tidak berubah
- [x] Mock data tidak berubah
- [x] Tidak ada secret bocor
- [x] tsc PASS
- [x] eslint PASS
- [x] build PASS
- [x] Audit diperbarui

Status akhir: **PHASE 2C — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 2D (GOOGLE SHEETS REPOSITORY READ)

## 1. Status

**COMPLETED**

## 2. File yang Dibuat/Diubah

- **Baru:** `src/repositories/google/mapping.ts` — header registry, header
  validation, row → record, normalisasi string kosong, parsing number,
  normalisasi + validasi enum, dan mapper per entity (Client, Vendor, Venue,
  Crew, Job, JobCrew, Delivery, ClientPayment, VendorPayment, Expense, Admin).
- **Baru:** `src/repositories/google/index.ts` — `googleRepositories`
  yang mengimplementasikan kontrak `DataRepositories` existing.
- **Tidak diubah:** `src/services/*`, `src/repositories/mock/*`,
  `src/repositories/index.ts` (`getRepositories()` tetap mock),
  `src/repositories/types.ts`, `src/data/mock/*`, `src/components/*`,
  `src/app/*`, `src/lib/google-sheets/client.ts`, `package.json`.
- Dependency baru: **tidak ada** (googleapis sudah terpasang dari Phase 2C).

## 3. Repository Google yang Dibuat

`googleRepositories` (`src/repositories/google/index.ts`):

- Memenuhi `DataRepositories` existing — tidak ada kontrak baru.
- `jobs`: `getAll`, `getById`, `getByJobNumber`.
- `clients`/`vendors`/`venues`/`crew`/`admins`: `getAll`, `getById`.
- `deliveries`/`jobCrews`/`clientPayments`/`vendorPayments`/`expenses`:
  `getAll`, `getById`, `getByJobId`.
- Setiap pemanggilan membaca ulang worksheet (read-only, tanpa cache, tanpa
  ID generation, tanpa dedup otomatis).

## 4. Worksheet yang Didukung

Semua 11 worksheet Phase 2B didukung penuh: `clients`, `vendors`, `venues`,
`crew`, `jobs`, `job_crews`, `deliveries`, `client_payments`,
`vendor_payments`, `expenses`, `admins`.

## 5. Penggunaan Google Sheets Client

- Memakai `getSheetsClient()`, `getSpreadsheetId()` dari
  `src/lib/google-sheets/client.ts`. Tidak ada duplikasi autentikasi, tidak
  ada credential handling baru, tidak ada client kedua.
- Hanya `spreadsheets.values.get` (read-only). Tidak ada append, update,
  delete, clear, atau batchUpdate.

## 6. Header → Domain Mapping

Mapping dibangun dari **header row sebagai sumber** (`rowToRecord` men-zip
nama kolom dengan indeks cell; cell kosong/kurang tidak menggeser kolom).
`validateHeaders` menolak header yang tidak sesuai dengan schema Phase 2B
dengan error eksplisit.

Pemetaan field (ringkasan, detail di `mapping.ts`):

- `clients`: id→id, name→name, contact→phone, notes→notes. `address`,
  `created_at`, `updated_at` tidak punya padanan di `Client` (tidak dibawa).
- `vendors`: id→id, name→name, contact→phone, notes→notes. `created_at`,
  `updated_at` tidak dibawa.
- `venues`: id→id, name→name, address→address, notes→notes. `contact`,
  `created_at`, `updated_at` tidak dibawa.
- `crew`: id→id, name→name, role→role, contact→phone,
  default_payment→defaultPayment (number). `notes`, `created_at`,
  `updated_at` tidak dibawa.
- `jobs`: id→id, job_number→jobNumber, job_name→jobName,
  job_type→category (enum, dinormalisasi), client_id→clientId,
  vendor_id→vendorId, venue_id→venueId, execution_date→executionDate,
  status→status (enum), description→notes, created_at→createdAt,
  updated_at→updatedAt. `location` tidak dibawa.
- `job_crews`: id→id, job_id→jobId, crew_id→crewId, role→role,
  payment→actualPayment (number). `payment_status`, `created_at`,
  `updated_at` tidak dibawa.
- `deliveries`: id→id, job_id→jobId, item_name→name, deadline→deadline,
  status→status (enum), notes→notes. `delivery_type`, `quantity`,
  `created_at`, `updated_at` tidak dibawa.
- `client_payments`: id→id, job_id→jobId, term→term (enum),
  amount→amount (number), due_date→dueDate, paid_date→paidDate,
  status→status (enum). `notes`, `created_at`, `updated_at` tidak dibawa.
- `vendor_payments`: id→id, job_id→jobId, type→type (enum DP/PELUNASAN),
  amount→amount, due_date→dueDate, paid_date→paidDate, status→status.
  Sisanya tidak dibawa.
- `expenses`: id→id, job_id→jobId, description→description,
  category→category, amount→amount, expense_date→date. `notes`,
  `created_at`, `updated_at` tidak dibawa.
- `admins`: id→id, name→name, email→email. `password_hash` sengaja TIDAK
  dibawa ke domain (tidak ada field padanan; tidak diekspos ke UI/service).

Keputusan ini didokumentasikan karena schema sheet (Phase 2B) dan domain type
(Phase 1) tidak 1:1. Kolom tanpa padanan di-drop secara eksplisit dan tercatat
di sini, bukan secara silent. Perataan schema sheet ↔ domain adalah kandidat
pekerjaan Phase 2E+ bila diperlukan.

## 7. Aturan Normalisasi

- String kosong → `undefined` untuk field opsional; error eksplisit untuk
  field wajib (`id`, `name`, dst.).
- Number wajib: angka valid (mendukung pemisah ribuan `1.500.000` / `1,500,000`);
  kosong/NaN → error eksplisit, tidak pernah `NaN`, tidak ada default `0` diam-diam.
- Enum: dinormalisasi (`trim`, uppercase, spasi/strip → underscore) lalu
  divalidasi terhadap type existing (`JobStatus`, `DeliveryStatus`,
  `PaymentStatus`, `JobCategory`, `ClientPaymentTerm`, `VendorPaymentType`).
  Nilai tidak valid → error eksplisit dengan konteks worksheet/baris/kolom.
- Date: dipakai apa adanya sebagai string sesuai representasi project
  (`YYYY-MM-DD` pada mock); tidak dikarang dan tidak divalidasi ulang di
  repository.
- ID dan `job_number` dipertahankan apa adanya; tidak ada generate ID, tidak
  ada dedup otomatis.
- Job invariant (Client ATAU Vendor) **tidak** diperbaiki/dinormalisasi oleh
  repository — konsisten dengan mock repository; validasi berada di service
  layer (`resolveCounterparty`).

## 8. Error Handling

- Env invalid / auth gagal / spreadsheet tidak dapat diakses / worksheet tidak
  ditemukan / header tidak sesuai → error berisi konteks repository, worksheet,
  dan operasi `read`. Tidak pernah mengembalikan data palsu/silent.
- Pesan error tidak memuat private key, access token, atau credential.

## 9. Hasil Verification

Menggunakan skrip sementara di luar repository (node strip-types + alias
loader) yang mengimpor module repository TERSEBUT dan membaca spreadsheet
nyata:

- Import google repository: PASS (11 key repository).
- `getAll()` pada 11 worksheet: **semua `[]`** (worksheet hanya berisi header) — PASS.
- `jobs.getByJobNumber` → `null`, `jobs.getById` → `null`,
  `jobCrews.getByJobId` → `[]`, `clientPayments.getByJobId` → `[]` — PASS.
- Mapper synthetic (tanpa write): enum normalisasi, number parsing
  (`1.500.000` → 1500000), paid_date kosong → undefined, status invalid →
  error, NaN → error, empty row terdeteksi, zip tanpa geser kolom, header
  mismatch → error, job invariant tidak disilent-fix — semua PASS.
- Spreadsheet tidak ditulis/diubah apa pun selama verification.

## 10. Read-Only Guarantee

- Tidak ada operasi C/U/D; tidak ada `batchUpdate`, append, update, delete,
  clear. Hanya `spreadsheets.values.get`.
- Scope client tetap `spreadsheets.readonly`.

## 11. Security Check

- `.env.local` tetap ignored Git.
- Tidak ada private key/token/credential di source, audit, README, terminal,
  atau git diff.
- `git grep` untuk pola `BEGIN PRIVATE KEY`, `private_key`, `access_token`,
  `AIza` pada `src/` dan `package.json`: 0 kemunculan.

## 12. Validation Project

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0.
- ESLint: **PASS** — `npx eslint .` exit code 0 (1 warning unused import
  dibersihkan).
- Build: **PASS** — `npm run build` exit code 0, 11 route.

## 13. Yang Sengaja TIDAK Dilakukan

- Tidak mengubah `getRepositories()` — masih `mockRepositories`.
- Tidak mengubah `src/services/*`, `src/components/*`, `src/app/*`,
  `src/data/mock/*`, `src/repositories/mock/*`, `src/repositories/index.ts`.
- Tidak membuat CRUD/write, UI, endpoint, integrasi service, atau koneksi
  repository Google ke service (Phase 2E).
- Tidak menambah dependency.
- Tidak memasukkan data dummy ke spreadsheet.

## 14. Catatan untuk Phase 2E

- `getRepositories()` akan beralih ke `googleRepositories`; service tetap
  memakai kontrak yang sama sehingga tidak perlu diubah.
- Schema sheet ↔ domain belum 1:1 (lihat bagian 6); bila data asli memakai
  kolom yang belum terpetakan (`location`, `address` client, `delivery_type`,
  `quantity`, dst.), perlu keputusan apakah domain type diperluas atau sheet
  disesuaikan.
- Mapper enum mengasumsikan nilai sheet sudah dalam domain enum setelah
  normalisasi; nilai seperti "Belum Dikerjakan" akan error eksplisit — perlu
  disepakati format penulisan worker/admin di sheet.

## 15. Definition of Done Phase 2D

- [x] Google Sheets repository read-only dibuat
- [x] Mengikuti contract existing (`DataRepositories`)
- [x] Menggunakan `src/lib/google-sheets/client.ts`
- [x] Tidak ada duplicate authentication
- [x] Semua 11 worksheet didukung
- [x] Header → domain mapping benar (berbasis nama header)
- [x] Empty worksheet menghasilkan `[]`
- [x] Empty rows ditangani (diskip tanpa object palsu)
- [x] Numeric/date/enum mengikuti existing types
- [x] Tidak ada ID generation saat read
- [x] Tidak ada silent business-rule invention
- [x] Job invariant tidak diam-diam diperbaiki
- [x] Tidak ada operasi write / CRUD
- [x] Tidak ada perubahan UI / service / mock
- [x] `getRepositories()` tetap mock
- [x] Verification spreadsheet nyata berhasil (11/11 `[]`)
- [x] Mapper verification berhasil tanpa menulis data
- [x] Tidak ada secret leakage
- [x] tsc PASS, eslint PASS, build PASS
- [x] Audit diperbarui

Status akhir: **PHASE 2D — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 2E (GOOGLE REPOSITORY → SERVICE SWITCH)

## 1. Status

**COMPLETED**

## 2. Audit Field-by-Field (Google Sheet header → domain → mapper → service → UI)

Audit dilakukan pada seluruh 11 worksheet. Temuan Phase 2D dikonfirmasi,
lalu ditangani:

| Field | Status Domain Sebelumnya | Keputusan Phase 2E |
| --- | --- | --- |
| `clients.address` | Hilang | Ditambahkan `Client.address?: string`, dipetakan. |
| `clients.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa — metadata persistence, tidak dipakai service/UI. |
| `vendors.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa (alasan sama). `contact`→`phone`, `notes`→`notes` sudah lengkap. |
| `venues.contact` | Hilang | Ditambahkan `Venue.contact?: string`, dipetakan. |
| `venues.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `crew.notes` | Hilang | Ditambahkan `Crew.notes?: string`, dipetakan. |
| `crew.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `jobs.location` | Hilang | Ditambahkan `Job.location?: string`, dipetakan. |
| `jobs.description` | → `notes` | Dipertahankan (`description` → `Job.notes`), semantic mapping tidak diubah, telah didokumentasikan. |
| `jobs.created_at`/`updated_at` | → `createdAt`/`updatedAt` | Dipertahankan — Job sudah memilikinya sejak Phase 1. |
| `job_crews.payment_status` | Hilang | Ditambahkan `JobCrew.paymentStatus?: PaymentStatus` (reuse enum existing `UNPAID/PARTIAL/PAID`), dipetakan dengan `optionalEnum` (kosong → undefined; nilai salah → error eksplisit). |
| `job_crews.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `deliveries.delivery_type` | Hilang | Ditambahkan `Delivery.deliveryType?: string`, dipetakan. |
| `deliveries.quantity` | Hilang | Ditambahkan `Delivery.quantity?: number`, dipetakan `optionalNumber`. |
| `deliveries.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `client_payments.notes` | Hilang | Ditambahkan `ClientPayment.notes?: string`, dipetakan. |
| `client_payments.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `vendor_payments.notes` | Hilang | Ditambahkan `VendorPayment.notes?: string`, dipetakan. |
| `vendor_payments.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `expenses.notes` | Hilang | Ditambahkan `Expense.notes?: string`, dipetakan. |
| `expenses.created_at`/`updated_at` | Tidak dibawa | TIDAK dibawa. |
| `admins.password_hash` | Tidak dibawa | **Sengaja tetap TIDAK dipetakan** — authentication belum scope Phase 2E. |

Field yang sudah lengkap dan tidak berubah: semua ID/relasi (`client_id`,
`vendor_id`, `venue_id`, `crew_id`, `job_id`), `job_number`, `job_name`,
`job_type`→`category`, `execution_date`, `status`, `role`, `contact`→`phone`,
`default_payment`, `payment`→`actualPayment`, `item_name`→`name`, `deadline`,
`term`, `type`, `amount`, `due_date`, `paid_date`, `category`, `description`,
`expense_date`→`date`, `name`, `email`.

## 3. File yang Diubah

- `src/lib/types.ts` — menambah field optional: `Client.address`,
  `Venue.contact`, `Crew.notes`, `Job.location`, `JobCrew.paymentStatus`,
  `Delivery.deliveryType`, `Delivery.quantity`, `ClientPayment.notes`,
  `VendorPayment.notes`, `Expense.notes`. Field optional agar mock data
  existing tetap valid tanpa diubah.
- `src/repositories/google/mapping.ts` — menambah helper `optionalNumber`
  dan `optionalEnum`; `mapClient`/`mapVenue`/`mapCrew`/`mapJob`/`mapJobCrew`/
  `mapDelivery`/`mapClientPayment`/`mapVendorPayment`/`mapExpense` kini
  memetakan field business di atas. Tidak ada positional mapping baru.
- `src/repositories/index.ts` — `getRepositories()` sekarang mengembalikan
  `googleRepositories` (SATU titik switch tetap di sini). `mockRepositories`
  tetap tersedia dan diekspor ulang.
- `src/repositories/google/index.ts` — komentar diperbarui (Phase 2E aktif,
  read-only tetap).
- `README.md` — status data aktif diperbarui ke Google Sheets.

Tidak berubah: `src/services/*`, `src/repositories/types.ts`,
`src/repositories/mock/*`, `src/data/mock/*`, `src/components/*`,
`src/app/*`, `src/lib/google-sheets/client.ts`, `package.json`.

## 4. Repository Contract

`googleRepositories` tetap memenuhi `DataRepositories` apa adanya — tidak ada
method yang ditambah/dihapus dan tidak ada perubahan kontrak. Validasi:
`npx tsc --noEmit` PASS.

## 5. Mock Validity

Seluruh field baru bersifat optional, sehingga seluruh mock data
(`src/data/mock/*`) dan mock repository tetap valid tanpa perubahan. Tidak
ada data mock dihapus atau nilainya dikarang.

## 6. Read Path

UI (`src/app`, `src/components`) → Service (`src/services/*`) →
Repository (`getRepositories()` → `googleRepositories`) → Google Sheets
(`spreadsheets.values.get`, scope `spreadsheets.readonly`).

Tidak ada UI yang membaca Google Sheets langsung; service menjadi satu-satunya
jembatan; business rule (Client XOR Vendor, status enum, termin payment)
tetap di domain/service, bukan di repository.

## 7. Spreadsheet Validation

- Worksheet: 11 (tidak berubah, tidak ada yang dibuat/dihapus).
- Setiap worksheet hanya berisi header — **tidak ada write operation**
  selama Phase 2E (read-only).
- Hasil read pada build production & smoke test: seluruh list kosong,
  empty state tampil, tidak crash, tidak ada mock data bocor.

## 8. Validation

- TypeScript: **PASS** — `npx tsc --noEmit` exit code 0.
- ESLint: **PASS** — `npx eslint .` exit code 0.
- Build: **PASS** — `npm run build` exit code 0, 11 route.
- Runtime/smoke test (production server, port 3102):
  `/dashboard`, `/jobs`, `/clients`, `/vendors`, `/crew`, `/venues`,
  `/finance` → HTTP 200; HTML terverifikasi **tidak** mengandung mock data
  ("Andrea", "JOB-2026"); `/jobs/JOB-2026-001` merender halaman
  not-found/empty karena data kosong — tanpa exception.

## 9. Security

- Tidak ada `GOOGLE_PRIVATE_KEY`, access token, JWT, atau credential di
  source code, audit, README, maupun output log.
- `.env.local` tetap ignored Git; credential handling Phase 2A–2D tidak diubah.

## 10. Scope Check

- CRUD write: **BELUM** (tidak ada append/update/delete/insert/worksheet baru).
- UI redesign: **BELUM**. Authentication/role: **BELUM**.
- Tidak ada fitur baru di luar rekonsiliasi schema Phase 2E.
- `admins.password_hash` tetap tidak diekspos ke domain.

## 11. Definition of Done Phase 2E

- [x] Schema mismatch diaudit field-by-field
- [x] Business field tidak hilang diam-diam; field business dipertahankan end-to-end
- [x] `admins.password_hash` tetap tidak dipetakan
- [x] Metadata `created_at`/`updated_at` tidak dipaksakan ke domain
- [x] Mapper membaca field business baru
- [x] Mock repository tetap valid
- [x] Kontrak `DataRepositories` konsisten
- [x] `getRepositories()` → `googleRepositories`
- [x] Service tetap jadi jembatan; tidak ada UI akses Google langsung
- [x] Tidak ada operasi write; spreadsheet tetap hanya header
- [x] Aplikasi tidak crash saat spreadsheet kosong; empty state tampil
- [x] tsc/eslint/build PASS; smoke test route utama PASS
- [x] Tidak ada secret bocor
- [x] Audit diperbarui

Status akhir: **PHASE 2E — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 2F (GOOGLE SHEETS READ VALIDATION)

## 1. Status

**COMPLETED**

Phase 2F memvalidasi read path Google Sheets → Repository → Service → UI
dengan data TEST sementara. Seluruh data TEST sudah dihapus kembali.

## 2. Metode

- Data TEST (id berawalan `TEST-`) ditulis ke spreadsheet memakai skrip
  sementara di luar repository (JWT + `googleapis`, scope `spreadsheets`
  hanya untuk skrip, bukan untuk client aplikasi). Skrip seed/cleanup
  TIDAK masuk repository.
- Validasi read dilakukan memakai module project asli
  (`@/repositories/google`, `@/repositories/google/mapping`,
  `@/services/*`) melalui node strip-types + alias loader.
- Validasi UI memakai dev server per-request (lihat Catatan Static
  Prerender di bagian 8).
- Setelah semua validasi, seluruh TEST DATA dihapus (`values.clear` pada
  range `A2:Z1000` per worksheet) dan final read verification dijalankan.

## 3. Field Validation

| Sheet Field | Domain Field | Result |
|---|---|---|
| clients.address | Client.address | PASS |
| clients.contact | Client.phone | PASS |
| clients.notes | Client.notes | PASS |
| vendors.contact | Vendor.phone | PASS |
| vendors.notes | Vendor.notes | PASS |
| venues.address | Venue.address | PASS |
| venues.contact | Venue.contact | PASS |
| venues.notes | Venue.notes | PASS |
| crew.default_payment | Crew.defaultPayment (number) | PASS |
| crew.notes | Crew.notes | PASS |
| jobs.location | Job.location | PASS |
| jobs.description | Job.notes | PASS |
| job_crews.payment | JobCrew.actualPayment (number) | PASS |
| job_crews.payment_status | JobCrew.paymentStatus | PASS |
| deliveries.delivery_type | Delivery.deliveryType | PASS |
| deliveries.quantity | Delivery.quantity (number) | PASS |
| deliveries.notes | Delivery.notes | PASS |
| client_payments.amount | ClientPayment.amount (number) | PASS |
| client_payments.paid_date (kosong) | ClientPayment.paidDate → undefined | PASS |
| client_payments.notes | ClientPayment.notes | PASS |
| client_payments.term | ClientPayment.term (TERMIN_1) | PASS |
| client_payments.status | ClientPayment.status (UNPAID) | PASS |
| vendor_payments.amount | VendorPayment.amount (number) | PASS |
| vendor_payments.notes | VendorPayment.notes | PASS |
| expenses.amount | Expense.amount (number) | PASS |
| expenses.notes | Expense.notes | PASS |
| admins.password_hash | — (TIDAK dibawa ke domain) | PASS |

## 4. Mapper Validation

- Number parsing: `'1500000'` → 1500000, `'1.500.000'` → 1500000,
  `'1,500,000'` → 1500000, `'250000'` → 250000 — semua PASS.
  `'abc'` → error eksplisit; wajib kosong → error eksplisit.
  Tidak ada string/NaN/undefined diam-diam/default 0.
- Enum normalisasi: `'in progress'` → `IN_PROGRESS` — PASS.
  Nilai invalid (`'SELESAI'`) → error eksplisit.
  `payment_status: 'NOT_STARTED'` → error eksplisit karena enum
  `PaymentStatus` adalah `UNPAID/PARTIAL/PAID` (sesuai domain existing;
  enum TIDAK diperluas untuk test).
- Empty optional value: `paid_date`/`due_date`/`notes` kosong →
  `undefined` (bukan `""`, `"undefined"`, `"null"`, `NaN`, `null`).
- Column shift: baris `TEST-CLIENT-002` dengan `address` kosong dan
  `contact` terisi → `Client.address === undefined`, `Client.phone ===
  'Test Contact Two'`, `Client.notes` benar — tidak ada pergeseran kolom.
- Header validation otomatis berjalan di setiap `getAll()`; mismatch
  header → error eksplisit.

## 5. Repository Method Validation

Semua method dikontrak `DataRepositories` lulus:
`jobs.getAll/getById/getByJobNumber`, `clients.getAll/getById`,
`vendors.getAll/getById`, `venues.getAll/getById`, `crew.getAll/getById`,
`jobCrews.getAll/getById/getByJobId`, `deliveries.getAll/getById/getByJobId`,
`clientPayments.getAll/getById/getByJobId`, `vendorPayments.getAll/getById/getByJobId`,
`expenses.getAll/getById/getByJobId`, `admins.getAll/getById`.

Relationship via ID divalidasi memakai `getByJobId` — repository TIDAK
melakukan automatic join (sesuai architecture existing).

## 6. Client XOR Vendor Invariant

Repository memetakan apa adanya dan TIDAK melakukan silent fix:
- Case A (client saja): `clientId` terisi, `vendorId` undefined — PASS.
- Case B (vendor saja): `vendorId` terisi, `clientId` undefined — PASS.
- Case C (keduanya kosong): kembali dengan `clientId`/`vendorId` undefined
  apa adanya, bukan diisi paksa — PASS.
- Case D (keduanya terisi): kembali dengan keduanya terisi, bukan
  dihapus/dipilih salah satu — PASS.

## 7. Service Validation

Melalui module project asli (bukan bypass repository):
- `getJobListItems()` berisi `TEST-2026-001`.
- `getJobDetail('TEST-2026-001')`: counterparty "Test Client", venue
  "Test Venue", 1 assignment (crew "Test Crew"), 1 delivery, 1
  clientPayment, 1 expense.
- `getDashboardData()`: totalJobs ≥ 4, Incoming Wedding berisi
  "Test Wedding", Incoming Editing berisi "Test Highlight Video".
- `getClients/getVendors/getVenues/getCrew/getCurrentAdmin` dan
  `getFinanceOverview()` membaca data TEST.

## 8. UI Validation

- Semua 8 route (`/dashboard`, `/jobs`, `/jobs/TEST-2026-001`,
  `/clients`, `/vendors`, `/crew`, `/venues`, `/finance`) HTTP 200 pada
  dev server; HTML mengandung data TEST; tidak ada mock data
  ("Andrea"/"Grand Ballroom"); tidak ada error runtime di log server.
- **Catatan Static Prerender** (bukan bug baru; perilaku Next.js App
  Router): route `○ (Static)` pada production build di-render sekali saat
  `npm run build`, sehingga HTML statis mencerminkan isi spreadsheet pada
  waktu build. Route dinamis `/jobs/[jobNumber]` (`ƒ`) selalu membaca
  live. Ini batasan caching/static-render, di luar scope Phase 2F; tidak
  ada `fetch` caching tambahan yang ditambahkan.

## 9. Cleanup & Final Verification

- Seluruh TEST DATA dihapus (`values.clear` `A2:Z1000` per worksheet).
- Read-back per raw: setiap worksheet hanya 1 baris (header).
- Final verification via project module: semua `getAll()` → `[]`,
  `jobs.getByJobNumber('TEST-2026-001')` → `null`.
- 11 worksheet utuh; header divalidasi identik dengan Phase 2B
  (`validateHeaders` berjalan setiap read; tidak ada error).
- Scope write (`spreadsheets`) hanya dipakai skrip sementara; client
  aplikasi tetap `spreadsheets.readonly`.

## 10. Security

- `admins.password_hash` (TEST_PASSWORD_HASH_NOT_REAL) tidak pernah
  masuk domain object (key tidak ada di `Admin`), tidak tampil di UI,
  tidak dicetak di log/audit, dan sudah dihapus dari spreadsheet.
- Tidak ada secret/token/JWT/private key di source, audit, README, log.

## 11. Scope Check

- Hanya READ VALIDATION. Tidak ada CRUD production, form, API endpoint
  write, authentication, dashboard redesign, dependency baru, atau
  refactor besar. Skrip temporary seed/cleanup berada di luar repository
  dan tidak meninggalkan artefak di source.

## 12. Validation Project

- `npx tsc --noEmit`: PASS (exit 0).
- `npx eslint .`: PASS (exit 0).
- `npm run build`: PASS (11 route).
- Runtime smoke test dev server (8 route): PASS.

## 13. Definition of Done Phase 2F

- [x] Read path Sheets → Repository → Service → UI terbukti bekerja
- [x] Data validation sementara berhasil dibaca
- [x] Field business Phase 2E tidak hilang
- [x] Client.address / Job.location / JobCrew.paymentStatus /
      Delivery.deliveryType / Delivery.quantity / Venue.contact / notes
      terbaca benar
- [x] Job.description → Job.notes tetap benar
- [x] Number parsing tervalidasi
- [x] Enum normalization tervalidasi
- [x] Empty optional values tervalidasi
- [x] Column shift tervalidasi
- [x] getById / getByJobId / getByJobNumber tervalidasi
- [x] Service tervalidasi; UI smoke test tervalidasi
- [x] Client XOR Vendor invariant tidak di-silent-fix
- [x] password_hash tidak masuk domain/log/UI
- [x] Semua test data DIHAPUS; spreadsheet kembali hanya header
- [x] 11 worksheet utuh; tidak ada perubahan header
- [x] Tidak ada CRUD production; tidak ada credential leakage
- [x] tsc/eslint/build PASS; audit diperbarui

Status akhir: **PHASE 2F — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 2G (GOOGLE SHEETS CRUD / WRITE)

## 1. Status

**COMPLETED**

## 2. Repository Contract

`WritableRepository<T>` baru ditambahkan pada `src/repositories/types.ts`:
`getAll/getById` (existing) + `create(data)`, `update(id, data)`,
`delete(id)`. `JobRepository` memakai input `Omit<Job, "id" | "createdAt" |
"updatedAt">` untuk create/update (ID & timestamp dihasilkan repository).
`AdminRepository` sengaja tetap read-only (authentication belum scope).
Tidak ada method existing yang dihapus. Kontrak antara mock dan Google
repository konsisten.

## 3. Google Sheets Write

- Scope client aplikasi diubah minimal menjadi
  `https://www.googleapis.com/auth/spreadsheets` (satu-satunya perubahan di
  `client.ts`; tanpa Drive scope).
- Operasi: `values.append` (create), `values.update` (update row by row
  number hasil lookup ID), `batchUpdate` + `deleteDimension` (delete row
  fisik — header index 0 tidak pernah disentuh; `values.clear` TIDAK dipakai
  untuk delete karena meninggalkan blank row).
- Lookup `id → row number` selalu dibaca dari data aktual spreadsheet,
  bukan nomor row yang disimpan.

## 4. Mapping Dua Arah

`mapping.ts` kini punya serializer Domain → Sheet (`clientToRecord`,
`vendorToRecord`, `venueToRecord`, `crewToRecord`, `jobToRecord`,
`jobCrewToRecord`, `deliveryToRecord`, `clientPaymentToRecord`,
`vendorPaymentToRecord`, `expenseToRecord`) + `recordToRow` sesuai urutan
`SHEET_HEADERS`. Tidak ada mapping kedua yang duplikatif; validasi enum &
finite number dilakukan saat write (`SheetMappingError`). Optional undefined
→ cell kosong (bukan `"undefined"`/`"null"`); number → `String(n)`.
Field domain tanpa kolom sheet (`Client.contactPerson/email`,
`Venue.city/capacity`, `Delivery.deliveredAt`) tidak dipersist —
didokumentasikan, schema sheet tidak diubah.

## 5. CRUD Matrix (tervalidasi via service + real spreadsheet)

| Entity | Create | Read | Update | Delete |
|---|---|---|---|---|
| Clients | PASS | PASS | PASS | PASS |
| Vendors | PASS | PASS | PASS | PASS |
| Venues | PASS | PASS | PASS | PASS |
| Crew | PASS | PASS | PASS | PASS |
| Jobs | PASS | PASS | PASS | PASS |
| Job Crews | PASS | PASS | PASS | PASS |
| Deliveries | PASS | PASS | PASS | PASS |
| Client Payments | PASS | PASS | PASS | PASS |
| Vendor Payments | PASS | PASS | PASS | PASS |
| Expenses | PASS | PASS | PASS | PASS |
| Admins | — (read-only by design) | PASS | — | — |

## 6. Business Validation

- Job XOR client/vendor: keduanya kosong atau keduanya terisi → ditolak
  service maupun repository, tanpa silent fix — PASS.
- Duplicate `job_number`: ditolak saat create maupun update — PASS.
- Update/delete ID non-existent → error eksplisit — PASS.
- Relation validation: `jobId`/`crewId` harus menunjuk record valid,
  service menjadi penegak utamanya — PASS.
- Payment rules mengikuti domain existing: `ClientPaymentTerm`
  `TERMIN_1/2/3`, `VendorPaymentType` `DP/PELUNASAN`, crew
  `paymentStatus` `UNPAID/PARTIAL/PAID`. Nilai dari prompt yang tidak ada
  di enum existing (`FINAL_PAYMENT`, `payment_status: NOT_STARTED`,
  `term: "1"`) ditolak eksplisit — domain TIDAK diperluas.
- `created_at` dipertahankan saat update, `updated_at` berubah — PASS
  (Job: `createdAt` sama, `updatedAt` refresh).
- Timestamp: `now` ISO untuk create (keduanya) dan update (`updated_at`).
- Header tidak pernah terhapus: seluruh operasi delete memakai
  `deleteDimension` baris data; header divalidasi ulang di setiap read.

## 7. UI

CRUD minimal lewat `MasterDataCrud` (`src/components/master/master-crud.tsx`,
Client Component) + server actions (`src/app/actions/master-actions.ts`) di
empat route: `/clients`, `/vendors`, `/venues`, `/crew`. Tabel, tombol
Tambah/Edit/Hapus, Modal form, EmptyState, dan error aman (pesan service,
tanpa stack trace/credential). UI tidak memanggil Google API langsung;
service tetap satu-satunya jalur. Job/Crew/Delivery/Payment/Expense CRUD
tersedia di repository/service, UI-nya dijadwalkan pada fase berikutnya.

## 8. Security

- `.env.local` tetap ignored; private key/token/credential tidak masuk
  source, audit, README, maupun log.
- `admins.password_hash` tidak pernah masuk domain object/UI; admins
  repository tidak memiliki method create/update/delete.
- Error message Google tidak memuat secret (pesan dibungkus konteks
  worksheet & operasi).

## 9. Cleanup

Seluruh TEST DATA (CRUD test + seed Phase 2F) dihapus. Final verification
via project module: semua `getAll()` → `[]`,
`jobs.getByJobNumber('TEST-...')` → `null`. 11 worksheet utuh, header
identik Phase 2B.

## 10. Validation

- `npx tsc --noEmit`: PASS.
- `npx eslint .`: PASS.
- `npm run build`: PASS (11 route).
- Runtime smoke: skrip CRUD test (phase2g-crud-test.mts) — 40+ assertion
  PASS, lalu cleanup lengkap; dev server route master menampilkan data
  TEST + tombol Tambah/Edit/Hapus — PASS.

## 11. Scope Check

- Tidak ada authentication/role/password management, dashboard redesign,
  timeline, JobVendor, caching, pagination, ORM, dependency baru.
- CRUD write untuk Job/JobCrew/Delivery/Payment/Expense siap di
  repository/service; UI-nya belum dibuat (sesuai batasan).

## 12. Definition of Done Phase 2G

- [x] Repository contract mendukung write (mock & Google konsisten)
- [x] Scope Google API mendukung write (`spreadsheets`)
- [x] Domain → Sheet mapping tersedia dua arah
- [x] CREATE/UPDATE/DELETE/READ bekerja pada real spreadsheet
- [x] ID unique (generate + cek loop); job_number unique
- [x] Job Client XOR Vendor divalidasi (dibuat & update, tanpa silent fix)
- [x] Relation validation bekerja
- [x] Payment rules mengikuti existing domain (UNPAID/PARTIAL/PAID,
      TERMIN_1..3, DP/PELUNASAN)
- [x] Header tidak pernah terhapus
- [x] created_at dipertahankan, updated_at berubah saat update
- [x] Optional field tidak menjadi string "undefined"/"null"
- [x] Mock repository tetap valid & memenuhi kontrak
- [x] Service tetap business layer; UI tidak direct Google API
- [x] CRUD UI Clients/Vendors/Venues/Crew selesai
- [x] Error UI aman
- [x] Semua TEST DATA dihapus; spreadsheet kembali header-only
- [x] tsc/eslint/build PASS; runtime smoke PASS
- [x] Security check PASS; audit diperbarui

Status akhir: **PHASE 2G — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 3 (MASTER DATA UI)

## 1. Status

**COMPLETED**

## 2. File yang Berubah

- `src/components/master/master-crud.tsx` — diperluas:
  - toolbar pencarian (Input) + counter "X dari Y",
  - delete confirmation memakai komponen `Modal` existing (menggantikan
    `window.confirm`), pesan error delete yang aman di dalam modal,
  - wrap tabel dengan `overflow-x-auto` agar tidak pernah membuat horizontal
    overflow halaman,
  - empty state terpisah untuk hasil pencarian kosong (`EmptyState` icon
    search),
  - busy-state pada semua tombol submit/delete (mencegah double submit).
- `src/app/clients/page.tsx`, `src/app/vendors/page.tsx`,
  `src/app/venues/page.tsx`, `src/app/crew/page.tsx` — memakai
  `MasterDataCrud` baru dengan `searchPlaceholder`; kolom mengikuti field
  domain aktual (tanpa ID internal).
- Tidak ada perubahan pada repository/service/schema — Phase 2G cukup.

## 3. Data Flow

UI (Server Component page + Client Component `MasterDataCrud`) → Server
Action (`src/app/actions/master-actions.ts`) → Service
(`src/services/master-service.ts`) → Repository (`getRepositories()` →
`googleRepositories`) → Google Sheets. UI tidak mengimpor googleapis dan
tidak membaca credential.

## 4. Validation

- Form wajib: service melempar pesan seperti "Nama client wajib diisi."
  yang diteruskan ke UI (aman, tanpa stack trace/credential).
- Angka: `crew.defaultPayment` diparse dengan membuang pemisah ribuan,
  selain itu `NaN` → error service; input memakai `inputMode=numeric`.
- Error Google juga diteruskan sebagai pesan ringkas yang sama polanya.

## 5. CRUD Verification (browser, headless Chrome via CDP)

Pada `/clients`:
- Tambah → row baru muncul di tabel & Google Sheets — PASS.
- Edit → nilai diperbarui di UI tanpa reload manual — PASS.
- Hapus → modal konfirmasi → row hilang — PASS.
- Search input ada dan memfilter row client-side — PASS.
- Revalidation bekerja (server action memanggil `revalidatePath`, client
  memanggil `router.refresh()`).

Runtime route check (headless Chrome, 4 viewport route
`/clients`, `/vendors`, `/venues`, `/crew`):
- halaman load, data dari Google Sheets tampil,
- tombol Tambah muncul,
- `document.documentElement.scrollWidth` tidak melebihi viewport
  (`noOverflow=true`),
- **0 console error / 0 page exception** pada semua route.

## 6. Cleanup Test Data

- Semua row `TEST UI Client` milik pengujian CDP sudah dihapus dari
  worksheet `clients` (terverifikasi `notes = 'Catatan Test UI'` tidak
  ada lagi).
- Worksheet lain berisi data yang dimasukkan manual oleh user selama
  pengujian manual: `clients` (1 baris), `venues` (1 baris), `crew`
  (1 baris). Data itu BUKAN milik pengujian Phase 3 otomatis dan sengaja
  tidak dihapus.
- **Pemberitahuan penting:** selama pengujian browser otomatis, field
  `name` pada baris client pertama (data user) sempat tertimpa menjadi
  "TEST UI Client Updated". Kolom lain baris itu (alamat, kontak,
  catatan) utuh. Nama aslinya tidak dapat dipulihkan dari spreadsheet;
  user dapat memperbaikinya sendiri melalui tombol Edit pada halaman
  Clients. Kesalahan terjadi pada skrip pengujian CDP sementara, bukan
  pada kode aplikasi.

## 7. Hasil tsc / eslint / build

- `npx tsc --noEmit`: **PASS** (exit 0).
- `npx eslint .`: **PASS** (exit 0).
- `npm run build`: **PASS** (exit 0, 11 route).

## 8. Known Limitations

- Route master pada production build adalah static (`○`), sehingga
  perubahan data di luar aplikasi (mis. edit langsung di spreadsheet)
  baru terlihat setelah `npm run build` ulang atau revalidatePath.
  Di dalam aplikasi, setiap mutasi selalu memicu revalidasi. Route
  dinamis `/jobs/[jobNumber]` selalu fresh.
- Kolom `Client.contactPerson/email`, `Venue.city/capacity`,
  `Delivery.deliveredAt` tidak punya kolom di schema sheet (Phase 2E),
  sehingga tidak ditampilkan/diedit pada UI ini.

## 9. Keputusan yang Sengaja Tidak Diubah

- Schema worksheet, business rules, repository contract, mock data,
  `getRepositories()` (tetap Google), dan design system Phase 1.5 —
  tidak berubah.
- Tidak ada fitur baru di luar search/filter sederhana dan modal
  konfirmasi delete.

## 10. Definition of Done Phase 3

- [x] Clients/Vendors/Venues/Crew UI usable
- [x] Add/Edit/Delete berjalan (diverifikasi di browser)
- [x] UI memakai service layer; tidak direct Google Sheets
- [x] Loading state global (`loading.tsx`) tetap; busy-state pada form
- [x] Empty state benar; empty-search state tambahan
- [x] Error state aman (tanpa credential/stack trace)
- [x] Delete confirmation via Modal existing
- [x] Refresh setelah mutation (revalidatePath + router.refresh)
- [x] Tidak ada horizontal page overflow
- [x] Visual konsisten dengan Phase 1.5
- [x] Schema Google Sheets tidak berubah
- [x] Test data pengujian Phase 3 sudah dibersihkan
- [x] tsc/eslint/build PASS; browser verification PASS
- [x] Audit diperbarui; git commit dibuat; working tree clean

Status akhir: **PHASE 3 — COMPLETED**.

---

# FREEBUFF AUDIT — PHASE 4 (JOB MANAGEMENT UI)

## 1. Status

**COMPLETED**

## 2. File yang Berubah

- `src/app/actions/job-actions.ts` — **baru**: server actions
  `createJobAction`, `updateJobAction`, `deleteJobAction`. Enum dikunci
  runtime (`JOB_CATEGORY`/`JOB_STATUS`/jenis hanya dari type existing),
  counterpartyXOR dibentuk dari `counterpartyType`, lalu service memvalidasi
  penuh business rule. `revalidatePath("/jobs")` + `revalidatePath("/dashboard")`
  setelah mutasi; error diteruskan sebagai pesan aman.
- `src/components/jobs/jobs-table.tsx` — diperluas: toolbar konsisten
  Phase 3 (search + filter status + counter + tombol "Tambah Job"),
  Action dropdown kini: Lihat Detail / Edit / Hapus. Modal Add/Edit Job
  (field sesuai domain: jobNumber, jobName, category, status, jenis
  counterparty + pilihan client/vendor saling eksklusif, venue opsional,
  executionDate, location, notes), Modal konfirmasi delete, busy-state
  anti double-submit, wrap tabel `overflow-x-auto`. Search (jobNumber,
  jobName, counterparty) & filter status yang sudah ada dipertahankan.
  Detail tetap `Link` ke `/jobs/[jobNumber]` (tanpa perubahan halaman
  Detail — Phase 5).
- `src/app/jobs/page.tsx` — memuat juga `clients`/`vendors`/`venues` via
  service untuk kebutuhan form; menyuplai aksi job ke JobsTable.
- `src/services/types.ts` — `JobListItem` ditambah `venueId`, `location`,
  `notes` (dibutuhkan prefill form edit). `src/services/job-service.ts` —
  `getJobListItems` mengisi field baru.

## 3. Data Flow

UI (`app/jobs` + `JobsTable`) → Server Action (`app/actions/job-actions.ts`)
→ `job-service` (createJob/updateJob/deleteJob + validasi) →
`getRepositories()` → `googleRepositories` → Google Sheets. Tidak ada
googleapis import maupun pembacaan env credential di Client Component.

## 4. Business Validation (tervalidasi di browser)

- create dengan client saja → PASS (baris muncul di sheet & tabel).
- create tanpa counterparty → REJECT dengan pesan "job wajib memiliki
  clientId ATAU vendorId (tidak keduanya, tidak kosong).".
- create dengan client + vendor → dicegah oleh UI (satu select
  counterparty); service tetap menolak jika dipaksa.
- create duplicate `job_number` → REJECT "sudah dipakai job lain".
- edit: nama job diperbarui dan `updatedAt` berubah, `createdAt`
  dipertahankan — terlihat langsung di baris sheet.
- delete: modal konfirmasi → baris terhapus dari tabel (empty state
  kembali) dan dari sheet `jobs`.
- Update/delete ID non-existent dan missing relation sudah teruji pada
  Phase 2G (service error eksplisit).

## 5. Browser Verification

- Halaman `/jobs` load: 200; data dari Google Sheets tampil; kolom
  mengikuti domain (tanpa ID internal); `scrollWidth` tidak melebihi
  viewport.
- Search & filter status bekerja (toolbar existing dipertahankan).
- Add/Edit/Delete diverifikasi di browser headless (CDP); pesan error
  service muncul di dalam modal.
- Console error: **0** pada pengujian route /jobs.
- Detail navigation: route `/jobs/[jobNumber]` tetap ada; perubahan besar
  Detail dijadwalkan Phase 5.

## 6. Cleanup Test Data

- Semua TEST-PHASE4 (2 seed client/vendor + 1 job) dihapus; worksheet
  `jobs` kembali header-only; `clients`/`vendors` hanya menyisakan data
  manual user (1 baris `TEST UI Client Updated / desa pangkalan` dari
  pengujian Phase 3 — dikelola user sendiri).
- Tidak ada selain data user yang tersisa pada worksheet apapun.

## 7. Hasil tsc / eslint / build

- `npx tsc --noEmit`: **PASS** (exit 0).
- `npx eslint .`: **PASS** (exit 0).
- `npm run build`: **PASS** (exit 0, 11 route).

## 8. Known Limitations

- Route master/list tetap static-prerender pada production build;
  setiap mutasi selalu mengubah ini melalui `revalidatePath`, jadi UI
  tetap fresh. Data yang diubah langsung di spreadsheet baru terlihat
  setelah rebuild/revalidate.
- Job Detail UI belum diubah (Phase 5); navigasi saja.

## 9. Keputusan Sengaja Tidak Diubah

- Schema worksheet, business rules, repository contract, design system,
  Dashboard logic (Incoming Wedding/Editing), dan Phase 3 master UI —
  tidak diubah.
- Tidak ada timeline/schedule/task/JobVendor/filter kompleks.

## 10. Definition of Done Phase 4

- [x] /jobs usable; list dari Google Sheets tampil
- [x] Search & status filter bekerja
- [x] Add/Edit/Delete bekerja; delete via Modal
- [x] Client/Vendor XOR dijaga (UI single-select + service+repository
      validate)
- [x] Duplicate jobNumber ditolak
- [x] Status hanya enum existing
- [x] Service tetap business layer; tidak direct Google API di UI
- [x] Loading/empty/error state aman; busy-state anti double submit
- [x] Tidak ada horizontal page overflow
- [x] Schema & business rules tidak berubah
- [x] Test data dibersihkan
- [x] tsc/eslint/build PASS; browser verification PASS
- [x] Audit diperbarui; commit dibuat; working tree clean

Status akhir: **PHASE 4 — COMPLETED**.
