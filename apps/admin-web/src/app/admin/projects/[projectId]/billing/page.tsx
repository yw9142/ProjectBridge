"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@bridge/ui";

type InvoiceStatus = "DRAFT" | "ISSUED" | "CONFIRMED" | "CLOSED" | "OVERDUE" | "CANCELLED";
type InvoicePhase = "ADVANCE" | "INTERMEDIATE" | "FINAL";
type AttachmentType = "INVOICE_PDF" | "PROOF" | "TAX_DOC" | "OTHER";

type Invoice = {
  id: string;
  invoiceNumber: string;
  phase: InvoicePhase;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueAt?: string | null;
  createdBy?: string;
  createdByName?: string;
};

type Presign = {
  uploadUrl: string;
  objectKey: string;
  uploadToken: string;
};

const statuses: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "DRAFT", label: "초안" },
  { value: "ISSUED", label: "발행" },
  { value: "CONFIRMED", label: "확인" },
  { value: "CLOSED", label: "종결" },
  { value: "OVERDUE", label: "연체" },
  { value: "CANCELLED", label: "취소" },
];

const phases: Array<{ value: InvoicePhase; label: string }> = [
  { value: "ADVANCE", label: "선금" },
  { value: "INTERMEDIATE", label: "중도금" },
  { value: "FINAL", label: "정산" },
];

const statusBadgeStyles: Record<InvoiceStatus, string> = {
  DRAFT: "border-slate-300 bg-slate-100 text-slate-700",
  ISSUED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
};

function phaseLabel(phase: InvoicePhase) {
  return phases.find((item) => item.value === phase)?.label ?? phase;
}

