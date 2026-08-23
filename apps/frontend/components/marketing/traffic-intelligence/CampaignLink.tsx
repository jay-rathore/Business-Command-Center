"use client";

import { CampaignListItem } from "@hpl/shared";
import { useDrawerStore } from "@/lib/stores/drawerStore";

/** Opens the existing global campaign drawer (see CampaignDrawerContent.tsx) from anywhere in
 * Traffic Intelligence — the drawer re-fetches full campaign detail by id itself, so a minimal
 * {id} payload is enough to open it. */
export function CampaignLink({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const open = useDrawerStore((s) => s.open);

  return (
    <button
      onClick={() => open("campaign", { id: campaignId } as CampaignListItem)}
      className="font-medium text-accent-strong underline decoration-dotted underline-offset-2 hover:decoration-solid"
    >
      {campaignName}
    </button>
  );
}
