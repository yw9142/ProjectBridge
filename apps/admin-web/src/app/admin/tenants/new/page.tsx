"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { apiFetch, handleAuthError } from "@/lib/api";

type Tenant = { id: string };

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = await apiFetch<Tenant>("/api/admin/tenants", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      router.replace(`/admin/tenants/${created.id}`);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "테넌트 생성에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">테넌트 생성</h1>
            <p className="text-sm text-slate-500">새 테넌트를 생성하고 상세 화면으로 이동합니다.</p>
          </div>
          <Link href="/admin/tenants" className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
            목록으로
          </Link>
        </div>

        <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">테넌트 이름</label>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Slug</label>
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
          <button disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60">
            {submitting ? "생성 중..." : "생성"}
          </button>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </form>
      </section>
    </AdminShell>
  );
}

