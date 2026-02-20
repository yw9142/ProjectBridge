"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FolderKanban, ShieldCheck } from "lucide-react";
import { AdminLogoutButton } from "./AdminLogoutButton";
import FadeContent from "@/components/react-bits/FadeContent";
import { useCurrentUserRole } from "@/lib/use-current-user-role";

const nav = [
  { href: "/admin/tenants", label: "테넌트 목록", icon: Building2 },
  { href: "/admin/projects", label: "프로젝트", icon: FolderKanban },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { tenantRole, isPlatformAdmin } = useCurrentUserRole();
  const roleLabel = isPlatformAdmin ? "PLATFORM_ADMIN" : tenantRole ?? "-";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1680px] items-center justify-between px-4 md:px-6">
          <Link href="/admin/tenants" className="flex items-center gap-3">
            <div className="shrink-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold !text-white">B</span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Bridge Admin</p>
              <p className="text-xs text-muted-foreground">운영 콘솔</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabel}
            </div>
            <div className="h-6 w-px bg-border" />
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-[1680px] gap-5 px-4 py-5 md:px-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-border bg-card p-2 shadow-sm">
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">내비게이션</p>
          <nav className="space-y-0.5" aria-label="관리자 메뉴">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
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
        </aside>
        <FadeContent blur duration={700} delay={180} threshold={0} className="min-w-0">
          <main className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">{children}</main>
        </FadeContent>
      </div>
    </div>
  );
}

