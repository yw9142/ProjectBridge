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
  contentType: string;
};

function extractVersion(objectKey: string) {
  const matched = objectKey.match(/\/v(\d+)\//);
  if (!matched) {
    return 1;
  }
  return Number(matched[1]);
}

function statusLabel(status: ContractStatus) {
  if (status === "DRAFT") return "작성 중";
  if (status === "ACTIVE") return "승인";
  return "반려/보관";
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

  const [error, setError] = useState<string | null>(null);

  const fileVersionMap = useMemo(() => new Map(fileVersions.map((item) => [item.id, item])), [fileVersions]);

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
      if (!handleAuthError(e, "/login")) {
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
    const presign = await apiFetch<PresignResponse>(`/api/files/${fileId}/versions/presign`, {
      method: "POST",
      body: JSON.stringify({ contentType }),
    });

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: pdf,
    });

    if (!uploadResponse.ok) {
      throw new Error("PDF 업로드에 실패했습니다.");
    }

    const version = extractVersion(presign.objectKey);
    const completed = await apiFetch<FileVersionSummary>(`/api/files/${fileId}/versions/complete`, {
      method: "POST",
      body: JSON.stringify({
        version,
        objectKey: presign.objectKey,
        contentType,
        size: pdf.size,
        checksum: `${pdf.name}-${pdf.size}-${pdf.lastModified}`,
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
      if (!handleAuthError(e, "/login")) {
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
      if (!handleAuthError(e, "/login")) {
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
      if (!handleAuthError(e, "/login")) {
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
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "계약서 열기에 실패했습니다.");
      }
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">계약</h1>
          <p className="text-sm text-slate-500">계약명과 PDF 파일만 등록합니다. 사인/승인 처리는 client-web에서 진행합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          계약 생성
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">계약명</th>
              <th className="px-4 py-3">계약서</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {contracts.map((contract) => {
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
                  <td className="px-4 py-3 text-slate-700">{statusLabel(contract.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
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
            {!loading && contracts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
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

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
