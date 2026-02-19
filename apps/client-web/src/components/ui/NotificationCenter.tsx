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
    let stream: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempts = 0;
    const RECOVERING_MESSAGE_ATTEMPTS = 5;
    const MAX_RECONNECT_DELAY_MS = 10000;
    const BASE_RECONNECT_DELAY_MS = 1000;

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

    const buildStreamRequest = () => {
      const token = getAccessToken();
      const apiOrigin = new URL(API_BASE, window.location.origin).origin;
      const sameOriginApi = apiOrigin === window.location.origin;
      const useCookieAuth = sameOriginApi || !token;
      return {
        url: useCookieAuth
          ? `${API_BASE}/api/notifications/stream`
          : `${API_BASE}/api/notifications/stream?accessToken=${encodeURIComponent(token)}`,
        withCredentials: useCookieAuth,
      };
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const onCreated = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as Notice;
        setItems((prev) => [payload, ...prev].slice(0, 20));
      } catch {
        // ignore ping payloads
      }
    };

    const onOpen = () => {
      reconnectAttempts = 0;
      if (active) {
        setError(null);
      }
    };

    const closeStream = () => {
      if (!stream) {
        return;
      }
      stream.removeEventListener("open", onOpen as EventListener);
      stream.removeEventListener("notification.created", onCreated as EventListener);
      stream.removeEventListener("error", onError as EventListener);
      stream.close();
      stream = null;
    };

    const scheduleReconnect = () => {
      if (!active || reconnectTimer !== null) {
        return;
      }

      reconnectAttempts += 1;
      const delayMs = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
      if (active) {
        setError(
          reconnectAttempts <= RECOVERING_MESSAGE_ATTEMPTS
            ? `실시간 연결 복구 중... (${reconnectAttempts}/${RECOVERING_MESSAGE_ATTEMPTS})`
            : "실시간 연결이 불안정합니다. 자동 복구를 계속 시도 중입니다."
        );
      }

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!active) {
          return;
        }
        connectStream();
      }, delayMs);
    };

    const onError = () => {
      closeStream();
      if (!active) {
        return;
      }

      void (async () => {
        try {
          await apiFetch<unknown>("/api/auth/me");
        } catch (e) {
          if (!handleAuthError(e, "/login") && active) {
            setError(e instanceof Error ? e.message : "실시간 연결을 복구하지 못했습니다.");
          }
          return;
        }

        scheduleReconnect();
      })();
    };

    const connectStream = () => {
      closeStream();
      const request = buildStreamRequest();
      stream = new EventSource(request.url, { withCredentials: request.withCredentials });
      stream.addEventListener("open", onOpen as EventListener);
      stream.addEventListener("notification.created", onCreated as EventListener);
      stream.addEventListener("error", onError as EventListener);
    };

    load();
    connectStream();

    return () => {
      active = false;
      clearReconnectTimer();
      closeStream();
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

