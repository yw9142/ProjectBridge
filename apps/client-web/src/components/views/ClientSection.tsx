import { StatusBadge } from "@/components/ui/StatusBadge";

export function ClientSection({
  title,
  description,
  status = "ACTIVE",
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">클라이언트 관점 작업 리스트와 상세 정보가 배치됩니다.</div>
    </section>
  );
}
