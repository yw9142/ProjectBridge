"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/modal";
import { apiFetch, handleAuthError } from "@/lib/api";
import { setAuthCookies } from "@/lib/auth";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt?: string;
};

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default function TenantsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Tenant[]>("/api/admin/tenants");
      setItems(data);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "테넌트 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setName("");
      setSlug("");
      setCreateOpen(false);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "테넌트 생성에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function openTenantDetail(tenant: Tenant) {
    setSwitchingTenantId(tenant.id);
    setError(null);
    try {
      const switched = await apiFetch<{ accessToken: string; refreshToken: string }>("/api/auth/switch-tenant", {
        method: "POST",
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      if (!switched?.accessToken || !switched?.refreshToken) {
        throw new Error("테넌트 전환 응답이 올바르지 않습니다.");
      }
      setAuthCookies(switched.accessToken, switched.refreshToken);
      router.push(`/admin/tenants/${tenant.id}`);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "테넌트 전환에 실패했습니다.");
      }
    } finally {
      setSwitchingTenantId(null);
    }
  }

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.status === "ACTIVE").length;
    return { total, active };
  }, [items]);

  return (
    <AdminShell>
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">테넌트 관리</h1>
            <p className="text-sm text-slate-500">테넌트를 생성하고 상태를 확인합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
          >
            테넌트 생성
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">전체 테넌트</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">활성 테넌트</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stats.active}</p>
          </article>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">테넌트명</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">생성일</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{tenant.name}</td>
                  <td className="px-4 py-3 text-slate-600">{tenant.slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tenant.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(tenant.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void openTenantDetail(tenant)}
                      disabled={switchingTenantId === tenant.id}
                      className="inline-flex rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {switchingTenantId === tenant.id ? "전환 중..." : "상세 보기"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    등록된 테넌트가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="테넌트 생성" description="이름과 slug를 입력해 테넌트를 생성합니다.">
          <form onSubmit={createTenant} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">테넌트 이름</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Slug</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
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

