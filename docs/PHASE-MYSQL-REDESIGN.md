# PHASE 0 — MySQL Redesign & Business Requirement Changes

Status: **DRAFT — MENUNGGU APPROVAL** (belum ada kode/dipendensi yang diubah)
Tanggal: 2026-10-07
Basis: audit sebelumnya (`PROJECT-AUDIT-REPORT.md`) + inspeksi kode terhadap requirement baru.

---

## 1. Current Architecture

```text
Next.js UI (App Router, Server Components + Client islands)
    ↓
Server Actions (30 fungsi, src/app/actions/*.ts)
    ↓
Services (src/services/*.ts — business rules, validasi)
    ↓
Repositories (src/repositories/types.ts — kontrak + getRepositories() switch)
    ↓
Google Sheets (googleapis, 11 worksheet, src/repositories/google/)
```

Fakta kunci hasil inspeksi:

- Data store = Google Sheets; `getRepositories()` di `src/repositories/index.ts:15` mengembalikan `googleRepositories`.
- Belum ada autentikasi; 30 server action terbuka tanpa cek izin.
- Belum ada database, migrasi, atau transaksi (Sheets = operasi baris per baris, non-atomik).
- Build/route gagal di environment ini karena kredensial Google (`GOOGLE_*`) tidak ada (audit Phase 7).
- Enam belas `package.json` dependency hanya: `next`, `react`, `react-dom`, `googleapis` (+toolchain dev).

## 2. New Architecture

```text
                    ┌───────────────┐
                    │   Next.js UI  │
                    └───────┬───────┘
                            │ Server Actions (dilindungi auth)
                    ┌───────▼───────┐
                    │    Services   │  business rules + validasi (zod)
                    │ Business Logic│
                    └───────┬───────┘
                            │ kontrak Repository (tetap)
                    ┌───────▼───────┐
                    │  Repositories │  implementasi Drizzle ORM
                    │  / Data Access│
                    └───────┬───────┘
                            │ mysql2 (connection pool)
                    ┌───────▼───────┐
                    │     MySQL     │  InnoDB, FK, CHECK, transaksi
                    └───────────────┘
```

Perubahan mendasar:

- Google Sheets **keluar dari jalur data produksi**; kode Sheets dipertahankan sampai migrasi data terverifikasi, lalu dihapus (Step 9).
- Layer UI → Actions → Services → Repository **dipertahankan**; hanya repository diganti dari Google ke Drizzle/MySQL.
- Business rules tetap di service layer (syarat 15: tidak ada SQL di komponen React).

## 3. Current Google Sheets Entities

11 worksheet — definisi header resmi di `src/repositories/google/mapping.ts:57` (`SHEET_HEADERS`):

| # | Worksheet | Header |
|---|-----------|--------|
| 1 | `clients` | id, name, address, contact, notes, created_at, updated_at |
| 2 | `vendors` | id, name, contact, notes, created_at, updated_at |
| 3 | `venues` | id, name, address, contact, notes, created_at, updated_at |
| 4 | `crew` | id, name, role, contact, default_payment, notes, created_at, updated_at |
| 5 | `jobs` | id, job_number, client_id, vendor_id, venue_id, job_name, job_type, execution_date, location, status, description, created_at, updated_at |
| 6 | `job_crews` | id, job_id, crew_id, role, payment, payment_status, created_at, updated_at |
| 7 | `deliveries` | id, job_id, item_name, delivery_type, quantity, deadline, status, notes, created_at, updated_at |
| 8 | `client_payments` | id, job_id, term, amount, due_date, paid_date, status, notes, created_at, updated_at |
| 9 | `vendor_payments` | id, job_id, type, amount, due_date, paid_date, status, notes, created_at, updated_at |
| 10 | `expenses` | id, job_id, category, description, amount, expense_date, notes, created_at, updated_at |
| 11 | `admins` | id, name, email, password_hash, created_at, updated_at |

Catatan domain (`src/lib/types.ts`) yang **tidak** tersimpan di sheet: `Client.contactPerson`, `Client.email`, `Vendor.email`, `Vendor.contactPerson` (email/contact_person tidak ada kolomnya). Field business yang sudah ada di domain: address, contact→phone, location, delivery_type, quantity, payment_status, notes.

Enum yang berlaku (sudah terdefinisi di domain, dipertahankan):

- `JobStatus` / `DeliveryStatus`: NOT_STARTED | IN_PROGRESS | COMPLETED
- `PaymentStatus`: UNPAID | PARTIAL | PAID
- `JobCategory`: WEDDING | PREWEDDING | CORPORATE | EVENT | OTHER
- `ClientPaymentTerm`: TERMIN_1 | TERMIN_2 | TERMIN_3
- `VendorPaymentType`: DP | PELUNASAN
- Expense categories (acuan UI/server): CREW | VENDOR | TRANSPORT | EQUIPMENT | OTHER
- Counterparty: `clientId` XOR `vendorId` (rule eksisting, wajib dipertahankan)

## 4. Proposed MySQL Entities

Keputusan ID: **PK = `VARCHAR(36)`**, mempertahankan ID lama sheet apa adanya untuk seluruh row hasil migrasi (memudahkan mapping & reversibel, tanpa join rewrite ID). Baris baru memakai `crypto.randomUUID()` (node:crypto, tanpa paket tambahan). Seluruh tabel InnoDB, `utf8mb4_0900_ai_ci`* , `created_at`/`updated_at` `DATETIME(3)` (updated_at `ON UPDATE CURRENT_TIMESTAMP(3)`).

