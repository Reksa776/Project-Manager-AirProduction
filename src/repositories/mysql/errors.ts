/**
 * Error types untuk repository MySQL.
 *
 * Semua error database (constraint, koneksi) DITERUSKAN apa adanya agar
 * pemanggil (service/test) dapat membedakannya. Hanya kondisi domain-level
 * yang dibungkus dengan tipe di file ini.
 */

/** Error umum repository MySQL (validasi/adapter, bukan error driver). */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

/** Record tidak ditemukan saat update/delete (semantik sama dengan repo Google). */
export class RepositoryNotFoundError extends RepositoryError {
  constructor(entity: string, id: string) {
    super(
      `Repository MySQL: record pada '${entity}' dengan id '${id}' tidak ditemukan.`,
    );
    this.name = "RepositoryNotFoundError";
  }
}

/**
 * Konflik idempotensi: kunci yang sama dipakai ulang dengan payload berbeda.
 * Request identik boleh di-replay (mengembalikan baris yang sama); payload yang
 * berbeda pada kunci yang sama HARUS gagal eksplisit.
 */
export class RepositoryConflictError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryConflictError";
  }
}

/**
 * Operasi ditolak karena record masih dirujuk oleh catatan finansial
 * (mencegah orphan / kontradiksi ledger).
 */
export class RepositoryInUseError extends RepositoryError {
  constructor(entity: string, id: string, reason: string) {
    super(
      `Repository MySQL: '${entity}' dengan id '${id}' tidak dapat diubah/dihapus: ${reason}`,
    );
    this.name = "RepositoryInUseError";
  }
}

/**
 * Method repository yang tidak dapat dipetakan ke skema MySQL tanpa
 * mengubah aturan bisnis. Selalu melempar — TIDAK ada fallback diam-diam
 * (tidak mengembalikan array kosong / sukses palsu).
 */
export class RepositoryBlockedError extends RepositoryError {
  constructor(
    public readonly entity: string,
    public readonly reason: string,
  ) {
    super(`Repository MySQL '${entity}' diblokir: ${reason}`);
    this.name = "RepositoryBlockedError";
  }
}
