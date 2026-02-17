"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmSubmitButton } from "@/components/ui/confirm-action";

type PostType = "ANNOUNCEMENT" | "GENERAL" | "QA" | "ISSUE" | "MEETING_MINUTES" | "RISK";
type VisibilityScope = "SHARED" | "INTERNAL";

const postTypes: PostType[] = ["ANNOUNCEMENT", "GENERAL", "QA", "ISSUE", "MEETING_MINUTES", "RISK"];

export default function NewPostPage() {
  const router = useRouter();
  const projectId = useProjectId();
  const [type, setType] = useState<PostType>("GENERAL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>("SHARED");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/projects/${projectId}/posts`, {
        method: "POST",
        body: JSON.stringify({ type, title, body, pinned, visibilityScope }),
      });
      router.replace(`/admin/projects/${projectId}/posts`);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "寃뚯떆湲 ?앹꽦???ㅽ뙣?덉뒿?덈떎.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">寃뚯떆湲 ?묒꽦</h1>
        <Link href={`/admin/projects/${projectId}/posts`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          紐⑸줉?쇰줈
        </Link>
      </div>

      <form onSubmit={createPost} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={type} onChange={(e) => setType(e.target.value as PostType)}>
          {postTypes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="?쒕ぉ" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={10} placeholder="蹂몃Ц" value={body} onChange={(e) => setBody(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          ?곷떒 怨좎젙
        </label>
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
          value={visibilityScope}
          onChange={(e) => setVisibilityScope(e.target.value as VisibilityScope)}
        >
          <option value="SHARED">怨듭쑀??(?대씪?댁뼵??怨듦컻)</option>
          <option value="INTERNAL">?대???(PM ?꾩슜)</option>
        </select>
        <ConfirmSubmitButton
          label={submitting ? "?묒꽦 以?.." : "?깅줉"}
          title="寃뚯떆湲???깅줉?좉퉴??"
          description="?낅젰???댁슜?쇰줈 寃뚯떆湲???앹꽦?⑸땲??"
          disabled={submitting}
          triggerClassName="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700 disabled:opacity-60"
        />
      </form>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}


