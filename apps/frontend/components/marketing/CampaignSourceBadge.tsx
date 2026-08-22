import { CampaignSource } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

export function CampaignSourceBadge({ source }: { source: CampaignSource }) {
  return <Badge variant={source === "live" ? "good" : "neutral"}>{source === "live" ? "Live" : "Demo"}</Badge>;
}
