"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { Modal } from "@bridge/ui";

type VaultRequest = {
  id: string;
  name: string;
  siteUrl?: string | null;
  requestReason?: string | null;
  credentialReady: boolean;
  providedAt?: string | null;
  createdBy?: string;
  createdByName?: string;
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
    // ignore json parse errors
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

  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<VaultRequest[]>(`/api/projects/${projectId}/vault/account-requests`);
      setItems(data);
      setCredentialsMap({});
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "Vault ��û ����� �ҷ����� ���߽��ϴ�.");
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
    try {
      await apiFetch<VaultRequest>(`/api/projects/${projectId}/vault/account-requests`, {
        method: "POST",
        body: JSON.stringify({ platformName, siteUrl, requestReason }),
      });
      setCreateOpen(false);
      setPlatformName("");
      setSiteUrl("");
      setRequestReason("");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "���� ��û ������ �����߽��ϴ�.");
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
    try {
      const plainSecret = JSON.stringify({ id: provisionLoginId, password: provisionPassword });
      await apiFetch(`/api/vault/secrets/${provisionTargetId}/provision`, {
        method: "PATCH",
        body: JSON.stringify({ plainSecret }),
      });
      setProvisionOpen(false);
      setProvisionTargetId(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "���� ���� �Է¿� �����߽��ϴ�.");
      }
    }
  }

  async function revealSecret(secretId: string) {
    setError(null);
    setRevealingId(secretId);
    try {
      const revealed = await apiFetch<{ secret: string }>(`/api/vault/secrets/${secretId}/reveal`, { method: "POST" });
      setCredentialsMap((prev) => ({
        ...prev,
        [secretId]: parseCredential(revealed.secret),
      }));
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "���� ���� ��ȸ�� �����߽��ϴ�.");
      }
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Vault ���� ��û</h1>
          <p className="text-sm text-slate-500">���� ��û�� ���� ������ ���̺���� Ȯ���ϰ� ó���մϴ�.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          ���� ��û
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">�÷���</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">��û ����</th>
              <th className="px-4 py-3">����</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">PW</th>
              <th className="px-4 py-3">���� �ð�</th>
              <th className="px-4 py-3">�۾�</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((item) => {
              const credential = credentialsMap[item.id];
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3 text-slate-700">{item.siteUrl || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{item.requestReason || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">�����: {item.createdByName ?? item.createdBy ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        item.credentialReady ? vaultStatusStyles.READY : vaultStatusStyles.PENDING
                      }`}
                    >
                      {item.credentialReady ? "�Է� �Ϸ�" : "�Է� ���"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{credential?.id ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{credential?.password ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatDate(item.providedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openProvisionModal(item.id)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        ���� �Է�
                      </button>
                      {item.credentialReady ? (
                        <button
                          type="button"
                          disabled={revealingId === item.id}
                          onClick={() => void revealSecret(item.id)}
                          className="rounded border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                        >
                          {revealingId === item.id ? "��ȸ ��" : "��ȸ"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  ��û ������ �����ϴ�.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="���� ��û ����" description="�÷��� ���� ������ ��û�մϴ�.">
        <form onSubmit={createAccountRequest} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="�÷�����" value={platformName} onChange={(e) => setPlatformName(e.target.value)} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="����Ʈ URL" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} required />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            rows={4}
            placeholder="��û ����"
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              ���
            </button>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
              ��û ����
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={provisionOpen} onClose={() => setProvisionOpen(false)} title="���� ���� �Է�" description="��û�� �÷����� �α��� ������ �Է��մϴ�.">
        <form onSubmit={provisionSecret} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="�α��� ID" value={provisionLoginId} onChange={(e) => setProvisionLoginId(e.target.value)} required />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="text"
            placeholder="��й�ȣ"
            value={provisionPassword}
            onChange={(e) => setProvisionPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProvisionOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              ���
            </button>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold !text-white hover:bg-slate-800">
              ����
            </button>
          </div>
        </form>
      </Modal>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
