"use client";

import { ChangeEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, apiFetch, handleAuthError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@/components/ui/modal";

type ContractStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

type Contract = {
  id: string;
  name: string;
  fileVersionId?: string | null;
  status: ContractStatus;
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

type PresignResponse = {
  uploadUrl: string;
  objectKey: string;
  version: number;
  contentType: string;
  size: number;
  checksum: string;
  uploadTicket: string;
};

type ProjectMemberAccount = {
  id: string;
  userId: string;
  role: "PM_OWNER" | "PM_MEMBER" | "CLIENT_OWNER" | "CLIENT_MEMBER";
  loginId: string;
  passwordMask: string;
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
  signatureField?: SignerField;
  dateField?: SignerField;
};

type SignerField = {
  id?: string;
  type?: string;
  page: number;
  coordX: number;
  coordY: number;
  coordW: number;
  coordH: number;
};

type PlacementTarget = "signature" | "date";
type PdfJsLib = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfDocumentProxy = Awaited<ReturnType<PdfJsLib["getDocument"]>["promise"]>;
type PdfRenderTask = ReturnType<Awaited<ReturnType<PdfDocumentProxy["getPage"]>>["render"]>;
type RectSelection = { x: number; y: number; w: number; h: number };

const PDF_PREVIEW_SCALE = 1.2;

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: "진행 중",
  ACTIVE: "완료",
  ARCHIVED: "보관",
};

const statusBadgeStyles: Record<ContractStatus, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ARCHIVED: "border-slate-300 bg-slate-100 text-slate-700",
};

const envelopeStatusLabels: Record<string, string> = {
  DRAFT: "초안",
  SENT: "발송",
  PARTIALLY_SIGNED: "부분 서명",
  COMPLETED: "완료",
  VOIDED: "철회",
};

const recipientStatusLabels: Record<string, string> = {
  PENDING: "대기",
  VIEWED: "열람",
  SIGNED: "서명 완료",
  DECLINED: "거절",
};

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

