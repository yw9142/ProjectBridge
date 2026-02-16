"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeNextPath, setAuthCookies } from "../../lib/auth";
import { API_BASE } from "../../lib/api";

type TenantOption = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: string;
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("pm@bridge.local");
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
      const next = sanitizeNextPath(params.get("next"), "/pm/projects");
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(99,102,241,0.42),transparent_36%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,0.28),transparent_32%),linear-gradient(150deg,#020617,#0f172a_45%,#1e293b)]"
      />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md rounded-3xl border border-indigo-400/35 bg-slate-900/80 p-7 shadow-[0_24px_80px_-36px_rgba(99,102,241,0.75)] backdrop-blur"
      >
        <h1 className="text-2xl font-bold text-white">PM 로그인</h1>
        <p className="mt-1 text-sm text-slate-300">Bridge PM Workspace에 로그인하세요.</p>

        <label htmlFor="pm-email" className="mt-5 block text-sm font-medium text-slate-200">
          이메일
        </label>
        <input
          id="pm-email"
          type="email"
          autoComplete="username"
          inputMode="email"
          className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTenantOptions(null);
            setSelectedTenantSlug("");
          }}
          disabled={Boolean(tenantOptions)}
          required
        />

        <label htmlFor="pm-password" className="mt-4 block text-sm font-medium text-slate-200">
          비밀번호
        </label>
        <input
          id="pm-password"
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
            <label htmlFor="pm-tenant" className="block text-sm font-medium text-slate-200">
              테넌트 선택
            </label>
            <select
              id="pm-tenant"
              className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-3 py-2.5 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
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
              className="text-xs font-medium text-indigo-300 underline underline-offset-4 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              다른 계정으로 다시 입력
            </button>
          </div>
        ) : null}

        {error ? (
          <p id="pm-login-error" role="alert" aria-live="polite" className="mt-4 rounded-xl bg-red-500/15 p-2.5 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <button
          disabled={submitting}
          className="mt-6 min-h-11 w-full rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "처리 중..." : tenantOptions ? "선택한 테넌트로 입장" : "로그인"}
        </button>
      </form>
    </main>
  );
}

function LoginPageFallback() {
  return <main className="min-h-screen bg-slate-950" />;
}

