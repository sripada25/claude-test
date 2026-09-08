import { DetailScreen } from "@/components/detail/DetailScreen";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <DetailScreen id={id} />;
}
