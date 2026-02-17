"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MessageSquare, Pin, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  commentCount?: number;
};

const postTypeLabels: Record<PostType, string> = {
  ANNOUNCEMENT: "공지",
  GENERAL: "일반",
  QA: "Q&A",
  ISSUE: "이슈",
  MEETING_MINUTES: "회의록",
  RISK: "리스크",
};

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sortByCreatedAt(items: Post[]) {
  return [...items].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
}

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

  const sortedPosts = useMemo(() => sortByCreatedAt(posts), [posts]);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">커뮤니케이션</h1>
          <p className="text-sm text-slate-500">게시글을 카드 형태로 확인하고 댓글 상세로 이동합니다.</p>
        </div>
        <Link href={`/client/projects/${projectId}/posts/new`} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
          게시글 작성
        </Link>
      </div>

      {loading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}

      <div className="space-y-3">
        {sortedPosts.map((post) => (
          <article key={post.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {postTypeLabels[post.type] ?? post.type}
                </span>
                {post.pinned ? <Pin className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" /> : null}
              </div>
              <span className="text-xs text-slate-500">{formatDate(post.createdAt)}</span>
            </div>

            <Link href={`/client/projects/${projectId}/posts/${post.id}`} className="mt-3 block">
              <p className="text-lg font-semibold text-slate-900">{post.title}</p>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{post.body}</p>
            </Link>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <UserCircle2 className="h-4 w-4" aria-hidden="true" />
                {post.createdByName ?? post.createdBy ?? "-"}
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  댓글 {(post.commentCount ?? 0).toLocaleString("ko-KR")}개
                </span>
                <ConfirmActionButton
                  label="삭제"
                  title="게시글을 삭제할까요?"
                  description="삭제 후 되돌릴 수 없습니다."
                  onConfirm={() => removePost(post.id)}
                  triggerVariant="destructive"
                  triggerSize="sm"
                  triggerClassName="rounded border border-red-700 bg-red-600 px-2.5 py-1.5 text-xs font-semibold !text-white hover:bg-red-700"
                  confirmVariant="destructive"
                />
              </div>
            </div>
          </article>
        ))}

        {!loading && sortedPosts.length === 0 ? <p className="text-sm text-slate-500">게시글이 없습니다.</p> : null}
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
