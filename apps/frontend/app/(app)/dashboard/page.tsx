import { AiExecutiveSummary, AttentionItem, BusinessHealthSignal, DashboardSummary } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const [summary, health, attention, aiSummary] = await Promise.all([
    serverApiFetch<DashboardSummary>("/api/dashboard/summary"),
    serverApiFetch<BusinessHealthSignal[]>("/api/dashboard/business-health"),
    serverApiFetch<AttentionItem[]>("/api/dashboard/attention"),
    serverApiFetch<AiExecutiveSummary>("/api/dashboard/ai-summary"),
  ]);

  return (
    <DashboardView initialSummary={summary} initialHealth={health} initialAttention={attention} initialAiSummary={aiSummary} />
  );
}