> \* Server terdeteksi **MariaDB 11.8.8** (lihat §14) — collation dipakai `utf8mb4_general_ci` bila target MariaDB dikonfirmasi; keputusan final pada approval.

### 4.1 `admins` — sumber kebenaran autentikasi baru

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| name | VARCHAR(120) NOT NULL | |
| email | VARCHAR(190) NOT NULL | UNIQUE |
| password_hash | VARCHAR(255) NOT NULL | format scrypt (`scrypt$N$r$p$salt$hash`) |
| role | VARCHAR(20) NOT NULL DEFAULT 'ADMIN' | CHECK IN ('OWNER','ADMIN','STAFF') |
| is_active | BOOLEAN NOT NULL DEFAULT 1 | |
| last_login_at | DATETIME(3) NULL | |
| created_at / updated_at | DATETIME(3) | |

### 4.2 `sessions`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| admin_id | VARCHAR(36) NOT NULL | FK → admins ON DELETE CASCADE |
| token_hash | CHAR(64) NOT NULL | UNIQUE — SHA-256 dari token cookie (token mentah tidak pernah disimpan) |
| expires_at | DATETIME(3) NOT NULL | INDEX |
| created_at / last_seen_at | DATETIME(3) | |

### 4.3 `crew_roles` — normalized (Option B)

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| name | VARCHAR(60) NOT NULL | UNIQUE |
| sort_order | INT NOT NULL DEFAULT 0 | |
| is_active | BOOLEAN NOT NULL DEFAULT 1 | role lama bisa dinonaktifkan tanpa menghapus riwayat |
| created_at / updated_at | DATETIME(3) | |

Seed: Editor, Videographer, Photographer, Camera Operator, Motion Designer, Sound Engineer, Lighting, Producer, Director, Other (daftar seed, bukan enum tertutup — role dikelola dari aplikasi → layak normalized, lihat §7).

### 4.4 `clients`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | dipertahankan dari sheet |
| name | VARCHAR(120) NOT NULL | "Nama Client" |
| company_name | VARCHAR(120) NULL | **baru** — "Nama Perusahaan" |
| contact_person | VARCHAR(120) NULL | domain eksisting, belum pernah terpersist |
| phone | VARCHAR(120) NULL | "Nomor WhatsApp" ← kolom sheet `contact` |
| email | VARCHAR(190) NULL | domain eksisting, belum pernah terpersist |
| address | TEXT NULL | |
| client_type | VARCHAR(32) NULL | **baru** — "Jenis Client": INDIVIDU/PERUSAHAAN/AGENCY/LAINNYA (validasi allow-list di service, bukan ENUM MySQL agar riwayat NULL aman) |
| notes | TEXT NULL | |
| created_at / updated_at | DATETIME(3) | |

### 4.5 `vendors`

id PK, name VARCHAR(120) NOT NULL, contact_person NULL, phone NULL, email NULL, notes TEXT NULL, timestamps. (Tanpa venue, tanpa perubahan lain.)

### 4.6 `jobs`

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| job_number | VARCHAR(32) NOT NULL | **UNIQUE** — format baru `JOB-YYYY-NNNNNN`, nilai historis dipertahankan (§10) |
| job_name | VARCHAR(160) NOT NULL | |
| category | VARCHAR(20) NOT NULL | CHECK IN ('WEDDING','PREWEDDING','CORPORATE','EVENT','OTHER') |
| client_id | VARCHAR(36) NULL | FK → clients ON DELETE RESTRICT |
| vendor_id | VARCHAR(36) NULL | FK → vendors ON DELETE RESTRICT |
| — | — | **CHECK XOR**: `NOT ((client_id IS NULL) <> (vendor_id IS NULL))` |
| execution_date | DATE NOT NULL | |
| status | VARCHAR(20) NOT NULL | CHECK IN ('NOT_STARTED','IN_PROGRESS','COMPLETED') |
| location | VARCHAR(190) NULL | |
| notes | TEXT NULL | ← sheet `description` |
| legacy_venue_name | VARCHAR(190) NULL | snapshot nama venue historis; **tidak ditampilkan di UI**, kandidat drop di cleanup (§9) |
| created_at / updated_at | DATETIME(3) | |

`venue_id` sengaja **tidak** dibuat sebagai kolom FK.

### 4.7 `job_crews` — hanya relasi assignment (tanpa uang)

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| job_id | VARCHAR(36) NOT NULL | FK → jobs ON DELETE CASCADE |
| crew_id | VARCHAR(36) NOT NULL | FK → crew ON DELETE RESTRICT |
| crew_role_id | VARCHAR(36) NULL | FK → crew_roles ON DELETE SET NULL = **override per-job**; NULL berarti "ikuti role dari crew" (§7) |
| agreed_amount | DECIMAL(15,2) NOT NULL DEFAULT 0 | nilai kesepakatan (pengganti kolom `payment`) |
| notes | TEXT NULL | |

INDEX (job_id), INDEX (crew_id). Kolom `payment` dan `payment_status` lama **tidak** dipindah ke sini — uang bergerak ke cashflow, status dibaca dari cashflow (§8).

### 4.8 `crew` (master)

id PK, name VARCHAR(120) NOT NULL, crew_role_id FK → crew_roles ON DELETE RESTRICT NOT NULL, default_payment DECIMAL(15,2) NOT NULL DEFAULT 0, phone NULL, notes TEXT NULL, timestamps. Kolom `role` string bebas diganti FK role.

