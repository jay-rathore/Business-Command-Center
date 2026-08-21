import { Sparkles } from "lucide-react";
import { AiExecutiveSummary } from "@hpl/shared";

export function AiSummaryCard({ summary }: { summary: AiExecutiveSummary }) {
  return (
    <div className="rounded-md border border-border bg-linear-to-br from-accent-tint to-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-strong" />
        <span className="font-display text-sm font-semibold text-text-primary">AI Executive Summary</span>
        <span className="ml-auto text-[11px] text-text-muted">Rule-based · LLM-ready</span>
      </div>
      <p className="text-sm text-text-secondary">{summary.narrative}</p>
      {summary.recommendedActions.length > 0 && (
        <div className="mt-4">
          <span className="text-xs font-medium text-text-muted">Recommended actions</span>
          <ol className="mt-2 flex flex-col gap-1.5">
            {summary.recommendedActions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-tint-strong text-[10px] font-semibold text-accent-strong">
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
