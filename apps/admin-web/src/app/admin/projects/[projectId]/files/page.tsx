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
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "?뚯씪 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??");
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
      throw new Error("泥⑤? ?뚯씪 ?낅줈?쒖뿉 ?ㅽ뙣?덉뒿?덈떎.");
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
      setError("?앹꽦 ??泥⑤? ?뚯씪? ?꾩닔?낅땲??");
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
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "?뚯씪 ?앹꽦???ㅽ뙣?덉뒿?덈떎.");
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
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "?뚯씪 ?섏젙???ㅽ뙣?덉뒿?덈떎.");
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
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "?뚯씪 ??젣???ㅽ뙣?덉뒿?덈떎.");
      }
    }
  }

  async function openAttachment(fileVersionId: string) {
    setError(null);
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${fileVersionId}/download-url`);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "泥⑤? ?뚯씪 ?닿린???ㅽ뙣?덉뒿?덈떎.");
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
                <th className="px-4 py-3">?쒕ぉ</th>
                <th className="px-4 py-3">援щ텇</th>
                <th className="px-4 py-3">?댁슜</th>
                <th className="px-4 py-3">泥⑤? ?뚯씪</th>
                <th className="px-4 py-3">?묒뾽</th>
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
                          泥⑤? 蹂닿린
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">泥⑤? ?놁쓬</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          ?섏젙
                        </button>
                        <ConfirmActionButton
                          label="??젣"
                          title="?뚯씪????젣?좉퉴??"
                          description="??젣 ??蹂듦뎄?????놁뒿?덈떎."
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
                    ?깅줉???뚯씪???놁뒿?덈떎.
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
          <h1 className="text-xl font-bold text-slate-900">?뚯씪</h1>
          <p className="text-sm text-slate-500">怨듭쑀???대???援щ텇?쇰줈 ?뚯씪??愿由ы빀?덈떎.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          ?뚯씪 ?앹꽦
        </button>
      </div>

      <div className="space-y-4">
        {renderSection("공유용", "클라이언트와 함께 보는 파일", sharedFiles)}
        {renderSection("내부용", "PM 내부 소통 전용 파일", internalFiles)}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="?뚯씪 ?앹꽦" description="?뚯씪 硫뷀??뺣낫? 媛?쒖꽦(visible)???ㅼ젙?⑸땲??">
        <form onSubmit={createFile} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="?쒕ぉ" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={5}
            placeholder="?댁슜"
            value={createContent}
            onChange={(e) => setCreateContent(e.target.value)}
          />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={createVisibilityScope}
            onChange={(e) => setCreateVisibilityScope(e.target.value as VisibilityScope)}
          >
            <option value="SHARED">怨듭쑀??(?대씪?댁뼵??怨듦컻)</option>
            <option value="INTERNAL">?대???(PM ?꾩슜)</option>
          </select>
          <div>
            <input type="file" accept="*/*" onChange={onPickCreateAttachment} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            {createAttachment ? <p className="mt-1 text-xs text-slate-500">?좏깮 ?뚯씪: {createAttachment.name}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              痍⑥냼
            </button>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
              ?앹꽦
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingItem)}
        onClose={() => setEditingId(null)}
        title="?뚯씪 ?섏젙"
        description="?쒕ぉ/?댁슜/visible ?듭뀡???섏젙?섍퀬 ?꾩슂 ????踰꾩쟾???낅줈?쒗빀?덈떎."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={5} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={editVisibilityScope}
            onChange={(e) => setEditVisibilityScope(e.target.value as VisibilityScope)}
          >
            <option value="SHARED">怨듭쑀??(?대씪?댁뼵??怨듦컻)</option>
            <option value="INTERNAL">?대???(PM ?꾩슜)</option>
          </select>
          <div>
            <input type="file" accept="*/*" onChange={onPickEditAttachment} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {editAttachment ? <p className="mt-1 text-xs text-slate-500">援먯껜 ?뚯씪: {editAttachment.name}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              痍⑥냼
            </button>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold !text-white hover:bg-slate-800">
              ???            </button>
          </div>
        </form>
      </Modal>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}


