import { JobsTable } from "@/components/jobs/jobs-table";
import { PageHeader } from "@/components/ui";
import { getClients, getVendors, getVenues } from "@/services/master-service";
import { getJobListItems } from "@/services/job-service";
import {
  createJobAction,
  deleteJobAction,
  updateJobAction,
} from "@/app/actions/job-actions";

export const metadata = {
  title: "Jobs · Air Production DB",
};

export default async function JobsPage() {
  const [jobs, clients, vendors, venues] = await Promise.all([
    getJobListItems(),
    getClients(),
    getVendors(),
    getVenues(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Kelola seluruh pekerjaan produksi dan dokumentasi Air Production."
      />
      <JobsTable
        jobs={jobs}
        clients={clients}
        vendors={vendors}
        venues={venues}
        createAction={createJobAction}
        updateAction={updateJobAction}
        deleteAction={deleteJobAction}
      />
    </div>
  );
}
