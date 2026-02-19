"use client";

import { useEffect, useState } from "react";
import { apiFetchPublic } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";

type SigningData = {
  envelope: { id: string; title: string; status: string };
  recipient: { id: string; recipientName: string; recipientEmail: string; status: string };
  fields: Array<{ id: string; fieldType: string; label?: string }>;
  pdfDownloadUrl: string;
};

export function SigningPageClient({ recipientToken }: { recipientToken: string }) {
  const [data, setData] = useState<SigningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetchPublic<SigningData>(`/api/signing/${recipientToken}`);
        if (active) {
          setData(response);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "서명 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [recipientToken]);

  async function markViewed() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      await apiFetchPublic(`/api/signing/${recipientToken}/viewed`, { method: "POST" });
      setResult("열람 이벤트를 기록했습니다.");
      setData((prev) => (prev ? { ...prev, recipient: { ...prev.recipient, status: "VIEWED" } } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "열람 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSignature() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiFetchPublic<{ signed: boolean; completed: boolean }>(`/api/signing/${recipientToken}/submit`, {
        method: "POST",
      });
      setResult(response.completed ? "서명이 완료되었습니다. 완료 문서가 생성되었습니다." : "서명을 제출했습니다.");
      setData((prev) =>
        prev
          ? {
              ...prev,
              envelope: { ...prev.envelope, status: response.completed ? "COMPLETED" : prev.envelope.status },
              recipient: { ...prev.recipient, status: "SIGNED" },
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "서명 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-6">서명 정보를 불러오는 중..</main>;
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4">서명 데이터를 찾을 수 없습니다.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">전자서명</h1>
              <p className="text-sm text-slate-500">{data.envelope.title}</p>
            </div>
            <StatusBadge status={data.envelope.status} />
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div>
              <dt className="font-semibold">수신자</dt>
              <dd>{data.recipient.recipientName}</dd>
            </div>
            <div>
              <dt className="font-semibold">이메일</dt>
              <dd>{data.recipient.recipientEmail}</dd>
            </div>
            <div>
              <dt className="font-semibold">서명 필드 수</dt>
              <dd>{data.fields.length}</dd>
            </div>
            <div>
              <dt className="font-semibold">PDF URL</dt>
              <dd className="truncate">{data.pdfDownloadUrl}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              disabled={submitting}
              onClick={markViewed}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              열람 기록
            </button>
            <button
              disabled={submitting}
              onClick={submitSignature}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              서명 제출
            </button>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
          {result ? <p className="mt-4 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{result}</p> : null}
        </section>
      </div>
    </main>
  );
}
