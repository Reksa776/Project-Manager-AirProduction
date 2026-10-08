# PHASE 1 — MySQL Foundation & Database Schema

Status dokumen Phase 0: `docs/PHASE-MYSQL-REDESIGN.md` (DRAFT — APPROVED FOR PHASE 1).

---

## 1. Status

```text
PASS WITH LIMITATIONS
```

Seluruh exit criteria kritis terpenuhi (lihat §30). Keterbatasan yang tersisa
eksplisit dan tidak memblokir Phase 2 (lihat §10).

---

## 2. Packages Installed

Dependencies:

| Package | Version |
| --- | --- |
| `drizzle-orm` | 0.45.3 |
| `mysql2` | 3.24.5 |
| `zod` | 4.6.5 |

Dev dependencies:

| Package | Version |
| --- | --- |
| `drizzle-kit` | 0.31.11 |
| `vitest` | 5.0.3 |
| `jsdom` | 30.1.2 |
| `@testing-library/react` | 16.3.3 |
| `@testing-library/user-event` | 14.6.7 |
| `@testing-library/jest-dom` | 7.0.1 |

Catatan:

- `@types/node` naik `^20` → `^24.19.1` (kompatibilitas tooling test/db).
- `npm run` scripts ditambahkan: `test`, `db:generate`, `db:migrate`, `db:check`.
- Tidak ada package terlarang yang dipasang (prisma, argon2, bcrypt, jose,
  next-auth, auth.js, upstash — semua tidak ada).
- Node tetap `v24.21.0`, npm `10.9.9` (tidak diubah).

---

## 3. Database

```text
host:     127.0.0.1:3306
database: database-airprod
server:   11.8.8-MariaDB
```

- Password/credentials TIDAK pernah dicetak ke output.
- Koneksi diambil dari `DATABASE_URL` di `.env` (divalidasi oleh `src/db/env.ts`,
  tidak ada credential hardcode di source code).
- Database test terpisah: `airprod_test` (dibuat otomatis oleh test setup,
  tidak menyentuh `database-airprod`).

---

## 4. Schema

13 tabel (dikonfirmasi via `SHOW TABLES` di `database-airprod`):

```text
admins
sessions
crew_roles
crew
clients
vendors
jobs
job_crews
cashflows
client_payments
vendor_payments
deliveries
job_sequences
```

Tabel yang TIDAK dibuat (sesuai scope):

```text
venues, expenses, payment, payments  → tidak ada
```

Struktur source:

```text
src/db/
  index.ts          # getDb()/closeDb(), mysql2 pool, server-only, UTC
  env.ts            # getDatabaseUrl() — validasi DATABASE_URL, fail-loud
  schema/
    _shared.ts      # timestamps() — created_at/updated_at datetime(3) UTC
    admins.ts
    sessions.ts
    crew-roles.ts
    crew.ts
    clients.ts
    vendors.ts
    jobs.ts
    job-crews.ts
    cashflows.ts
    client-payments.ts
    vendor-payments.ts
    deliveries.ts
    job-sequences.ts
    index.ts        # barrel
```

Field client sesuai approved list: `name`, `company_name`, `contact_person`,
`phone`, `email`, `address`, `client_type`, `notes` — tidak lebih.

Venue: hanya `jobs.legacy_venue_name` (snapshot historis). Tidak ada
`venues` table, tidak ada `jobs.venue_id`.

---

## 5. Migration

```text
drizzle/0000_magical_true_believers.sql
drizzle/meta/0000_snapshot.json
drizzle/meta/_journal.json
```

- Deterministik dan reviewable (dihasilkan `drizzle-kit generate`).
- Tidak berisi credentials, tidak berisi production data.
- Sudah di-apply ke `database-airprod` (database saat itu kosong / 0 tabel —
  tidak ada data existing yang dihancurkan).
- `drizzle-kit check` → `Everything's fine`.
- Catatan: clause `ON UPDATE CURRENT_TIMESTAMP(3)` pada `updated_at` ditambahkan
  manual ke SQL migration karena builder `datetime` drizzle-orm 0.45 tidak
  menyediakan `onUpdateNow()` (lihat `src/db/schema/_shared.ts`).

