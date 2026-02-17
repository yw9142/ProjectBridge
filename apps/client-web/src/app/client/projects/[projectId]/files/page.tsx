"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type VisibilityScope = "SHARED" | "INTERNAL";

type FileItem = {
  id: string;
  name: string;
  description?: string | null;
  visibilityScope: VisibilityScope;
  createdAt?: string;
};

type FileVersion = {
  id: string;
  version: number;
  latest: boolean;
};

type LatestVersionMap = Record<string, FileVersion | null>;

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

function sortFilesByCreatedAt(items: FileItem[]) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function ClientFilesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [items, setItems] = useState<FileItem[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sharedItems = useMemo(() => sortFilesByCreatedAt(items), [items]);

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
      const data = await apiFetch<FileItem[]>(`/api/projects/${projectId}/files`);
      const sharedData = data.filter((item) => item.visibilityScope === "SHARED");
      setItems(sharedData);
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

  function renderFileTable(title: string, description: string, rows: FileItem[]) {
    return (
      <div className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>제목</TableHead>
                <TableHead>내용</TableHead>
                <TableHead>첨부 파일</TableHead>
                <TableHead>생성 시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const latest = latestVersions[item.id] ?? null;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                    <TableCell>{item.description || "-"}</TableCell>
                    <TableCell>
                      {latest ? (
                        <Button size="sm" variant="outline" onClick={() => void openAttachment(latest.id)}>
                          첨부 보기
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">첨부 없음</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">
                    표시할 파일이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>파일</CardTitle>
        <CardDescription>공유 파일 목록입니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderFileTable("파일 목록", "클라이언트와 공유되는 파일", sharedItems)}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
