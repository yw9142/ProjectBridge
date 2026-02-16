import { redirect } from "next/navigation";

export default async function ClientProjectIndexPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/client/projects/${projectId}/home`);
}
