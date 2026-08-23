"use client";

import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTrafficEventDetail } from "@/lib/query/useTrafficIntelligence";
import { CampaignLink } from "./CampaignLink";

export function EventDetailDialog({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  const { data: detail, isLoading } = useTrafficEventDetail(eventId);

  return (
    <Dialog open={eventId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detail?.label ?? "Event"}</DialogTitle>
          <DialogDescription>{detail ? new Date(detail.occurredAt).toLocaleString("en-IN") : isLoading ? "Loading…" : undefined}</DialogDescription>
        </DialogHeader>

        {detail && (
          <div className="flex flex-col gap-4 text-sm">
            {detail.campaignId && detail.campaignName && (
              <CampaignLink campaignId={detail.campaignId} campaignName={detail.campaignName} />
            )}

            {detail.field && (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-2 p-3 text-xs">
                <div>
                  <span className="text-text-muted">Field</span>
                  <p className="font-medium text-text-primary">{detail.field}</p>
                </div>
                <div>
                  <span className="text-text-muted">Module</span>
                  <p className="font-medium text-text-primary">{detail.platform ?? "Marketing"}</p>
                </div>
                <div>
                  <span className="text-text-muted">Before</span>
                  <p className="font-medium text-text-primary">{detail.oldValue ?? "—"}</p>
                </div>
                <div>
                  <span className="text-text-muted">After</span>
                  <p className="font-medium text-text-primary">{detail.newValue ?? "—"}</p>
                </div>
              </div>
            )}

            {detail.trafficImpact && (
              <div>
                <span className="text-xs font-medium text-text-muted">Impact on traffic</span>
                <p className="mt-1 text-text-secondary">{detail.trafficImpact}</p>
              </div>
            )}

            {detail.aiInterpretation && (
              <div className="rounded-md border border-border bg-linear-to-br from-accent-tint to-surface p-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent-strong" />
                  <span className="text-xs font-semibold text-text-primary">AI interpretation</span>
                </div>
                <p className="text-xs text-text-secondary">{detail.aiInterpretation}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
