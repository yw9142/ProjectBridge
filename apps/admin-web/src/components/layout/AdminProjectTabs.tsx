"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { key: "dashboard", label: "대시보드" },
  { key: "posts", label: "커뮤니케이션" },
  { key: "requests", label: "요청" },
  { key: "files", label: "파일" },
  { key: "meetings", label: "회의" },
  { key: "contracts", label: "계약" },
  { key: "billing", label: "정산" },
  { key: "vault", label: "Vault" },
  { key: "events", label: "변경 이력" },
  { key: "settings/members", label: "멤버 설정" },
];

export function AdminProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {items.map((item) => {
        const href = `/admin/projects/${projectId}/${item.key}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={item.key}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border border-border bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
