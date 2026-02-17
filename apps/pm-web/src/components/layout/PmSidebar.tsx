"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, FileSignature, FolderOpen, History, LayoutDashboard, Lock, MessageSquare, Receipt, Settings, SquareCheck } from "lucide-react";

const items = [
  { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { key: "posts", label: "커뮤니케이션", icon: MessageSquare },
  { key: "requests", label: "요청", icon: SquareCheck },
  { key: "files", label: "파일", icon: FolderOpen },
  { key: "meetings", label: "회의", icon: Calendar },
  { key: "contracts", label: "계약", icon: FileSignature },
  { key: "billing", label: "정산", icon: Receipt },
  { key: "vault", label: "Vault", icon: Lock },
  { key: "events", label: "변경 이력", icon: History },
];

export function PmSidebar({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-card/95 backdrop-blur">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/pm/projects" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold !text-white">B</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">Bridge PM</p>
            <p className="text-xs text-muted-foreground">Project Workspace</p>
          </div>
        </Link>
      </div>

      <div className="p-2">
        <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Project Navigation</p>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const href = `/pm/projects/${projectId}/${item.key}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-slate-900 !text-white shadow-sm [&_svg]:!text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className={active ? "!text-white" : undefined}>{item.label}</span>
              </Link>
            );
          })}
          <Link
            href={`/pm/projects/${projectId}/settings/members`}
            className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              pathname.includes("/settings/members")
                ? "bg-slate-900 !text-white shadow-sm [&_svg]:!text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span className={pathname.includes("/settings/members") ? "!text-white" : undefined}>멤버 설정</span>
          </Link>
        </nav>
      </div>
    </aside>
  );
}
