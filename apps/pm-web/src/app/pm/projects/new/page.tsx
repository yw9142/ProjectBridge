"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ConfirmSubmitButton } from "@/components/ui/confirm-action";
import { PmLogoutButton } from "@/components/layout/PmLogoutButton";

type CreatedProject = {
  id: string;
  name: string;
};

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = await apiFetch<CreatedProject>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      router.replace(`/pm/projects/${created.id}/dashboard`);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "프로젝트 생성에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">새 프로젝트 생성</h1>
            <p className="mt-1 text-sm text-slate-500">프로젝트 기본정보를 입력해 생성합니다.</p>
          </div>
          <PmLogoutButton />
        </div>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">프로젝트명</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="프로젝트명을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">설명</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={5}
              placeholder="프로젝트 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          <ConfirmSubmitButton
            label={submitting ? "생성 중..." : "생성"}
            title="새 프로젝트를 생성할까요?"
            description="입력한 프로젝트명과 설명으로 프로젝트가 생성됩니다."
            disabled={submitting}
            triggerClassName="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
          />
        </form>
      </div>
    </main>
  );
}
