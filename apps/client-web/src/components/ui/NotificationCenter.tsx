"use client";

import { Bell } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const unread = useMemo(() => items.length, [items]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림 열기"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label="알림 센터"
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-xl"
        >
          <p className="mb-2 text-sm font-semibold text-foreground">알림 센터</p>
          <div className="max-h-72 space-y-2 overflow-auto">
            {error ? <p className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
            {items.length === 0 ? <p className="rounded-md border border-dashed border-border p-2 text-sm text-muted-foreground">새 알림이 없습니다.</p> : null}
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-muted/30 p-2">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.eventType}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
