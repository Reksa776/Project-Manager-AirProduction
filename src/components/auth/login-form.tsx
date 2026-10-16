"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/actions/auth-actions";
import { Button, Input } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-5">
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="nama@perusahaan.com"
        required
        maxLength={190}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password"
        required
        maxLength={128}
      />
      {state.error ? (
        <p role="alert" className="rounded-xl border border-[#efc5c2] bg-[#fff5f4] px-4 py-3 text-sm text-[#9f332b]">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="md" className="h-11 w-full !bg-brand hover:!bg-[#8e4051]" disabled={pending}>
        {pending ? "Signing in..." : "Sign in to dashboard"}
      </Button>
    </form>
  );
}
