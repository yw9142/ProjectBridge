"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { StatusBadge } from "@/components/ui/StatusBadge";

type InvoiceStatus = "DRAFT" | "ISSUED" | "CONFIRMED" | "CLOSED" | "OVERDUE" | "CANCELLED";
type InvoicePhase = "ADVANCE" | "INTERMEDIATE" | "FINAL";

type Invoice = {
  id: string;
  invoiceNumber: string;
  phase: InvoicePhase;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueAt?: string | null;
  createdAt?: string;
};

type InvoiceAttachment = {
  id: string;
  objectKey: string;
};

const phaseLabels: Record<InvoicePhase, string> = {
  ADVANCE: "선금",
  INTERMEDIATE: "중도금",
  FINAL: "정산",
};

const statusOptions: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "DRAFT", label: "초안" },
  { value: "ISSUED", label: "발행" },
  { value: "CONFIRMED", label: "확인" },
  { value: "CLOSED", label: "종결" },
  { value: "OVERDUE", label: "연체" },
  { value: "CANCELLED", label: "취소" },
];

function formatDate(value?: string | null) {
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

export default function ClientBillingPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [items, setItems] = useState<Invoice[]>([]);
  const [attachmentsCount, setAttachmentsCount] = useState<Record<string, number>>({});
  const [draftStatuses, setDraftStatuses] = useState<Record<string, InvoiceStatus>>({});
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

  async function hydrateAttachmentCount(invoices: Invoice[]) {
    const nextCount: Record<string, number> = {};
    await Promise.all(
      invoices.map(async (invoice) => {
        try {
          const data = await apiFetch<InvoiceAttachment[]>(`/api/invoices/${invoice.id}/attachments`);
          nextCount[invoice.id] = data.length;
        } catch {
          nextCount[invoice.id] = 0;
        }
      }),
    );
    setAttachmentsCount(nextCount);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Invoice[]>(`/api/projects/${projectId}/invoices`);
      setItems(data);
      setDraftStatuses(Object.fromEntries(data.map((item) => [item.id, item.status])));
      await hydrateAttachmentCount(data);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "정산 항목을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function saveStatus(invoiceId: string) {
    const status = draftStatuses[invoiceId];
    if (!status) return;
    setError(null);
    try {
      await apiFetch(`/api/invoices/${invoiceId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "정산 상태 변경에 실패했습니다.");
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>정산</CardTitle>
        <CardDescription>선금/중도금/정산 항목을 확인하고 상태를 갱신합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>구분</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>통화</TableHead>
                <TableHead>기한</TableHead>
                <TableHead>첨부</TableHead>
                <TableHead>현재 상태</TableHead>
                <TableHead>변경 상태</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{phaseLabels[item.phase] ?? item.phase}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{item.amount.toLocaleString("ko-KR")}</TableCell>
                  <TableCell>{item.currency}</TableCell>
                  <TableCell>{formatDate(item.dueAt)}</TableCell>
                  <TableCell>{attachmentsCount[item.id] ?? 0}개</TableCell>
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
                          [item.id]: event.target.value as InvoiceStatus,
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
                  <TableCell>
                    <ConfirmActionButton
                      label="상태 저장"
                      title="정산 상태를 저장할까요?"
                      description="선택한 상태로 정산 상태가 변경됩니다."
                      onConfirm={() => saveStatus(item.id)}
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                    표시할 정산 항목이 없습니다.
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
