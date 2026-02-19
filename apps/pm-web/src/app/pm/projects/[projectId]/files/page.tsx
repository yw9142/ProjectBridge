"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, FileText, Folder, FolderOpen, GripVertical, Plus } from "lucide-react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@bridge/ui";

type VisibilityScope = "SHARED" | "INTERNAL";

type FileItem = {
  id: string;
  name: string;
  description?: string | null;
  folder: string;
  visibilityScope: VisibilityScope;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type FileFolder = {
  id: string;
  path: string;
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
  uploadToken: string;
};

type LatestVersionMap = Record<string, FileVersion | null>;
type DragPayload = { kind: "file"; fileId: string; sourceFolder: string } | { kind: "folder"; sourcePath: string };
type FileTreeRow =
  | { key: string; kind: "folder"; path: string; depth: number; name: string; isRoot: boolean; hasChildren: boolean; collapsed: boolean }
  | { key: string; kind: "file"; depth: number; file: FileItem };

function extractVersion(objectKey: string) {
  const matched = objectKey.match(/\/v(\d+)\//);
  if (!matched) return 1;
  return Number(matched[1]);
}

function normalizeFolderPath(path?: string | null) {
  if (!path) return "/";
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

function folderDepth(path: string) {
  if (path === "/") return 0;
  return path.split("/").filter(Boolean).length;
}

function folderName(path: string) {
  if (path === "/") return "Project Root";
  const segments = path.split("/").filter(Boolean);
  return segments.at(-1) ?? "폴더";
}

function parentFolder(path: string) {
  if (path === "/") return "/";
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return "/";
  return path.slice(0, idx);
}

function formatDateTime(value?: string | null) {
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

function formatFileSize(bytes?: number) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildTreeRows(items: FileItem[], folders: FileFolder[], collapsedFolders: Set<string>) {
  const normalizedItems = items.map((item) => ({ ...item, folder: normalizeFolderPath(item.folder) }));
  const filesByFolder = new Map<string, FileItem[]>();
  const folderChildren = new Map<string, Set<string>>();
  const allFolderPaths = new Set<string>(["/"]);

  for (const folder of folders) {
    allFolderPaths.add(normalizeFolderPath(folder.path));
  }
  for (const item of normalizedItems) {
    allFolderPaths.add(item.folder);
    if (!filesByFolder.has(item.folder)) {
      filesByFolder.set(item.folder, []);
    }
    filesByFolder.get(item.folder)?.push(item);
  }

  for (const folderPath of [...allFolderPaths]) {
    let current = folderPath;
    while (current !== "/") {
      allFolderPaths.add(parentFolder(current));
      current = parentFolder(current);
    }
  }

  for (const folderPath of allFolderPaths) {
    if (folderPath === "/") continue;
    const parent = parentFolder(folderPath);
    if (!folderChildren.has(parent)) {
      folderChildren.set(parent, new Set<string>());
    }
    folderChildren.get(parent)?.add(folderPath);
  }

  const rows: FileTreeRow[] = [
    {
      key: "folder:/",
      kind: "folder",
      path: "/",
      depth: 0,
      name: "Project Root",
      isRoot: true,
      hasChildren: (folderChildren.get("/")?.size ?? 0) > 0 || (filesByFolder.get("/")?.length ?? 0) > 0,
      collapsed: false,
    },
  ];

  const walk = (folderPath: string) => {
    const childFolders = [...(folderChildren.get(folderPath) ?? [])].sort((a, b) => a.localeCompare(b, "ko-KR"));
    for (const child of childFolders) {
      const childHasChildren = (folderChildren.get(child)?.size ?? 0) > 0 || (filesByFolder.get(child)?.length ?? 0) > 0;
      const collapsed = collapsedFolders.has(child);
      rows.push({
        key: `folder:${child}`,
        kind: "folder",
        path: child,
        depth: folderDepth(child),
        name: folderName(child),
        isRoot: false,
        hasChildren: childHasChildren,
        collapsed,
      });
      if (!collapsed) {
        walk(child);
      }
    }

    if (folderPath !== "/" && collapsedFolders.has(folderPath)) {
      return;
    }
    const files = [...(filesByFolder.get(folderPath) ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
    for (const file of files) {
      rows.push({
        key: `file:${file.id}`,
        kind: "file",
        depth: folderDepth(file.folder) + 1,
        file,
      });
    }
  };

  walk("/");
  return rows;
}

function visibilityLabel(scope: VisibilityScope) {
  return scope === "INTERNAL" ? "내부용" : "공유용";
}

export default function ProjectFilesPage() {
  const projectId = useProjectId();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [createFolder, setCreateFolder] = useState("/");
  const [createAttachment, setCreateAttachment] = useState<File | null>(null);
  const [createVisibilityScope, setCreateVisibilityScope] = useState<VisibilityScope>("SHARED");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editFolder, setEditFolder] = useState("/");
  const [editAttachment, setEditAttachment] = useState<File | null>(null);
  const [editVisibilityScope, setEditVisibilityScope] = useState<VisibilityScope>("SHARED");

  const [folderOpen, setFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("/");
  const [editingFolderPath, setEditingFolderPath] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [draggingRowKey, setDraggingRowKey] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    return files.find((item) => item.id === editingId) ?? null;
  }, [editingId, files]);

  const sharedFiles = useMemo(() => files.filter((file) => file.visibilityScope === "SHARED"), [files]);
  const internalFiles = useMemo(() => files.filter((file) => file.visibilityScope === "INTERNAL"), [files]);

  const folderPaths = useMemo(() => {
    const set = new Set<string>(["/"]);
    for (const folder of folders) {
      set.add(normalizeFolderPath(folder.path));
    }
    for (const file of files) {
      set.add(normalizeFolderPath(file.folder));
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko-KR"));
  }, [folders, files]);

  useEffect(() => {
    setCollapsedFolders((prev) => {
      const allowed = new Set(folderPaths);
      const next = new Set<string>();
      for (const path of prev) {
        if (path !== "/" && allowed.has(path)) {
          next.add(path);
        }
      }
      if (next.size !== prev.size) {
        return next;
      }
      for (const path of next) {
        if (!prev.has(path)) {
          return next;
        }
      }
      return prev;
    });
  }, [folderPaths]);

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
      const [fileData, folderData] = await Promise.all([
        apiFetch<FileItem[]>(`/api/projects/${projectId}/files`),
        apiFetch<FileFolder[]>(`/api/projects/${projectId}/file-folders`),
      ]);
      setFiles(fileData);
      setFolders(folderData);
      await fetchLatestVersions(fileData);
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
        uploadToken: presign.uploadToken,
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
          folder: normalizeFolderPath(createFolder),
          visibilityScope: createVisibilityScope,
        }),
      });

      await uploadFileVersion(created.id, createAttachment);

      setCreateOpen(false);
      setCreateTitle("");
      setCreateContent("");
      setCreateFolder("/");
      setCreateAttachment(null);
      setCreateVisibilityScope("SHARED");
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "파일 생성에 실패했습니다.");
      }
    }
  }

  async function submitCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/file-folders`, {
        method: "POST",
        body: JSON.stringify({
          name: newFolderName,
          parentPath: normalizeFolderPath(newFolderParent),
        }),
      });
      setFolderOpen(false);
      setNewFolderName("");
      setNewFolderParent("/");
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "폴더 생성에 실패했습니다.");
      }
    }
  }

  function openEditFolderModal(path: string) {
    if (path === "/") return;
    setEditingFolderPath(path);
    setEditFolderName(folderName(path));
  }

  async function submitEditFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFolderPath) return;
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/file-folders/rename`, {
        method: "POST",
        body: JSON.stringify({
          sourcePath: normalizeFolderPath(editingFolderPath),
          name: editFolderName,
        }),
      });
      setEditingFolderPath(null);
      setEditFolderName("");
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "폴더 수정에 실패했습니다.");
      }
    }
  }

  async function removeFolder(path: string) {
    if (path === "/") return;
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/file-folders/delete`, {
        method: "POST",
        body: JSON.stringify({ path: normalizeFolderPath(path) }),
      });
      if (editingFolderPath === path) {
        setEditingFolderPath(null);
      }
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "폴더 삭제에 실패했습니다.");
      }
    }
  }

  function openEditModal(item: FileItem) {
    setEditingId(item.id);
    setEditTitle(item.name);
    setEditContent(item.description ?? "");
    setEditFolder(normalizeFolderPath(item.folder));
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
          folder: normalizeFolderPath(editFolder),
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

  async function downloadAttachment(fileVersionId: string) {
    setError(null);
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${fileVersionId}/download-url`);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "다운로드에 실패했습니다.");
      }
    }
  }

  function canDrop(targetPath: string) {
    if (!dragging) return false;
    if (dragging.kind === "file") {
      return normalizeFolderPath(dragging.sourceFolder) !== normalizeFolderPath(targetPath);
    }
    const source = normalizeFolderPath(dragging.sourcePath);
    const target = normalizeFolderPath(targetPath);
    return source !== target && !target.startsWith(`${source}/`);
  }

  function onDragStartFile(event: DragEvent, file: FileItem) {
    const payload: DragPayload = {
      kind: "file",
      fileId: file.id,
      sourceFolder: normalizeFolderPath(file.folder),
    };
    setDragging(payload);
    setDraggingRowKey(`file:${file.id}`);
    event.dataTransfer.setData("text/plain", file.id);
    event.dataTransfer.effectAllowed = "move";
  }

  function onDragStartFolder(event: DragEvent, path: string) {
    if (path === "/") return;
    const payload: DragPayload = { kind: "folder", sourcePath: path };
    setDragging(payload);
    setDraggingRowKey(`folder:${path}`);
    event.dataTransfer.setData("text/plain", path);
    event.dataTransfer.effectAllowed = "move";
  }

  function onDragOverFolder(event: DragEvent, targetPath: string) {
    if (!canDrop(targetPath)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetPath(targetPath);
  }

  function onDragLeaveFolder() {
    setDropTargetPath(null);
  }

  async function onDropFolder(event: DragEvent, targetPath: string) {
    event.preventDefault();
    if (!dragging || !canDrop(targetPath)) {
      setDropTargetPath(null);
      return;
    }
    setMoving(true);
    setError(null);
    try {
      if (dragging.kind === "file") {
        await apiFetch(`/api/files/${dragging.fileId}`, {
          method: "PATCH",
          body: JSON.stringify({ folder: normalizeFolderPath(targetPath) }),
        });
      } else {
        await apiFetch(`/api/projects/${projectId}/file-folders/move`, {
          method: "POST",
          body: JSON.stringify({
            sourcePath: normalizeFolderPath(dragging.sourcePath),
            targetPath: normalizeFolderPath(targetPath),
          }),
        });
      }
      await loadFiles();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "이동에 실패했습니다.");
      }
    } finally {
      setMoving(false);
      setDragging(null);
      setDropTargetPath(null);
      setDraggingRowKey(null);
    }
  }

  function onDragEnd() {
    setDragging(null);
    setDropTargetPath(null);
    setDraggingRowKey(null);
  }

  function toggleFolder(path: string) {
    if (path === "/") return;
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function renderSection(title: string, description: string, rows: FileItem[]) {
    const treeRows = buildTreeRows(rows, folders, collapsedFolders);
    return (
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">용도</th>
                <th className="px-4 py-3">등록자</th>
                <th className="px-4 py-3">크기</th>
                <th className="px-4 py-3">버전</th>
                <th className="px-4 py-3">업데이트 일시</th>
                <th className="px-4 py-3">다운로드</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {treeRows.map((row) => {
                if (row.kind === "folder") {
                  const isDropTarget = dropTargetPath === row.path && canDrop(row.path);
                  const isDraggingRow = draggingRowKey === row.key;
                  const isSelected = selectedRowKey === row.key;
                  const rowClassName = [
                    "transition-colors duration-150",
                    !row.isRoot ? "cursor-grab active:cursor-grabbing" : "",
                    isSelected ? "bg-slate-100" : "hover:bg-slate-50",
                    isDropTarget ? "bg-indigo-50/80" : "",
                    isDraggingRow ? "opacity-55" : "",
                  ]
                    .join(" ")
                    .trim();
                  return (
                    <tr
                      key={row.key}
                      draggable={!row.isRoot}
                      onDragStart={(event) => onDragStartFolder(event, row.path)}
                      onDragOver={(event) => onDragOverFolder(event, row.path)}
                      onDragLeave={onDragLeaveFolder}
                      onDrop={(event) => void onDropFolder(event, row.path)}
                      onDragEnd={onDragEnd}
                      onMouseDown={() => setSelectedRowKey(row.key)}
                      className={rowClassName}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 16}px` }}>
                          {!row.isRoot ? <GripVertical className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> : null}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFolder(row.path);
                            }}
                            disabled={!row.hasChildren || row.isRoot}
                            className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 transition hover:bg-slate-200/70 disabled:cursor-default disabled:opacity-30"
                            aria-label={row.collapsed ? "폴더 펼치기" : "폴더 접기"}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${row.collapsed ? "" : "rotate-90"}`} aria-hidden="true" />
                          </button>
                          {row.collapsed ? (
                            <Folder className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          ) : (
                            <FolderOpen className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          )}
                          <span className="font-medium text-slate-800">{row.name}</span>
                          {row.hasChildren ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{row.collapsed ? "접힘" : "펼침"}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">폴더</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3">
                        {row.isRoot ? (
                          <span className="text-xs text-slate-500">{moving ? "이동 중..." : isDropTarget ? "여기에 놓기" : "-"}</span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditFolderModal(row.path);
                              }}
                              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              수정
                            </button>
                            <ConfirmActionButton
                              label="삭제"
                              title="폴더를 삭제할까요?"
                              description="하위 폴더와 파일도 함께 삭제되며 복구할 수 없습니다."
                              onConfirm={() => removeFolder(row.path)}
                              triggerVariant="destructive"
                              triggerSize="sm"
                              triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                              confirmVariant="destructive"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }

                const latest = latestVersions[row.file.id] ?? null;
                const isDraggingRow = draggingRowKey === row.key;
                const isSelected = selectedRowKey === row.key;
                const fileRowClassName = [
                  "transition-colors duration-150 cursor-grab active:cursor-grabbing",
                  isSelected ? "bg-slate-100" : "hover:bg-slate-50",
                  isDraggingRow ? "opacity-55" : "",
                ]
                  .join(" ")
                  .trim();
                return (
                  <tr
                    key={row.key}
                    draggable
                    onDragStart={(event) => onDragStartFile(event, row.file)}
                    onDragEnd={onDragEnd}
                    onMouseDown={() => setSelectedRowKey(row.key)}
                    className={fileRowClassName}
                  >
                    <td className="px-4 py-3">
                      <div className="space-y-1" style={{ paddingLeft: `${row.depth * 16}px` }}>
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                          <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          <span className="font-medium text-slate-900">{row.file.name}</span>
                          {isDraggingRow ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">드래그 중</span> : null}
                        </div>
                        <p className="text-xs text-slate-500">{row.file.description || "-"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{visibilityLabel(row.file.visibilityScope)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.file.createdByName ?? row.file.createdBy ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{formatFileSize(latest?.size)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {latest ? <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">v{latest.version}</span> : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(row.file.updatedAt ?? row.file.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {latest ? (
                        <button
                          type="button"
                          onClick={() => void downloadAttachment(latest.id)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          다운로드
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(row.file)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          수정
                        </button>
                        <ConfirmActionButton
                          label="삭제"
                          title="파일을 삭제할까요?"
                          description="삭제 후 복구할 수 없습니다."
                          onConfirm={() => removeFile(row.file.id)}
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
              {!loading && treeRows.length === 1 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                    등록된 파일이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">폴더 좌측 화살표로 펼치기/접기를 제어하고, 파일 또는 폴더를 드래그해 원하는 폴더로 이동할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">파일</h1>
          <p className="text-sm text-slate-500">공유/내부 파일을 폴더 구조로 관리하고 최신 버전을 다운로드합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFolderOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            폴더 추가
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
          >
            파일 업로드
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {renderSection("공유용", "클라이언트와 함께 보는 파일", sharedFiles)}
        {renderSection("내부용", "PM 내부 소통 전용 파일", internalFiles)}
      </div>

      <Modal open={folderOpen} onClose={() => setFolderOpen(false)} title="폴더 추가" description="새 폴더를 생성합니다.">
        <form onSubmit={submitCreateFolder} className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="폴더명"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            required
          />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={newFolderParent}
            onChange={(e) => setNewFolderParent(e.target.value)}
          >
            {folderPaths.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFolderOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
              생성
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingFolderPath)} onClose={() => setEditingFolderPath(null)} title="폴더 수정" description="폴더 이름을 변경합니다.">
        <form onSubmit={submitEditFolder} className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="폴더명"
            value={editFolderName}
            onChange={(e) => setEditFolderName(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingFolderPath(null)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
              저장
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="파일 생성" description="파일 정보와 대상 폴더를 선택합니다.">
        <form onSubmit={createFile} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="파일명" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={createFolder}
            onChange={(e) => setCreateFolder(e.target.value)}
          >
            {folderPaths.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={4}
            placeholder="설명"
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
        description="파일 정보와 폴더를 수정하고 필요 시 새 버전을 업로드합니다."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={editFolder}
            onChange={(e) => setEditFolder(e.target.value)}
          >
            {folderPaths.map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
          <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={4} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
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

