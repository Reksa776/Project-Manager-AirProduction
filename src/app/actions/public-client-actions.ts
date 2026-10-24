"use server";

import { revalidatePath } from "next/cache";

import { createClient, deleteClient } from "@/services/master-service";
import { createJob } from "@/services/job-service";

export type PublicClientFormResult = { ok: true } | { ok: false; error: string };

export async function submitPublicClientForm(
  values: Record<string, string>,
): Promise<PublicClientFormResult> {
  try {
    if (values.website?.trim()) {
      return { ok: false, error: "Formulir tidak dapat dikirim. Silakan coba lagi." };
    }

    const cpw = values.cpw?.trim() ?? "";
    const cpp = values.cpp?.trim() ?? "";
    const cpwNickname = values.cpwNickname?.trim() ?? "";
    const cpwInstagram = values.cpwInstagram?.trim() ?? "";
    const cppNickname = values.cppNickname?.trim() ?? "";
    const cppInstagram = values.cppInstagram?.trim() ?? "";
    const phone = values.phone?.trim() ?? "";
    const address = values.address?.trim() ?? "";
    const notes = values.notes?.trim() ?? "";
    const eventDate = values.eventDate?.trim() ?? "";
    const packageId = values.packageId?.trim() ?? "";

    if (cpw.length < 2 || cpp.length < 2 || cpw.length > 120 || cpp.length > 120) {
      return { ok: false, error: "Nama lengkap kedua pengantin wajib diisi (2–120 karakter)." };
    }
    if (address.length < 3) {
      return { ok: false, error: "Silakan isi alamat acara." };
    }
    if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      return { ok: false, error: "Silakan pilih tanggal acara." };
    }
    if (!packageId) return { ok: false, error: "Silakan pilih paket acara." };
    if (address.length > 500 || notes.length > 5000 || phone.length > 120 || cpwNickname.length > 120 || cpwInstagram.length > 120 || cppNickname.length > 120 || cppInstagram.length > 120) {
      return { ok: false, error: "Satu atau beberapa isian melebihi batas karakter." };
    }
    const client = await createClient({
      name: cpw,
      cpw: cpw || undefined,
      cpp: cpp || undefined,
      cpwNickname: cpwNickname || undefined,
      cpwInstagram: cpwInstagram || undefined,
      cppNickname: cppNickname || undefined,
      cppInstagram: cppInstagram || undefined,
      phone: phone || undefined,
      address: address || undefined,
      notes: notes || undefined,
      eventDate,
      packageId,
    });

    try {
      await createJob({
        jobName: `Pernikahan: ${cpw} & ${cpp}`.slice(0, 160),
        category: "WEDDING",
        clientId: client.id,
        packageId,
        executionDate: eventDate,
        status: "NOT_STARTED",
        location: address,
        notes: notes || undefined,
      });
    } catch (error) {
      await deleteClient(client.id);
      throw error;
    }

    revalidatePath("/clients");
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Data belum dapat disimpan. Silakan coba lagi." };
  }
}
