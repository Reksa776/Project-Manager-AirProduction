"use client";

import { useActionState } from "react";

import { setupOwnerAction } from "@/app/actions/auth-actions";
import { Button, Input } from "@/components/ui";

export function SetupOwnerForm() {
  const [state, action, pending] = useActionState(setupOwnerAction, {});

  return (
    <form action={action} className="space-y-4">
      <Input label="Full name" name="name" autoComplete="name" required minLength={2} maxLength={120} />
      <Input label="Work email" name="email" type="email" autoComplete="email" required maxLength={190} />
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Use at least 8 characters."
        required
        minLength={8}
        maxLength={128}
      />
      {state.error ? (
        <p role="alert" className="rounded-xl border border-[#efc5c2] bg-[#fff5f4] px-4 py-3 text-sm text-[#9f332b]">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="md" className="h-11 w-full !bg-brand hover:!bg-[#8e4051]" disabled={pending}>
        {pending ? "Creating account..." : "Create Owner account"}
      </Button>
    </form>
  );
}
