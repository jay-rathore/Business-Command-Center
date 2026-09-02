import { AiExecutiveSummary, AttentionItem, BusinessHealthSignal, DashboardSummary } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [summary, health, attention, aiSummary] = await Promise.all([
    serverApiFetch<DashboardSummary>(appendDateRange("/api/dashboard/summary", { dateFrom, dateTo })),
    serverApiFetch<BusinessHealthSignal[]>("/api/dashboard/business-health"),
    serverApiFetch<AttentionItem[]>("/api/dashboard/attention"),
    serverApiFetch<AiExecutiveSummary>("/api/dashboard/ai-summary"),
  ]);

  return (
    <DashboardView initialSummary={summary} initialHealth={health} initialAttention={attention} initialAiSummary={aiSummary} />
  );
}
