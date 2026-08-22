import { CampaignStatus } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT = { ACTIVE: "good", PAUSED: "warning", ENDED: "neutral" } as const;
const LABEL = { ACTIVE: "Active", PAUSED: "Paused", ENDED: "Ended" } as const;

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
