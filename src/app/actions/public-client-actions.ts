"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/services/master-service";

export type PublicClientFormResult = { ok: true } | { ok: false; error: string };

export async function submitPublicClientForm(
  values: Record<string, string>,
): Promise<PublicClientFormResult> {
  try {
    if (values.website?.trim()) {
      return { ok: false, error: "The form could not be submitted. Please try again." };
    }

    const name = values.name?.trim() ?? "";
    const address = values.address?.trim() ?? "";
    const notes = values.notes?.trim() ?? "";

    if (name.length < 2 || name.length > 120) {
      return { ok: false, error: "Please enter a name between 2 and 120 characters." };
    }
    if (address.length < 3) {
      return { ok: false, error: "Please enter the event address." };
    }
    if (address.length > 500 || notes.length > 5000) {
      return { ok: false, error: "One or more fields exceed the allowed length." };
    }
    await createClient({
      name,
      address: address || undefined,
      notes: notes || undefined,
    });

    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "We could not save your information. Please try again." };
  }
}
