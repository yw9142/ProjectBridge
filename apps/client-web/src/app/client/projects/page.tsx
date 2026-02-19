"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ClientLogoutButton } from "@/components/layout/ClientLogoutButton";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
};

export default function ClientProjectsPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setError(null);
      try {
        const data = await apiFetch<Project[]>("/api/projects");
        if (active) {
          setItems(data);
        }
      } catch (e) {
        if (!handleAuthError(e, "/login") && active) {
          setError(e instanceof Error ? e.message : "프로젝트 목록을 불러오지 못했습니다.");
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">내 프로젝트</h1>
            <p className="mt-1 text-sm text-slate-500">초대받은 프로젝트를 선택해 진행 상태를 확인하세요.</p>
          </div>
          <ClientLogoutButton />
        </div>

        <div className="mt-6 space-y-3">
          {items.map((project) => (
            <Link key={project.id} href={`/client/projects/${project.id}/home`} className="block rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40">
              <p className="font-semibold text-slate-900">{project.name}</p>
              <p className="text-sm text-slate-500">{project.description || "설명 없음"}</p>
              <p className="text-xs text-slate-400">status: {project.status}</p>
            </Link>
          ))}
        </div>

        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </main>
  );
}