### 4.9 `cashflows` — **satu-satunya sumber kebenaran uang**

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| job_id | VARCHAR(36) NOT NULL | FK → jobs ON DELETE RESTRICT |
| occurred_on | DATE NOT NULL | tanggal kas |
| direction | VARCHAR(10) NOT NULL | CHECK IN ('INCOME','EXPENSE') |
| category | VARCHAR(24) NOT NULL | CHECK IN ('CLIENT_PAYMENT','CREW_PAYMENT','VENDOR_PAYMENT','TRANSPORT','EQUIPMENT','OTHER') + arah wajib cocok: CLIENT_PAYMENT hanya INCOME, sisanya hanya EXPENSE (CHECK gabungan) |
| amount | DECIMAL(15,2) NOT NULL | CHECK (amount > 0); arah disimpan di `direction` |
| description | VARCHAR(190) NOT NULL | |
| reference_type | VARCHAR(24) NULL | 'client_payment' \| 'vendor_payment' \| 'job_crew' \| NULL |
| reference_id | VARCHAR(36) NULL | **polymorphic** — FK-nya tidak bisa dibuat di DB; dijaga service layer dalam transaksi (lihat §16) |
| source | VARCHAR(16) NOT NULL DEFAULT 'MANUAL' | CHECK IN ('MANUAL','MIGRATION') — penanda row hasil migrasi, memudahkan verifikasi |
| created_at / updated_at | DATETIME(3) | |

INDEX (job_id), (occurred_on), (direction, category), (reference_type, reference_id).

### 4.10 Tabel yang sengaja TIDAK dibuat

| Tabel sheet lama | Keputusan | Alasan |
|---|---|---|
| `venues` | **dihapus** (§9) | concept dihilangkan dari bisnis |
| `expenses` | **diganti cashflows** | expense = uang keluar aktual, tanpa jadwal → duplikat sumber kebenaran. Form "Operational Expense" menulis langsung 1 row cashflow (category TRANSPORT/EQUIPMENT/OTHER) |
| `client_payments` | **tetap sebagai jadwal tagihan** (bukan kas) | termin/DP/due_date adalah data perencanaan; uang = cashflow |
| `vendor_payments` | **tetap sebagai jadwal tagihan** | sama |
| `payments` (entity terpisah) | **tidak ada** | cashflow adalah representasi pembayaran; lihat §8 |

`client_payments` / `vendor_payments` baru:

| Kolom | Tipe | Ketentuan |
|---|---|---|
| id | VARCHAR(36) PK | |
| job_id | VARCHAR(36) NOT NULL | FK → jobs ON DELETE CASCADE |
| term / type | VARCHAR(20) NOT NULL | CHECK masing-masing (TERMIN_1..3 / DP,PELUNASAN) |
| amount | DECIMAL(15,2) NOT NULL | CHECK > 0 — nominal **yang harus dibayar** |
| due_date / paid_date | DATE NULL | paid_date diisi saat kas tercatat |
| notes | TEXT NULL | timestamps |

Status pembayaran (UNPAID/PARTIAL/PAID) **tidak disimpan** — dihitung dari `SUM(cashflow)` terkait vs `amount` (§8, anti-double-count).

### 4.11 `deliveries`

id PK, job_id FK CASCADE NOT NULL, name VARCHAR(160) NOT NULL, delivery_type VARCHAR(40) NULL, quantity INT NULL CHECK >= 0, deadline DATE NOT NULL, status VARCHAR(20) CHECK IN (3 nilai), delivered_at DATE NULL, notes TEXT NULL, timestamps. (Tanpa perubahan bisnis.)

## 5. ERD

```text
admins ──< sessions

crew_roles ──< crew
            └─< job_crews >── jobs >── clients
                    │            │  └─< vendors
                    │            ├─< deliveries
                    │            ├─< client_payments ──< cashflows (direction=INCOME,
                    │            └─< vendor_payments    category=CLIENT_PAYMENT)
                    │
                    └── reference_type='job_crew' ──< cashflows (direction=EXPENSE,
                                                      category=CREW_PAYMENT)
cashflows (vendor/reference NULL)  ← vendor_payments (category=VENDOR_PAYMENT)
cashflows (manual expense)         ← category=TRANSPORT/EQUIPMENT/OTHER

(venues: TIDAK ADA — konsep dihapus)
```

Aturan arah kas:

```text
INCOME   : CLIENT_PAYMENT          ← dari client_payments (termin)
EXPENSE  : CREW_PAYMENT            ← dari job_crews (reference_type='job_crew')
           VENDOR_PAYMENT          ← dari vendor_payments
           TRANSPORT/EQUIPMENT/OTHER ← input operasional manual (pengganti tabel expenses)
```

## 6. Field Mapping (Google Sheet → MySQL)

