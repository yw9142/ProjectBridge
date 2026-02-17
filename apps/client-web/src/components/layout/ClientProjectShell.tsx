"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, FileSignature, FolderOpen, House, Lock, MessageSquare, Receipt, SquareCheck } from "lucide-react";
import { ClientLogoutButton } from "./ClientLogoutButton";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

const menu = [
  { key: "home", label: "홈", icon: House },
  { key: "requests", label: "요청", icon: SquareCheck },
  { key: "posts", label: "커뮤니케이션", icon: MessageSquare },
  { key: "files", label: "파일", icon: FolderOpen },
  { key: "meetings", label: "회의", icon: Calendar },
  { key: "contracts", label: "계약", icon: FileSignature },
  { key: "billing", label: "정산", icon: Receipt },
  { key: "vault", label: "Vault", icon: Lock },
];

export function ClientProjectShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-card/95 backdrop-blur">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/client/projects" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold !text-white">B</span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">Bridge Client</p>
              <p className="text-xs text-muted-foreground">Collaboration Space</p>
            </div>
          </Link>
        </div>

        <div className="p-2">
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Project Navigation</p>
          <nav className="space-y-0.5">
            {menu.map((item) => {
              const href = `/client/projects/${projectId}/${item.key}`;
              const Icon = item.icon;
              const active = pathname === href || pathname.startsWith(`${href}/`);
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
          </nav>
        </div>
      </aside>

      <div className="min-h-screen pl-64">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-between px-4 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Client Workspace</p>
              <h2 className="text-sm font-semibold text-foreground">프로젝트 협업 공간</h2>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="h-6 w-px bg-border" />
              <ClientLogoutButton />
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">Client 사용자</p>
                <p className="text-xs text-muted-foreground">CLIENT_OWNER</p>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 md:px-6">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

