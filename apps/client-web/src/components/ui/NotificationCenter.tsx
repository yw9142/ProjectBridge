"use client";

import { Bell } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { API_BASE, apiFetch, handleAuthError } from "@/lib/api";

type Notice = {
  id: string;
  title: string;
  message: string;
  eventType: string;
  createdAt: string;
};

export function NotificationCenter() {
  const [items, setItems] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const current = await apiFetch<Notice[]>("/api/notifications");
        if (active) {
          setItems(current.slice(0, 20));
        }
      } catch (e) {
        if (!handleAuthError(e, "/login") && active) {
          setError(e instanceof Error ? e.message : "알림을 불러오지 못했습니다.");
        }
      }
    };

    load();

    const token = getAccessToken();
    const apiOrigin = new URL(API_BASE, window.location.origin).origin;
    const sameOriginApi = apiOrigin === window.location.origin;
    const streamUrl =
      sameOriginApi || !token
        ? `${API_BASE}/api/notifications/stream`
        : `${API_BASE}/api/notifications/stream?accessToken=${encodeURIComponent(token)}`;

    const es = new EventSource(streamUrl, { withCredentials: true });

    const onCreated = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as Notice;
        setItems((prev) => [payload, ...prev].slice(0, 20));
      } catch {
        // ignore ping payloads
      }
    };

    es.addEventListener("notification.created", onCreated as EventListener);

    return () => {
      active = false;
      es.removeEventListener("notification.created", onCreated as EventListener);
      es.close();
    };
  }, []);

  const unread = useMemo(() => items.length, [items]);

  return (
    <div className="relative">
      <button
        className="relative min-h-11 min-w-11 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림 열기"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-sm font-semibold text-slate-900">알림 센터</p>
          <div className="max-h-72 space-y-2 overflow-auto">
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            {items.length === 0 ? <p className="text-sm text-slate-500">새 알림이 없습니다.</p> : null}
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-600">{item.message}</p>
                <p className="mt-1 text-[11px] text-slate-400">{item.eventType}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
