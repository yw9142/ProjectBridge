"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Contract = {
  id: string;
  name: string;
  fileVersionId?: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
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

type SignerInfo = {
  assigned: boolean;
  myTurn?: boolean;
  envelopeId?: string;
  envelopeStatus?: string;
  recipientId?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientStatus?: string;
};

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

function isSigningDone(signer: SignerInfo | undefined) {
  if (!signer?.assigned) return false;
  return signer.recipientStatus === "SIGNED" || signer.envelopeStatus === "COMPLETED";
}

function signingStatusLabel(signer: SignerInfo | undefined) {
  if (!signer?.assigned) {
    return {
      label: "서명자 미지정",
      className: "border-slate-300 bg-slate-100 text-slate-700",
    };
  }
  if (isSigningDone(signer)) {
    return {
      label: "서명 완료",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (signer.myTurn) {
    return {
      label: "내 서명 필요",
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  return {
    label: "서명 대기",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

export default function ClientContractsPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersionSummary[]>([]);
  const [signersByContract, setSignersByContract] = useState<Record<string, SignerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileVersionMap = useMemo(() => new Map(fileVersions.map((item) => [item.id, item])), [fileVersions]);
  const sortedContracts = useMemo(
    () =>
      [...contracts].sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }),
    [contracts],
  );

  const signedCount = useMemo(
    () => sortedContracts.filter((contract) => isSigningDone(signersByContract[contract.id])).length,
    [sortedContracts, signersByContract],
  );
  const waitingCount = useMemo(
    () => sortedContracts.filter((contract) => signersByContract[contract.id]?.assigned && !isSigningDone(signersByContract[contract.id])).length,
    [sortedContracts, signersByContract],
  );

  useEffect(() => {
    const toast = searchParams.get("toast");
    if (toast !== "signed") {
      return;
    }

    setToastMessage("서명이 완료되었습니다.");
    router.replace(`/client/projects/${projectId}/contracts`);
    const timeout = window.setTimeout(() => setToastMessage(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [projectId, router, searchParams]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [contractData, versionData] = await Promise.all([
        apiFetch<Contract[]>(`/api/projects/${projectId}/contracts`),
        apiFetch<FileVersionSummary[]>(`/api/projects/${projectId}/file-versions`),
      ]);
      setContracts(contractData);
      setFileVersions(versionData);

      const signerEntries = await Promise.all(
        contractData.map(async (contract) => {
          try {
            const signer = await apiFetch<SignerInfo>(`/api/contracts/${contract.id}/signer`);
            return [contract.id, signer] as const;
          } catch {
            return [contract.id, { assigned: false }] as const;
          }
        }),
      );
      setSignersByContract(Object.fromEntries(signerEntries));
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

  async function openContractPdf(fileVersionId: string) {
    setError(null);
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${fileVersionId}/download-url`);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "계약서를 열지 못했습니다.");
      }
    }
  }

  function openSigning(contractId: string) {
    router.push(`/sign/${contractId}`);
  }

  function openSigningStatus(contractId: string) {
    router.push(`/client/projects/${projectId}/contracts/${contractId}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>계약</CardTitle>
        <CardDescription>서명 진행 상태를 확인하고, 내 차례인 계약은 바로 서명할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {toastMessage ? (
          <div className="fixed right-4 top-4 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow">
            {toastMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">서명 완료</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{signedCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">서명 진행중</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{waitingCount}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>계약명</TableHead>
                <TableHead>계약서</TableHead>
                <TableHead>서명 상태</TableHead>
                <TableHead>서명자</TableHead>
                <TableHead>마지막 수정</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContracts.map((contract) => {
                const version = contract.fileVersionId ? fileVersionMap.get(contract.fileVersionId) : undefined;
                const signer = signersByContract[contract.id];
                const canSign = Boolean(
                  signer?.assigned &&
                    signer.myTurn &&
                    signer.envelopeStatus !== "COMPLETED" &&
                    signer.recipientStatus !== "SIGNED",
                );
                const done = isSigningDone(signer);
                const statusInfo = signingStatusLabel(signer);

                return (
                  <TableRow key={contract.id}>
                    <TableCell className="font-semibold text-slate-900">
                      <p>{contract.name}</p>
                      <p className="mt-1 text-xs font-normal text-slate-500">등록자: {contract.createdByName ?? contract.createdBy ?? "-"}</p>
                    </TableCell>
                    <TableCell>
                      {contract.fileVersionId ? (
                        <Button size="sm" variant="outline" onClick={() => void openContractPdf(contract.fileVersionId as string)}>
                          {version ? `${version.fileName} v${version.version}` : "PDF 보기"}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">PDF 없음</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}>{statusInfo.label}</span>
                    </TableCell>
                    <TableCell>
                      {signer?.assigned ? (
                        <span className="text-xs text-slate-700">
                          {signer.recipientName} ({signer.recipientEmail})
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">서명자가 지정되지 않았습니다.</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(contract.updatedAt ?? contract.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openSigningStatus(contract.id)}>
                          서명 상태
                        </Button>
                        {canSign ? (
                          <Button size="sm" onClick={() => openSigning(contract.id)}>
                            서명하기
                          </Button>
                        ) : done ? (
                          <Button size="sm" variant="secondary" disabled>
                            서명 완료
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    표시할 계약이 없습니다.
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
