"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Skeleton } from "@/components/ui/skeleton";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
};

export default function ProjectsPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<Project[]>("/api/projects");
        if (active) {
          setItems(data);
        }
      } catch (e) {
        if (!handleAuthError(e, "/admin/login") && active) {
          setError(e instanceof Error ? e.message : "프로젝트 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">프로젝트 목록</h1>
            <p className="text-sm text-slate-500">현재 선택한 테넌트의 프로젝트를 관리합니다.</p>
          </div>
          <Link href="/admin/projects/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
            새 프로젝트
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="space-y-3">
          {items.map((project) => (
            <Link
              key={project.id}
              href={`/admin/projects/${project.id}/dashboard`}
              className="block rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <p className="font-semibold text-slate-900">{project.name}</p>
              <p className="text-sm text-slate-500">{project.description || "설명 없음"}</p>
              <p className="mt-1 text-xs text-slate-400">status: {project.status}</p>
            </Link>
          ))}
          {!loading && items.length === 0 ? <p className="text-sm text-slate-500">등록된 프로젝트가 없습니다.</p> : null}
        </div>
      </section>
    </AdminShell>
  );
}


