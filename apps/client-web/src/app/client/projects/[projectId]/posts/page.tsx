"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action";

type Post = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt?: string;
};

type Comment = {
  id: string;
  body: string;
  createdBy: string;
  createdAt?: string;
};

type Me = {
  id: string;
};

function parseUserIdFromAccessToken(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const payloadSegment = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadSegment.padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function normalizeUserId(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/-/g, "").trim();
}

function isSameUserId(a?: string | null, b?: string | null) {
  const normalizedA = normalizeUserId(a);
  const normalizedB = normalizeUserId(b);
  return normalizedA.length > 0 && normalizedA === normalizedB;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ClientPostsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedPost = useMemo(() => posts.find((post) => post.id === selectedPostId) ?? null, [posts, selectedPostId]);

  async function loadPosts() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<Post[]>(`/api/projects/${projectId}/posts`);
      setPosts(data);
      const nextSelected = selectedPostId || data[0]?.id || "";
      setSelectedPostId(nextSelected);
      if (nextSelected) {
        await loadComments(nextSelected);
      } else {
        setComments([]);
      }
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "게시글을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadComments(postId: string) {
    try {
      const data = await apiFetch<Comment[]>(`/api/posts/${postId}/comments`);
      setComments(data);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "댓글을 불러오지 못했습니다.");
      }
    }
  }

  useEffect(() => {
    const tokenUserId = parseUserIdFromAccessToken();
    if (tokenUserId) {
      setCurrentUserId(tokenUserId);
      return;
    }

    const loadMe = async () => {
      try {
        const me = await apiFetch<Me>("/api/auth/me");
        setCurrentUserId(me.id);
      } catch {
        setCurrentUserId(null);
      }
    };

    void loadMe();
  }, []);

  useEffect(() => {
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!selectedPostId) return;
    void loadComments(selectedPostId);
  }, [selectedPostId]);

  async function createComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPostId) return;
    setError(null);
    try {
      await apiFetch(`/api/posts/${selectedPostId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: commentBody }),
      });
      setCommentBody("");
      await loadComments(selectedPostId);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "댓글 작성에 실패했습니다.");
      }
    }
  }

  async function saveComment(commentId: string) {
    setError(null);
    try {
      await apiFetch(`/api/post-comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body: editingCommentBody }),
      });
      setEditingCommentId(null);
      setEditingCommentBody("");
      if (selectedPostId) {
        await loadComments(selectedPostId);
      }
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
      if (selectedPostId) {
        await loadComments(selectedPostId);
      }
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "댓글 삭제에 실패했습니다.");
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>커뮤니케이션</CardTitle>
          <CardDescription>게시글을 선택해 내용을 확인하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {posts
            .slice()
            .sort((a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bTime - aTime;
            })
            .map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => setSelectedPostId(post.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left ${selectedPostId === post.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <p className="text-xs text-slate-500">{post.type}</p>
                <p className="text-sm font-semibold text-slate-900">{post.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{post.body}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(post.createdAt)}</p>
              </button>
            ))}
          {!loading && posts.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">게시글이 없습니다.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>댓글</CardTitle>
          <CardDescription>{selectedPost ? `${selectedPost.title} 게시글 댓글` : "게시글을 선택해 주세요."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={createComment} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={3}
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="댓글"
              required
              disabled={!selectedPostId}
            />
            <Button type="submit" variant="primary" size="sm" disabled={!selectedPostId}>
              댓글 등록
            </Button>
          </form>

          <div className="space-y-2">
            {comments.map((comment) => (
              <article key={comment.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                {editingCommentId === comment.id && isSameUserId(comment.createdBy, currentUserId) ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded border border-slate-300 px-3 py-2"
                      rows={3}
                      value={editingCommentBody}
                      onChange={(event) => setEditingCommentBody(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingCommentBody("");
                        }}
                      >
                        취소
                      </Button>
                      <Button variant="default" size="sm" onClick={() => void saveComment(comment.id)}>
                        저장
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-800">{comment.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      작성자: {comment.createdBy} · {formatDate(comment.createdAt)}
                    </p>
                    {isSameUserId(comment.createdBy, currentUserId) ? (
                      <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCommentId(comment.id);
                          setEditingCommentBody(comment.body);
                        }}
                      >
                        수정
                      </Button>
                      <ConfirmActionButton
                        label="삭제"
                        title="댓글을 삭제할까요?"
                        description="삭제 후 복구할 수 없습니다."
                        onConfirm={() => deleteComment(comment.id)}
                        triggerVariant="destructive"
                        triggerSize="sm"
                      />
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            ))}
            {!loading && comments.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">댓글이 없습니다.</p> : null}
          </div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 xl:col-span-2">{error}</p> : null}
    </div>
  );
}
