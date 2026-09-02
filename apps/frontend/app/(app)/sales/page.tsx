import { SalesOverview, SalesTrendPoint } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { SalesView } from "@/components/sales/SalesView";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [overview, trend] = await Promise.all([
    serverApiFetch<SalesOverview>(appendDateRange("/api/sales/overview", { dateFrom, dateTo })),
    serverApiFetch<SalesTrendPoint[]>(appendDateRange("/api/sales/revenue-trend?granularity=monthly", { dateFrom, dateTo })),
  ]);

  return <SalesView initialOverview={overview} initialTrend={trend} />;
}
