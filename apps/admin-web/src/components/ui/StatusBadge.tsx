const styles: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INVITED: "border-amber-200 bg-amber-50 text-amber-700",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700",
  DEACTIVATED: "border-slate-300 bg-slate-100 text-slate-700",
};

const labels: Record<string, string> = {
  ACTIVE: "활성",
  INVITED: "초대",
  SUSPENDED: "정지",
  DEACTIVATED: "비활성",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? "border-slate-300 bg-slate-100 text-slate-700"}`}>
      {labels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}
