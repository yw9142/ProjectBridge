import { ClientProjectShell } from "@/components/layout/ClientProjectShell";

export default async function ClientProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ClientProjectShell projectId={projectId}>{children}</ClientProjectShell>;
}
