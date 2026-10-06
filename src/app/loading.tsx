import { Card, TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-48 animate-pulse rounded bg-[#eef0f3]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-line bg-panel"
          />
        ))}
      </div>
      <Card className="overflow-hidden">
        <TableSkeleton rows={6} />
      </Card>
    </div>
  );
}
