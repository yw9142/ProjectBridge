import { AppHeader } from "./AppHeader";
import { PmSidebar } from "./PmSidebar";

export function ProjectRoomShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <PmSidebar projectId={projectId} />
      <div className="ml-64 min-h-screen">
        <AppHeader />
        <main className="p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
