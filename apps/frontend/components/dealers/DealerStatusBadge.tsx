import { DealerStatus } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT = { ACTIVE: "good", NEW: "accent", AT_RISK: "warning", INACTIVE: "critical" } as const;
const LABEL = { ACTIVE: "Active", NEW: "New", AT_RISK: "At Risk", INACTIVE: "Inactive" } as const;

export function DealerStatusBadge({ status }: { status: DealerStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
