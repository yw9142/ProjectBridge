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
        if (!handleAuthError(e, "/login") && active) {
          setError(e instanceof Error ? e.message : "蹂寃??대젰??遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
        <h1 className="text-xl font-bold text-slate-900">PM 蹂寃??대젰</h1>
        <p className="text-sm text-slate-500">PM ?ъ슜?먭? ?섑뻾??蹂寃??대깽?몃? ?쒓컙?쒖쑝濡??뺤씤?⑸땲??</p>
      </div>

      {loading ? <p className="text-sm text-slate-500">遺덈윭?ㅻ뒗 以?..</p> : null}
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
        {!loading && !error && items.length === 0 ? <p className="text-sm text-slate-500">?쒖떆??蹂寃??대젰???놁뒿?덈떎.</p> : null}
      </div>
    </section>
  );
}

