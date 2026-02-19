"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@/components/ui/modal";

type RequestType = "APPROVAL" | "INFO_REQUEST" | "FEEDBACK" | "SIGNATURE" | "PAYMENT_CONFIRMATION" | "VAULT_ACCESS" | "MEETING_CONFIRMATION";
type RequestStatus = "DRAFT" | "SENT" | "ACKED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";

type RequestItem = {
  id: string;
  type: RequestType;
  title: string;
  description?: string | null;
  status: RequestStatus;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
};

const requestTypeOptions: Array<{ value: RequestType; label: string }> = [
  { value: "APPROVAL", label: "승인 요청" },
  { value: "INFO_REQUEST", label: "정보 요청" },
  { value: "FEEDBACK", label: "피드백 요청" },
  { value: "SIGNATURE", label: "서명 요청" },
  { value: "PAYMENT_CONFIRMATION", label: "결제 확인" },
  { value: "VAULT_ACCESS", label: "Vault 접근" },
  { value: "MEETING_CONFIRMATION", label: "회의 확인" },
];

const requestStatusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: "DRAFT", label: "초안" },
  { value: "SENT", label: "발송" },
  { value: "ACKED", label: "확인" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "DONE", label: "완료" },
  { value: "REJECTED", label: "반려" },
  { value: "CANCELLED", label: "취소" },
];

const requestStatusBadgeStyles: Record<RequestStatus, string> = {
  DRAFT: "border-transparent bg-slate-100 text-slate-700",
  SENT: "border-transparent bg-sky-100 text-sky-700",
  ACKED: "border-transparent bg-sky-100 text-sky-700",
  IN_PROGRESS: "border-transparent bg-amber-100 text-amber-800",
  DONE: "border-transparent bg-emerald-100 text-emerald-700",
  REJECTED: "border-transparent bg-red-100 text-red-700",
  CANCELLED: "border-slate-300 text-slate-700",
};

function typeLabel(value: RequestType) {
  return requestTypeOptions.find((item) => item.value === value)?.label ?? value;
}

function statusLabel(value: RequestStatus) {
  return requestStatusOptions.find((item) => item.value === value)?.label ?? value;
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

function sortByCreatedAt(items: RequestItem[]) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function ProjectRequestsPage() {
  const projectId = useProjectId();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<RequestType>("APPROVAL");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<RequestType>("APPROVAL");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<RequestStatus>("DRAFT");

  const [error, setError] = useState<string | null>(null);

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    return items.find((item) => item.id === editingId) ?? null;
  }, [editingId, items]);

  const sortedItems = useMemo(() => sortByCreatedAt(items), [items]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<RequestItem[]>(`/api/projects/${projectId}/requests`);
      setItems(data);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "요청 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openEditModal(item: RequestItem) {
    setEditingId(item.id);
    setEditType(item.type);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditStatus(item.status);
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/requests`, {
        method: "POST",
        body: JSON.stringify({
          type: createType,
          title: createTitle,
          description: createDescription,
        }),
      });
      setCreateTitle("");
      setCreateDescription("");
      setCreateType("APPROVAL");
      setCreateOpen(false);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "요청 생성에 실패했습니다.");
      }
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      await apiFetch(`/api/requests/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: editType,
          title: editTitle,
          description: editDescription,
          status: editStatus,
        }),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "요청 수정에 실패했습니다.");
      }
    }
  }

  async function deleteRequest(requestId: string) {
    setError(null);
    try {
      await apiFetch(`/api/requests/${requestId}`, { method: "DELETE" });
      if (editingId === requestId) {
        setEditingId(null);
      }
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "요청 삭제에 실패했습니다.");
      }
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">요청</h1>
          <p className="text-sm text-slate-500">클라이언트와 주고받는 요청을 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          요청 생성
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">요청 유형</th>
              <th className="px-4 py-3">제목</th>
              <th className="px-4 py-3">내용</th>
              <th className="px-4 py-3">등록자</th>
              <th className="px-4 py-3">요청 시각</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={99} className="px-4 py-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </td>
              </tr>
            ) : null}
            {sortedItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${requestStatusBadgeStyles[item.status]}`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{typeLabel(item.type)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                <td className="px-4 py-3 text-slate-700">{item.description || "-"}</td>
                <td className="px-4 py-3 text-slate-700">{item.createdByName ?? item.createdBy ?? "-"}</td>
                <td className="px-4 py-3 text-slate-700">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      수정
                    </button>
                    <ConfirmActionButton
                      label={<span className="!text-white">삭제</span>}
                      title="요청을 삭제할까요?"
                      description="삭제 후 복구할 수 없습니다."
                      onConfirm={() => deleteRequest(item.id)}
                      triggerVariant="destructive"
                      triggerSize="sm"
                      triggerClassName="rounded border border-red-700 bg-red-600 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-red-700"
                      confirmVariant="destructive"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!loading && sortedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  등록된 요청이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="요청 생성" description="요청 유형과 내용을 입력해 생성합니다.">
        <form onSubmit={createRequest} className="space-y-3">
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={createType} onChange={(e) => setCreateType(e.target.value as RequestType)}>
            {requestTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="요청 제목"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            required
          />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={4}
            placeholder="요청 설명"
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
              생성
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingId(null)}
        title="요청 수정"
        description="요청 유형, 내용, 상태를 수정합니다."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editType} onChange={(e) => setEditType(e.target.value as RequestType)}>
            {requestTypeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={4} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editStatus} onChange={(e) => setEditStatus(e.target.value as RequestStatus)}>
            {requestStatusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold !text-white hover:bg-slate-800">
              저장
            </button>
          </div>
        </form>
      </Modal>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

