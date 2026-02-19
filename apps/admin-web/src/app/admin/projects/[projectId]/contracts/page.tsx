"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@/components/ui/modal";

type ContractStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

type Contract = {
  id: string;
  name: string;
  fileVersionId?: string | null;
  status: ContractStatus;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type FileVersionSummary = {
  id: string;
  fileId: string;
  fileName: string;
  version: number;
  latest: boolean;
};

type PresignResponse = {
  uploadUrl: string;
  objectKey: string;
  version: number;
  contentType: string;
  size: number;
  checksum: string;
  uploadTicket: string;
};

type EnvelopeStatus = "DRAFT" | "SENT" | "COMPLETED" | "VOIDED";

type Envelope = {
  id: string;
  title: string;
  status: EnvelopeStatus;
  sentAt?: string | null;
  completedAt?: string | null;
};

type EnvelopeDetail = {
  envelope: Envelope;
  recipients: Array<{
    id: string;
    recipientName: string;
    recipientEmail: string;
    status: string;
    signingOrder: number;
  }>;
};

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: "진행 중",
  ACTIVE: "완료",
  ARCHIVED: "보관",
};

const statusBadgeStyles: Record<ContractStatus, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-slate-300 bg-slate-100 text-slate-700",
};

function formatDateTime(value?: string) {
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

function sortContracts(items: Contract[]) {
  return [...items].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function ProjectContractsPage() {
  const projectId = useProjectId();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPdf, setCreatePdf] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPdf, setEditPdf] = useState<File | null>(null);

  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [recipientsByEnvelope, setRecipientsByEnvelope] = useState<Record<string, EnvelopeDetail["recipients"]>>({});
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState("");
  const [newEnvelopeTitle, setNewEnvelopeTitle] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientOrder, setNewRecipientOrder] = useState("1");

  const [error, setError] = useState<string | null>(null);

  const fileVersionMap = useMemo(() => new Map(fileVersions.map((item) => [item.id, item])), [fileVersions]);
  const sortedContracts = useMemo(() => sortContracts(contracts), [contracts]);
  const doneCount = useMemo(() => contracts.filter((item) => item.status === "ACTIVE").length, [contracts]);
  const inProgressCount = useMemo(() => contracts.filter((item) => item.status === "DRAFT").length, [contracts]);
  const selectedRecipients = selectedEnvelopeId ? recipientsByEnvelope[selectedEnvelopeId] ?? [] : [];

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [contractData, versionData] = await Promise.all([
        apiFetch<Contract[]>(`/api/projects/${projectId}/contracts`),
        apiFetch<FileVersionSummary[]>(`/api/projects/${projectId}/file-versions`),
      ]);
      setContracts(contractData);
      setFileVersions(versionData);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function onPickCreatePdf(event: ChangeEvent<HTMLInputElement>) {
    setCreatePdf(event.target.files?.[0] ?? null);
  }

  function onPickEditPdf(event: ChangeEvent<HTMLInputElement>) {
    setEditPdf(event.target.files?.[0] ?? null);
  }

  async function uploadPdfToFile(fileId: string, pdf: File) {
    const contentType = pdf.type || "application/pdf";
    const checksum = `${pdf.name}-${pdf.size}-${pdf.lastModified}`;
    const presign = await apiFetch<PresignResponse>(`/api/files/${fileId}/versions/presign`, {
      method: "POST",
      body: JSON.stringify({ contentType, size: pdf.size, checksum }),
    });

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: pdf,
    });

    if (!uploadResponse.ok) {
      throw new Error("PDF 업로드에 실패했습니다.");
    }

    const completed = await apiFetch<FileVersionSummary>(`/api/files/${fileId}/versions/complete`, {
      method: "POST",
      body: JSON.stringify({
        version: presign.version,
        objectKey: presign.objectKey,
        contentType,
        size: pdf.size,
        checksum,
        uploadTicket: presign.uploadTicket,
      }),
    });

    return completed;
  }

  async function createBackingFile(contractName: string, pdf: File) {
    const file = await apiFetch<{ id: string }>(`/api/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify({
        name: `${contractName}.pdf`,
        description: "계약서 파일",
        folder: "/contracts",
      }),
    });
    return uploadPdfToFile(file.id, pdf);
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createPdf) {
      setError("계약서 PDF 파일을 첨부해 주세요.");
      return;
    }
    setError(null);
    try {
      const version = await createBackingFile(createName, createPdf);
      await apiFetch(`/api/projects/${projectId}/contracts`, {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          fileVersionId: version.id,
        }),
      });
      setCreateOpen(false);
      setCreateName("");
      setCreatePdf(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 생성에 실패했습니다.");
      }
    }
  }

  function openEditModal(contract: Contract) {
    setEditingId(contract.id);
    setEditName(contract.name);
    setEditPdf(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);

    try {
      const target = contracts.find((item) => item.id === editingId);
      if (!target) return;

      let nextFileVersionId = target.fileVersionId ?? null;

      if (editPdf) {
        const currentVersion = target.fileVersionId ? fileVersionMap.get(target.fileVersionId) : undefined;
        if (currentVersion) {
          const uploaded = await uploadPdfToFile(currentVersion.fileId, editPdf);
          nextFileVersionId = uploaded.id;
        } else {
          const uploaded = await createBackingFile(editName, editPdf);
          nextFileVersionId = uploaded.id;
        }
      }

      await apiFetch(`/api/contracts/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          fileVersionId: nextFileVersionId,
          clearFileVersion: nextFileVersionId === null,
        }),
      });

      setEditingId(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 수정에 실패했습니다.");
      }
    }
  }

  async function deleteContract(contractId: string) {
    setError(null);
    try {
      await apiFetch(`/api/contracts/${contractId}`, { method: "DELETE" });
      if (editingId === contractId) {
        setEditingId(null);
      }
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 삭제에 실패했습니다.");
      }
    }
  }

  async function openContractPdf(fileVersionId: string) {
    setError(null);
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${fileVersionId}/download-url`);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약서 열기에 실패했습니다.");
      }
    }
  }

  async function loadSigningData(contractId: string) {
    setSigningLoading(true);
    try {
      const envelopeData = await apiFetch<Envelope[]>(`/api/contracts/${contractId}/envelopes`);
      const details = await Promise.all(envelopeData.map((item) => apiFetch<EnvelopeDetail>(`/api/envelopes/${item.id}`)));

      const nextRecipients: Record<string, EnvelopeDetail["recipients"]> = {};
      details.forEach((detail) => {
        nextRecipients[detail.envelope.id] = detail.recipients;
      });

      setEnvelopes(envelopeData);
      setRecipientsByEnvelope(nextRecipients);
      setSelectedEnvelopeId((prev) => {
        if (prev && envelopeData.some((item) => item.id === prev)) {
          return prev;
        }
        return envelopeData[0]?.id ?? "";
      });
    } finally {
      setSigningLoading(false);
    }
  }

  async function openSigningModal(contractId: string) {
    setSigningContractId(contractId);
    setError(null);
    setNewEnvelopeTitle("");
    setNewRecipientName("");
    setNewRecipientEmail("");
    setNewRecipientOrder("1");
    try {
      await loadSigningData(contractId);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "Failed to load signature management data.");
      }
    }
  }

  async function createEnvelope(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signingContractId) return;
    setError(null);
    try {
      await apiFetch(`/api/contracts/${signingContractId}/envelopes`, {
        method: "POST",
        body: JSON.stringify({ title: newEnvelopeTitle }),
      });
      setNewEnvelopeTitle("");
      await loadSigningData(signingContractId);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "Failed to create envelope.");
      }
    }
  }

  async function addRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEnvelopeId) return;
    setError(null);
    try {
      await apiFetch(`/api/envelopes/${selectedEnvelopeId}/recipients`, {
        method: "POST",
        body: JSON.stringify({
          name: newRecipientName,
          email: newRecipientEmail,
          signingOrder: Number(newRecipientOrder) || 1,
        }),
      });
      setNewRecipientName("");
      setNewRecipientEmail("");
      setNewRecipientOrder("1");
      if (signingContractId) {
        await loadSigningData(signingContractId);
      }
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "Failed to add recipient.");
      }
    }
  }

  async function sendEnvelope(envelopeId: string) {
    setError(null);
    try {
      await apiFetch(`/api/envelopes/${envelopeId}/send`, { method: "POST" });
      if (signingContractId) {
        await loadSigningData(signingContractId);
      }
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "Failed to send envelope.");
      }
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">계약</h1>
          <p className="text-sm text-slate-500">계약 진행 현황을 확인하고 마지막 수정 이력을 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          계약 생성
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">완료 처리</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{doneCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">진행 중</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{inProgressCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">계약명</th>
              <th className="px-4 py-3">계약서</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">마지막 수정</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedContracts.map((contract) => {
              const version = contract.fileVersionId ? fileVersionMap.get(contract.fileVersionId) : undefined;
              return (
                <tr key={contract.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <p>{contract.name}</p>
                    <p className="mt-1 text-xs font-normal text-slate-500">등록자: {contract.createdByName ?? contract.createdBy ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {contract.fileVersionId ? (
                      <button
                        type="button"
                        onClick={() => void openContractPdf(contract.fileVersionId as string)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {version ? `${version.fileName} v${version.version}` : "PDF 보기"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">PDF 없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyles[contract.status]}`}>
                      {statusLabels[contract.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(contract.updatedAt ?? contract.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void openSigningModal(contract.id)}
                          className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          서명 관리
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(contract)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                        수정
                      </button>
                      <ConfirmActionButton
                        label="삭제"
                        title="계약을 삭제할까요?"
                        description="삭제 후 복구할 수 없습니다."
                        onConfirm={() => deleteContract(contract.id)}
                        triggerVariant="destructive"
                        triggerSize="sm"
                        triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        confirmVariant="destructive"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && sortedContracts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  등록된 계약이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="계약 생성" description="계약명과 계약서 PDF를 입력합니다.">
        <form onSubmit={createContract} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="계약명" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
          <input type="file" accept="application/pdf" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={onPickCreatePdf} required />
          {createPdf ? <p className="text-xs text-slate-500">선택 파일: {createPdf.name}</p> : null}
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
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="계약 수정"
        description="계약명을 수정하고, 필요하면 PDF를 교체합니다."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <input type="file" accept="application/pdf" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={onPickEditPdf} />
          {editPdf ? <p className="text-xs text-slate-500">교체 파일: {editPdf.name}</p> : null}
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

      <Modal
        open={Boolean(signingContractId)}
        onClose={() => {
          setSigningContractId(null);
          setSelectedEnvelopeId("");
          setEnvelopes([]);
          setRecipientsByEnvelope({});
        }}
        title="전자서명 운영"
        description="Envelope 생성, 수신자 추가, 발송 상태를 관리합니다."
      >
        <div className="space-y-4">
          <form onSubmit={createEnvelope} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">Envelope 생성</p>
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Envelope 제목"
                value={newEnvelopeTitle}
                onChange={(e) => setNewEnvelopeTitle(e.target.value)}
                required
              />
              <button type="submit" className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
                생성
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">Envelope 목록</p>
            {signingLoading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}
            {!signingLoading && envelopes.length === 0 ? <p className="text-sm text-slate-500">생성된 envelope이 없습니다.</p> : null}
            <div className="space-y-2">
              {envelopes.map((envelope) => (
                <div key={envelope.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEnvelopeId(envelope.id)}
                    className={`rounded px-2 py-1 text-xs font-semibold ${
                      selectedEnvelopeId === envelope.id ? "bg-indigo-600 !text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {envelope.title}
                  </button>
                  <span className="text-xs text-slate-500">{envelope.status}</span>
                  <button
                    type="button"
                    onClick={() => void sendEnvelope(envelope.id)}
                    disabled={envelope.status !== "DRAFT"}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    발송
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={addRecipient} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">수신자 추가</p>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={selectedEnvelopeId}
              onChange={(e) => setSelectedEnvelopeId(e.target.value)}
              required
            >
              <option value="">Envelope 선택</option>
              {envelopes.map((envelope) => (
                <option key={envelope.id} value={envelope.id}>
                  {envelope.title}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="이름"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                required
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="이메일"
                type="email"
                value={newRecipientEmail}
                onChange={(e) => setNewRecipientEmail(e.target.value)}
                required
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="순서"
                type="number"
                min={1}
                value={newRecipientOrder}
                onChange={(e) => setNewRecipientOrder(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold !text-white hover:bg-slate-800">
              추가
            </button>
          </form>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">선택 Envelope 수신자</p>
            {selectedEnvelopeId === "" ? <p className="text-sm text-slate-500">Envelope를 선택하세요.</p> : null}
            {selectedEnvelopeId !== "" && selectedRecipients.length === 0 ? <p className="text-sm text-slate-500">등록된 수신자가 없습니다.</p> : null}
            <ul className="space-y-1">
              {selectedRecipients.map((recipient) => (
                <li key={recipient.id} className="rounded border border-slate-200 px-2 py-1 text-sm text-slate-700">
                  {recipient.signingOrder}. {recipient.recipientName} ({recipient.recipientEmail}) - {recipient.status}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

