"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { Modal } from "@/components/ui/modal";

type VaultRequest = {
  id: string;
  name: string;
  siteUrl?: string | null;
  requestReason?: string | null;
  credentialReady: boolean;
  providedAt?: string | null;
  createdBy?: string;
  createdByName?: string;
  revealAllowed?: boolean;
  revealedSecret?: string | null;
};

type CredentialPair = {
  id: string;
  password: string;
};

const vaultStatusStyles = {
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
};

function parseCredential(raw: string): CredentialPair {
  try {
    const parsed = JSON.parse(raw) as { id?: string; password?: string };
    if (parsed.id && parsed.password) {
      return { id: parsed.id, password: parsed.password };
    }
  } catch {
    // ignore JSON parse errors
  }

  const idMatch = raw.match(/id\s*[:=]\s*([^,\n]+)/i);
  const pwMatch = raw.match(/password\s*[:=]\s*([^,\n]+)/i);
  if (idMatch || pwMatch) {
    return {
      id: idMatch?.[1]?.trim() ?? "-",
      password: pwMatch?.[1]?.trim() ?? "-",
    };
  }

  return { id: "-", password: raw };
}

function formatDate(value?: string | null) {
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

export default function ProjectVaultPage() {
  const projectId = useProjectId();
  const [items, setItems] = useState<VaultRequest[]>([]);
  const [credentialsMap, setCredentialsMap] = useState<Record<string, CredentialPair>>({});
  const [loading, setLoading] = useState(true);
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [platformName, setPlatformName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [requestReason, setRequestReason] = useState("");

  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionTargetId, setProvisionTargetId] = useState<string | null>(null);
  const [provisionLoginId, setProvisionLoginId] = useState("");
  const [provisionPassword, setProvisionPassword] = useState("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<VaultRequest[]>(`/api/projects/${projectId}/vault/account-requests`);
      setItems(data);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "Failed to load vault requests.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createAccountRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await apiFetch<VaultRequest>(`/api/projects/${projectId}/vault/account-requests`, {
        method: "POST",
        body: JSON.stringify({ platformName, siteUrl, requestReason }),
      });
      setCreateOpen(false);
      setPlatformName("");
      setSiteUrl("");
      setRequestReason("");
      setNotice("Account request created.");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "Failed to create account request.");
      }
    }
  }

  function openProvisionModal(targetId: string) {
    setProvisionOpen(true);
    setProvisionTargetId(targetId);
    setProvisionLoginId("");
    setProvisionPassword("");
  }

  async function provisionSecret(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provisionTargetId) return;
    setError(null);
    setNotice(null);
    try {
      const plainSecret = JSON.stringify({ id: provisionLoginId, password: provisionPassword });
      await apiFetch(`/api/vault/secrets/${provisionTargetId}/provision`, {
        method: "PATCH",
        body: JSON.stringify({ plainSecret }),
      });
      setProvisionOpen(false);
      setProvisionTargetId(null);
      setNotice("자격 제공되었습니다.");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "자격 제공에 실패했습니다.");
      }
    }
  }

  async function requestAccess(secretId: string) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/vault/secrets/${secretId}/access-requests`, { method: "POST" });
      setNotice("접근 요청이 제출되었습니다.");
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "접근 요청 제출에 실패했습니다.");
      }
    }
  }

  async function revealSecret(secretId: string) {
    setError(null);
    setNotice(null);
    setRevealingId(secretId);
    try {
      const revealed = await apiFetch<{ secret: string }>(`/api/vault/secrets/${secretId}/reveal`, { method: "POST" });
      setCredentialsMap((prev) => ({ ...prev, [secretId]: parseCredential(revealed.secret) }));
      setNotice("자격 공개되었습니다.");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "자격 공개에 실패했습니다.");
      }
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">계정 요청</h1>
          <p className="text-sm text-slate-500">필요할 때만 계정 요청, 제공, 공개를 할 수 있습니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          새 요청
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">플랫폼</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">이유</th>
              <th className="px-4 py-3">요청자</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">PW</th>
              <th className="px-4 py-3">제공 시각</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((item) => {
              const credential = item.revealedSecret ? parseCredential(item.revealedSecret) : credentialsMap[item.id];
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-700">{item.siteUrl || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{item.requestReason || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{item.createdByName ?? item.createdBy ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        item.credentialReady ? vaultStatusStyles.READY : vaultStatusStyles.PENDING
                      }`}
                    >
                      {item.credentialReady ? "Ready" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{credential?.id ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{credential?.password ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(item.providedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openProvisionModal(item.id)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        제공
                      </button>
                      {item.credentialReady ? (
                        <>
                          {!item.revealAllowed ? (
                            <button
                              type="button"
                              onClick={() => void requestAccess(item.id)}
                              className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              접근 요청
                            </button>
                          ) : null}
                          {item.revealAllowed ? (
                            <button
                              type="button"
                              onClick={() => void revealSecret(item.id)}
                              disabled={revealingId === item.id}
                              className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                            >
                              {revealingId === item.id ? "공개 중..." : "공개"}
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                    요청이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="계정 요청" description="플랫폼 계정을 요청합니다.">
        <form onSubmit={createAccountRequest} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="플랫폼" value={platformName} onChange={(e) => setPlatformName(e.target.value)} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="URL" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} required />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={4}
            placeholder="이유"
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            required
          />
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

        <Modal open={provisionOpen} onClose={() => setProvisionOpen(false)} title="자격 제공" description="자격을 암호화된 저장소에 저장합니다.">
        <form onSubmit={provisionSecret} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="로그인 ID" value={provisionLoginId} onChange={(e) => setProvisionLoginId(e.target.value)} required />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="text"
            placeholder="비밀번호"
            value={provisionPassword}
            onChange={(e) => setProvisionPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProvisionOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold !text-white hover:bg-slate-800">
              저장
            </button>
          </div>
        </form>
      </Modal>

      {notice ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p> : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
