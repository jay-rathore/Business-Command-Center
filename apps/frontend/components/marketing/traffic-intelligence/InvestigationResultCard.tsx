"use client";

import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { TrafficInvestigationResult } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

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
            {item.summary}
          </li>
        ))}
      </ul>
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

      {result.supported && (
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
              <p className="mt-1 text-sm text-text-secondary">{result.primaryCause.summary}</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-4">
            <EvidenceList title="Supporting evidence" items={result.supportingEvidence} />
            <EvidenceList title="Contributing factors" items={result.contributingFactors} />
            <EvidenceList title="What did not cause it" items={result.notCausedBy} />
          </div>
        </>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <span className="text-xs font-medium text-text-muted">Recommended action</span>
        <p className="mt-1 text-sm text-text-secondary">{result.recommendedAction}</p>
      </div>
    </div>
  );
}