---

## 6. Constraints

Semua diverifikasi lewat `SHOW CREATE TABLE` (bukan hanya dari file migration).

### PK

- 12 tabel: `id VARCHAR(36)` (UUID via `crypto.randomUUID()` untuk record baru;
  ID lama dipertahankan saat migrasi Sheets nanti).
- `job_sequences`: PK `year SMALLINT` (deviasi disengaja, kunci sekuens per-tahun).

### UNIQUE

- `uq_admins_email` — admins.email
- `uq_sessions_token_hash` — sessions.token_hash
- `uq_crew_roles_name` — crew_roles.name
- `uq_jobs_job_number` — jobs.job_number

### FK & delete behavior

| Relasi | ON DELETE |
| --- | --- |
| sessions → admins | CASCADE |
| crew → crew_roles | RESTRICT |
| jobs → clients | RESTRICT |
| jobs → vendors | RESTRICT |
| cashflows → jobs | RESTRICT |
| job_crews → jobs | CASCADE |
| job_crews → crew | RESTRICT |
| job_crews → crew_roles | SET NULL |
| deliveries → jobs | CASCADE |
| client_payments → jobs | CASCADE |
| vendor_payments → jobs | CASCADE |

(Catatan: untuk `RESTRICT`, MariaDB tidak menampilkan clause `ON DELETE` di
`SHOW CREATE TABLE` karena RESTRICT adalah default; perilaku RESTRICT diverifikasi
oleh test.)

### CHECK

- `chk_jobs_client_vendor_xor` — `(client_id is null) <> (vendor_id is null)`
- `chk_jobs_category`, `chk_jobs_status`
- `chk_cashflows_amount_positive` — `amount > 0`
- `chk_cashflows_direction` — `INCOME | EXPENSE`
- `chk_cashflows_category` — allow-list 6 kategori
- `chk_cashflows_direction_category` — invariant INCOME↔CLIENT_PAYMENT,
  EXPENSE↔(CREW_PAYMENT|VENDOR_PAYMENT|TRANSPORT|EQUIPMENT|OTHER)
- `chk_cashflows_reference` — reference_type/id wajib berpasangan
- `chk_cashflows_source` — `MANUAL | MIGRATION`
- `chk_client_payments_amount_positive`, `chk_client_payments_term`
- `chk_vendor_payments_amount_positive`, `chk_vendor_payments_type`
- `chk_job_crews_agreed_amount` — `>= 0`
- `chk_deliveries_quantity`, `chk_deliveries_status`
- `chk_admins_role`

MariaDB 11.8 mendukung seluruh CHECK di atas (termasuk ekspresi XOR `< >`
dan invariant direction/category) — semua CHECK diimplementasikan sebagai CHECK
di database, bukan hanya service layer.

### Decimal & timestamp

- Uang: `decimal(15,2)` (cashflows.amount, *_payments.amount, crew.default_payment,
  job_crews.agreed_amount).
- Waktu: `datetime(3)` (presisi milidetik), `date` untuk tanggal murni.
- Index: `idx_cashflows_occurred_on`, `idx_cashflows_direction_category`,
  `idx_cashflows_reference`, `idx_sessions_expires_at`.

### Timezone

- Seluruh DATETIME disimpan sebagai **UTC**.
- Setiap koneksi mysql2 menyetel `time_zone = '+00:00'` (lihat `src/db/index.ts`),
  sehingga `DEFAULT CURRENT_TIMESTAMP(3)` dan `ON UPDATE CURRENT_TIMESTAMP(3)`
  selalu UTC.
- Driver memakai `dateStrings: true` → tanpa konversi timezone ambigu.
- `updated_at` terbukti berubah saat record di-update (test otomatis).

---

## 7. Tests

`npm run test` (Vitest, environment node) — **22/22 PASS**.

