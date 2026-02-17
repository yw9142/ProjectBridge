"use client";

import { useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";

type PmEvent = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  title: string;
  message: string;
  actorUserId: string;
  actorName?: string;
  actorRole: string;
  createdAt: string;
};

export default function ProjectEventsPage() {
  const projectId = useProjectId();
  const [items, setItems] = useState<PmEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await apiFetch<PmEvent[]>(`/api/notifications/pm-events?projectId=${projectId}`);
        if (active) {
          setItems(data);
          setError(null);
        }
      } catch (e) {
        if (!handleAuthError(e, "/admin/login") && active) {
          setError(e instanceof Error ? e.message : "변경 이력을 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-900">PM 변경 이력</h1>
        <p className="text-sm text-slate-500">PM 사용자가 수행한 변경 이벤트를 시간순으로 확인합니다.</p>
      </div>

      {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-2">
        {items.map((item) => (
          <article key={item.id} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-700">{item.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              {item.eventType} · {item.aggregateType} · {item.actorName ?? item.actorUserId} ({item.actorRole})
            </p>
          </article>
        ))}
        {!loading && !error && items.length === 0 ? <p className="text-sm text-slate-500">표시할 변경 이력이 없습니다.</p> : null}
      </div>
    </section>
  );
}


