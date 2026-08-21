import { SalesOverview, SalesTrendPoint } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { SalesView } from "@/components/sales/SalesView";

export default async function SalesPage() {
  const [overview, trend] = await Promise.all([
    serverApiFetch<SalesOverview>("/api/sales/overview"),
    serverApiFetch<SalesTrendPoint[]>("/api/sales/revenue-trend?granularity=monthly"),
  ]);

  return <SalesView initialOverview={overview} initialTrend={trend} />;
}
