import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminProjectTabs } from "@/components/layout/AdminProjectTabs";
import { RouteTransition } from "@/components/motion/RouteTransition";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="space-y-3">
          <Link href="/admin/projects" className="inline-flex text-sm font-medium text-indigo-600 hover:underline">
            프로젝트 목록으로
          </Link>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">프로젝트 상세</h1>
              <p className="text-sm text-slate-500">projectId: {projectId}</p>
            </div>
          </div>
          <AdminProjectTabs projectId={projectId} />
        </div>
        <RouteTransition>{children}</RouteTransition>
      </section>
    </AdminShell>
  );
}
