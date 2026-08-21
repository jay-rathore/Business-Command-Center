import { PaginatedResponse, QuotationListItem } from "@hpl/shared";
import { serverApiFetch } from "@/lib/api/serverApi";
import { QuotationsView } from "@/components/quotations/QuotationsView";

export default async function QuotationsPage() {
  const initialList = await serverApiFetch<PaginatedResponse<QuotationListItem>>(
    "/api/quotations?page=1&pageSize=10&sortDir=desc",
  );

  return <QuotationsView initialList={initialList} />;
}
