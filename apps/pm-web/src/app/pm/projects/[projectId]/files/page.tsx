"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@/components/ui/modal";

type VisibilityScope = "SHARED" | "INTERNAL";

type FileItem = {
  id: string;
  name: string;
  description?: string | null;
  folder: string;
  visibilityScope: VisibilityScope;
  createdBy?: string;
  createdByName?: string;
};

type FileVersion = {
  id: string;
  version: number;
  objectKey: string;
  contentType: string;
  size: number;
  checksum: string;
  latest: boolean;
};

type PresignResponse = {
  uploadUrl: string;
  objectKey: string;
  contentType: string;
};

type LatestVersionMap = Record<string, FileVersion | null>;

function extractVersion(objectKey: string) {
  const matched = objectKey.match(/\/v(\d+)\//);
  if (!matched) return 1;
  return Number(matched[1]);
}

function visibilityLabel(scope: VisibilityScope) {
  return scope === "INTERNAL" ? "내부용" : "공유용";
}

export default function ProjectFilesPage() {
  const projectId = useProjectId();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createAttachment, setCreateAttachment] = useState<File | null>(null);
  const [createVisibilityScope, setCreateVisibilityScope] = useState<VisibilityScope>("SHARED");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAttachment, setEditAttachment] = useState<File | null>(null);
  const [editVisibilityScope, setEditVisibilityScope] = useState<VisibilityScope>("SHARED");

  const [error, setError] = useState<string | null>(null);

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    return files.find((item) => item.id === editingId) ?? null;
  }, [editingId, files]);

  const sharedFiles = useMemo(
    () => files.filter((file) => file.visibilityScope === "SHARED"),
    [files],
  );
  const internalFiles = useMemo(
    () => files.filter((file) => file.visibilityScope === "INTERNAL"),
    [files],
  );

  async function fetchLatestVersions(fileItems: FileItem[]) {
    const result: LatestVersionMap = {};
    await Promise.all(
      fileItems.map(async (file) => {
        try {
          const versions = await apiFetch<FileVersion[]>(`/api/files/${file.id}/versions`);
          result[file.id] = versions.find((item) => item.latest) ?? versions[0] ?? null;
        } catch {
          result[file.id] = null;
        }
      }),
    );
    setLatestVersions(result);
  }

  async function loadFiles() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<FileItem[]>(`/api/projects/${projectId}/files`);
      setFiles(data);
      await fetchLatestVersions(data);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "파일 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function onPickCreateAttachment(event: ChangeEvent<HTMLInputElement>) {
    setCreateAttachment(event.target.files?.[0] ?? null);
  }

  function onPickEditAttachment(event: ChangeEvent<HTMLInputElement>) {
    setEditAttachment(event.target.files?.[0] ?? null);
  }

  async function uploadFileVersion(fileId: string, uploadFile: File) {
    const contentType = uploadFile.type || "application/octet-stream";
    const presign = await apiFetch<PresignResponse>(`/api/files/${fileId}/versions/presign`, {
      method: "POST",
      body: JSON.stringify({ contentType }),
    });

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: uploadFile,
    });

    if (!uploadResponse.ok) {
      throw new Error("첨부 파일 업로드에 실패했습니다.");
    }

    const version = extractVersion(presign.objectKey);
    await apiFetch(`/api/files/${fileId}/versions/complete`, {
      method: "POST",
      body: JSON.stringify({
        version,
        objectKey: presign.objectKey,
        contentType,
        size: uploadFile.size,
        checksum: `${uploadFile.name}-${uploadFile.size}-${uploadFile.lastModified}`,
      }),
    });
  }

  async function createFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createAttachment) {
      setError("생성 시 첨부 파일은 필수입니다.");
      return;
    }
    setError(null);

    try {
      const created = await apiFetch<FileItem>(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: JSON.stringify({
          name: createTitle,
          description: createContent,
          folder: "/",
          visibilityScope: createVisibilityScope,
        }),
      });

      await uploadFileVersion(created.id, createAttachment);

      setCreateOpen(false);
      setCreateTitle("");
      setCreateContent("");
      setCreateAttachment(null);
      setCreateVisibilityScope("SHARED");
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "파일 생성에 실패했습니다.");
      }
    }
  }

  function openEditModal(item: FileItem) {
    setEditingId(item.id);
    setEditTitle(item.name);
    setEditContent(item.description ?? "");
    setEditAttachment(null);
    setEditVisibilityScope(item.visibilityScope);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      await apiFetch(`/api/files/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editTitle,
          description: editContent,
          folder: "/",
          visibilityScope: editVisibilityScope,
        }),
      });

      if (editAttachment) {
        await uploadFileVersion(editingId, editAttachment);
      }

      setEditingId(null);
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "파일 수정에 실패했습니다.");
      }
    }
  }

  async function removeFile(fileId: string) {
    setError(null);
    try {
      await apiFetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (editingId === fileId) {
        setEditingId(null);
      }
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "파일 삭제에 실패했습니다.");
      }
    }
  }

  async function openAttachment(fileVersionId: string) {
    setError(null);
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${fileVersionId}/download-url`);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "첨부 파일 열기에 실패했습니다.");
      }
    }
  }

  function renderSection(title: string, description: string, rows: FileItem[]) {
    return (
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">구분</th>
                <th className="px-4 py-3">내용</th>
                <th className="px-4 py-3">첨부 파일</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.map((item) => {
                const latest = latestVersions[item.id] ?? null;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{visibilityLabel(item.visibilityScope)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{item.description || "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">등록자: {item.createdByName ?? item.createdBy ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {latest ? (
                        <button
                          type="button"
                          onClick={() => void openAttachment(latest.id)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          첨부 보기
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">첨부 없음</span>
                      )}
                    </td>
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
                          label="삭제"
                          title="파일을 삭제할까요?"
                          description="삭제 후 복구할 수 없습니다."
                          onConfirm={() => removeFile(item.id)}
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
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    등록된 파일이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">파일</h1>
          <p className="text-sm text-slate-500">공유용/내부용 구분으로 파일을 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          파일 생성
        </button>
      </div>

      <div className="space-y-4">
        {renderSection("공유용", "클라이언트와 함께 보는 파일", sharedFiles)}
        {renderSection("내부용", "PM 내부 소통 전용 파일", internalFiles)}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="파일 생성" description="파일 메타정보와 가시성(visible)을 설정합니다.">
        <form onSubmit={createFile} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="제목" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={5}
            placeholder="내용"
            value={createContent}
            onChange={(e) => setCreateContent(e.target.value)}
          />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={createVisibilityScope}
            onChange={(e) => setCreateVisibilityScope(e.target.value as VisibilityScope)}
          >
            <option value="SHARED">공유용 (클라이언트 공개)</option>
            <option value="INTERNAL">내부용 (PM 전용)</option>
          </select>
          <div>
            <input type="file" accept="*/*" onChange={onPickCreateAttachment} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            {createAttachment ? <p className="mt-1 text-xs text-slate-500">선택 파일: {createAttachment.name}</p> : null}
          </div>
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
        title="파일 수정"
        description="제목/내용/visible 옵션을 수정하고 필요 시 새 버전을 업로드합니다."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={5} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={editVisibilityScope}
            onChange={(e) => setEditVisibilityScope(e.target.value as VisibilityScope)}
          >
            <option value="SHARED">공유용 (클라이언트 공개)</option>
            <option value="INTERNAL">내부용 (PM 전용)</option>
          </select>
          <div>
            <input type="file" accept="*/*" onChange={onPickEditAttachment} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {editAttachment ? <p className="mt-1 text-xs text-slate-500">교체 파일: {editAttachment.name}</p> : null}
          </div>
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
