import { AppHeader } from "./AppHeader";
import { PmSidebar } from "./PmSidebar";

export function ProjectRoomShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PmSidebar projectId={projectId} />
      <div className="min-h-screen pl-64">
        <AppHeader />
        <main className="px-4 py-5 md:px-6">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

