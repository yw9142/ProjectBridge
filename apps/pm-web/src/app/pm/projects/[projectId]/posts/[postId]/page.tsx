"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { ConfirmActionButton, ConfirmSubmitButton } from "@/components/ui/confirm-action";

type PostType = "ANNOUNCEMENT" | "GENERAL" | "QA" | "ISSUE" | "MEETING_MINUTES" | "RISK";

type Post = {
  id: string;
  type: PostType;
  title: string;
  body: string;
  pinned: boolean;
};

type Comment = {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PostDetailPage() {
  const params = useParams<{ projectId: string; postId: string }>();
  const projectId = params.projectId;
  const postId = params.postId;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [postData, commentData] = await Promise.all([
        apiFetch<Post>(`/api/posts/${postId}`),
        apiFetch<Comment[]>(`/api/posts/${postId}/comments`),
      ]);
      setPost(postData);
      setComments(commentData);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "게시글 상세를 불러오지 못했습니다.");
      }
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody("");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "댓글 작성에 실패했습니다.");
      }
    }
  }

  async function updateComment(commentId: string) {
    setError(null);
    try {
      await apiFetch(`/api/post-comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: editingCommentBody }),
      });
      setEditingCommentId(null);
      setEditingCommentBody("");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "댓글 수정에 실패했습니다.");
      }
    }
  }

  async function deleteComment(commentId: string) {
    setError(null);
    try {
      await apiFetch(`/api/post-comments/${commentId}`, { method: "DELETE" });
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingCommentBody("");
      }
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "댓글 삭제에 실패했습니다.");
      }
    }
  }

  async function updatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!post) return;
    setError(null);
    try {
      await apiFetch(`/api/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: post.title, body: post.body, pinned: post.pinned }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "게시글 수정에 실패했습니다.");
      }
    }
  }

  if (!post) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link href={`/pm/projects/${projectId}/posts`} className="text-sm text-indigo-600 hover:underline">
          목록으로
        </Link>
        <p className="mt-3 text-sm text-slate-500">게시글을 불러오는 중입니다.</p>
        {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">게시글 상세</h1>
        <Link href={`/pm/projects/${projectId}/posts`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          목록으로
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
          label="게시글 수정"
          title="게시글을 수정할까요?"
          description="수정한 제목/본문/고정 상태가 저장됩니다."
          triggerVariant="outline"
          triggerClassName="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        />
      </form>

      <article className="space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">댓글</h2>
        <form onSubmit={createComment} className="space-y-2">
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} placeholder="댓글" value={commentBody} onChange={(e) => setCommentBody(e.target.value)} required />
          <ConfirmSubmitButton
            label="댓글 작성"
            title="댓글을 등록할까요?"
            description="현재 게시글에 댓글이 추가됩니다."
            triggerVariant="default"
            triggerClassName="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold !text-white"
          />
        </form>

        <div className="space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              {editingCommentId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full rounded border border-slate-300 px-3 py-2"
                    rows={3}
                    value={editingCommentBody}
                    onChange={(e) => setEditingCommentBody(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCommentId(null)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateComment(comment.id)}
                      className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-slate-800"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-slate-800">{comment.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    작성자: {comment.createdBy} · {formatDate(comment.createdAt)}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(comment.id);
                        setEditingCommentBody(comment.body);
                      }}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      수정
                    </button>
                    <ConfirmActionButton
                      label="삭제"
                      title="댓글을 삭제할까요?"
                      description="삭제 후 복구할 수 없습니다."
                      onConfirm={() => deleteComment(comment.id)}
                      triggerVariant="destructive"
                      triggerSize="sm"
                      triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      confirmVariant="destructive"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
          {comments.length === 0 ? <p className="text-sm text-slate-500">댓글이 없습니다.</p> : null}
        </div>
      </article>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
