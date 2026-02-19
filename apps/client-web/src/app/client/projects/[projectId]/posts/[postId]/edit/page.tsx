"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ConfirmSubmitButton } from "@/components/ui/confirm-action";
import { Skeleton } from "@/components/ui/skeleton";

type PostType = "ANNOUNCEMENT" | "GENERAL" | "QA" | "ISSUE" | "MEETING_MINUTES" | "RISK";

type Post = {
  id: string;
  type: PostType;
  title: string;
  body: string;
  pinned: boolean;
  visibilityScope?: "SHARED" | "INTERNAL";
};

export default function ClientPostEditPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string; postId: string }>();
  const projectId = params.projectId;
  const postId = params.postId;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<Post>(`/api/posts/${postId}`);
        if (data.visibilityScope === "INTERNAL") {
          throw new Error("접근할 수 없는 게시글입니다.");
        }
        setPost(data);
      } catch (e) {
        if (!handleAuthError(e, "/login")) {
          setError(e instanceof Error ? e.message : "게시글을 불러오지 못했습니다.");
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [postId]);

  async function updatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: post.title,
          body: post.body,
          pinned: post.pinned,
        }),
      });
      router.replace(`/client/projects/${projectId}/posts/${postId}`);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "게시글 수정에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !post) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href={`/client/projects/${projectId}/posts/${postId}`} className="text-sm text-indigo-600 hover:underline">
          상세로
        </Link>
        {loading ? (<div className="mt-3 space-y-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-24 w-full" /></div>) : <p className="mt-3 text-sm text-slate-500">게시글을 찾을 수 없습니다.</p>}
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">게시글 수정</h1>
        <Link href={`/client/projects/${projectId}/posts/${postId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          상세로
        </Link>
      </div>

      <form onSubmit={updatePost} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <p className="text-xs text-slate-500">{post.type}</p>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} required />
        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={8} value={post.body} onChange={(e) => setPost({ ...post, body: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={post.pinned} onChange={(e) => setPost({ ...post, pinned: e.target.checked })} />
          상단 고정
        </label>
        <ConfirmSubmitButton
          label={submitting ? "저장 중..." : "게시글 수정"}
          title="게시글을 수정할까요?"
          description="수정된 제목/본문/고정 상태가 저장됩니다."
          disabled={submitting}
          triggerVariant="outline"
          triggerClassName="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        />
      </form>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
