import { ExecutiveDetailView } from "@/components/sales-team/ExecutiveDetailView";

export default async function ExecutivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExecutiveDetailView id={id} />;
}
