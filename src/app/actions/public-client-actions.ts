"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/services/master-service";

export type PublicClientFormResult = { ok: true } | { ok: false; error: string };

export async function submitPublicClientForm(
  values: Record<string, string>,
): Promise<PublicClientFormResult> {
  try {
    if (values.website?.trim()) {
      return { ok: false, error: "Formulir tidak dapat dikirim. Silakan coba lagi." };
    }

    const name = values.name?.trim() ?? "";
    const cpw = values.cpw?.trim() ?? "";
    const cpp = values.cpp?.trim() ?? "";
    const phone = values.phone?.trim() ?? "";
    const address = values.address?.trim() ?? "";
    const notes = values.notes?.trim() ?? "";

    if (name.length < 2 || name.length > 120) {
      return { ok: false, error: "Nama harus terdiri dari 2 sampai 120 karakter." };
    }
    if (address.length < 3) {
      return { ok: false, error: "Silakan isi alamat acara." };
    }
    if (address.length > 500 || notes.length > 5000 || cpw.length > 120 || cpp.length > 120 || phone.length > 120) {
      return { ok: false, error: "Satu atau beberapa isian melebihi batas karakter." };
    }
    await createClient({
      name,
      cpw: cpw || undefined,
      cpp: cpp || undefined,
      phone: phone || undefined,
      address: address || undefined,
      notes: notes || undefined,
    });

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Data belum dapat disimpan. Silakan coba lagi." };
  }
}
