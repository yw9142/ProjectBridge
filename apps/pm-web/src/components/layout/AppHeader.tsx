import { NotificationCenter } from "../ui/NotificationCenter";
import { PmLogoutButton } from "./PmLogoutButton";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <p className="text-sm text-slate-500">PM Workspace</p>
        <h2 className="text-base font-semibold text-slate-900">Bridge 프로젝트 룸</h2>
      </div>
      <div className="flex items-center gap-4">
        <NotificationCenter />
        <div className="h-8 w-px bg-slate-200" />
        <PmLogoutButton />
        <div className="h-8 w-px bg-slate-200" />
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">PM 사용자</p>
          <p className="text-xs text-slate-500">PM_OWNER</p>
        </div>
      </div>
    </header>
  );
}
