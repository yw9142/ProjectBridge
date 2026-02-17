"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type VaultAccountRequest = {
  id: string;
  name: string;
  siteUrl?: string | null;
  requestReason?: string | null;
  credentialReady: boolean;
  providedAt?: string | null;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
};

const vaultStatusStyles = {
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
};

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

export default function ClientVaultPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [items, setItems] = useState<VaultAccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionTargetId, setProvisionTargetId] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
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
      const data = await apiFetch<VaultAccountRequest[]>(`/api/projects/${projectId}/vault/account-requests`);
      setItems(data);
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "Vault 요청 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function openProvisionModal(targetId: string) {
    setProvisionTargetId(targetId);
    setLoginId("");
    setPassword("");
    setProvisionOpen(true);
  }

  async function provision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provisionTargetId) return;
    setError(null);
    try {
      const plainSecret = JSON.stringify({ id: loginId, password });
      await apiFetch(`/api/vault/secrets/${provisionTargetId}/provision`, {
        method: "PATCH",
        body: JSON.stringify({ plainSecret }),
      });
      setProvisionOpen(false);
      setProvisionTargetId(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "계정 정보 제공에 실패했습니다.");
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault</CardTitle>
        <CardDescription>PM 요청에 따라 플랫폼 계정 정보를 입력합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>플랫폼</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>요청 이유</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>제공 시각</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                  <TableCell>{item.siteUrl || "-"}</TableCell>
                  <TableCell>
                    <p>{item.requestReason || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">등록자: {item.createdByName ?? item.createdBy ?? "-"}</p>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        item.credentialReady ? vaultStatusStyles.READY : vaultStatusStyles.PENDING
                      }`}
                    >
                      {item.credentialReady ? "입력 완료" : "입력 대기"}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(item.providedAt)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => openProvisionModal(item.id)}>
                      {item.credentialReady ? "재입력" : "계정 입력"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    표시할 요청이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <Modal open={provisionOpen} onClose={() => setProvisionOpen(false)} title="계정 정보 입력" description="요청된 플랫폼의 로그인 정보를 입력합니다.">
          <form onSubmit={provision} className="space-y-3">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="로그인 ID"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              required
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="비밀번호"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProvisionOpen(false)}>
                취소
              </Button>
              <Button type="submit" variant="primary">
                저장
              </Button>
            </div>
          </form>
        </Modal>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
