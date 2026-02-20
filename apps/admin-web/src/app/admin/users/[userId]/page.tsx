"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

type UserDetail = {
  userId: string;
  email: string;
  name: string;
  status: UserStatus;
  isPlatformAdmin: boolean;
  failedLoginAttempts: number;
  loginBlocked: boolean;
  passwordInitialized: boolean;
  lastLoginAt?: string | null;
  memberships: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: string;
  }>;
};

const statusOptions: Array<{ value: UserStatus; label: string }> = [
  { value: "INVITED", label: "초대" },
  { value: "ACTIVE", label: "활성" },
  { value: "SUSPENDED", label: "정지" },
  { value: "DEACTIVATED", label: "비활성" },
];

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

export default function UserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canUnlockLogin = Boolean(detail?.loginBlocked) && !loading && !unlocking;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<UserDetail>(`/api/admin/users/${userId}`);
      setDetail(data);
      setStatus(data.status);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "사용자 정보를 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function updateStatus() {
    setUpdating(true);
    setError(null);
    setResult(null);
    try {
      await apiFetch<{ userId: string; status: string }>(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      setResult("사용자 상태를 업데이트했습니다.");
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "사용자 상태 변경에 실패했습니다.");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function unlockLogin() {
    if (!detail?.loginBlocked || loading || unlocking) {
      return;
    }
    setUnlocking(true);
    setError(null);
    setResult(null);
    try {
      await apiFetch<{ userId: string; loginBlocked: boolean; failedLoginAttempts: number }>(`/api/admin/users/${userId}/unlock-login`, {
        method: "POST",
      });
      await load();
      setResult("로그인 잠금을 해제했습니다.");
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "잠금 해제에 실패했습니다.");
      }
    } finally {
      setUnlocking(false);
    }
  }

  if (loading && !detail) {
    return (
      <AdminShell>
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">사용자 상세</h1>
            <p className="text-sm text-slate-500">userId: {userId}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-44" />
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
        <div>
          <h1 className="text-2xl font-bold text-slate-900">사용자 상세</h1>
          <p className="text-sm text-slate-500">userId: {userId}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <p>
              <span className="font-medium text-slate-700">이름:</span> {detail?.name ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-700">이메일:</span> {detail?.email ?? "-"}
            </p>
            <p>
              <span className="font-medium text-slate-700">현재 상태:</span>{" "}
              {detail ? <StatusBadge status={detail.status} /> : "-"}
            </p>
            <p>
              <span className="font-medium text-slate-700">플랫폼 관리자:</span> {detail?.isPlatformAdmin ? "예" : "아니오"}
            </p>
            <p>
              <span className="font-medium text-slate-700">최근 로그인:</span> {formatDateTime(detail?.lastLoginAt)}
            </p>
            <p>
              <span className="font-medium text-slate-700">실패 횟수:</span> {detail?.failedLoginAttempts ?? 0}
            </p>
            <p>
              <span className="font-medium text-slate-700">로그인 잠금:</span> {detail?.loginBlocked ? "예" : "아니오"}
            </p>
            <p>
              <span className="font-medium text-slate-700">비밀번호 초기화:</span> {detail?.passwordInitialized ? "완료" : "미완료"}
            </p>
          </div>
        </div>

        <div className="max-w-md space-y-3 rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-800">상태 변경</h2>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
            {statusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={updateStatus}
            disabled={updating || loading}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {updating ? "업데이트 중..." : "상태 업데이트"}
          </button>
        </div>

        <div className="max-w-md space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">로그인 잠금 해제</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                detail?.loginBlocked ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {detail?.loginBlocked ? "해제 가능" : "비활성"}
            </span>
          </div>
          <p className={`text-xs ${detail?.loginBlocked ? "text-amber-700" : "text-slate-500"}`}>
            {detail?.loginBlocked
              ? "로그인 잠금 상태입니다. 버튼을 눌러 즉시 해제할 수 있습니다."
              : "현재 로그인 잠금 상태가 아니어서 이 기능은 비활성화되었습니다."}
          </p>
          <button
            type="button"
            onClick={unlockLogin}
            disabled={!canUnlockLogin}
            title={detail?.loginBlocked ? "로그인 잠금 해제" : "로그인 잠금 상태가 아니면 해제할 수 없습니다."}
            className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${
              canUnlockLogin
                ? "bg-amber-600 !text-white hover:bg-amber-700"
                : "border border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {unlocking ? "해제 중..." : detail?.loginBlocked ? "잠금 해제 실행" : "잠금 상태 아님"}
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">소속 테넌트</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">역할</th>
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
              {detail?.memberships.map((membership) => (
                <tr key={`${membership.tenantId}:${membership.role}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">{membership.tenantName}</td>
                  <td className="px-4 py-3 text-slate-600">{membership.tenantSlug}</td>
                  <td className="px-4 py-3 text-slate-600">{membership.role}</td>
                </tr>
              ))}
              {!loading && (detail?.memberships.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    소속 테넌트가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {result ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{result}</p> : null}
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </section>
    </AdminShell>
  );
}
