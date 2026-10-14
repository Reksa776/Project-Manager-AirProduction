import { JobsTable } from "@/components/jobs/jobs-table";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui";
import { getClients, getPackages, getVendors } from "@/services/master-service";
import { getJobListItems } from "@/services/job-service";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import {
  createJobAction,
  deleteJobAction,
  updateJobAction,
} from "@/app/actions/job-actions";

export const metadata = {
  title: "Jobs · Air Production DB",
};

// Data MySQL dibaca saat runtime; tidak diprerender statis.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const admin = await requireAuthenticatedAdmin();
  const [jobs, clients, vendors, packages] = await Promise.all([
    getJobListItems(),
    getClients(),
    getVendors(),
    getPackages(true),
  ]);

  return (
    <AppShell adminName={admin.name}>
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Manage all Air Production production and documentation jobs."
      />
      <JobsTable
        jobs={jobs}
        clients={clients}
        vendors={vendors}
        packages={packages.map(({ id, name, description }) => ({ id, name, description }))}
        createAction={createJobAction}
        updateAction={updateJobAction}
        deleteAction={deleteJobAction}
      />
    </div>
    </AppShell>
  );
}
