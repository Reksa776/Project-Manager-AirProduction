import { JobsTable } from "@/components/jobs/jobs-table";
import { PageHeader } from "@/components/ui";
import { getJobListItems } from "@/services/job-service";

export const metadata = {
  title: "Jobs · Air Production DB",
};

export default async function JobsPage() {
  const jobs = await getJobListItems();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Daftar seluruh pekerjaan produksi dan dokumentasi. Gunakan pencarian dan filter status untuk menemukan job tertentu."
      />
      <JobsTable jobs={jobs} />
    </div>
  );
}
