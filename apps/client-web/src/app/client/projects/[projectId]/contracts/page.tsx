"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ContractStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

type Contract = {
  id: string;
  name: string;
  fileVersionId?: string | null;
  status: ContractStatus;
  createdAt?: string;
};

type FileVersionSummary = {
  id: string;
  fileId: string;
  fileName: string;
  version: number;
  latest: boolean;
};

type EnvelopeBrief = {
  id: string;
  title: string;
  status: string;
};

type EnvelopeDetail = {
  envelope: EnvelopeBrief;
  recipients: Array<{ id: string; recipientName: string; recipientEmail: string; recipientToken: string }>;
};

type UserProfile = {
  email: string;
};

type SignLink = {
  envelopeId: string;
  envelopeTitle: string;
  envelopeStatus: string;
  recipientName: string;
  recipientEmail: string;
  recipientToken: string;
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

export default function ClientContractsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersionSummary[]>([]);
  const [signLinks, setSignLinks] = useState<Record<string, SignLink[]>>({});
  const [loadingLinksFor, setLoadingLinksFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileVersionMap = useMemo(() => new Map(fileVersions.map((item) => [item.id, item])), [fileVersions]);

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

  async function reviewContract(contractId: string, approved: boolean) {
    setError(null);
    try {
      await apiFetch(`/api/contracts/${contractId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ approved }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "계약 검토 처리에 실패했습니다.");
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

  async function loadSignLinks(contractId: string) {
    setError(null);
    setLoadingLinksFor(contractId);
    try {
      const me = await apiFetch<UserProfile>("/api/auth/me");
      const envelopes = await apiFetch<EnvelopeBrief[]>(`/api/contracts/${contractId}/envelopes`);
      const details = await Promise.all(envelopes.map((item) => apiFetch<EnvelopeDetail>(`/api/envelopes/${item.id}`)));

      const links = details.flatMap((detail) =>
        detail.recipients
          .filter((recipient) => recipient.recipientEmail.toLowerCase() === me.email.toLowerCase())
          .map((recipient) => ({
            envelopeId: detail.envelope.id,
            envelopeTitle: detail.envelope.title,
            envelopeStatus: detail.envelope.status,
            recipientName: recipient.recipientName,
            recipientEmail: recipient.recipientEmail,
            recipientToken: recipient.recipientToken,
          })),
      );

      setSignLinks((prev) => ({ ...prev, [contractId]: links }));
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "서명 링크 조회에 실패했습니다.");
      }
    } finally {
      setLoadingLinksFor(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>계약</CardTitle>
        <CardDescription>계약서를 검토하고 승인 또는 반려를 처리합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>계약명</TableHead>
                <TableHead>계약서</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>생성 시각</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts
                .slice()
                .sort((a, b) => {
                  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return bTime - aTime;
                })
                .map((contract) => {
                  const version = contract.fileVersionId ? fileVersionMap.get(contract.fileVersionId) : undefined;
                  const links = signLinks[contract.id] ?? [];

                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-semibold text-slate-900">{contract.name}</TableCell>
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
                        <StatusBadge status={contract.status} />
                      </TableCell>
                      <TableCell>{formatDate(contract.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <ConfirmActionButton
                            label="승인"
                            title="계약을 승인할까요?"
                            description="승인 시 계약 상태가 ACTIVE로 변경됩니다."
                            onConfirm={() => reviewContract(contract.id, true)}
                            triggerVariant="outline"
                            triggerSize="sm"
                            confirmVariant="primary"
                          />
                          <ConfirmActionButton
                            label="반려"
                            title="계약을 반려할까요?"
                            description="반려 시 계약 상태가 ARCHIVED로 변경됩니다."
                            onConfirm={() => reviewContract(contract.id, false)}
                            triggerVariant="destructive"
                            triggerSize="sm"
                            confirmVariant="destructive"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void loadSignLinks(contract.id)}
                            disabled={loadingLinksFor === contract.id}
                          >
                            {loadingLinksFor === contract.id ? "조회 중..." : "서명 링크 조회"}
                          </Button>
                        </div>
                        {links.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {links.map((link) => (
                              <a
                                key={`${link.envelopeId}-${link.recipientToken}`}
                                href={`/sign/${link.recipientToken}`}
                                className="block text-xs text-indigo-600 hover:underline"
                              >
                                {link.envelopeTitle} ({link.envelopeStatus}) · 서명하기
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!loading && contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
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
