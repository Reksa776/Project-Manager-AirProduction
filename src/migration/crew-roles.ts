import {
  reconcileLegacyCrewRole,
  reconciliationRequired,
  type ReconciliationIssue,
  type Reconciled,
} from "@/domain/reconciliation";

/**
 * NORMALISASI CREW ROLE (P0D-1).
 *
 * Sumber: kolom `role` (string bebas) pada worksheet `crew` dan `job_crews`.
 *
 * Aturan normalisasi (deterministik saja):
 * - trim + rapikan spasi ganda;
 * - pembandingan case-insensitive (kunci = uppercase);
 * - nilai asli SELALU disimpan di metadata audit (`sourceValues`).
 *
 * Yang TIDAK dilakukan:
 * - tidak menebak sinonim/ejaan berbeda (mis. "VIDEOGRAFER" vs "VIDEOGRAPHER");
 * - tidak membuat role baru secara implisit;
 * - tidak memberi role default.
 *
 * Kamus yang dihasilkan berstatus **PROPOSED (belum disetujui)**. Migrasi hanya
 * boleh memakai kamus yang sudah disetujui (`ApprovedCrewRoleDictionary`).
 */

export interface CrewRoleSourceValue {
  value: string;
  sourceId?: string;
}

export interface ProposedCrewRole {
  /** Nama kanonik yang diajukan (hasil trim/rapi spasi dari varian pertama). */
  canonicalName: string;
  /** Kunci pembanding deterministik (uppercase, spasi tunggal). */
  normalizedKey: string;
  /** Semua nilai asli yang disatukan oleh aturan deterministik ini. */
  sourceValues: string[];
  sourceIds: string[];
  totalRows: number;
  /** `AMBIGUOUS` = mirip dengan role lain tetapi tidak identik setelah normalisasi. */
  status: "PROPOSED" | "AMBIGUOUS";
  issues: ReconciliationIssue[];
}

export interface CrewRoleDictionaryProposal {
  /** Selalu `PROPOSED_NOT_APPROVED` sampai ada konfirmasi eksplisit. */
  approvalStatus: "PROPOSED_NOT_APPROVED";
  roles: ProposedCrewRole[];
  issues: ReconciliationIssue[];
}

/** Kunci deterministik: trim, spasi tunggal, uppercase. */
export function normalizeRoleKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Levenshtein sederhana untuk mendeteksi kandidat yang mirip (bukan identik). */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current = [i, ...Array.from({ length: cols - 1 }, () => 0)];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[cols - 1] ?? 0;
}

/**
 * Kandidat ambigu: kunci berbeda yang jarak editnya ≤ 2 atau salah satu
 * merupakan bagian dari yang lain (mis. "EDITOR" vs "EDITING"). Tidak pernah
 * digabung otomatis — hanya ditandai untuk review manusia.
 */
function findAmbiguousPeers(key: string, keys: readonly string[]): string[] {
  return keys.filter(
    (other) =>
      other !== key &&
      (editDistance(key, other) <= 2 || key.includes(other) || other.includes(key)),
  );
}

const EMPTY_ROLE_CODE = "EMPTY_ROLE";

/** Mengajukan kamus crew role dari nilai-nilai role historis. */
export function proposeCrewRoleDictionary(
  values: readonly CrewRoleSourceValue[],
): CrewRoleDictionaryProposal {
  const groups = new Map<
    string,
    { displayName: string; sourceValues: Set<string>; sourceIds: string[]; totalRows: number }
  >();
  const issues: ReconciliationIssue[] = [];

  for (const entry of values) {
    const key = normalizeRoleKey(entry.value);
    if (key === "") {
      issues.push({
        code: EMPTY_ROLE_CODE,
        message: "Role crew sumber kosong; tidak dapat dipetakan tanpa keputusan manual.",
        field: "role",
      });
      continue;
    }
    const group = groups.get(key);
    if (group) {
      group.sourceValues.add(entry.value);
      group.totalRows += 1;
      if (entry.sourceId !== undefined) group.sourceIds.push(entry.sourceId);
    } else {
      groups.set(key, {
        displayName: normalizeDisplayName(entry.value),
        sourceValues: new Set([entry.value]),
        sourceIds: entry.sourceId === undefined ? [] : [entry.sourceId],
        totalRows: 1,
      });
    }
  }

  const keys = [...groups.keys()].sort();
  const roles: ProposedCrewRole[] = keys.map((key) => {
    const group = groups.get(key)!;
    const peers = findAmbiguousPeers(key, keys);
    const roleIssues: ReconciliationIssue[] = peers.map((peer) => ({
      code: "AMBIGUOUS_ROLE",
      message: `Role '${key}' mirip dengan '${peer}' tetapi tidak identik; penggabungan memerlukan keputusan manual.`,
      field: "role",
    }));
    return {
      canonicalName: group.displayName,
      normalizedKey: key,
      sourceValues: [...group.sourceValues].sort(),
      sourceIds: [...group.sourceIds].sort(),
      totalRows: group.totalRows,
      status: peers.length > 0 ? "AMBIGUOUS" : "PROPOSED",
      issues: roleIssues,
    };
  });

  return {
    approvalStatus: "PROPOSED_NOT_APPROVED",
    roles,
    issues: [...issues, ...roles.flatMap((role) => role.issues)],
  };
}

/** Kamus crew role yang SUDAH disetujui (dipakai migrasi). */
export interface ApprovedCrewRoleDictionary {
  roles: readonly { id: string; name: string }[];
  /** Bukti persetujuan (mis. tanggal/approver) — wajib diisi saat approval nyata. */
  approvedBy?: string;
}

/**
 * Resolusi role sumber → `crew_roles.id` memakai kamus yang DISETUJUI dan
 * helper P0C-1 `reconcileLegacyCrewRole` (tanpa pembuatan role implisit).
 */
export function resolveCrewRoleId(
  roleName: string,
  dictionary: ApprovedCrewRoleDictionary | undefined,
): Reconciled<{ crewRoleId: string }> {
  if (!dictionary) {
    return reconciliationRequired([
      {
        code: "ROLE_DICTIONARY_NOT_APPROVED",
        message: "Kamus crew role belum disetujui; migrasi crew/assignment tidak dapat dijalankan.",
        field: "role",
      },
    ]);
  }
  return reconcileLegacyCrewRole(roleName, dictionary.roles);
}

/** Memastikan kamus yang akan dipakai benar-benar disetujui secara eksplisit. */
export function isApprovedDictionary(
  dictionary: ApprovedCrewRoleDictionary | undefined,
): boolean {
  return (
    dictionary !== undefined &&
    dictionary.approvedBy !== undefined &&
    dictionary.approvedBy.trim() !== "" &&
    dictionary.roles.length > 0
  );
}
