import { FollowUpScreen } from "@/components/reminders/FollowUpScreen";

export default async function FollowUpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <FollowUpScreen applicationId={id} />;
}
