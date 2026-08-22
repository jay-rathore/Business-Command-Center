import { CustomerListItem, CustomersKpis, PaginatedResponse } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { CustomersView } from "@/components/customers/CustomersView";

export default async function CustomersPage() {
  const [kpis, list] = await Promise.all([
    serverApiFetch<CustomersKpis>("/api/customers/kpis"),
    serverApiFetch<PaginatedResponse<CustomerListItem>>("/api/customers?page=1&pageSize=10&sortDir=desc"),
  ]);

  return <CustomersView initialKpis={kpis} initialList={list} />;
}