function sortContracts(items: Contract[]) {
  return [...items].sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

export default function ProjectContractsPage() {
  const projectId = useProjectId();
  const router = useRouter();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersionSummary[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberAccount[]>([]);
  const [signersByContract, setSignersByContract] = useState<Record<string, SignerInfo>>({});
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPdf, setCreatePdf] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPdf, setEditPdf] = useState<File | null>(null);

  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [signingLoading, setSigningLoading] = useState(false);
  const [signingTargetUserId, setSigningTargetUserId] = useState("");
  const [signaturePage, setSignaturePage] = useState("1");
  const [signatureCoordX, setSignatureCoordX] = useState("0.67");
  const [signatureCoordY, setSignatureCoordY] = useState("0.84");
  const [signatureCoordW, setSignatureCoordW] = useState("0.27");
  const [signatureCoordH, setSignatureCoordH] = useState("0.08");
  const [includeDateField, setIncludeDateField] = useState(true);
  const [datePage, setDatePage] = useState("1");
  const [dateCoordX, setDateCoordX] = useState("0.67");
  const [dateCoordY, setDateCoordY] = useState("0.76");
  const [dateCoordW, setDateCoordW] = useState("0.27");
  const [dateCoordH, setDateCoordH] = useState("0.04");
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activePlacement, setActivePlacement] = useState<PlacementTarget>("signature");
  const [isDrawing, setIsDrawing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewOverlayRef = useRef<HTMLDivElement | null>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const pdfDocumentRef = useRef<PdfDocumentProxy | null>(null);
  const pdfDocumentFileVersionRef = useRef<string | null>(null);
  const pdfLibRef = useRef<PdfJsLib | null>(null);
  const pdfRenderTaskRef = useRef<PdfRenderTask | null>(null);

  const fileVersionMap = useMemo(() => new Map(fileVersions.map((item) => [item.id, item])), [fileVersions]);
  const sortedContracts = useMemo(() => sortContracts(contracts), [contracts]);
  const doneCount = useMemo(
    () => contracts.filter((item) => resolveDisplayStatus(item, signersByContract[item.id]) === "ACTIVE").length,
    [contracts, signersByContract],
  );
  const inProgressCount = useMemo(
    () => contracts.filter((item) => resolveDisplayStatus(item, signersByContract[item.id]) === "DRAFT").length,
    [contracts, signersByContract],
  );
  const clientMembers = useMemo(
    () => projectMembers.filter((member) => member.role === "CLIENT_OWNER" || member.role === "CLIENT_MEMBER"),
    [projectMembers],
  );
  const currentSigningInfo = signingContractId ? signersByContract[signingContractId] : undefined;
  const currentSigningContract = signingContractId ? contracts.find((contract) => contract.id === signingContractId) : undefined;
  const signaturePreviewRect = useMemo(
    () => ({
      page: Math.max(1, Math.round(parsePreviewNumber(signaturePage, 1))),
      x: clampNormalized(parsePreviewNumber(signatureCoordX, 0.67)),
      y: clampNormalized(parsePreviewNumber(signatureCoordY, 0.84)),
      w: Math.max(0.001, clampNormalized(parsePreviewNumber(signatureCoordW, 0.27))),
      h: Math.max(0.001, clampNormalized(parsePreviewNumber(signatureCoordH, 0.08))),
    }),
    [signaturePage, signatureCoordX, signatureCoordY, signatureCoordW, signatureCoordH],
  );
  const datePreviewRect = useMemo(
    () => ({
      page: Math.max(1, Math.round(parsePreviewNumber(datePage, 1))),
      x: clampNormalized(parsePreviewNumber(dateCoordX, 0.67)),
      y: clampNormalized(parsePreviewNumber(dateCoordY, 0.76)),
      w: Math.max(0.001, clampNormalized(parsePreviewNumber(dateCoordW, 0.27))),
      h: Math.max(0.001, clampNormalized(parsePreviewNumber(dateCoordH, 0.04))),
    }),
    [datePage, dateCoordX, dateCoordY, dateCoordW, dateCoordH],
  );

  function resolveAssignedSignerUserId(signer: SignerInfo | undefined) {
    if (!signer?.assigned || !signer.recipientEmail) {
      return "";
    }
    const matched = clientMembers.find((member) => member.loginId.toLowerCase() === signer.recipientEmail?.toLowerCase());
    return matched?.userId ?? "";
  }

  function toFieldValue(value: number | undefined, fallback: string) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return fallback;
    }
    return value.toString();
  }

  function applyFieldDefaults(signer: SignerInfo | undefined) {
    const signature = signer?.signatureField;
    const date = signer?.dateField;
    const signaturePageValue = toFieldValue(signature?.page, "1");
    setSignaturePage(signaturePageValue);
    setSignatureCoordX(toFieldValue(signature?.coordX, "0.67"));
    setSignatureCoordY(toFieldValue(signature?.coordY, "0.84"));
    setSignatureCoordW(toFieldValue(signature?.coordW, "0.27"));
    setSignatureCoordH(toFieldValue(signature?.coordH, "0.08"));

    const hasDate = Boolean(date);
    setIncludeDateField(hasDate);
    setDatePage(toFieldValue(date?.page, "1"));
    setDateCoordX(toFieldValue(date?.coordX, "0.67"));
    setDateCoordY(toFieldValue(date?.coordY, "0.76"));
    setDateCoordW(toFieldValue(date?.coordW, "0.27"));
    setDateCoordH(toFieldValue(date?.coordH, "0.04"));
    setPreviewPage(Math.max(1, Math.round(Number(signaturePageValue))));
    setActivePlacement("signature");
  }

  function parseNumberValue(raw: string, fieldLabel: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${fieldLabel} 값을 확인해 주세요.`);
    }
    return parsed;
  }

  function parsePreviewNumber(raw: string, fallback: number) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return parsed;
  }

  function clampNormalized(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }

  function setSignatureRect(rect: RectSelection & { page: number }) {
    setSignaturePage(String(rect.page));
    setSignatureCoordX(rect.x.toFixed(4));
    setSignatureCoordY(rect.y.toFixed(4));
    setSignatureCoordW(rect.w.toFixed(4));
    setSignatureCoordH(rect.h.toFixed(4));
  }

  function setDateRect(rect: RectSelection & { page: number }) {
    setDatePage(String(rect.page));
    setDateCoordX(rect.x.toFixed(4));
    setDateCoordY(rect.y.toFixed(4));
    setDateCoordW(rect.w.toFixed(4));
    setDateCoordH(rect.h.toFixed(4));
  }

  function updateActiveRect(target: PlacementTarget, rect: RectSelection & { page: number }) {
    if (target === "signature") {
      setSignatureRect(rect);
      return;
    }
    setDateRect(rect);
  }

  function getPointFromEvent(event: MouseEvent<HTMLDivElement>) {
    const overlay = previewOverlayRef.current;
    if (!overlay) {
      return null;
    }
    const bounds = overlay.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }
    const x = clampNormalized((event.clientX - bounds.left) / bounds.width);
    const y = clampNormalized((event.clientY - bounds.top) / bounds.height);
    return { x, y };
  }

  function handlePreviewMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (previewLoading || !currentSigningContract?.fileVersionId) {
      return;
    }
    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }
    if (activePlacement === "date" && !includeDateField) {
      setIncludeDateField(true);
    }
    drawStartRef.current = point;
    setIsDrawing(true);
    updateActiveRect(activePlacement, { page: previewPage, x: point.x, y: point.y, w: 0.001, h: 0.001 });
  }

  function handlePreviewMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (!isDrawing || !drawStartRef.current) {
      return;
    }
    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }
    const start = drawStartRef.current;
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const w = Math.max(0.001, Math.abs(point.x - start.x));
    const h = Math.max(0.001, Math.abs(point.y - start.y));
    updateActiveRect(activePlacement, { page: previewPage, x, y, w, h });
  }

  function endPreviewDrawing() {
    drawStartRef.current = null;
    setIsDrawing(false);
  }

  async function ensurePdfLib() {
    if (pdfLibRef.current) {
      return pdfLibRef.current;
    }
    const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    lib.GlobalWorkerOptions.workerSrc = workerSrc;
    pdfLibRef.current = lib;
    return lib;
  }

  async function fetchPdfBytes(fileVersionId: string) {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE}/api/file-versions/${fileVersionId}/content`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("PDF 미리보기를 불러오지 못했습니다.");
    }
    return response.arrayBuffer();
  }

  async function ensurePdfDocument(fileVersionId: string) {
    if (pdfDocumentRef.current && pdfDocumentFileVersionRef.current === fileVersionId) {
      return pdfDocumentRef.current;
    }
    const pdfLib = await ensurePdfLib();
    const bytes = await fetchPdfBytes(fileVersionId);
    const loadingTask = pdfLib.getDocument({
      data: bytes,
      disableWorker: true,
      useSystemFonts: true,
    });
    const document = await loadingTask.promise;
    pdfDocumentRef.current = document;
    pdfDocumentFileVersionRef.current = fileVersionId;
    setPreviewPageCount(document.numPages);
    return document;
  }

  async function renderPdfPreview(fileVersionId: string, pageNumber: number) {
    const document = await ensurePdfDocument(fileVersionId);
    const safePage = Math.min(Math.max(pageNumber, 1), document.numPages);
    if (safePage !== pageNumber) {
      setPreviewPage(safePage);
      return;
    }

    const page = await document.getPage(safePage);
    const viewport = page.getViewport({ scale: PDF_PREVIEW_SCALE });
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("PDF 캔버스를 준비하지 못했습니다.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    if (pdfRenderTaskRef.current) {
      pdfRenderTaskRef.current.cancel();
      try {
        await pdfRenderTaskRef.current.promise;
      } catch {
        // Ignore cancelled render task errors.
      }
      pdfRenderTaskRef.current = null;
    }

    const nextRenderTask = page.render({ canvasContext: context, viewport });
    pdfRenderTaskRef.current = nextRenderTask;
    try {
      await nextRenderTask.promise;
    } finally {
      if (pdfRenderTaskRef.current === nextRenderTask) {
        pdfRenderTaskRef.current = null;
      }
    }
  }

  async function loadSigner(contractId: string) {
    const signer = await apiFetch<SignerInfo>(`/api/contracts/${contractId}/signer`);
    setSignersByContract((prev) => ({ ...prev, [contractId]: signer }));
    return signer;
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [contractData, versionData, memberData] = await Promise.all([
        apiFetch<Contract[]>(`/api/projects/${projectId}/contracts`),
        apiFetch<FileVersionSummary[]>(`/api/projects/${projectId}/file-versions`),
        apiFetch<ProjectMemberAccount[]>(`/api/projects/${projectId}/members`),
      ]);
      setContracts(contractData);
      setFileVersions(versionData);
      setProjectMembers(memberData);

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
      if (!handleAuthError(e, "/admin/login")) {
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

  useEffect(() => {
    if (!signingContractId || !currentSigningContract?.fileVersionId) {
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    void (async () => {
      try {
        await renderPdfPreview(currentSigningContract.fileVersionId as string, previewPage);
      } catch (e) {
        const renderCancelled = e instanceof Error && e.name === "RenderingCancelledException";
        if (!cancelled && !renderCancelled) {
          setPreviewError(e instanceof Error ? e.message : "PDF 미리보기를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (pdfRenderTaskRef.current) {
        pdfRenderTaskRef.current.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signingContractId, currentSigningContract?.fileVersionId, previewPage]);

  function onPickCreatePdf(event: ChangeEvent<HTMLInputElement>) {
    setCreatePdf(event.target.files?.[0] ?? null);
  }

  function onPickEditPdf(event: ChangeEvent<HTMLInputElement>) {
    setEditPdf(event.target.files?.[0] ?? null);
  }

  async function uploadPdfToFile(fileId: string, pdf: File) {
    const contentType = pdf.type || "application/pdf";
    const checksum = `${pdf.name}-${pdf.size}-${pdf.lastModified}`;
    const presign = await apiFetch<PresignResponse>(`/api/files/${fileId}/versions/presign`, {
      method: "POST",
      body: JSON.stringify({ contentType, size: pdf.size, checksum }),
    });

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: pdf,
    });

    if (!uploadResponse.ok) {
      throw new Error("PDF 업로드에 실패했습니다.");
    }

    const completed = await apiFetch<FileVersionSummary>(`/api/files/${fileId}/versions/complete`, {
      method: "POST",
      body: JSON.stringify({
        version: presign.version,
        objectKey: presign.objectKey,
        contentType,
        size: pdf.size,
        checksum,
        uploadTicket: presign.uploadTicket,
      }),
    });

    return completed;
  }

  async function createBackingFile(contractName: string, pdf: File) {
    const file = await apiFetch<{ id: string }>(`/api/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify({
        name: `${contractName}.pdf`,
        description: "계약서 파일",
        folder: "/contracts",
      }),
    });
    return uploadPdfToFile(file.id, pdf);
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createPdf) {
      setError("계약서 PDF 파일을 첨부해 주세요.");
      return;
    }
    setError(null);
    try {
      const version = await createBackingFile(createName, createPdf);
      await apiFetch(`/api/projects/${projectId}/contracts`, {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          fileVersionId: version.id,
        }),
      });
      setCreateOpen(false);
      setCreateName("");
      setCreatePdf(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 생성에 실패했습니다.");
      }
    }
  }

  function openEditModal(contract: Contract) {
    setEditingId(contract.id);
    setEditName(contract.name);
    setEditPdf(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);

    try {
      const target = contracts.find((item) => item.id === editingId);
      if (!target) return;

      let nextFileVersionId = target.fileVersionId ?? null;

      if (editPdf) {
        const currentVersion = target.fileVersionId ? fileVersionMap.get(target.fileVersionId) : undefined;
        if (currentVersion) {
          const uploaded = await uploadPdfToFile(currentVersion.fileId, editPdf);
          nextFileVersionId = uploaded.id;
        } else {
          const uploaded = await createBackingFile(editName, editPdf);
          nextFileVersionId = uploaded.id;
        }
      }

      await apiFetch(`/api/contracts/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          fileVersionId: nextFileVersionId,
          clearFileVersion: nextFileVersionId === null,
        }),
      });

      setEditingId(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 수정에 실패했습니다.");
      }
    }
  }

  async function deleteContract(contractId: string) {
    setError(null);
    try {
      await apiFetch(`/api/contracts/${contractId}`, { method: "DELETE" });
      if (editingId === contractId) {
        setEditingId(null);
      }
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약 삭제에 실패했습니다.");
      }
    }
  }

  async function openContractPdf(fileVersionId: string) {
    setError(null);
    try {
      const result = await apiFetch<{ downloadUrl: string }>(`/api/file-versions/${fileVersionId}/download-url`);
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계약서 열기에 실패했습니다.");
      }
    }
  }

  function openSigningStatus(contractId: string) {
    router.push(`/admin/projects/${projectId}/contracts/${contractId}`);
  }

  async function openSigningModal(contractId: string) {
    setSigningContractId(contractId);
    setSigningLoading(true);
    setError(null);
    try {
      const signer = await loadSigner(contractId);
      const assignedUserId = resolveAssignedSignerUserId(signer);
      setSigningTargetUserId(assignedUserId || clientMembers[0]?.userId || "");
      applyFieldDefaults(signer);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "서명자 정보를 불러오지 못했습니다.");
      }
    } finally {
      setSigningLoading(false);
    }
  }

  async function assignSigner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signingContractId) return;
    if (!signingTargetUserId) {
      setError("서명자를 선택해 주세요.");
      return;
    }
    setError(null);
    setSigningLoading(true);
    try {
      const payload = {
        signerUserId: signingTargetUserId,
        signaturePage: parseNumberValue(signaturePage, "서명 페이지"),
        signatureCoordX: parseNumberValue(signatureCoordX, "서명 X"),
        signatureCoordY: parseNumberValue(signatureCoordY, "서명 Y"),
        signatureCoordW: parseNumberValue(signatureCoordW, "서명 너비"),
        signatureCoordH: parseNumberValue(signatureCoordH, "서명 높이"),
        includeDateField,
        datePage: includeDateField ? parseNumberValue(datePage, "날짜 페이지") : null,
        dateCoordX: includeDateField ? parseNumberValue(dateCoordX, "날짜 X") : null,
        dateCoordY: includeDateField ? parseNumberValue(dateCoordY, "날짜 Y") : null,
        dateCoordW: includeDateField ? parseNumberValue(dateCoordW, "날짜 너비") : null,
        dateCoordH: includeDateField ? parseNumberValue(dateCoordH, "날짜 높이") : null,
      };
      await apiFetch(`/api/contracts/${signingContractId}/signer`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const refreshed = await loadSigner(signingContractId);
      applyFieldDefaults(refreshed);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "서명자 지정에 실패했습니다.");
      }
    } finally {
      setSigningLoading(false);
    }
  }

  function resetSigningModal() {
    if (pdfRenderTaskRef.current) {
      pdfRenderTaskRef.current.cancel();
      pdfRenderTaskRef.current = null;
    }
    setSigningContractId(null);
    setSigningTargetUserId("");
    setPreviewError(null);
    setPreviewLoading(false);
    setIsDrawing(false);
    setActivePlacement("signature");
    setPreviewPage(1);
    setPreviewPageCount(1);
    drawStartRef.current = null;
    pdfDocumentRef.current = null;
    pdfDocumentFileVersionRef.current = null;
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">계약</h1>
          <p className="text-sm text-slate-500">계약 진행 현황을 확인하고 마지막 수정 이력을 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          계약 생성
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">완료 처리</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{doneCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">진행 중</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{inProgressCount}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[1360px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">계약명</th>
              <th className="px-4 py-3 whitespace-nowrap">등록자</th>
              <th className="px-4 py-3 whitespace-nowrap">계약서</th>
              <th className="px-4 py-3 whitespace-nowrap">상태</th>
              <th className="px-4 py-3 whitespace-nowrap">서명자</th>
              <th className="px-4 py-3 whitespace-nowrap">서명 요청</th>
              <th className="px-4 py-3 whitespace-nowrap">수신 상태</th>
              <th className="px-4 py-3 whitespace-nowrap">마지막 수정</th>
              <th className="px-4 py-3 whitespace-nowrap">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedContracts.map((contract) => {
              const version = contract.fileVersionId ? fileVersionMap.get(contract.fileVersionId) : undefined;
              const signer = signersByContract[contract.id];
              const displayStatus = resolveDisplayStatus(contract, signer);
              const canAssignSigner = Boolean(contract.fileVersionId);
              return (
                <tr key={contract.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{contract.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{contract.createdByName ?? contract.createdBy ?? "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {contract.fileVersionId ? (
                      <button
                        type="button"
                        onClick={() => void openContractPdf(contract.fileVersionId as string)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {version ? `${version.fileName} v${version.version}` : "PDF 보기"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">PDF 없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyles[displayStatus]}`}>
                      {statusLabels[displayStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {signer?.assigned ? (
                      <span className="whitespace-nowrap">
                        {signer.recipientName ?? "-"} ({signer.recipientEmail ?? "-"})
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">서명자가 지정되지 않았습니다.</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{signer?.assigned ? formatEnvelopeStatus(signer.envelopeStatus) : "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{signer?.assigned ? formatRecipientStatus(signer.recipientStatus) : "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDateTime(contract.updatedAt ?? contract.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-nowrap gap-2">
                      <button
                        type="button"
                        onClick={() => openSigningStatus(contract.id)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        서명 확인
                      </button>
                      <button
                        type="button"
                        onClick={() => void openSigningModal(contract.id)}
                        disabled={!canAssignSigner}
                        className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        서명자 지정
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(contract)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        수정
                      </button>
                      <ConfirmActionButton
                        label="삭제"
                        title="계약을 삭제할까요?"
                        description="삭제 후 복구할 수 없습니다."
                        onConfirm={() => deleteContract(contract.id)}
                        triggerVariant="destructive"
                        triggerSize="sm"
                        triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        confirmVariant="destructive"
                      />
                    </div>
                    {!signer?.assigned && !canAssignSigner ? <p className="mt-2 text-xs text-slate-500">서명자 지정 전 계약서 PDF를 먼저 업로드해 주세요.</p> : null}
                  </td>
                </tr>
              );
            })}
            {!loading && sortedContracts.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                  등록된 계약이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="계약 생성" description="계약명과 계약서 PDF를 입력합니다.">
        <form onSubmit={createContract} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="계약명" value={createName} onChange={(e) => setCreateName(e.target.value)} required />
          <input type="file" accept="application/pdf" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={onPickCreatePdf} required />
          {createPdf ? <p className="text-xs text-slate-500">선택 파일: {createPdf.name}</p> : null}
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
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="계약 수정"
        description="계약명을 수정하고, 필요하면 PDF를 교체합니다."
      >
        <form onSubmit={saveEdit} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <input type="file" accept="application/pdf" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={onPickEditPdf} />
          {editPdf ? <p className="text-xs text-slate-500">교체 파일: {editPdf.name}</p> : null}
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

      <Modal
        open={Boolean(signingContractId)}
        onClose={resetSigningModal}
        title="서명자 지정"
        description="계약당 서명자 1명을 지정합니다. 서명 요청은 내부적으로 자동 생성됩니다."
      >
        <form onSubmit={assignSigner} className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">클라이언트 멤버</p>
            {clientMembers.length === 0 ? (
              <p className="text-sm text-slate-500">이 프로젝트에 클라이언트 멤버가 없습니다.</p>
            ) : (
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={signingTargetUserId}
                onChange={(e) => setSigningTargetUserId(e.target.value)}
                required
              >
                <option value="">서명자 선택</option>
                {clientMembers.map((member) => (
                  <option key={member.id} value={member.userId}>
                    {member.loginId} ({member.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">서명 위치 설정 (드래그로 지정)</p>
              {currentSigningContract?.fileVersionId ? (
                <button
                  type="button"
                  onClick={() => void openContractPdf(currentSigningContract.fileVersionId as string)}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  계약서 PDF 열기
                </button>
              ) : (
                <span className="text-xs text-slate-500">PDF 없는 계약은 서명 지정이 불가합니다.</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivePlacement("signature");
                  setPreviewPage(signaturePreviewRect.page);
                }}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  activePlacement === "signature" ? "bg-indigo-600 !text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                서명 영역 편집
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncludeDateField(true);
                  setActivePlacement("date");
                  setPreviewPage(datePreviewRect.page);
                }}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  activePlacement === "date" ? "bg-emerald-600 !text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                날짜 영역 편집
              </button>
              <label className="ml-2 inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={includeDateField} onChange={(e) => setIncludeDateField(e.target.checked)} />
                날짜 필드 포함
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <button
                type="button"
                onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))}
                disabled={previewPage <= 1}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                이전 페이지
              </button>
              <span>
                페이지 {previewPage} / {previewPageCount}
              </span>
              <button
                type="button"
                onClick={() => setPreviewPage((prev) => Math.min(previewPageCount, prev + 1))}
                disabled={previewPage >= previewPageCount}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                다음 페이지
              </button>
              <span className="text-slate-500">PDF 위에서 드래그하면 {activePlacement === "signature" ? "서명" : "날짜"} 영역이 지정됩니다.</span>
            </div>

            <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
              {previewLoading ? <p className="text-sm text-slate-500">PDF 미리보기 로딩 중...</p> : null}
              {previewError ? <p className="text-sm text-red-600">{previewError}</p> : null}
              <div
                ref={previewOverlayRef}
                className="relative inline-block cursor-crosshair"
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={endPreviewDrawing}
                onMouseLeave={endPreviewDrawing}
              >
                <canvas ref={previewCanvasRef} className="block max-w-full rounded border border-slate-300 bg-white" />
                {signaturePreviewRect.page === previewPage ? (
                  <div
                    className="pointer-events-none absolute border-2 border-indigo-500 bg-indigo-500/20"
                    style={{
                      left: `${signaturePreviewRect.x * 100}%`,
                      top: `${signaturePreviewRect.y * 100}%`,
                      width: `${signaturePreviewRect.w * 100}%`,
                      height: `${signaturePreviewRect.h * 100}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold !text-white">서명</span>
                  </div>
                ) : null}
                {includeDateField && datePreviewRect.page === previewPage ? (
                  <div
                    className="pointer-events-none absolute border-2 border-emerald-500 bg-emerald-500/20"
                    style={{
                      left: `${datePreviewRect.x * 100}%`,
                      top: `${datePreviewRect.y * 100}%`,
                      width: `${datePreviewRect.w * 100}%`,
                      height: `${datePreviewRect.h * 100}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold !text-white">날짜</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <p>
                서명: p{signaturePage} / x {signatureCoordX}, y {signatureCoordY}, w {signatureCoordW}, h {signatureCoordH}
              </p>
              <p>
                날짜: {includeDateField ? `p${datePage} / x ${dateCoordX}, y ${dateCoordY}, w ${dateCoordW}, h ${dateCoordH}` : "사용 안 함"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-900">현재 지정 상태</p>
            {signingLoading ? <p className="text-sm text-slate-500">불러오는 중...</p> : null}
            {!signingLoading && currentSigningInfo?.assigned ? (
              <p className="text-sm text-slate-700">
                {currentSigningInfo.recipientName} ({currentSigningInfo.recipientEmail}) / 서명 요청: {formatEnvelopeStatus(currentSigningInfo.envelopeStatus)} / 수신 상태:{" "}
                {formatRecipientStatus(currentSigningInfo.recipientStatus)}
              </p>
            ) : null}
            {!signingLoading && !currentSigningInfo?.assigned ? <p className="text-sm text-slate-500">지정된 서명자가 없습니다.</p> : null}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetSigningModal}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              닫기
            </button>
            <button
              type="submit"
              disabled={signingLoading || clientMembers.length === 0 || !signingTargetUserId}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              서명자 지정
            </button>
          </div>
        </form>
      </Modal>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

function formatEnvelopeStatus(status?: string) {
  if (!status) return "-";
  return envelopeStatusLabels[status] ?? status;
}

function formatRecipientStatus(status?: string) {
  if (!status) return "-";
  return recipientStatusLabels[status] ?? status;
}

function isSignerCompleted(signer?: SignerInfo) {
  if (!signer?.assigned) {
    return false;
  }
  return signer.envelopeStatus === "COMPLETED" || signer.recipientStatus === "SIGNED";
}

function resolveDisplayStatus(contract: Contract, signer?: SignerInfo): ContractStatus {
  if (signer?.assigned) {
    return isSignerCompleted(signer) ? "ACTIVE" : "DRAFT";
  }
  return contract.status;
}


