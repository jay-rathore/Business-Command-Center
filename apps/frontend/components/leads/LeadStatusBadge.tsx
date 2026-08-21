import { LeadStatusOption } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

const STAGE_VARIANT = {
  OPEN: "accent",
  WON: "good",
  LOST: "critical",
} as const;

export function LeadStatusBadge({ status }: { status: LeadStatusOption | null }) {
  if (!status) return <Badge variant="neutral">Unassigned</Badge>;
  return <Badge variant={STAGE_VARIANT[status.stage]}>{status.name}</Badge>;
}
