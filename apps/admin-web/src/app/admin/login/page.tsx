"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { sanitizeNextPath, setAuthCookies } from "@/lib/auth";

type TenantOption = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: string;
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@bridge.local");
  const [password, setPassword] = useState("password");
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null);
  const [selectedTenantSlug, setSelectedTenantSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(tenantOptions ? { tenantSlug: selectedTenantSlug } : {}),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "로그인에 실패했습니다.");
      }

      const data = json?.data;
      if (data?.requiresTenantSelection) {
        const options = (Array.isArray(data.tenantOptions) ? data.tenantOptions : []) as TenantOption[];
        if (options.length === 0) {
          throw new Error("선택 가능한 테넌트가 없습니다.");
        }
        setTenantOptions(options);
        setSelectedTenantSlug(options[0].tenantSlug);
        return;
      }

      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error("로그인 응답이 올바르지 않습니다.");
      }

      setAuthCookies(data.accessToken, data.refreshToken);
      router.replace(sanitizeNextPath(params.get("next"), "/admin/tenants"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(15,23,42,0.11),transparent_32%),radial-gradient(circle_at_87%_20%,rgba(15,23,42,0.08),transparent_30%)]"
      />
      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl lg:grid-cols-2">
        <section className="hidden border-r border-border bg-muted/40 p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold !text-white">B</span>
            <p className="text-sm font-semibold text-foreground">Bridge Admin</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            플랫폼 운영 설정과 테넌트 제어를 관리하는 관리자 콘솔입니다.
          </p>
        </section>

        <form onSubmit={onSubmit} className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-foreground">관리자 로그인</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bridge Admin Workspace에 로그인하세요.</p>

          <label htmlFor="admin-email" className="mt-6 block text-sm font-medium text-foreground">
            이메일
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setTenantOptions(null);
              setSelectedTenantSlug("");
            }}
            disabled={Boolean(tenantOptions)}
            required
          />

          <label htmlFor="admin-password" className="mt-4 block text-sm font-medium text-foreground">
            비밀번호
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setTenantOptions(null);
              setSelectedTenantSlug("");
            }}
            disabled={Boolean(tenantOptions)}
            required
          />

          {tenantOptions ? (
            <div className="mt-4 space-y-2">
              <label htmlFor="admin-tenant" className="block text-sm font-medium text-foreground">
                테넌트 선택
              </label>
              <select
                id="admin-tenant"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedTenantSlug}
                onChange={(e) => setSelectedTenantSlug(e.target.value)}
              >
                {tenantOptions.map((option) => (
                  <option key={option.tenantId} value={option.tenantSlug}>
                    {option.tenantName} ({option.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setTenantOptions(null);
                  setSelectedTenantSlug("");
                }}
                className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                다른 계정으로 다시 입력
              </button>
            </div>
          ) : null}

          {error ? (
            <p id="admin-login-error" role="alert" aria-live="polite" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            disabled={submitting}
            className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium !text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "처리 중..." : tenantOptions ? "선택한 테넌트로 입장" : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}

function LoginPageFallback() {
  return <main className="min-h-screen bg-background" />;
}


