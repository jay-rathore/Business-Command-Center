import { CustomerListItem, CustomersKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { appendDateRange } from "@/lib/dateRange";
import { CustomersView } from "@/components/customers/CustomersView";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  const { dateFrom, dateTo } = await searchParams;

  const [kpis, list] = await Promise.all([
    serverApiFetch<CustomersKpis>(appendDateRange("/api/customers/kpis", { dateFrom, dateTo })),
    serverApiFetch<PaginatedResponse<CustomerListItem>>(
      appendDateRange("/api/customers?page=1&pageSize=10&sortDir=desc", { dateFrom, dateTo }),
    ),
  ]);

  return <CustomersView initialKpis={kpis} initialList={list} />;
}
