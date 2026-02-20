"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@/components/ui/modal";

type MemberRole = "PM_OWNER" | "PM_MEMBER" | "CLIENT_OWNER" | "CLIENT_MEMBER" | "READONLY";

type ProjectMember = {
  id: string;
  userId: string;
  role: MemberRole;
  loginId: string;
  passwordMask: string;
  passwordInitialized: boolean;
  setupCode?: string | null;
  setupCodeExpiresAt?: string | null;
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
  const [loginId, setLoginId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("CLIENT_MEMBER");

  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [setupCodeInfo, setSetupCodeInfo] = useState<{ loginId: string; setupCode: string; expiresAt?: string | null } | null>(null);
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
      if (!handleAuthError(e, "/login")) {
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
    setCreateNotice(null);

    try {
      const created = await apiFetch<ProjectMember>(`/api/projects/${projectId}/members/invite`, {
        method: "POST",
        body: JSON.stringify({
          role: inviteRole,
          loginId,
          name: displayName,
        }),
      });
      if (created.setupCode) {
        setCreateNotice(`계정이 생성되었습니다. 클라이언트 앱의 /first-password 에서 최초 비밀번호를 설정하세요. 로그인 ID: ${created.loginId}`);
        setSetupCodeInfo({
          loginId: created.loginId,
          setupCode: created.setupCode,
          expiresAt: created.setupCodeExpiresAt,
        });
      } else if (created.passwordInitialized) {
        setCreateNotice(`이미 비밀번호가 설정된 기존 계정입니다. 클라이언트 로그인 페이지에서 기존 비밀번호로 로그인하세요. 로그인 ID: ${created.loginId}`);
      } else {
        setCreateNotice(`계정이 생성되었습니다. 설정 코드를 확인하지 못했습니다. 멤버 행의 '설정코드 재발급'으로 코드를 발급한 뒤 /first-password 에서 설정하세요. 로그인 ID: ${created.loginId}`);
        setSetupCodeInfo(null);
      }
      setCreateOpen(false);
      setLoginId("");
      setDisplayName("");
      setInviteRole("CLIENT_MEMBER");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "계정 생성에 실패했습니다.");
      }
    }
  }

  async function resetSetupCode(memberId: string, memberLoginId: string) {
    setError(null);
    try {
      const reset = await apiFetch<ProjectMember>(`/api/projects/${projectId}/members/${memberId}/setup-code/reset`, {
        method: "POST",
      });
      if (!reset.setupCode) {
        throw new Error("설정 코드 발급에 실패했습니다.");
      }
      setSetupCodeInfo({
        loginId: memberLoginId,
        setupCode: reset.setupCode,
        expiresAt: reset.setupCodeExpiresAt,
      });
      setCreateNotice(`설정 코드를 재발급했습니다. 클라이언트 앱 /first-password 에서 사용하세요. 로그인 ID: ${memberLoginId}`);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "설정 코드 재발급에 실패했습니다.");
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
      if (!handleAuthError(e, "/login")) {
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
      if (!handleAuthError(e, "/login")) {
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
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "멤버 삭제에 실패했습니다.");
      }
    }
  }

  const formatExpiry = (value?: string | null) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const copySetupCode = async () => {
    if (!setupCodeInfo?.setupCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(setupCodeInfo.setupCode);
      setCreateNotice("설정 코드를 클립보드에 복사했습니다.");
    } catch {
      setCreateNotice("클립보드 복사에 실패했습니다.");
    }
  };

  const copySetupGuide = async () => {
    if (!setupCodeInfo?.setupCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    const guide = [
      "[Bridge 최초 비밀번호 설정 안내]",
      `로그인 ID: ${setupCodeInfo.loginId}`,
      `설정 코드: ${setupCodeInfo.setupCode}`,
      `만료시각: ${formatExpiry(setupCodeInfo.expiresAt)}`,
      "접속 경로: 클라이언트 앱 /first-password",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(guide);
      setCreateNotice("설정 안내문을 클립보드에 복사했습니다.");
    } catch {
      setCreateNotice("설정 안내문 복사에 실패했습니다.");
    }
  };

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

      {createNotice ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{createNotice}</p> : null}
      {setupCodeInfo ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">최초 비밀번호 설정 코드</p>
          <p>로그인 ID: {setupCodeInfo.loginId}</p>
          <p>설정 코드: <span className="font-mono font-semibold">{setupCodeInfo.setupCode}</span></p>
          <p>만료시각: {formatExpiry(setupCodeInfo.expiresAt)}</p>
          <p className="text-xs text-amber-800">
            사용 방법: 클라이언트 앱의 <span className="font-mono">/first-password</span> 페이지에서 로그인 ID, 설정 코드, 새 비밀번호를 입력합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copySetupCode()}
              className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              코드 복사
            </button>
            <button
              type="button"
              onClick={() => void copySetupGuide()}
              className="rounded border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              안내문 복사
            </button>
          </div>
        </div>
      ) : null}

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
                  <p className="mt-1 text-xs text-slate-500">{member.passwordInitialized ? "비밀번호 설정 완료" : "최초 비밀번호 설정 필요"}</p>
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
                    {!member.passwordInitialized ? (
                      <button
                        type="button"
                        onClick={() => void resetSetupCode(member.id, member.loginId)}
                        className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                      >
                        설정코드 재발급
                      </button>
                    ) : null}
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
        description="로그인 ID를 생성하고 최초 비밀번호 설정 코드를 발급합니다."
      >
        <form onSubmit={createMember} className="space-y-3">
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="로그인 ID(이메일)"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
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