function dateOnlyToIso(dateOnly: string) {
  return `${dateOnly}T00:00:00Z`;
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

export default function ProjectBillingPage() {
  const projectId = useProjectId();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPhase, setCreatePhase] = useState<InvoicePhase>("ADVANCE");
  const [createAmount, setCreateAmount] = useState("0");
  const [createCurrency, setCreateCurrency] = useState("KRW");
  const [createDueAt, setCreateDueAt] = useState("");
  const [createAttachment, setCreateAttachment] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhase, setEditPhase] = useState<InvoicePhase>("ADVANCE");
  const [editAmount, setEditAmount] = useState("0");
  const [editCurrency, setEditCurrency] = useState("KRW");
  const [editDueAt, setEditDueAt] = useState("");
  const [editStatus, setEditStatus] = useState<InvoiceStatus>("DRAFT");

  const [error, setError] = useState<string | null>(null);

  async function loadInvoices() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<Invoice[]>(`/api/projects/${projectId}/invoices`);
      setInvoices(data);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "정산 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function onPickCreateAttachment(event: ChangeEvent<HTMLInputElement>) {
    setCreateAttachment(event.target.files?.[0] ?? null);
  }

  async function uploadInvoiceAttachment(invoiceId: string, attachmentFile: File) {
    const presign = await apiFetch<Presign>(`/api/invoices/${invoiceId}/attachments/presign`, {
      method: "POST",
      body: JSON.stringify({ contentType: attachmentFile.type || "application/octet-stream" }),
    });

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": attachmentFile.type || "application/octet-stream" },
      body: attachmentFile,
    });

    if (!uploadResponse.ok) {
      throw new Error("첨부 업로드에 실패했습니다.");
    }

    await apiFetch(`/api/invoices/${invoiceId}/attachments/complete`, {
      method: "POST",
      body: JSON.stringify({
        attachmentType: "INVOICE_PDF" as AttachmentType,
        objectKey: presign.objectKey,
        uploadToken: presign.uploadToken,
      }),
    });
  }

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const created = await apiFetch<Invoice>(`/api/projects/${projectId}/invoices`, {
        method: "POST",
        body: JSON.stringify({
          phase: createPhase,
          amount: Number(createAmount),
          currency: createCurrency,
          dueAt: createDueAt ? dateOnlyToIso(createDueAt) : null,
        }),
      });

      if (createAttachment) {
        await uploadInvoiceAttachment(created.id, createAttachment);
      }

      setCreateOpen(false);
      setCreatePhase("ADVANCE");
      setCreateAmount("0");
      setCreateCurrency("KRW");
      setCreateDueAt("");
      setCreateAttachment(null);
      await loadInvoices();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "정산 생성에 실패했습니다.");
      }
    }
  }

  function openEditModal(invoice: Invoice) {
    setEditingId(invoice.id);
    setEditPhase(invoice.phase);
    setEditAmount(String(invoice.amount));
    setEditCurrency(invoice.currency);
    setEditDueAt(invoice.dueAt ? invoice.dueAt.slice(0, 10) : "");
    setEditStatus(invoice.status);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      await apiFetch(`/api/invoices/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          phase: editPhase,
          amount: Number(editAmount),
          currency: editCurrency,
          dueAt: editDueAt ? dateOnlyToIso(editDueAt) : null,
          status: editStatus,
        }),
      });
      setEditingId(null);
      await loadInvoices();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "정산 수정에 실패했습니다.");
      }
    }
  }

  async function deleteInvoice(invoiceId: string) {
    setError(null);
    try {
      await apiFetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (editingId === invoiceId) {
        setEditingId(null);
      }
      await loadInvoices();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "정산 삭제에 실패했습니다.");
      }
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">정산</h1>
          <p className="text-sm text-slate-500">선금/중도금/정산 항목을 생성하고 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          정산 생성
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">구분</th>
              <th className="px-4 py-3">금액</th>
              <th className="px-4 py-3">통화</th>
              <th className="px-4 py-3">기한</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3 text-slate-700">
                  <p>{phaseLabel(invoice.phase)}</p>
                  <p className="mt-1 text-xs text-slate-500">등록자: {invoice.createdByName ?? invoice.createdBy ?? "-"}</p>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{invoice.amount.toLocaleString("ko-KR")}</td>
                <td className="px-4 py-3 text-slate-700">{invoice.currency}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateOnly(invoice.dueAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyles[invoice.status]}`}>
                    {statuses.find((status) => status.value === invoice.status)?.label ?? invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(invoice)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      수정
                    </button>
                    <ConfirmActionButton
                      label="삭제"
                      title="정산 항목을 삭제할까요?"
                      description="삭제 후 되돌릴 수 없습니다."
                      onConfirm={() => deleteInvoice(invoice.id)}
                      triggerVariant="destructive"
                      triggerSize="sm"
                      triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      confirmVariant="destructive"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!loading && invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  등록된 정산 항목이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="정산 생성" description="구분, 금액, 첨부파일을 입력해 생성합니다.">
        <form onSubmit={createInvoice} className="space-y-3">
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={createPhase} onChange={(e) => setCreatePhase(e.target.value as InvoicePhase)}>
            {phases.map((phase) => (
              <option key={phase.value} value={phase.value}>
                {phase.label}
              </option>
            ))}
          </select>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="number" value={createAmount} onChange={(e) => setCreateAmount(e.target.value)} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="통화" value={createCurrency} onChange={(e) => setCreateCurrency(e.target.value)} />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={createDueAt} onChange={(e) => setCreateDueAt(e.target.value)} />
          <input type="file" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={onPickCreateAttachment} />
          {createAttachment ? <p className="text-xs text-slate-500">첨부 파일: {createAttachment.name}</p> : null}
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

      <Modal open={Boolean(editingId)} onClose={() => setEditingId(null)} title="정산 수정" description="정산 정보를 수정합니다.">
        <form onSubmit={saveEdit} className="space-y-3">
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editPhase} onChange={(e) => setEditPhase(e.target.value as InvoicePhase)}>
            {phases.map((phase) => (
              <option key={phase.value} value={phase.value}>
                {phase.label}
              </option>
            ))}
          </select>
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" type="date" value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} />
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editStatus} onChange={(e) => setEditStatus(e.target.value as InvoiceStatus)}>
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
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

