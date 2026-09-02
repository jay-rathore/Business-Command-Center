import { PaginatedResponse, ProductListItem, ProductsStatSummary } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { ProductsView } from "@/components/products/ProductsView";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [catalog, stats] = await Promise.all([
    serverApiFetch<PaginatedResponse<ProductListItem>>(
      appendDateRange("/api/products?page=1&pageSize=10&sortDir=desc", { dateFrom, dateTo }),
    ),
    serverApiFetch<ProductsStatSummary>(appendDateRange("/api/products/stats/summary", { dateFrom, dateTo })),
  ]);

  return <ProductsView initialCatalog={catalog} initialStats={stats} />;
}
