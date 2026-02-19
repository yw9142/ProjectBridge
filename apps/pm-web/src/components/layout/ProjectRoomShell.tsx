import { AppHeader } from "./AppHeader";
import { PmSidebar } from "./PmSidebar";
import FadeContent from "@/components/react-bits/FadeContent";
import { RouteTransition } from "@/components/motion/RouteTransition";

export function ProjectRoomShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PmSidebar projectId={projectId} />
      <div className="min-h-screen pl-64">
        <AppHeader />
        <main className="px-4 py-5 md:px-6">
          <FadeContent blur duration={700} delay={120} threshold={0}>
            <RouteTransition>
              <div className="mx-auto w-full max-w-[1320px]">{children}</div>
            </RouteTransition>
          </FadeContent>
        </main>
      </div>
    </div>
  );
}
