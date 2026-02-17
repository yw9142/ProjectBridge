import { NotificationCenter } from "../ui/NotificationCenter";
import { PmLogoutButton } from "./PmLogoutButton";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-between px-4 md:px-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">PM 작업공간</p>
          <h2 className="text-sm font-semibold text-foreground">Bridge 프로젝트 룸</h2>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <div className="h-6 w-px bg-border" />
          <PmLogoutButton />
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-foreground">PM 사용자</p>
            <p className="text-xs text-muted-foreground">PM_OWNER</p>
          </div>
        </div>
      </div>
    </header>
  );
}