| SHEET | MYSQL TABLE | FIELD | Transformasi |
|---|---|---|---|
| clients.id | clients.id | id | dipertahankan |
| clients.name | clients.name | name | trim, required |
| clients.address | clients.address | address | TEXT, '' → NULL |
| clients.contact | clients.phone | phone | '' → NULL (label lama "Kontak" = nomor) |
| clients.notes | clients.notes | notes | '' → NULL |
| clients.created_at/updated_at | clients.created_at/updated_at | | parse ISO/lokal → DATETIME(3); invalid → catat di laporan, jangan gagal batch |
| — | clients.company_name / email / contact_person / client_type | | **kolom baru, NULL semua** (tidak ada di sheet) |
| vendors.* | vendors.* | | sama seperti clients (contact → phone; email/contact_person baru NULL) |
| venues.id/name/address/… | — (snapshot) | jobs.legacy_venue_name ← venues.name via jobs.venue_id | venue row diarsipkan ke `docs/migration-reports/venues-archive.json` **sebelum** penghapusan fitur; sheet TIDAK dihapus |
| crew.id | crew.id | id | dipertahankan |
| crew.name | crew.name | name | |
| crew.role | crew.crew_role_id | crew_role_id | **lookup**: role string → row `crew_roles` (case-insensitive); tidak dikenal → INSERT role baru (is_active=1), catat ke laporan |
| crew.contact | crew.phone | phone | |
| crew.default_payment | crew.default_payment | | parse "1.500.000"/"1500000"/"1,500,000" → DECIMAL(15,2); gagal → 0 + laporan |
| jobs.* | jobs.* | | `job_type`→category (normalisasi enum), `description`→notes, `status`→enum, **job_number dipertahankan apa adanya** (termasuk "1", "rosdiana", "JOB-2026-001") |
| jobs.venue_id | jobs.legacy_venue_name | | JOIN ke venues.name (snapshot); venue_id menggantung → NULL + laporan orphan |
| jobs.client_id/vendor_id | jobs.client_id/vendor_id | | validasi XOR per baris; pelanggaran → baris **ditandai & dilaporkan**, tidak dijatuhkan diam-diam (approval perbaikan) |
| job_crews.job_id/crew_id | job_crews.job_id/crew_id | | FK check; menggantung → laporan orphan, row dimuat tanpa FK? **TIDAK** — row orphan tidak dimuat ke MySQL utama, dicatat di `orphans.json` (integritas MySQL dijaga) |
| job_crews.role | job_crews.crew_role_id | | **override hanya jika ≠ role crew-nya**; jika sama → NULL (ikut crew). Role tak dikenal → seed crew_roles baru |
| job_crews.payment | job_crews.agreed_amount + cashflows | | agreed_amount = nilai lama; **cashflow EXPENSE/CREW_PAYMENT dibuat HANYA bila status payment_status = PAID atau PARTIAL** — lihat kaidah ganda di §8/§18 |
| job_crews.payment_status | (dihitung) | | tidak dimigrasi; status baru diturunkan dari cashflow vs agreed_amount |
| client_payments.* | client_payments.* | | term/status enum; **cashflow INCOME/CLIENT_PAYMENT dibuat bila status = PAID atau PARTIAL**; paid_date → occurred_on kas |
| vendor_payments.* | vendor_payments.* | | sama, direction=EXPENSE |
| expenses.id… | cashflows (+source='MIGRATION') | | category CREW/VENDOR di sheet → **perlu keputusan** (§18-R3); TRANSPORT/EQUIPMENT/OTHER → cashflow manual; expense_date → occurred_on |
| deliveries.* | deliveries.* | | quantity '' → NULL; status enum |
| admins.* | admins | | `password_hash` sheet lama format hash apa? → **dipertahankan apa adanya bila format dikenali** (bcrypt/scrypt/argon2) agar login lama tetap hidup; format tak dikenal → akun dibuat nonaktif + reset password (approval) |
| — | sessions, crew_roles | | tabel baru, tidak ada padanan sheet |

Kaidah ganda (anti-double counting saat migrasi): **satu baris pembayaran lama = paling banyak satu row cashflow.** Sumber (`job_crews`/`client_payments`/`vendor_payments`) tidak lagi pernah dijumlahkan untuk Total Income/Expense — hanya `cashflows` yang dihitung (lihat §8).

## 7. Crew Role Design

Keputusan: **Option B — tabel `crew_roles` ternormalisasi.**

Alasan:

1. Requirement eksplisit: "Prefer a normalized role table if roles will be managed from the application." Rencana UI baru memang mengelola role (CRUD Crew harus memilih role, bukan mengetik bebas — saat ini field role adalah teks bebas di `src/app/crew/page.tsx`).
2. Role dipakai di dua tempat (master crew dan assignment job) → string bebas rawan inkonsistensi ("Videografer" vs "Videographer") yang merusak filter/grouping.
3. `ON DELETE SET NULL` + `is_active` menjaga riwayat job lama tetap utuh saat role dinonaktifkan.

Aturan tampilan role di assignment (sesuai requirement):

```text
tampilan role = job_crews.crew_role_id (override)  JIKA terisi
                crew.crew_role_id                  jika NULL
```

Migrasi mengisi override **hanya** bila role di sheet berbeda dari role crew-nya; jika sama → NULL. Tidak ada perubahan tampilan data lama.

## 8. Cashflow Design (anti double counting)

Model: **"keduanya, dengan cashflows sebagai sumber kebenaran uang"** (requirement §8 mengizinkan ini; ini juga yang mencegah duplikasi sumber kebenaran).

```text
Job
 └── JobCrew (agreed_amount = hutang/kesepakatan, TANPA kolom uang)
       └── Crew Payment  →  INSERT cashflows(direction=EXPENSE, category=CREW_PAYMENT,
                                             reference_type='job_crew', reference_id=<assignment>)
```

Aturan hitung (dipakai service `finance-service` baru):

```text
Total Income  = SUM(amount) WHERE direction = 'INCOME'  (dalam rentang filter)
Total Expense = SUM(amount) WHERE direction = 'EXPENSE'
Net Cashflow  = Income − Expense
Sisa tagihan client = client_payments.amount − SUM(cashflow CLIENT_PAYMENT terkait)
Status bayar crew   = SUM(cashflow CREW_PAYMENT terkait) vs job_crews.agreed_amount
                      → 0 = UNPAID, < agreed = PARTIAL, ≥ agreed = PAID
```

Kontra-ganda:

