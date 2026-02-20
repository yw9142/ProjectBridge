"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/api";

export default function FirstPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <FirstPasswordForm />
    </Suspense>
  );
}

function FirstPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const queryEmail = params.get("email");
    if (queryEmail) {
      setEmail(queryEmail);
    }
  }, [params]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (newPassword !== confirmPassword) {
        throw new Error("비밀번호 확인이 일치하지 않습니다.");
      }

      const response = await fetch(`${API_BASE}/api/auth/first-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bridge-App": "pm",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          setupCode,
          newPassword,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "최초 비밀번호 설정에 실패했습니다.");
      }

      setSuccess("비밀번호 설정이 완료되었습니다. 로그인 페이지로 이동합니다.");
      window.setTimeout(() => {
        router.replace("/login");
      }, 1000);
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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_16%,rgba(15,23,42,0.1),transparent_35%),radial-gradient(circle_at_84%_22%,rgba(15,23,42,0.07),transparent_32%)]"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <h1 className="text-2xl font-semibold text-foreground">PM 최초 비밀번호 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">관리자에게 받은 설정 코드로 비밀번호를 설정하세요.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="first-password-email" className="block text-sm font-medium text-foreground">
              이메일
            </label>
            <input
              id="first-password-email"
              type="email"
              autoComplete="username"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="first-password-code" className="block text-sm font-medium text-foreground">
              설정 코드
            </label>
            <input
              id="first-password-code"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              placeholder="8자리 숫자"
              required
            />
          </div>

          <div>
            <label htmlFor="first-password-new" className="block text-sm font-medium text-foreground">
              새 비밀번호
            </label>
            <input
              id="first-password-new"
              type="password"
              autoComplete="new-password"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">10~72자, 대문자/소문자/숫자를 포함해야 합니다.</p>
          </div>

          <div>
            <label htmlFor="first-password-confirm" className="block text-sm font-medium text-foreground">
              새 비밀번호 확인
            </label>
            <input
              id="first-password-confirm"
              type="password"
              autoComplete="new-password"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium !text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "설정 중..." : "비밀번호 설정 완료"}
          </button>
        </form>
      </div>
    </main>
  );
}
