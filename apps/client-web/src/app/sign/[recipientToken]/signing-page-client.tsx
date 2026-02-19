"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";
import { apiFetch } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";

type SignatureFieldType = "SIGNATURE" | "INITIAL" | "DATE" | "TEXT" | "CHECKBOX";

type SigningField = {
  id: string;
  recipientId: string;
  type: SignatureFieldType;
  page: number;
  coordX: number;
  coordY: number;
  coordW: number;
  coordH: number;
};

type SigningData = {
  contractId: string;
  projectId: string;
  envelope: { id: string; title: string; status: string };
  recipient: { id: string; recipientName: string; recipientEmail: string; status: string };
  fields: SigningField[];
  pdfDownloadUrl: string;
};

const SIGNATURE_FIELD_TYPES: SignatureFieldType[] = ["SIGNATURE", "INITIAL"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SigningPageClient({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [data, setData] = useState<SigningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  const recipientFields = useMemo(() => {
    if (!data) return [];
    return data.fields.filter((field) => field.recipientId === data.recipient.id);
  }, [data]);

  const hasSignatureField = useMemo(
    () => recipientFields.some((field) => SIGNATURE_FIELD_TYPES.includes(field.type)),
    [recipientFields],
  );

  const isSigned = data?.recipient.status === "SIGNED";

  function buildInitialFieldValues(response: SigningData) {
    return Object.fromEntries(
      response.fields
        .filter((field) => field.recipientId === response.recipient.id)
        .map((field) => {
          if (field.type === "CHECKBOX") {
            return [field.id, "false"];
          }
          if (field.type === "DATE") {
            return [field.id, todayISO()];
          }
          return [field.id, ""];
        }),
    );
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<SigningData>(`/api/signing/contracts/${contractId}`);
        if (!active) {
          return;
        }
        setData(response);
        setFieldValues(buildInitialFieldValues(response));
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "서명 정보를 불러오지 못했습니다.");
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
  }, [contractId]);

  useEffect(() => {
    if (!hasSignatureField || isSigned) {
      signaturePadRef.current = null;
      return;
    }

    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = canvas.clientWidth || 600;
    const targetHeight = 180;
    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;
    const context = canvas.getContext("2d");
    if (context) {
      context.scale(dpr, dpr);
    }

    const pad = new SignaturePad(canvas, {
      minWidth: 0.8,
      maxWidth: 2.2,
      penColor: "#0f172a",
      backgroundColor: "rgba(255,255,255,0)",
    });
    signaturePadRef.current = pad;

    return () => {
      pad.off();
      signaturePadRef.current = null;
    };
  }, [hasSignatureField, isSigned, data?.recipient.id]);

  async function submitSignature() {
    if (!data) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const signatureDataUrl =
        hasSignatureField && signaturePadRef.current && !signaturePadRef.current.isEmpty() ? signaturePadRef.current.toDataURL("image/png") : null;

      const payloadFieldValues = { ...fieldValues };
      if (signatureDataUrl) {
        for (const field of recipientFields) {
          if (SIGNATURE_FIELD_TYPES.includes(field.type) && !payloadFieldValues[field.id]) {
            payloadFieldValues[field.id] = signatureDataUrl;
          }
        }
      }

      const response = await apiFetch<{ signed: boolean; completed: boolean; alreadySigned?: boolean }>(`/api/signing/contracts/${contractId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          fieldValues: payloadFieldValues,
          signatureDataUrl,
        }),
      });

      if (data.projectId) {
        router.replace(`/client/projects/${data.projectId}/contracts?toast=signed`);
        return;
      }

      setResult(response.alreadySigned ? "이미 서명이 완료된 문서입니다." : "서명이 완료되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "서명 제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateFieldValue(fieldId: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function clearSignaturePad() {
    signaturePadRef.current?.clear();
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-6">서명 정보를 불러오는 중...</main>;
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-4">서명 데이터가 없습니다.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">전자서명</h1>
              <p className="text-sm text-slate-500">{data.envelope.title}</p>
            </div>
            <StatusBadge status={data.envelope.status} />
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div>
              <dt className="font-semibold">수신자</dt>
              <dd>{data.recipient.recipientName}</dd>
            </div>
            <div>
              <dt className="font-semibold">이메일</dt>
              <dd>{data.recipient.recipientEmail}</dd>
            </div>
            <div>
              <dt className="font-semibold">필드 수</dt>
              <dd>{recipientFields.length}</dd>
            </div>
            <div>
              <dt className="font-semibold">PDF</dt>
              <dd className="truncate">
                {data.pdfDownloadUrl ? (
                  <a href={data.pdfDownloadUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline-offset-2 hover:underline">
                    PDF 열기
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
          </dl>

          {recipientFields.length > 0 ? (
            <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">필드 입력</p>
              {recipientFields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.type} (p{field.page})
                  </label>
                  {field.type === "CHECKBOX" ? (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={fieldValues[field.id] === "true"}
                        onChange={(event) => updateFieldValue(field.id, event.target.checked ? "true" : "false")}
                        disabled={isSigned}
                      />
                      체크
                    </label>
                  ) : field.type === "DATE" ? (
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      type="date"
                      value={fieldValues[field.id] ?? ""}
                      onChange={(event) => updateFieldValue(field.id, event.target.value)}
                      disabled={isSigned}
                    />
                  ) : (
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder={field.type === "TEXT" ? "값을 입력하세요" : "서명(선택)"}
                      value={fieldValues[field.id] ?? ""}
                      onChange={(event) => updateFieldValue(field.id, event.target.value)}
                      disabled={isSigned}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {hasSignatureField ? (
            <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">서명 캔버스</p>
                <button
                  type="button"
                  onClick={clearSignaturePad}
                  disabled={isSigned}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  초기화
                </button>
              </div>
              <canvas ref={signatureCanvasRef} className="h-[180px] w-full rounded border border-dashed border-slate-300 bg-white" />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {isSigned ? (
              <button
                type="button"
                disabled
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold !text-white opacity-80"
              >
                서명 완료
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={submitSignature}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                서명 제출
              </button>
            )}
            {data.projectId ? (
              <button
                type="button"
                onClick={() => router.push(`/client/projects/${data.projectId}/contracts`)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                계약 목록으로
              </button>
            ) : null}
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
          {result ? <p className="mt-4 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{result}</p> : null}
        </section>
      </div>
    </main>
  );
}
