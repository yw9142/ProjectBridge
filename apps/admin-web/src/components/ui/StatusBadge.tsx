const styles: Record<string, string> = {
  ACTIVE: "border-transparent bg-emerald-100 text-emerald-700",
  INVITED: "border-transparent bg-amber-100 text-amber-800",
  SUSPENDED: "border-transparent bg-red-100 text-red-700",
  DEACTIVATED: "border-slate-300 text-slate-700",
};

const labels: Record<string, string> = {
  ACTIVE: "활성",
  INVITED: "초대",
  SUSPENDED: "정지",
  DEACTIVATED: "비활성",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? "border-slate-300 text-slate-700"}`}>
      {labels[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}
