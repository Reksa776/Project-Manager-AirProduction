import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { Card, EmptyState, PageHeader, TBody, TD, TH, THead, TR, Table } from "@/components/ui";
import { getClients } from "@/services/master-service";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export const metadata = {
  title: "Client Submissions · Air Production DB",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const admin = await requireAuthenticatedAdmin();
  const clients = await getClients();

  return (
    <AppShell adminName={admin.name}>
      <div className="space-y-6">
        <PageHeader
          title="Client Submissions"
          description="View client information submitted through the separate intake form."
        />

        <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-ink">Client intake form</p>
            <p className="mt-1 text-xs text-ink-muted">Share this form route with clients: /client-form</p>
          </div>
          <Link
            href="/client-form"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#2e2e2e]"
          >
            Open Form
          </Link>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-ink">Submitted Client Information</h2>
            <span className="text-xs text-ink-muted">{clients.length} submissions</span>
          </div>
          {clients.length === 0 ? (
            <EmptyState
              icon="clients"
              title="No client submissions yet"
              description="Information submitted through /client-form will appear here."
            />
          ) : (
            <div className="min-w-0 max-w-full overflow-x-auto">
              <Table className="min-w-[900px]">
                <THead>
                  <TR>
                    <TH>Client</TH>
                    <TH>Event Address</TH>
                    <TH>Notes</TH>
                  </TR>
                </THead>
                <TBody>
                  {clients.map((client) => (
                    <TR key={client.id}>
                      <TD className="max-w-56 break-words font-medium text-ink">
                        {client.name}
                      </TD>
                      <TD className="max-w-56 break-words">{client.address ?? "-"}</TD>
                      <TD className="max-w-72 whitespace-pre-wrap break-words">{client.notes ?? "-"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
