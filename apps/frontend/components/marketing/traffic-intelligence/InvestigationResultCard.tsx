"use client";

import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { TrafficInvestigationResult } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { CampaignLink } from "./CampaignLink";

const CONFIDENCE_VARIANT = { High: "good", Medium: "warning", Low: "critical" } as const;

function EvidenceList({ title, items }: { title: string; items: TrafficInvestigationResult["supportingEvidence"] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <span className="text-xs font-medium text-text-muted">{title}</span>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
            <span>
              {item.summary}
              {item.campaignId && (
                <>
                  {" "}
                  <CampaignLink campaignId={item.campaignId} campaignName="View campaign" />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecommendationSection({ recommendation }: { recommendation: NonNullable<TrafficInvestigationResult["recommendation"]> }) {
  const { recommended, alternatives, insufficientDataCampaigns, dataQualityWarnings } = recommendation;

  return (
    <div className="mt-3 flex flex-col gap-4">
      {recommended ? (
        <div className="rounded-sm border border-border bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Recommended campaign</span>
            <Badge variant="good">Score {recommended.score.toFixed(0)}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            <CampaignLink campaignId={recommended.campaignId} campaignName={recommended.campaignName} />
          </p>
          <p className="mt-2 text-xs text-text-secondary">{recommendation.recommendationText}</p>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">No campaign has enough data yet to confidently recommend.</p>
      )}

      {alternatives.length > 0 && (
        <div>
          <span className="text-xs font-medium text-text-muted">Other campaigns considered</span>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {alternatives.map((alt) => (
              <li key={alt.campaignId} className="flex items-start gap-2 text-xs text-text-secondary">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                <span>
                  <CampaignLink campaignId={alt.campaignId} campaignName={alt.campaignName} /> — {alt.reasonNotSelected}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insufficientDataCampaigns.length > 0 && (
        <p className="text-xs text-text-muted">Not scored (too little data yet): {insufficientDataCampaigns.join(", ")}</p>
      )}

      {dataQualityWarnings.length > 0 && (
        <div className="rounded-sm border border-border bg-warning-tint p-3">
          <span className="text-xs font-medium text-warning">Excluded — data quality</span>
          <ul className="mt-1.5 flex flex-col gap-1">
            {dataQualityWarnings.map((w) => (
              <li key={w.campaignName} className="text-xs text-text-secondary">
                <span className="font-medium">{w.campaignName}</span> — {w.issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function InvestigationResultCard({ result }: { result: TrafficInvestigationResult }) {
  const { trafficChange } = result;

  return (
    <div className="rounded-md border border-border bg-linear-to-br from-accent-tint to-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-strong" />
        <span className="font-display text-sm font-semibold text-text-primary">AI Investigation</span>
        <Badge variant={CONFIDENCE_VARIANT[result.confidence.label]} className="ml-auto">
          {result.confidence.label} confidence — {result.confidence.score}%
        </Badge>
      </div>

      <p className="text-sm font-medium text-text-primary">{result.summary}</p>

      {result.recommendation ? (
        <RecommendationSection recommendation={result.recommendation} />
      ) : (
        result.supported && (
          <>
            <div className="mt-3 flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-xs">
              {trafficChange.direction === "up" && <TrendingUp className="h-3.5 w-3.5 text-good" />}
              {trafficChange.direction === "down" && <TrendingDown className="h-3.5 w-3.5 text-critical" />}
              <span className="text-text-secondary">
                {formatNumber(trafficChange.visitorsBefore)} → {formatNumber(trafficChange.visitorsAfter)} visitors
                {trafficChange.percent != null && ` (${trafficChange.percent >= 0 ? "+" : ""}${trafficChange.percent.toFixed(0)}%)`}
              </span>
              <span className="ml-auto text-text-muted">{trafficChange.comparedWith}</span>
            </div>

            {result.primaryCause && (
              <div className="mt-4">
                <span className="text-xs font-medium text-text-muted">Primary cause</span>
                <p className="mt-1 text-sm text-text-secondary">
                  {result.primaryCause.summary}
                  {result.primaryCause.campaignId && (
                    <>
                      {" "}
                      <CampaignLink campaignId={result.primaryCause.campaignId} campaignName="View campaign" />
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-4">
              <EvidenceList title="Supporting evidence" items={result.supportingEvidence} />
              <EvidenceList title="Contributing factors" items={result.contributingFactors} />
              <EvidenceList title="What did not cause it" items={result.notCausedBy} />
            </div>
          </>
        )
      )}

      <div className="mt-4 border-t border-border pt-3">
        <span className="text-xs font-medium text-text-muted">Recommended action</span>
        <p className="mt-1 text-sm text-text-secondary">{result.recommendedAction}</p>
      </div>
    </div>
  );
}
