import type { ReactNode } from "react";

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-4 py-10">
      <section className="w-full max-w-[420px] rounded-3xl border border-line bg-panel p-6 shadow-[0_18px_60px_rgba(56,36,31,0.09)] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-sm font-bold tracking-wide text-brand ring-1 ring-[#a64f611a]">
            AP
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Air Production</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
              Wedding & Event Organizer
            </p>
          </div>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
