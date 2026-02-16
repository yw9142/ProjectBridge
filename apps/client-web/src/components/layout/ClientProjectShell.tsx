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
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-800 bg-slate-900 p-4 text-slate-300">
        <Link href="/client/projects" className="mb-6 flex items-center gap-2 px-2 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 font-semibold text-white">B</span>
          <span className="font-semibold text-white">Bridge Client</span>
        </Link>
        <nav className="space-y-1">
          {menu.map((item) => {
            const href = `/client/projects/${projectId}/${item.key}`;
            const Icon = item.icon;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.key}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-indigo-600 text-white" : "hover:bg-slate-800 hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="ml-64 min-h-screen">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
          <div>
            <p className="text-sm text-slate-500">Client Workspace</p>
            <h2 className="text-base font-semibold text-slate-900">프로젝트 협업 공간</h2>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="h-8 w-px bg-slate-200" />
            <ClientLogoutButton />
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Client 사용자</p>
              <p className="text-xs text-slate-500">CLIENT_OWNER</p>
            </div>
          </div>
        </header>
        <main className="p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
