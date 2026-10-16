# Air Production — Panduan Penggunaan

Panduan ini mengikuti fitur dan menu yang tersedia saat ini. Data aplikasi disimpan di Supabase PostgreSQL.

## 1. Menyiapkan aplikasi

Pastikan `DATABASE_URL` Supabase terisi di `.env` lokal atau environment server. Terapkan schema dan role crew:

```bash
npm run db:check
npm run db:migrate
npm run db:seed
npm run dev
```

Buka `http://localhost:3000`. Saat database belum memiliki akun, aplikasi mengarahkan ke `/setup`.

## 2. Membuat akun dan masuk

1. Pada halaman **Create Owner account**, masukkan nama, email kerja, dan password minimal 8 karakter.
2. Akun pertama mendapat role Owner dan langsung masuk ke dashboard.
3. Setelah akun tersedia, gunakan email dan password di halaman **Login**.
4. Gunakan menu **Sign out** di bagian profil untuk keluar. Halaman internal akan meminta login kembali.

Setup Owner hanya berlaku sebelum akun admin pertama dibuat. Saat ini belum ada halaman untuk membuat akun admin tambahan atau reset password.

## 3. Mengisi data klien

1. Masuk ke menu **Clients**.
2. Klik **Open Form** untuk membuka formulir publik di `/client-form`.
3. Bagikan alamat form tersebut kepada klien. Form meminta nama, CPW, CPP, nomor HP, alamat acara, dan catatan.
4. Klien mengirim form dengan tombol **Save Client**.
5. Kiriman muncul di tabel **Client Submissions** pada menu Clients.

Form publik hanya mengumpulkan data diri dan informasi lokasi/catatan. Paket dipilih oleh tim internal saat membuat Job.

## 4. Mengelola paket

1. Buka **Packages**, lalu klik **Add**.
2. Isi nama paket, deskripsi, urutan tampil, dan status Active.
3. Paket aktif tersedia untuk dipilih di form Job. Paket yang sudah dipakai sebaiknya dinonaktifkan daripada dihapus.

## 5. Membuat dan mengelola Job

1. Buka **Jobs** lalu klik **Add Job**.
2. Isi nama job, kategori, status, tipe pihak (**Client** atau **Vendor**) dan pilih pihaknya.
3. Pilih paket bila diperlukan, tentukan **Event Date** lewat kalender, kemudian isi lokasi dan catatan.
4. **Job Number dibuat otomatis** saat disimpan dan tidak perlu diisi manual.
5. Gunakan **View** untuk membuka detail job. **Edit** memperbarui informasi, dan **Delete** menghapus job bila tidak lagi diperlukan.
6. Tombol **Download Excel** mengunduh daftar job yang tersedia.

Di halaman detail Job:

- **Overview**: ringkasan job, tanggal, nilai pemasukan, pengeluaran, kewajiban, dan net.
- **Crew**: tambahkan anggota crew, role, dan nominal kesepakatan. Catat pembayaran crew dari baris crew tersebut; pembayaran masuk ke Cashflow sebagai pengeluaran job.
- **Delivery**: tambahkan deliverable, tenggat, dan status (Not Started, In Progress, Completed). Tenggat diisi lewat kalender. Data ini ditampilkan pada Project Monitoring di Overview dashboard.
- **Schedules & Cashflow**: atur jadwal pembayaran klien/vendor dan catat pembayaran aktual.
- **Expense**: catat biaya operasional yang terkait dengan job.

## 6. Mengelola vendor dan crew

- **Vendors**: tambah nama vendor, kontak/nomor telepon, email, dan catatan. Pilih vendor sebagai pihak pada Job bila pekerjaan terkait vendor.
- **Crew**: role Editor dan Videographer disediakan oleh seed. Tambah crew dengan role dan default payment; nominal aktual disepakati lagi pada Job.
- **Crew Role**: tambah role khusus, ubah urutan atau statusnya. Role harus aktif untuk digunakan pada crew.

## 7. Mengelola Finance

1. Buka **Finance**.
2. Tambahkan **Client Billing Schedule** atau **Vendor Payment Schedule** untuk mencatat kewajiban, jumlah, tanggal jatuh tempo, dan catatan. Jadwal bukan pembayaran aktual.
3. Gunakan form pembayaran klien/vendor untuk mencatat tanggal dan jumlah yang benar-benar diterima/dibayar.
4. Catat **Operating Expenses** untuk biaya umum; Job boleh dikosongkan jika biaya tidak terkait satu job.
5. Lihat **Cashflow** sebagai ledger pergerakan uang. Status pembayaran dijumlahkan dari transaksi aktual.
6. **Download Excel** mengunduh workbook dengan sheet Cashflow, Client Schedules, Vendor Schedules, dan Summary.

Jadwal pembayaran bisa diedit, tetapi tidak tersedia aksi hapus dari UI. Cashflow adalah catatan aktual dan tidak dapat diedit atau dihapus dari UI.

## 8. Membaca Dashboard

- Kartu ringkasan menunjukkan total Job, Not Started, In Progress, dan Completed.
- **Upcoming Weddings** menunjukkan job kategori wedding mendatang berdasarkan Event Date.
- **Project Monitoring** menampilkan deliverable dari semua job, deadline, dan status. Pilih nama proyek untuk membuka detail Job.

## Catatan operasional

- Menu internal memerlukan akun login. Form `/client-form` ditujukan untuk klien dan tidak memerlukan login.
- Sebelum menggunakan database baru atau setelah ada perubahan schema, jalankan migrasi dengan `DATABASE_URL` yang menunjuk ke Supabase yang benar.
- File laporan Excel memakai format `.xls` yang dapat dibuka di Microsoft Excel dan aplikasi spreadsheet kompatibel.
- Saat ini UI punya sebagian label berbahasa Inggris dan Indonesia.
