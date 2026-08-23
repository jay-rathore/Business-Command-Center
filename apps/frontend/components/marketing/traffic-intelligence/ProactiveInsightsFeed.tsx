"use client";

import { AlertTriangle, TrendingUp } from "lucide-react";
import { ProactiveInsight } from "@hpl/shared";
import { Badge } from "@/components/ui/badge";
import { useProactiveInsights } from "@/lib/query/useTrafficIntelligence";

const PRIORITY_VARIANT = { CRITICAL: "critical", HIGH: "warning", MEDIUM: "accent", LOW: "neutral" } as const;

function InsightCard({ insight }: { insight: ProactiveInsight }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        {insight.type === "RISK" ? <AlertTriangle className="h-4 w-4 text-critical" /> : <TrendingUp className="h-4 w-4 text-good" />}
        <span className="text-sm font-semibold text-text-primary">{insight.headline}</span>
        <Badge variant={PRIORITY_VARIANT[insight.priority]} className="ml-auto">
          {insight.priority}
        </Badge>
      </div>
      <p className="text-xs text-text-secondary">
        <span className="font-medium text-text-muted">Likely cause: </span>
        {insight.whyItHappened}
      </p>
      <p className="text-xs text-text-secondary">
        <span className="font-medium text-text-muted">Impact: </span>
        {insight.businessImpact}
      </p>
      <p className="text-xs text-text-secondary">
        <span className="font-medium text-text-muted">Recommended action: </span>
        {insight.recommendedAction}
      </p>
    </div>
  );
}

export function ProactiveInsightsFeed() {
  const { data: insights } = useProactiveInsights();

  if (!insights || insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium text-text-muted">Detected automatically</h3>
      <div className="flex flex-col gap-3">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}
