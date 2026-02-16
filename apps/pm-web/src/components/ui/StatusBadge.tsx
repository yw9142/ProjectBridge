const colors: Record<string, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  SENT: "bg-amber-100 text-amber-800",
  ACKED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  DONE: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  PARTIALLY_SIGNED: "bg-amber-100 text-amber-800",
  ISSUED: "bg-indigo-100 text-indigo-800",
  OVERDUE: "bg-red-100 text-red-800",
  ACTIVE: "bg-green-100 text-green-800",
  REVOKED: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  const style = colors[status] ?? "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>{status.replaceAll("_", " ")}</span>;
}
