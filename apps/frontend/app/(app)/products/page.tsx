import { PaginatedResponse, ProductListItem, ProductsStatSummary } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { ProductsView } from "@/components/products/ProductsView";

export default async function ProductsPage() {
  const [catalog, stats] = await Promise.all([
    serverApiFetch<PaginatedResponse<ProductListItem>>("/api/products?page=1&pageSize=10&sortDir=desc"),
    serverApiFetch<ProductsStatSummary>("/api/products/stats/summary"),
  ]);

  return <ProductsView initialCatalog={catalog} initialStats={stats} />;
}