1. **Tidak ada agregasi ganda**: UI/service tidak pernah menjumlahkan `job_crews` + `cashflows` lagi (audit Phase 6 menemukan dashboard menjumlahkan `actualPayment` jobCrews **dan** `expenses` kategori CREW → berisiko ganda; model baru menghilangkan akar masalahnya).
2. Satu aksi "catat pembayaran" = satu transaksi INSERT cashflow (+ UPDATE paid_date pada jadwal tagihan). Gagal → ROLLBACK, tidak ada row kas yatim.
3. Row sumber (termin/hutang crew) tidak pernah dihitung sebagai kas.
4. Migrasi memakai `source='MIGRATION'` sehingga total hasil migrasi bisa diaudit terpisah dan diulang (idempoten) tanpa menggandakan kas.
5. `reference_type/reference_id` polimorfik dijaga di service (FK fisik tidak mungkin untuk reference polimorfik) — lihat §16.

## 9. Venue Removal Plan

Audit referensi: **139 baris di 24 file** (`app/venues/page.tsx`, `app/actions/master-actions.ts` (4 action), `app/actions/job-actions.ts` (venueId), nav `src/lib/navigation.ts:16`, `icons.tsx`, `edit-job-button.tsx`, `job-detail-tabs.tsx`, `jobs-table.tsx`, `dashboard/page.tsx`, `jobs/page.tsx`, `jobs/[jobNumber]/page.tsx`, `master-service`, `job-service`, `dashboard-service`, `repositories/{google,mock,types}`, `types.ts` (Venue), `data/mock/venues.ts`, dsb.).

Strategi berfase (non-destruktif):

```text
Fase V1  Schema MySQL: venues TIDAK dibuat; jobs.venue_id TIDAK dibuat;
         snapshot nama venue → jobs.legacy_venue_name (data historis tidak hilang)
Fase V2  Kode: hapus /venues page, nav item, 4 venue actions, VenueRepository/
         VenueService, mock venues, venueId dari job form/edit/detail/dashboard,
         venue dari icon set. (langkah ini hanya menghapus kode — sheet/DB aman)
Fase V3  Arsip: export isi worksheet `venues` → docs/migration-reports/venues-archive.json
Fase V4  Verifikasi: grep "venue" = 0 di src/, build+lint+typecheck hijau
Fase V5  (nanti, terpisah) drop kolom legacy_venue_name setelah sign-off data
```

Worksheet `venues` Google Sheets **tidak dihapus** (prinsip non-destruktif; sheet lama tetap jadi arsip).

## 10. Job Number Strategy

Format baru: **`JOB-YYYY-NNNNNN`** (contoh `JOB-2026-000001`) — sesuai usulan requirement, menyesuaikan mock lama (`JOB-2026-001`).

Mekanisme (aman konkurensi, **bukan** count+1, **bukan** random ID):

```sql
CREATE TABLE job_sequences (
  year      SMALLINT PRIMARY KEY,
  next_seq  INT NOT NULL
);
-- dalam transaksi:
SELECT next_seq FROM job_sequences WHERE year = ? FOR UPDATE;  -- row lock
UPDATE job_sequences SET next_seq = next_seq + 1 WHERE year = ?;
-- hasil: 'JOB-' || year || '-' || LPAD(seq, 6, '0')
-- baris pertama tahun itu → INSERT ... (INSERT IGNORE awal + retry bila race)
```

- Kunci baris `FOR UPDATE` menyerialisasi pembentukan nomor → aman di bawah konkurensi.
- `jobs.job_number` diberi **UNIQUE index** → pengaman terakhir di level database.
- Dibuat **server-side saja**; field input `jobNumber` dihapus dari form job (client tidak pernah mengirim nomor).
- **Nilai historis dipertahankan** ("1", "rosdiana", "JOB-2026-001" tetap sama; requirement hanya mensyaratkan format baru untuk job baru → campuran format di list adalah ekspektasi terdokumentasi).
- Prasyarat migrasi: cek duplikat `job_number` di sheet **sebelum** membuat UNIQUE index (jika ada duplikat → laporan + keputusan perbaikan = approval item R4).
- Route `/jobs/[jobNumber]` tetap valid (lookup by UNIQUE job_number).

## 11. Job Action UI Plan

Kondisi saat ini: aksi job disembunyikan di dropdown (MoreHorizontal) "Lihat Detail / Edit / Hapus" (`jobs-table.tsx:250-258`); aksi detail (crew/delivery) memakai menu teks + modal generik; belum ada "Add Payment / Change Status" yang jelas.

Rencana — **tombol eksplisit** memakai `Button` + `Modal` + `Toast` yang sudah ada (design system lokal, Tailwind v4):

| Lokasi | Tombol |
|---|---|
| Baris jobs table | **Detail** · **Edit** · **Ubah Status** · **Hapus** |
| Job detail page (header/section) | **Tambah Crew** · **Tambah Pembayaran** · **Tambah Delivery** · **Edit Job** · **Hapus Job** |

Syarat per tombol:

- Label jelas, ikon pendukung boleh tapi teks wajib.
- `loading` state ("Menyimpan…"), `disabled` selama eksekusi (tombol tidak bisa dobel-klik).
- **Hapus** → Modal konfirmasi berlabel nama job + tombol danger (pola `Hapus Job` yang sudah ada dipertahankan).
- Feedback sukses/gagal (toast/inline error) — pesan dari server.
- **Server-side**: setiap action dicek auth (session) + validasi zod sebelum menyentuh DB; delete job dalam transaksi (cascade `job_crews`/`deliveries`/jadwal bayar ikut; cashflow **RESTRICT** — job dengan riwayat kas tidak bisa dihapus tanpa keputusan eksplisit).
- `Change Status` = modal pilihan 3 status job (aturan transisi status tetap mengikuti aturan lama; jika ada aturan transisi yang tidak terdefinisi di kode lama → semua transisi diizinkan, dicatat di §18).

