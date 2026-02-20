"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/modal";
import { ApiRequestError, apiFetch, handleAuthError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt?: string;
};

type PmUser = {
  userId: string;
  email: string;
  name: string;
  status: string;
  role: string;
  passwordInitialized: boolean;
  lastLoginAt?: string | null;
};

type SetupCodeIssue = {
  userId: string;
  email?: string;
  status?: string;
  passwordInitialized: boolean;
  setupCode?: string | null;
  setupCodeExpiresAt?: string | null;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function TenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [pmUsers, setPmUsers] = useState<PmUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [setupCodeInfo, setSetupCodeInfo] = useState<{ email: string; setupCode: string; expiresAt?: string | null } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const resolveCreateErrorMessage = (e: unknown) => {
    if (e instanceof ApiRequestError && e.code === "VALIDATION_ERROR" && e.details && typeof e.details === "object") {
      const details = e.details as Record<string, unknown>;
      const emailError = details.email;
      if (typeof emailError === "string" && emailError.trim() !== "") {
        return "이메일 형식을 확인해 주세요. (예: user@example.com)";
      }
    }
    if (e instanceof Error) {
      try {
        const parsed = JSON.parse(e.message) as { details?: Record<string, unknown> };
        const emailError = parsed?.details?.email;
        if (typeof emailError === "string" && emailError.trim() !== "") {
          return "이메일 형식을 확인해 주세요. (예: user@example.com)";
        }
      } catch {
        // use fallback message
      }
    }
    return "PM 사용자 생성에 실패했습니다. 입력값을 확인한 뒤 다시 시도해 주세요.";
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tenantData, pmUserData, projectData] = await Promise.all([
        apiFetch<Tenant>(`/api/admin/tenants/${tenantId}`),
        apiFetch<PmUser[]>(`/api/admin/tenants/${tenantId}/pm-users`),
        apiFetch<Project[]>(`/api/admin/tenants/${tenantId}/projects`),
      ]);
      setTenant(tenantData);
      setPmUsers(pmUserData);
      setProjects(projectData);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "테넌트 상세를 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function createPmUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setCreateError(null);
    setError(null);
    setCreateNotice(null);
    try {
      const created = await apiFetch<SetupCodeIssue>(`/api/admin/tenants/${tenantId}/pm-users`, {
        method: "POST",
        body: JSON.stringify({ email, name }),
      });
      if (created.setupCode) {
        setCreateNotice(`PM 계정을 생성했습니다. 최초 비밀번호 설정 코드를 전달하세요. 이메일: ${created.email ?? email}`);
        setSetupCodeInfo({
          email: created.email ?? email,
          setupCode: created.setupCode,
          expiresAt: created.setupCodeExpiresAt,
        });
      } else if (created.passwordInitialized) {
        setCreateNotice(`이미 비밀번호가 설정된 계정입니다. 이메일: ${created.email ?? email}`);
        setSetupCodeInfo(null);
      } else {
        setCreateNotice(`코드를 확인하지 못했습니다. 행의 '설정코드 재발급'으로 다시 발급하세요. 이메일: ${created.email ?? email}`);
        setSetupCodeInfo(null);
      }
      setEmail("");
      setName("");
      setCreateOpen(false);
      setCreateError(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setCreateError(resolveCreateErrorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resetSetupCode(userId: string, userEmail: string) {
    setError(null);
    setCreateNotice(null);
    try {
      const issued = await apiFetch<SetupCodeIssue>(`/api/admin/users/${userId}/setup-code/reset`, {
        method: "POST",
      });
      if (!issued.setupCode) {
        throw new Error("설정 코드 발급에 실패했습니다.");
      }
      setSetupCodeInfo({
        email: userEmail,
        setupCode: issued.setupCode,
        expiresAt: issued.setupCodeExpiresAt,
      });
      setCreateNotice(`설정 코드를 재발급했습니다. 이메일: ${userEmail}`);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "설정 코드 재발급에 실패했습니다.");
      }
    }
  }

  async function copySetupCode() {
    if (!setupCodeInfo?.setupCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(setupCodeInfo.setupCode);
      setCreateNotice("설정 코드를 클립보드에 복사했습니다.");
    } catch {
      setCreateNotice("클립보드 복사에 실패했습니다.");
    }
  }

  async function copySetupGuide() {
    if (!setupCodeInfo?.setupCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    const guide = [
      "[Bridge PM 최초 비밀번호 설정 안내]",
      `이메일: ${setupCodeInfo.email}`,
      `설정 코드: ${setupCodeInfo.setupCode}`,
      `만료시각: ${formatDateTime(setupCodeInfo.expiresAt)}`,
      "접속 경로: PM 앱 /first-password",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(guide);
      setCreateNotice("설정 안내문을 클립보드에 복사했습니다.");
    } catch {
      setCreateNotice("설정 안내문 복사에 실패했습니다.");
    }
  }

  if (loading && !tenant) {
    return (
      <AdminShell>
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">테넌트 상세</h1>
              <p className="text-sm text-slate-500">tenantId: {tenantId}</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 p-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </section>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">테넌트 상세</h1>
            <p className="text-sm text-slate-500">tenantId: {tenantId}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
          >
            PM 사용자 추가
          </button>
        </div>

        {createNotice ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{createNotice}</p> : null}
        {setupCodeInfo ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">PM 최초 비밀번호 설정 코드</p>
            <p>이메일: {setupCodeInfo.email}</p>
            <p>
              설정 코드: <span className="font-mono font-semibold">{setupCodeInfo.setupCode}</span>
            </p>
            <p>만료시각: {formatDateTime(setupCodeInfo.expiresAt)}</p>
            <p className="text-xs text-amber-800">
              사용 방법: PM 앱의 <span className="font-mono">/first-password</span> 페이지에서 이메일, 설정 코드, 새 비밀번호를 입력합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copySetupCode()}
                className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                코드 복사
              </button>
              <button
                type="button"
                onClick={() => void copySetupGuide()}
                className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                안내문 복사
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <p>
              <span className="font-medium text-slate-700">이름:</span> {tenant?.name ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-700">Slug:</span> {tenant?.slug ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-700">상태:</span>{" "}
              {tenant ? <StatusBadge status={tenant.status} /> : "-"}
            </p>
            <p>
              <span className="font-medium text-slate-700">생성일:</span> {formatDateTime(tenant?.createdAt)}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">프로젝트</h2>
            <Link
              href="/admin/projects/new"
              className="inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              프로젝트 생성
            </Link>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">프로젝트명</th>
                <th className="px-4 py-3">설명</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">생성일</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={99} className="px-4 py-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </td>
              </tr>
            ) : null}
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{project.name}</td>
                  <td className="px-4 py-3 text-slate-600">{project.description || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(project.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/projects/${project.id}/dashboard`}
                      className="inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      프로젝트 상세
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    등록된 프로젝트가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-700">테넌트 사용자</h2>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">최근 로그인</th>
                <th className="px-4 py-3">비밀번호 상태</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={99} className="px-4 py-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </td>
              </tr>
            ) : null}
              {pmUsers.map((user) => (
                <tr key={user.userId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{user.role}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(user.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{user.passwordInitialized ? "설정 완료" : "최초 설정 필요"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {!user.passwordInitialized ? (
                        <button
                          type="button"
                          onClick={() => void resetSetupCode(user.userId, user.email)}
                          className="inline-flex rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                        >
                          설정코드 재발급
                        </button>
                      ) : null}
                      <Link
                        href={`/admin/users/${user.userId}`}
                        className="inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        사용자 관리
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pmUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    등록된 테넌트 사용자가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="PM 사용자 생성" description="생성 후 기본 상태는 초대(INVITED)입니다.">
          <form onSubmit={createPmUser} className="space-y-3">
            {createError ? <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{createError}</p> : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">이메일</label>
              <input
                className={`w-full rounded-lg px-3 py-2 ${createError ? "border border-red-300 bg-red-50/30" : "border border-slate-300"}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (createError) {
                    setCreateError(null);
                  }
                }}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">이름</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (createError) {
                    setCreateError(null);
                  }
                }}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(false);
                }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {submitting ? "생성 중..." : "생성"}
              </button>
            </div>
          </form>
        </Modal>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>
    </AdminShell>
  );
}
