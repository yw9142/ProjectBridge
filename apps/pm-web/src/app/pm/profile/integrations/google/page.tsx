"use client";

import { useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action";

type GoogleStatus = {
  enabled: boolean;
  connected: boolean;
  code: string;
};

export default function GoogleIntegrationPage() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setError(null);
    try {
      const data = await apiFetch<GoogleStatus>("/api/integrations/google/status");
      setStatus(data);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "Google 연동 상태 조회에 실패했습니다.");
      }
    }
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const data = await apiFetch<GoogleStatus>("/api/integrations/google/status");
        if (!active) {
          return;
        }
        setStatus(data);
        setError(null);
      } catch (e) {
        if (!active) {
          return;
        }
        if (!handleAuthError(e, "/login")) {
          setError(e instanceof Error ? e.message : "Google 연동 상태 조회에 실패했습니다.");
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const connect = async () => {
    setError(null);
    try {
      await apiFetch("/api/integrations/google/connect", { method: "POST" });
      await loadStatus();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "연결 요청에 실패했습니다.");
      }
    }
  };

  const disconnect = async () => {
    setError(null);
    try {
      await apiFetch("/api/integrations/google/disconnect", { method: "POST" });
      await loadStatus();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "연결 해제 요청에 실패했습니다.");
      }
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Google 연동</h1>
        <p className="mt-1 text-sm text-slate-500">현재 서버 플러그인 상태를 조회하고 연결/해제를 테스트합니다.</p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p>enabled: {String(status?.enabled ?? false)}</p>
          <p>connected: {String(status?.connected ?? false)}</p>
          <p>code: {status?.code ?? "-"}</p>
        </div>

        <div className="mt-4 flex gap-2">
          <ConfirmActionButton
            label="연결 요청"
            title="Google 연동 연결을 요청할까요?"
            onConfirm={connect}
            triggerVariant="primary"
            triggerClassName="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
          />
          <ConfirmActionButton
            label="연결 해제"
            title="Google 연동을 해제할까요?"
            onConfirm={disconnect}
            triggerVariant="outline"
            triggerClassName="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          />
        </div>

        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </main>
  );
}


