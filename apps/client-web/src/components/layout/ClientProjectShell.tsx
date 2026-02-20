"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, FileSignature, FolderOpen, LayoutDashboard, Lock, MessageSquare, Receipt, SquareCheck } from "lucide-react";
import { ClientLogoutButton } from "./ClientLogoutButton";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import FadeContent from "@/components/react-bits/FadeContent";
import { RouteTransition } from "@/components/motion/RouteTransition";
import { useCurrentUserRole } from "@/lib/use-current-user-role";

const menu = [
  { key: "home", label: "대시보드", icon: LayoutDashboard },
  { key: "posts", label: "커뮤니케이션", icon: MessageSquare },
  { key: "requests", label: "요청", icon: SquareCheck },
  { key: "files", label: "파일", icon: FolderOpen },
  { key: "meetings", label: "회의", icon: Calendar },
  { key: "contracts", label: "계약", icon: FileSignature },
  { key: "billing", label: "정산", icon: Receipt },
  { key: "vault", label: "금고", icon: Lock },
];

export function ClientProjectShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenantRole, isPlatformAdmin } = useCurrentUserRole();
  const roleLabel = isPlatformAdmin ? "PLATFORM_ADMIN" : tenantRole ?? "-";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-card/95 backdrop-blur">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/client/projects" className="flex items-center gap-3">
            <div className="shrink-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold !text-white">B</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">Bridge Client</p>
              <p className="text-xs text-muted-foreground">협업 작업공간</p>
            </div>
          </Link>
        </div>

        <div className="p-2">
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">프로젝트 내비게이션</p>
          <FadeContent blur duration={650} delay={120} threshold={0}>
            <nav className="space-y-0.5" aria-label="클라이언트 프로젝트 메뉴">
              {menu.map((item) => {
                const href = `/client/projects/${projectId}/${item.key}`;
                const Icon = item.icon;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={item.key}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      active ? "bg-slate-900 !text-white shadow-sm [&_svg]:!text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className={active ? "!text-white" : undefined}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </FadeContent>
        </div>
      </aside>

      <div className="min-h-screen pl-64">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-between px-4 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">클라이언트 작업공간</p>
              <h2 className="text-sm font-semibold text-foreground">프로젝트 협업 공간</h2>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="h-6 w-px bg-border" />
              <ClientLogoutButton />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">Client 사용자</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

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

