"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/modal";
import { apiFetch, handleAuthError } from "@/lib/api";
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
  lastLoginAt?: string | null;
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

  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await apiFetch(`/api/admin/tenants/${tenantId}/pm-users`, {
        method: "POST",
        body: JSON.stringify({ email, name }),
      });
      setEmail("");
      setName("");
      setCreateOpen(false);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "PM 사용자 생성에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
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
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
          >
            PM 사용자 추가
          </button>
        </div>

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
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.userId}`}
                      className="inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      사용자 관리
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && pmUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    등록된 테넌트 사용자가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="PM 사용자 생성" description="생성 후 기본 상태는 초대(INVITED)입니다.">
          <form onSubmit={createPmUser} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">이메일</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">이름</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
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
