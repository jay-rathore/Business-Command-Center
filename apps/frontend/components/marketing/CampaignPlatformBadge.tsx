import { CampaignPlatform } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";

const LABEL: Record<CampaignPlatform, string> = {
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  ORGANIC: "Organic",
  OTHER: "Other",
};

export function CampaignPlatformBadge({ platform }: { platform: CampaignPlatform }) {
  return <Badge variant="accent">{LABEL[platform]}</Badge>;
}