## 12. Client Form Design

Kondisi saat ini: client memakai `MasterDataCrud` generik (modal dengan field name/address/phone/notes — `src/app/clients/page.tsx`); field email/company/jenis tidak ada.

Bentuk baru: **halaman form terstruktur gaya Google Forms** (`/clients/new`, `/clients/[id]/edit`) — kartu satu kolom, section header, bukan clone produk Google:

```text
┌─ Client Information ────────────────────────────┐
│  Nama Client *        [________________]        │
│  Nama Perusahaan      [________________]        │
│  Email                [________________]        │
│  Nomor WhatsApp       [________________]        │
│  Alamat               [________________]        │
│                        (textarea, auto-grow)    │
│  Jenis Client         [ Pilih ▾ ]               │
│                       INDIVIDU/PERUSAHAAN/AGENCY│
│                       /LAINNYA (opsional)       │
│  Catatan              [________________]        │
│                        (textarea)               │
│                 [ Simpan Client ]               │
└─────────────────────────────────────────────────┘
```

Field = **persis** isi requirement, diturunkan dari model Client eksisting (tidak menambah field di luar daftar):

| Field | Wajib | Validasi (client + server, zod) |
|---|---|---|
| Nama Client | ya | string, 1–120 char |
| Nama Perusahaan | tidak | ≤120 char |
| Email | tidak | format email, ≤190 |
| Nomor WhatsApp | tidak | pola telepon (`+`, spasi, `-`, digit, 8–20 digit) |
| Alamat | tidak | ≤500 char |
| Jenis Client | tidak | allow-list 4 nilai |
| Catatan | tidak | ≤2000 char |

Syarat: label ter-`<label htmlFor>` benar (audit lama menemukan `inputId` bisa undefined → perbaikan), error per-field dengan `aria-invalid` + `aria-describedby`, `required` marker, state loading saat submit, pesan sukses + redirect ke list, layout mobile (colom tunggal, tap target cukup), server-side validation wajib (return field errors, jangan trust client).

Daftar client tetap memakai tabel list yang ada + tombol "Tambah Client" → form baru.

## 13. Authentication Strategy

```text
admins (MySQL) ── password scrypt (node:crypto, tanpa paket tambahan)
      ↓ login
sessions row: token acak 32 byte → cookie httpOnly/sameSite=lax/secure(prod)
      ↓ tiap request server
cari session via SHA-256(token) → cek expires_at → attach admin
      ↓
authorization: cek role di SETIAP server action (fail = throw, bukan diam-diam)
```

- Sumber kebenaran user = **MySQL** (syarat 13) — tidak ada lagi dependensi Sheets untuk auth.
- Hash: **scrypt** bawaan Node (`crypto.scrypt`, format `scrypt$N$r$p$salt$hash` + timing-safe compare) → **0 dependency** (argon2/bcrypt = native build; jose tidak diperlukan karena token disimpan ter-hash di DB, bukan ditandatangani).
- Cookie: `httpOnly`, `sameSite=lax`, `secure` di prod, path `/`, `maxAge` = sesi (mis. 7 hari).
- Logout = hapus row sessions + clear cookie.
- Authorisation minimal dulu: role OWNER/ADMIN/STAFF + `is_active` (permission granular = future, di luar scope Phase 0).
- Rate limiting login & sanitasi pesan error (dari audit) ikut Step 11.
- Migrasi admin: hash sheet lama dibawa bila format dikenali (§6); jika tidak → reset password terjadwal.

## 14. ORM / Database Package Decision

### DATABASE STACK DECISION

```text
Database           : MySQL (target requirement) — server terdeteksi MariaDB 11.8.8
                     di 127.0.0.1:3306, database `database-airprod` sudah ada & KOSONG.
                     Kredensial sudah ada di .env (DATABASE_URL, perlu unquote saat dibaca).
                     → approval item R1: MariaDB 11.8 (sekarang) vs MySQL 8/9 via Docker.

ORM / Query Builder : Drizzle ORM + drizzle-kit (+ mysql2 sebagai driver)

Reason             : TypeScript-first tanpa codegen/binary engine (Prisma membawa
                     engine + codegen; Prisma 8 masih RC saat audit ini) — cocok
                     dengan repository pattern yang sudah ada: Drizzle hanya hidup di
                     layer repository, services tetap murni domain.
                     Mendukung transaksi (db.transaction), FK/CHECK via SQL migrasi,
                     dan drizzle-kit menghasilkan file SQL migrasi yang bisa direview
                     di git (repeatable/auditable = syarat §15).

Migration system    : drizzle-kit generate → file SQL di `drigrations/` + `drizzle-kit migrate`
                     (idempoten, tracked di tabel __drizzle_migrations)

Validation          : zod 4 (skema dipakai di client & server action)

Authentication      : session table MySQL + cookie httpOnly + hash SHA-256(token)
                     + password scrypt (node:crypto) — tanpa paket auth

Testing             : vitest + @testing-library/react + user-event + jest-dom + jsdom
                     (DB test jalan terhadap skema terpisah `airprod_test`)
```

Paket yang akan dipasang (**hanya ini**, belum dipasang — menunggu approval):

