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
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-800 bg-slate-900 p-4 text-slate-300">
      <Link href="/pm/projects" className="mb-6 flex items-center gap-2 px-2 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">B</span>
        <span className="text-base font-semibold text-white">Bridge PM</span>
      </Link>
      <nav className="space-y-1">
        {items.map((item) => {
          const href = `/pm/projects/${projectId}/${item.key}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;
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
        <Link
          href={`/pm/projects/${projectId}/settings/members`}
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${pathname.includes("/settings/members") ? "bg-indigo-600 text-white" : "hover:bg-slate-800 hover:text-white"}`}
        >
          <Settings className="h-4 w-4" />
          멤버 설정
        </Link>
      </nav>
    </aside>
  );
}
