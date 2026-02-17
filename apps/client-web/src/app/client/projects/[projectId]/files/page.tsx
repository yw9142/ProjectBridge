"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, Folder } from "lucide-react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

type FileVersion = {
  id: string;
  version: number;
  size: number;
  latest: boolean;
};

type FileFolder = {
  id: string;
  path: string;
};

type LatestVersionMap = Record<string, FileVersion | null>;
type FileTreeRow =
  | { key: string; kind: "folder"; path: string; depth: number; name: string; isRoot: boolean }
  | { key: string; kind: "file"; depth: number; file: FileItem };

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

function buildTreeRows(items: FileItem[], folders: FileFolder[]) {
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
      name: folderName("/"),
      isRoot: true,
    },
  ];

  const walk = (folder: string) => {
    const childFolders = [...(folderChildren.get(folder) ?? [])].sort((a, b) => a.localeCompare(b, "ko-KR"));
    for (const child of childFolders) {
      rows.push({
        key: `folder:${child}`,
        kind: "folder",
        path: child,
        depth: folderDepth(child),
        name: folderName(child),
        isRoot: false,
      });
      walk(child);
    }

    const files = [...(filesByFolder.get(folder) ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
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

export default function ClientFilesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [items, setItems] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const treeRows = useMemo(() => buildTreeRows(items, folders), [folders, items]);

  async function hydrateLatestVersions(fileItems: FileItem[]) {
    const nextMap: LatestVersionMap = {};
    await Promise.all(
      fileItems.map(async (item) => {
        try {
          const versions = await apiFetch<FileVersion[]>(`/api/files/${item.id}/versions`);
          nextMap[item.id] = versions.find((version) => version.latest) ?? versions[0] ?? null;
        } catch {
          nextMap[item.id] = null;
        }
      }),
    );
    setLatestVersions(nextMap);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, folderData] = await Promise.all([
        apiFetch<FileItem[]>(`/api/projects/${projectId}/files`),
        apiFetch<FileFolder[]>(`/api/projects/${projectId}/file-folders`),
      ]);
      const sharedData = data.filter((item) => item.visibilityScope === "SHARED");
      setItems(sharedData);
      setFolders(folderData);
      await hydrateLatestVersions(sharedData);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "파일 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>파일</CardTitle>
        <CardDescription>공유 파일을 폴더 구조로 확인하고 최신 파일을 다운로드합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">등록자</th>
                <th className="px-4 py-3">크기</th>
                <th className="px-4 py-3">버전</th>
                <th className="px-4 py-3">업데이트 일시</th>
                <th className="px-4 py-3">다운로드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {treeRows.map((row) => {
                if (row.kind === "folder") {
                  return (
                    <tr key={row.key}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${row.depth * 16}px` }}>
                          <Folder className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          <span className="font-medium text-slate-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                      <td className="px-4 py-3 text-slate-500">-</td>
                    </tr>
                  );
                }

                const latest = latestVersions[row.file.id] ?? null;
                return (
                  <tr key={row.key}>
                    <td className="px-4 py-3">
                      <div className="space-y-1" style={{ paddingLeft: `${row.depth * 16}px` }}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                          <span className="font-medium text-slate-900">{row.file.name}</span>
                        </div>
                        <p className="text-xs text-slate-500">{row.file.description || "-"}</p>
                      </div>
                    </td>
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
                  </tr>
                );
              })}
              {!loading && treeRows.length === 1 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    표시할 파일이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