| Paket | Type | Versi saat audit | Untuk |
|---|---|---|---|
| `drizzle-orm` | deps | ^0.45.3 | akses DB |
| `mysql2` | deps | ^3.24.5 | driver (peer Drizzle) |
| `drizzle-kit` | dev | ^0.31.11 | migrasi/schema |
| `zod` | deps | ^4.6.5 | validasi |
| `vitest` | dev | ^5.0.3 | test runner |
| `jsdom` | dev | ^30.1.2 | DOM env test |
| `@testing-library/react` | dev | ^16.3.3 | component test |
| `@testing-library/user-event` | dev | ^14.6.7 | interaksi |
| `@testing-library/jest-dom` | dev | ^7.0.1 | matcher |

Tidak dipasang: Prisma (alasan di atas), argon2/bcrypt (scrypt cukup), jose (tidak perlu JWT), ORMs ganda.

`googleapis` **tetap** dipasang sampai Step 9 (migrasi data selesai & terverifikasi), lalu dihapus setelah approval terpisah.

## 15. Migration Strategy (data Sheets → MySQL)

Peta sebelum coding (syarat 11) — **§6 di dokumen ini adalah peta field-nya.** Langkah:

```text
M1  Snapshot   : export 11 worksheet → JSON mentah (docs/migration-reports/snapshot-*.json)
                 (butuh GOOGLE_* creds — LIHAT RISK R2: tidak ada di env ini)
M2  Schema     : drizzle-kit generate → apply ke database-airprod (DB masih kosong → aman)
M3  Transform  : skrip sekali-pakai scripts/migrate-sheets-to-mysql.ts
                 - baca via repository Google lama (mapping lama = sumber kebenaran)
                 - terapkan §6 (enum, tanggal, uang, ID, XOR, role→crew_roles)
                 - row orphan/duplikat/invalid → JSON laporan, TIDAK dimuat diam-diam
                 - batch per tabel, FK order: clients/vendors/crew_roles → crew →
                   jobs → job_crews/deliveries/jadwal bayar → cashflows
                 - idempoten: upsert by legacy id + source='MIGRATION' (bisa diulang)
M4  Verify     : laporan perbandingan Sheets vs MySQL (syarat 12):
                   row count per tabel, jumlah job/client/crew, relasi (job_crews,
                   deliveries), TOTAL FINANSIAL: income, expense, net, total
                   client_payments/vendor_payments/agreed crew, expense per kategori
                 Selisih wajib = 0 atau tercatat eksplisit di "documented differences"
M5  Sign-off   : laporan di-review sebelum pemindahan jalur produksi
M6  Flip       : getRepositories() → mysqlRepositories (Sheets jadi read-only cadangan)
M7  Hapus      : (Step 9, approval terpisah) buang googleapis & kode google repo
```

Sifat migrasi: **repeatable** (idempoten by id + source flag), **verifiable** (laporan M4), **non-destruktif** (Sheets tidak pernah ditulis/dihapus), **reversible** (MySQL bisa di-drop; snapshot JSON + sheet lama = rollback penuh).

## 16. Data Integrity Strategy

- FK dengan perilaku eksplisit:
  - uang/anak transaksi → `ON DELETE RESTRICT` (job dengan riwayat kas tidak bisa hilang diam-diam; client/vendor yang dipakai job tidak bisa dihapus);
  - data turunan non-finansial → `CASCADE` (`job_crews`, `deliveries`, jadwal bayar);
  - role dinonaktifkan → `SET NULL` (riwayat utuh).
- **CHECK di DB** (MariaDB 10.2+/MySQL 8): XOR client/vendor, arah+kategori kas, amount > 0, allow-list status/kategori — invariant tidak lagi bergantung pada service saja.
- UNIQUE: `jobs.job_number`, `admins.email`, `crew_roles.name`, `sessions.token_hash`.
- ID varchar(36) dipertahankan dari sheet untuk semua row migrasi (mapping stabil, rollback gampang); ID baru = UUID v4.
- Reference polimorfik (`reference_type/reference_id`) dijaga service **dalam transaksi yang sama** dengan insert kas; invariant "satu aksi bayar = satu baris kas" diuji unit test.
- Orphan/duplikat dari sheet ditangkap di M3 (tidak dimuat; dilaporkan) — MySQL selalu konsisten.
- Decimal uang: `DECIMAL(15,2)` (bukan FLOAT).

## 17. Transaction Strategy

| Operasi | Transaksi |
|---|---|
| Create job (auto number) | `SELECT ... FOR UPDATE` job_sequences → INSERT job → COMMIT; gagal → ROLLBACK (nomor boleh "bolong", tidak pernah ganda) |
| Catat pembayaran client | INSERT cashflow (INCOME) + UPDATE jadwal termin (paid_date/drift check) → COMMIT/ROLLBACK |
| Catat pembayaran crew | INSERT cashflow (EXPENSE/CREW_PAYMENT, reference job_crew) → COMMIT/ROLLBACK |
| Catat pembayaran vendor | INSERT cashflow (EXPENSE/VENDOR_PAYMENT) + UPDATE jadwal → COMMIT/ROLLBACK |
| Catat expense operasional | INSERT cashflow saja (tunggal, tetap dibungkus transaksi) |
| Update job + relasi | transaksi tunggal |
| Delete job | transaksi: cek cashflow RESTRICT → hapus cashflow? **TIDAK otomatis** (minta konfirmasi eksplisit) → hapus children (CASCADE) → COMMIT |
| Migrasi batch | transaksi per batch kecil (mis. 200 row), gagal → rollback batch, lanjut batch lain, laporan akhir |

`db.transaction(...)` dari Drizzle di repository (service tidak tahu SQL, tetap memanggil repo interface — transaksi dijalankan pada boundary repo/service call yang sesuai, keputusan final saat implementasi Step 5/6).

## 18. Risks

