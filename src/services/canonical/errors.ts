/**
 * Error batas service kanonik (Contract v2).
 *
 * Dipakai untuk kesalahan ORKESTRASI/composisi yang tidak berasal dari
 * repository (mis. detail job yang diminta tidak ada). Kesalahan validasi
 * field/referensi tetap memakai error repository kanonik
 * (`RepositoryError`/`RepositoryNotFoundError`) supaya tidak ada dua jenis
 * pesan untuk aturan yang sama.
 */
export class CanonicalServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalServiceError";
  }
}
