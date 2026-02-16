import { ProjectRoomShell } from "@/components/layout/ProjectRoomShell";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectRoomShell projectId={projectId}>{children}</ProjectRoomShell>;
}
