"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { StatusBadge } from "@/components/ui/StatusBadge";

type RequestType = "APPROVAL" | "INFO_REQUEST" | "FEEDBACK" | "SIGNATURE" | "PAYMENT_CONFIRMATION" | "VAULT_ACCESS" | "MEETING_CONFIRMATION";
type RequestStatus = "DRAFT" | "SENT" | "ACKED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";

type RequestItem = {
  id: string;
  title: string;
  description?: string | null;
  type: RequestType;
  status: RequestStatus;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
};

const typeLabels: Record<RequestType, string> = {
  APPROVAL: "승인 요청",
  INFO_REQUEST: "정보 요청",
  FEEDBACK: "피드백 요청",
  SIGNATURE: "서명 요청",
  PAYMENT_CONFIRMATION: "결제 확인",
  VAULT_ACCESS: "Vault 접근",
  MEETING_CONFIRMATION: "회의 확인",
};

const statusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: "ACKED", label: "확인" },
  { value: "IN_PROGRESS", label: "진행 중" },
  { value: "DONE", label: "완료" },
  { value: "REJECTED", label: "반려" },
  { value: "CANCELLED", label: "취소" },
];

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

export default function ClientRequestsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [items, setItems] = useState<RequestItem[]>([]);
  const [draftStatuses, setDraftStatuses] = useState<Record<string, RequestStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }),
    [items],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<RequestItem[]>(`/api/projects/${projectId}/requests`);
      setItems(data);
      setDraftStatuses(Object.fromEntries(data.map((item) => [item.id, item.status])));
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
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

  async function saveStatus(requestId: string) {
    const status = draftStatuses[requestId];
    if (!status) return;
    setError(null);
    try {
      await apiFetch(`/api/requests/${requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "요청 상태 변경에 실패했습니다.");
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>요청</CardTitle>
        <CardDescription>PM에서 생성한 요청을 확인하고 상태를 업데이트합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>유형</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>현재 상태</TableHead>
                <TableHead>변경 상태</TableHead>
                <TableHead>생성 시각</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{typeLabels[item.type] ?? item.type}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{item.title}</TableCell>
                  <TableCell>
                    <p>{item.description || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">등록자: {item.createdByName ?? item.createdBy ?? "-"}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      value={draftStatuses[item.id] ?? item.status}
                      onChange={(event) =>
                        setDraftStatuses((prev) => ({
                          ...prev,
                          [item.id]: event.target.value as RequestStatus,
                        }))
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell>
                    <ConfirmActionButton
                      label="상태 저장"
                      title="요청 상태를 저장할까요?"
                      description="선택한 상태로 즉시 반영됩니다."
                      onConfirm={() => saveStatus(item.id)}
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    표시할 요청이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