| Area | Hasil |
| --- | --- |
| connection (app → Drizzle → MariaDB, target `airprod_test`, UTC) | PASS |
| insert (master → job → assignment → cashflow) | PASS |
| FK (child ke parent tidak ada ditolak) | PASS |
| CHECK XOR kedua arah (NULL+NULL, client+vendor) | PASS |
| CHECK amount ≤ 0 | PASS |
| CHECK direction/category invariant | PASS |
| CHECK lain (category, source, reference, quantity) | PASS |
| UNIQUE job_number duplikat | PASS |
| RESTRICT (client/job/crew tidak bisa dihapus) | PASS |
| CASCADE (job dihapus → child non-finansial ikut) | PASS |
| transaction ROLLBACK (A+B tidak tersisa) | PASS |
| transaction COMMIT | PASS |
| updated_at otomatis | PASS |
| job_sequences per tahun | PASS |

Test berjalan HANYA di `airprod_test` (setup: guard DATABASE_URL →
`database-airprod` → create `airprod_test` → drop tabel test → apply migration).
Database produksi tidak pernah disentuh oleh test.

---

## 8. Existing App Compatibility

- Google repository **tetap menjadi active production data source**.
- `getRepositories()` TIDAK diubah.
- `git diff --name-only` hanya menunjuk `package.json` dan `package-lock.json`
  sebagai file tracked yang berubah. Tidak ada perubahan pada UI, Server Actions,
  Google repositories, auth, venue/client/finance/job UI.
- Semua file baru bersifat additive: `src/db/**`, `drizzle/**`, `tests/**`,
  `drizzle.config.ts`, `vitest.config.ts`, `docs/**`.
- `npm run build` gagal **hanya** karena `GOOGLE_SHEETS_ID` belum tersedia
  saat prerender (existing Google runtime dependency) — bukan failure MySQL
  foundation. TypeScript compile dalam build tetap `Finished TypeScript ...`.
  Tidak dibuat fake Google credentials.

---

## 9. Google Migration

```text
NOT STARTED
```

Alasan: Google credentials (`GOOGLE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEETS_ID`) belum tersedia.
Tidak ada attempt migrasi Sheets → MySQL, tidak ada fake credentials,
tidak ada perubahan data source production.

---

## 10. Known Limitations

1. **Build hijau bergantung Google credentials** — `next build` gagal di tahap
   prerender karena `GOOGLE_SHEETS_ID` kosong (dependency lama, bukan Phase 1).
   Memerlukan credentials asli; fake value sengaja tidak dibuat.
2. **`updated_at ON UPDATE` manual di SQL migration** — drizzle-orm 0.45 tidak
   punya `onUpdateNow()` untuk `datetime`. Jika migration di-regenerate,
   clause ini harus diperiksa ulang.
3. **`job_sequences` PK `year SMALLINT`** — deviasi dari aturan umum
   `VARCHAR(36)` PK. Deviasi ini disengaja (kunci sekuens per-tahun) dan
   bukan data hasil migrasi.
4. **Assertion error DB membaca `error.cause`** — drizzle membungkus error
   MySQL sebagai `DrizzleQueryError`; helper `rejectsWith()` di test membaca
   pesan wrapper + cause untuk memvalidasi nama constraint.
5. **Zod hanya foundation** — 30 Server Actions belum di-refactor ke Zod
   (Phase validation berikutnya).
6. **Tabel auth (`admins`, `sessions`) kosong** — hanya schema; login/auth
   diimplementasikan di Phase auth.
7. **`job_sequences` kosong, generator belum ada** — generator
   `JOB-YYYY-NNNNNN` dibuat di Phase business logic (bukan Phase 1).
8. **File Phase 1 belum di-commit ke git** — seluruh perubahan siap direview
   (`git status`), commit dilakukan setelah review.
9. **`npm ls` menampilkan beberapa package `extraneous`** — transitive leftover
   dari instalasi, tidak digunakan langsung dan tidak ditambahkan ke package.json.

---

## 11. Next Phase

```text
PHASE 2 — MySQL Repository Implementation
```

Isi yang direkomendasikan: implementasi repository interface atas Drizzle
(`src/repositories/mysql/**`), pertahanan Google repository sebagai fallback/
aktif sampai data migration selesai, lalu Phase berikutnya: data migration
Sheets → MySQL setelah credentials tersedia.
