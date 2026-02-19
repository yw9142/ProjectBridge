"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@bridge/ui";

type MemberRole = "PM_OWNER" | "PM_MEMBER" | "CLIENT_OWNER" | "CLIENT_MEMBER" | "READONLY";

type ProjectMember = {
  id: string;
  userId: string;
  role: MemberRole;
  loginId: string;
  passwordMask: string;
};

type AccountDraft = {
  loginId: string;
  password: string;
};

const roles: Array<{ value: MemberRole; label: string }> = [
  { value: "PM_OWNER", label: "PM 관리자" },
  { value: "PM_MEMBER", label: "PM 멤버" },
  { value: "CLIENT_OWNER", label: "클라이언트 관리자" },
  { value: "CLIENT_MEMBER", label: "클라이언트 멤버" },
  { value: "READONLY", label: "읽기 전용" },
];

export default function ProjectMemberSettingsPage() {
  const projectId = useProjectId();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, MemberRole>>({});
  const [accountDrafts, setAccountDrafts] = useState<Record<string, AccountDraft>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("CLIENT_MEMBER");

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await apiFetch<ProjectMember[]>(`/api/projects/${projectId}/members`);
      setMembers(data);
      setRoleDrafts(Object.fromEntries(data.map((member) => [member.id, member.role])));
      setAccountDrafts(
        Object.fromEntries(
          data.map((member) => [
            member.id,
            {
              loginId: member.loginId,
              password: member.passwordMask,
            },
          ]),
        ),
      );
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "멤버 목록을 불러오지 못했습니다.");
      }
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInviteToken(null);

    try {
      const result = await apiFetch<{ invitationToken: string }>(`/api/projects/${projectId}/members/invite`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          loginId,
          password: initialPassword,
          name: displayName,
        }),
      });
      setInviteToken(result.invitationToken);
      setCreateOpen(false);
      setInviteEmail("");
      setLoginId("");
      setInitialPassword("");
      setDisplayName("");
      setInviteRole("CLIENT_MEMBER");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계정 생성에 실패했습니다.");
      }
    }
  }

  async function saveRole(memberId: string) {
    const nextRole = roleDrafts[memberId];
    if (!nextRole) return;
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "멤버 역할 수정에 실패했습니다.");
      }
    }
  }

  async function saveAccount(memberId: string) {
    const member = members.find((item) => item.id === memberId);
    const draft = accountDrafts[memberId];
    if (!member || !draft) return;

    const normalizedLoginId = draft.loginId.trim();
    const hasLoginIdChange = normalizedLoginId !== "" && normalizedLoginId !== member.loginId;
    const hasPasswordChange = draft.password.trim() !== "" && draft.password !== member.passwordMask;
    if (!hasLoginIdChange && !hasPasswordChange) return;

    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/members/${memberId}/account`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(hasLoginIdChange ? { loginId: normalizedLoginId } : {}),
          ...(hasPasswordChange ? { password: draft.password } : {}),
        }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "계정 정보 수정에 실패했습니다.");
      }
    }
  }

  async function deleteMember(memberId: string) {
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "멤버 삭제에 실패했습니다.");
      }
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">멤버 설정</h1>
          <p className="text-sm text-slate-500">멤버 역할과 계정 정보를 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          계정 생성
        </button>
      </div>

      {inviteToken ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">초대 토큰: {inviteToken}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">사용자</th>
              <th className="px-4 py-3">로그인 ID</th>
              <th className="px-4 py-3">비밀번호</th>
              <th className="px-4 py-3">역할</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{member.userId}</td>
                <td className="px-4 py-3">
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={accountDrafts[member.id]?.loginId ?? member.loginId}
                    onChange={(e) =>
                      setAccountDrafts((prev) => ({
                        ...prev,
                        [member.id]: {
                          loginId: e.target.value,
                          password: prev[member.id]?.password ?? member.passwordMask,
                        },
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    type="text"
                    value={accountDrafts[member.id]?.password ?? member.passwordMask}
                    onFocus={() =>
                      setAccountDrafts((prev) => ({
                        ...prev,
                        [member.id]: {
                          loginId: prev[member.id]?.loginId ?? member.loginId,
                          password: prev[member.id]?.password === member.passwordMask ? "" : (prev[member.id]?.password ?? ""),
                        },
                      }))
                    }
                    onChange={(e) =>
                      setAccountDrafts((prev) => ({
                        ...prev,
                        [member.id]: {
                          loginId: prev[member.id]?.loginId ?? member.loginId,
                          password: e.target.value,
                        },
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    value={roleDrafts[member.id] ?? member.role}
                    onChange={(e) => setRoleDrafts((prev) => ({ ...prev, [member.id]: e.target.value as MemberRole }))}
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveAccount(member.id)}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-indigo-700"
                    >
                      계정 저장
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveRole(member.id)}
                      className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold !text-white hover:bg-slate-800"
                    >
                      역할 저장
                    </button>
                    <ConfirmActionButton
                      label="멤버 삭제"
                      title="멤버를 삭제할까요?"
                      description="삭제 시 프로젝트 접근 권한이 제거됩니다."
                      onConfirm={() => deleteMember(member.id)}
                      triggerVariant="destructive"
                      triggerSize="sm"
                      triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      confirmVariant="destructive"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  등록된 멤버가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="계정 생성"
        description="로그인 ID/비밀번호를 포함해 계정을 생성하고 프로젝트에 추가합니다."
      >
        <form onSubmit={createMember} className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="초대 이메일"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="로그인 ID(이메일)"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="text"
            placeholder="초기 비밀번호"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="표시 이름"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MemberRole)}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
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

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
