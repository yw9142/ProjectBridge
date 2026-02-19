import FadeContent from "@/components/react-bits/FadeContent";
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
      <FadeContent blur duration={650} threshold={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </FadeContent>
      <FadeContent blur duration={700} delay={80} threshold={0}>
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">클라이언트 관점 작업 리스트와 상세 정보가 배치됩니다.</div>
      </FadeContent>
    </section>
  );
}
