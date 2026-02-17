const colors: Record<string, string> = {
  DRAFT: "border-slate-300 bg-slate-100 text-slate-700",
  SENT: "border-indigo-200 bg-indigo-50 text-indigo-700",
  ACKED: "border-sky-200 bg-sky-50 text-sky-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  PARTIALLY_SIGNED: "border-amber-200 bg-amber-50 text-amber-700",
  ISSUED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REVOKED: "border-red-200 bg-red-50 text-red-700",
};

const labels: Record<string, string> = {
  IN_PROGRESS: "진행 중",
  PARTIALLY_SIGNED: "부분 서명",
};

export function StatusBadge({ status }: { status: string }) {
  const style = colors[status] ?? "border-slate-300 bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>{labels[status] ?? status.replaceAll("_", " ")}</span>;
}
