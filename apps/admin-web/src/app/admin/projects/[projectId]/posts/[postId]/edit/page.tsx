"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ConfirmSubmitButton } from "@/components/ui/confirm-action";

type PostType = "ANNOUNCEMENT" | "GENERAL" | "QA" | "ISSUE" | "MEETING_MINUTES" | "RISK";
type VisibilityScope = "SHARED" | "INTERNAL";

type Post = {
  id: string;
  type: PostType;
  title: string;
  body: string;
  pinned: boolean;
  visibilityScope: VisibilityScope;
};

export default function PostEditPage() {
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
        setPost(data);
      } catch (e) {
        if (!handleAuthError(e, "/admin/login")) {
          setError(e instanceof Error ? e.message : "寃뚯떆湲??遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
          visibilityScope: post.visibilityScope,
        }),
      });
      router.replace(`/admin/projects/${projectId}/posts/${postId}`);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "寃뚯떆湲 ?섏젙???ㅽ뙣?덉뒿?덈떎.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !post) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href={`/admin/projects/${projectId}/posts/${postId}`} className="text-sm text-indigo-600 hover:underline">
          ?곸꽭濡?        </Link>
        <p className="mt-3 text-sm text-slate-500">寃뚯떆湲??遺덈윭?ㅻ뒗 以묒엯?덈떎.</p>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">寃뚯떆湲 ?섏젙</h1>
        <Link href={`/admin/projects/${projectId}/posts/${postId}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          ?곸꽭濡?        </Link>
      </div>

      <form onSubmit={updatePost} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <p className="text-xs text-slate-500">{post.type}</p>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} required />
        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={8} value={post.body} onChange={(e) => setPost({ ...post, body: e.target.value })} required />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={post.pinned} onChange={(e) => setPost({ ...post, pinned: e.target.checked })} />
          ?곷떒 怨좎젙
        </label>
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={post.visibilityScope}
          onChange={(e) => setPost({ ...post, visibilityScope: e.target.value as VisibilityScope })}
        >
          <option value="SHARED">怨듭쑀??(?대씪?댁뼵??怨듦컻)</option>
          <option value="INTERNAL">?대???(PM ?꾩슜)</option>
        </select>
        <ConfirmSubmitButton
          label={submitting ? "???以?.." : "寃뚯떆湲 ?섏젙"}
          title="寃뚯떆湲???섏젙?좉퉴??"
          description="?섏젙???쒕ぉ/蹂몃Ц/怨좎젙/怨듦컻 踰붿쐞媛 ??λ맗?덈떎."
          disabled={submitting}
          triggerVariant="outline"
          triggerClassName="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        />
      </form>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}



