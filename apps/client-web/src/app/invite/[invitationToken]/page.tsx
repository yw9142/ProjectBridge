"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { setAuthCookies } from "@/lib/auth";

type InvitationPreview = {
  projectId: string;
  invitedEmail: string;
  role: string;
  expiresAt: string;
  accepted: boolean;
};

type ActivateResponse = {
  accepted: boolean;
  projectId: string;
  accessToken: string;
  refreshToken: string;
};

export default function InvitationAcceptPage() {
  const params = useParams<{ invitationToken: string }>();
  const router = useRouter();
  const invitationToken = params.invitationToken;

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/invitations/${invitationToken}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error?.message ?? "Failed to load invitation.");
        }
        if (active) {
          setPreview(body.data as InvitationPreview);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load invitation.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [invitationToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/auth/invitations/${invitationToken}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Failed to activate invitation.");
      }
      const data = body.data as ActivateResponse;
      if (!data.accessToken || !data.refreshToken) {
        throw new Error("Invalid activation response.");
      }
      setAuthCookies(data.accessToken, data.refreshToken);
      router.replace(`/client/projects/${data.projectId}/home`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to activate invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-6">Loading invitation...</main>;
  }

  if (!preview) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error ?? "Invitation not found."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Accept Invitation</h1>
        <p className="mt-2 text-sm text-slate-600">Set your profile and password to enter the project.</p>

        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-700">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-500">Email</dt>
            <dd className="text-right">{preview.invitedEmail}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-500">Role</dt>
            <dd className="text-right">{preview.role}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-slate-500">Expires</dt>
            <dd className="text-right">{new Date(preview.expiresAt).toLocaleString("ko-KR")}</dd>
          </div>
        </dl>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            disabled={submitting}
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Processing..." : "Join Project"}
          </button>
        </form>

        {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </div>
    </main>
  );
}
