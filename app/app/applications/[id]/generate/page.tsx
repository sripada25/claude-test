import { Suspense } from "react";
import { GenerateScreen } from "@/components/generate/GenerateScreen";

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <GenerateScreen applicationId={id} />
    </Suspense>
  );
}