| ID | Risiko | Dampak | Mitasi |
|---|---|---|---|
| R1 | Server = **MariaDB 11.8.8**, requirement menulis "MySQL" | kompatibel wire, ada beda minor (collation, sintaks) | skript dirancang portabel; atau jalur Docker MySQL 8/9 — **butuh approval** |
| R2 | **Kredensial Google tidak ada di env ini** (audit Phase 7) → Sheets tidak terbaca → Step M1/M3 mentok | migrasi data tidak bisa dijalankan/disini | butuh GOOGLE_* creds atau file export dari owner; semua kode migrasi tetap bisa dibangun & diuji dengan fixture |
| R3 | **Konflik ganda uang lama**: `expenses.category='CREW'` DAN `job_crews.payment` sama-sama mewakili uang crew (dashboard lama menjumlahkan keduanya → berisiko ganda) | angka total berubah setelah migrasi | migrasi: expense category CREW dicocokkan ke assignment (job_id+nominal) → jadi reference; sisa yang tak cocok jadi CREW_PAYMENT tanpa reference + masuk daftar "documented differences"; **butuh approval** |
| R4 | Duplikat `job_number` / langgar XOR / orphan FK di sheet historis | UNIQUE/CHECK gagal saat load | pre-flight check M3; pelanggar → laporan + perbaikan per keputusan owner (approval) |
| R5 | Job number lama campur format baru | tampilan list tidak seragam | diterima & didokumentasi (requirement hanya job baru) |
| R6 | `admins.password_hash` format lama tidak dikenal | login lama mati | reset password terjadwal (approval) |
| R7 | Perubahan status bayar dari stored → derived | perilaku UI kecil berbeda | unit test status UNPAID/PARTIAL/PAID |
| R8 | Polimorfik reference tanpa FK | integrity bergantung service | wajib dalam transaksi + unit test |
| R9 | Lokasi port 3306 terisi instance multi-DB milik environment | salah target DB | gunakan DATABASE_URL persis (`database-airprod`); test pakai `airprod_test`; **jangan sentuh DB lain** |
| R10 | 24 file / 139 baris berbau venue dihapus sekaligus | regresi UI | fase V1–V4 + grep gate + lint/typecheck/build |

## 19. Implementation Order (mengikuti syarat §16, diterjemahkan konkret)

```text
Step 1  ✅ Audit existing vs requirement baru   → dokumen ini (Phase 0)
Step 2  DESAIN skema MySQL (§4–§5)             → dokumen ini, menunggu approval
Step 3  PILIH stack (§14)                      → Drizzle + mysql2 + zod + vitest
Step 4  Migrasi skema: drizzle-kit generate + migrate (DB kosong, aman)
Step 5  Implementasi repository MySQL (kontrak src/repositories/types.ts TIDAK berubah)
Step 6  Services terhadap MySQL + transaksi + aturan lama dipertahankan (XOR dll.)
Step 7  Skrip migrasi data Sheets → MySQL (§15 M1–M3)
Step 8  Verifikasi data (§15 M4–M5) — total harus cocok / terdokumentasi
Step 9  Flip getRepositories() → MySQL; (setelah sign-off) hapus googleapis
Step 10 Requirement bisnis baru:
          a. crew_roles + UI Crew (role dropdown)     (§7)
          b. crew payment → cashflow                  (§8)
          c. hapus Venue (fase V1–V4)                 (§9)
          d. auto job number + hapus input manual     (§10)
          e. tombol aksi Job eksplisit                (§11)
          f. form Client gaya Google-Forms            (§12)
Step 11 Auth + authz server-side terhadap MySQL (§13) + rate limit + pesan error aman
Step 12 Verifikasi penuh: typecheck, lint, build, test vitest (unit + DB), laporan M4 final
```

Preservasi aturan lama (syarat 17): Client XOR Vendor (kini juga CHECK di DB), aturan PaymentStatus (kini derived tapi semantik sama), JobStatus/DeliveryStatus tetap terpisah, kategori/termin/DP tetap, semua pesan & label UI Bahasa Indonesia. **Konflik yang ditemukan dilaporkan (R3, R7, §6 job_crews role) — tidak dipilih diam-diam.**

## 20. Items Requiring Approval

1. **R1** — Target DB: MariaDB 11.8 sekarang (dipakai) vs naik ke MySQL 8/9 Docker.
2. **Stack** — Drizzle + mysql2 + zod + vitest (daftar paket §14, 9 paket) — pasang sekarang?
3. **Skema** — 13 tabel baru: `admins, sessions, crew_roles, crew, clients, vendors, jobs, job_crews, cashflows, client_payments, vendor_payments, deliveries, job_sequences` — tanpa `venues`, tanpa `expenses`.
4. **Model keuangan** — cashflows = satu-satunya sumber Total Income/Expense; `client_payments`/`vendor_payments` tetap sebagai jadwal tagihan; status bayar jadi derived.
5. **R3** — Perlakuan row `expenses.category = CREW/VENDOR` historis (cocokkan ke reference vs documented difference).
6. **Venue** — snapshot ke `jobs.legacy_venue_name` + arsip JSON; drop kolom di cleanup terpisah.
7. **Job number** — format `JOB-YYYY-NNNNNN` + `job_sequences`; nilai historis dipertahankan.
8. **R2** — kredensial Google/export diperlukan untuk migrasi data (Step 7/8); tanpa itu, Step 7–8 tertunda.
9. **R4/R6** — strategi perbaikan data kotor (duplikat job_number, langgar XOR, hash admin tak dikenal).
10. **Google Sheets removal** — hanya setelah verifikasi M4 sign-off (Step 9, approval terpisah).
