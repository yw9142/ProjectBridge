"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ConfirmActionButton } from "@/components/ui/confirm-action";

type PostType = "ANNOUNCEMENT" | "GENERAL" | "QA" | "ISSUE" | "MEETING_MINUTES" | "RISK";
type VisibilityScope = "SHARED" | "INTERNAL";

type Post = {
  id: string;
  type: PostType;
  title: string;
  body: string;
  pinned: boolean;
  visibilityScope: VisibilityScope;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
};

export default function ClientPostsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<Post[]>(`/api/projects/${projectId}/posts`);
      setPosts(data.filter((post) => post.visibilityScope !== "INTERNAL"));
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "게시글 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function removePost(postId: string) {
    setError(null);
    try {
      await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
      await loadPosts();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "게시글 삭제에 실패했습니다.");
      }
    }
  }

  function renderPostSection(title: string, description: string, data: Post[]) {
    return (
      <div className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="space-y-2">
          {data.map((post) => (
            <article key={post.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/client/projects/${projectId}/posts/${post.id}`} className="block min-w-0 flex-1">
                  <p className="text-xs text-slate-500">
                    {post.type}
                    {post.pinned ? " · 고정" : ""}
                  </p>
                  <p className="text-xs text-slate-500">작성자: {post.createdByName ?? post.createdBy ?? "-"}</p>
                  <p className="truncate font-semibold text-slate-900">{post.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.body}</p>
                </Link>
                <ConfirmActionButton
                  label="삭제"
                  title="게시글을 삭제할까요?"
                  description="삭제 후 되돌릴 수 없습니다."
                  onConfirm={() => removePost(post.id)}
                  triggerVariant="destructive"
                  triggerSize="sm"
                  triggerClassName="rounded border border-red-700 bg-red-600 px-2 py-1 text-xs font-semibold !text-white hover:bg-red-700"
                  confirmVariant="destructive"
                />
              </div>
            </article>
          ))}
          {!loading && data.length === 0 ? <p className="text-sm text-slate-500">게시글이 없습니다.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">커뮤니케이션</h1>
          <p className="text-sm text-slate-500">게시판 형태로 글을 조회하고 상세에서 댓글을 작성합니다.</p>
        </div>
        <Link href={`/client/projects/${projectId}/posts/new`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
          게시글 작성
        </Link>
      </div>

      {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}

      <div className="space-y-4">
        {renderPostSection("게시글", "클라이언트와 함께 보는 게시글", posts)}
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
