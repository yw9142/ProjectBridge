"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmSubmitButton } from "@/components/ui/confirm-action";

type PostType = "ANNOUNCEMENT" | "GENERAL" | "QA" | "ISSUE" | "MEETING_MINUTES" | "RISK";

const postTypes: PostType[] = ["ANNOUNCEMENT", "GENERAL", "QA", "ISSUE", "MEETING_MINUTES", "RISK"];

export default function NewPostPage() {
  const router = useRouter();
  const projectId = useProjectId();
  const [type, setType] = useState<PostType>("GENERAL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>(`/api/projects/${projectId}/posts`, {
        method: "POST",
        body: JSON.stringify({ type, title, body, pinned }),
      });
      router.replace(`/admin/projects/${projectId}/posts/${created.id}`);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "게시글 생성에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">게시글 작성</h1>
        <Link href={`/admin/projects/${projectId}/posts`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          목록으로
        </Link>
      </div>

      <form onSubmit={createPost} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={type} onChange={(e) => setType(e.target.value as PostType)}>
          {postTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={10} placeholder="본문" value={body} onChange={(e) => setBody(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          상단 고정
        </label>
        <ConfirmSubmitButton
          label={submitting ? "작성 중..." : "등록"}
          title="게시글을 등록할까요?"
          description="입력한 내용으로 게시글이 생성됩니다."
          disabled={submitting}
          triggerClassName="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        />
      </form>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

