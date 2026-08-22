import { CustomerSegment } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT = { NEW: "accent", ACTIVE: "good", AT_RISK: "warning", DORMANT: "critical" } as const;
const LABEL = { NEW: "New", ACTIVE: "Active", AT_RISK: "At Risk", DORMANT: "Dormant" } as const;

export function CustomerSegmentBadge({ segment }: { segment: CustomerSegment }) {
  return <Badge variant={VARIANT[segment]}>{LABEL[segment]}</Badge>;
}
