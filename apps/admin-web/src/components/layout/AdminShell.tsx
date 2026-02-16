"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FolderKanban, Users } from "lucide-react";
import { AdminLogoutButton } from "./AdminLogoutButton";

const nav = [
  { href: "/admin/tenants", label: "테넌트 목록", icon: Building2 },
  { href: "/admin/projects", label: "프로젝트", icon: FolderKanban },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white">B</span>
            <strong>Bridge Admin</strong>
          </div>
          <div className="flex items-center gap-4">
            <AdminLogoutButton />
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="h-4 w-4" />
            PLATFORM_ADMIN
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 py-6">
        <aside className="col-span-12 rounded-xl border border-slate-200 bg-white p-3 md:col-span-3 lg:col-span-2">
          <nav className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="col-span-12 rounded-xl border border-slate-200 bg-white p-6 md:col-span-9 lg:col-span-10">{children}</main>
      </div>
    </div>
  );
}
