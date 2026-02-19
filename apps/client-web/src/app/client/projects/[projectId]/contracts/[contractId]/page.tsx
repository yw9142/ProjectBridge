"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Contract = {
  id: string;
  name: string;
  fileVersionId?: string | null;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SignerField = {
  page: number;
  coordX: number;
  coordY: number;
  coordW: number;
  coordH: number;
};

type SignerInfo = {
  assigned: boolean;
  myTurn?: boolean;
  envelopeId?: string;
  envelopeStatus?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientStatus?: string;
  signatureField?: SignerField;
  dateField?: SignerField;
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

function isSigned(signer: SignerInfo | null) {
  if (!signer?.assigned) return false;
  return signer.recipientStatus === "SIGNED" || signer.envelopeStatus === "COMPLETED";
}

export default function ClientContractSigningStatusPage() {
  const params = useParams<{ projectId: string; contractId: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const contractId = params.contractId;

  const [contract, setContract] = useState<Contract | null>(null);
  const [signer, setSigner] = useState<SignerInfo | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const signed = useMemo(() => isSigned(signer), [signer]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const contracts = await apiFetch<Contract[]>(`/api/projects/${projectId}/contracts`);
        const current = contracts.find((item) => item.id === contractId) ?? null;
        if (!current) {
          throw new Error("계약 정보를 찾을 수 없습니다.");
        }

        const signerInfo = await apiFetch<SignerInfo>(`/api/contracts/${contractId}/signer`);
        let downloadUrl = "";
        if (current.fileVersionId) {
          const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${current.fileVersionId}/download-url`);
          downloadUrl = result.downloadUrl;
        }

        if (!active) return;
        setContract(current);
        setSigner(signerInfo);
        setPdfUrl(downloadUrl);
      } catch (e) {
        if (!active) return;
        if (!handleAuthError(e, "/login")) {
          setError(e instanceof Error ? e.message : "서명 상태를 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [projectId, contractId]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">서명 상태를 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={() => router.push(`/client/projects/${projectId}/contracts`)}>
          계약 목록으로
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">서명 상태</h1>
        <Button variant="outline" size="sm" onClick={() => router.push(`/client/projects/${projectId}/contracts`)}>
          계약 목록으로
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{contract?.name ?? "-"}</CardTitle>
          <CardDescription>계약서의 최신 서명 상태와 서명 반영 문서를 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">서명 상태</p>
              <p className={`mt-1 font-semibold ${signed ? "text-emerald-700" : "text-amber-700"}`}>{signed ? "서명 완료" : "서명 진행중"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">마지막 수정</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDate(contract?.updatedAt ?? contract?.createdAt)}</p>
            </div>
          </div>

          {signer?.assigned ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">서명자 정보</p>
              <p className="mt-1 text-slate-700">
                {signer.recipientName} ({signer.recipientEmail})
              </p>
              <p className="mt-1 text-slate-600">
                Envelope: {signer.envelopeStatus ?? "-"} / Recipient: {signer.recipientStatus ?? "-"}
              </p>
              {signer.signatureField ? (
                <p className="mt-2 text-xs text-slate-600">
                  서명 필드: p{signer.signatureField.page} / x {signer.signatureField.coordX}, y {signer.signatureField.coordY}, w {signer.signatureField.coordW}, h{" "}
                  {signer.signatureField.coordH}
                </p>
              ) : null}
              {signer.dateField ? (
                <p className="mt-1 text-xs text-slate-600">
                  날짜 필드: p{signer.dateField.page} / x {signer.dateField.coordX}, y {signer.dateField.coordY}, w {signer.dateField.coordW}, h {signer.dateField.coordH}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-600">지정된 서명자가 없습니다.</div>
          )}

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-slate-900">서명 반영 문서</p>
              {pdfUrl ? (
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:underline">
                  새 창에서 열기
                </a>
              ) : null}
            </div>
            {pdfUrl ? (
              <iframe title="Signed contract PDF" src={pdfUrl} className="h-[72vh] w-full rounded border border-slate-200 bg-white" />
            ) : (
              <p className="text-sm text-slate-500">표시할 PDF가 없습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
