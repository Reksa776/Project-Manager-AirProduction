import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  DELIVERY_STATUS_LABEL,
  JOB_STATUS_LABEL,
} from "@/lib/labels";
import type { DeliveryStatus, JobStatus } from "@/lib/types";

const jobStatusTone: Record<JobStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
};

const deliveryStatusTone: Record<DeliveryStatus, BadgeTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETED: "success",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={jobStatusTone[status]} dot>
      {JOB_STATUS_LABEL[status]}
    </Badge>
  );
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <Badge tone={deliveryStatusTone[status]} dot>
      {DELIVERY_STATUS_LABEL[status]}
    </Badge>
  );
}
