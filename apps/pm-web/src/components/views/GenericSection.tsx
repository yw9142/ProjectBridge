import { StatusBadge } from "../ui/StatusBadge";

type Props = {
  title: string;
  description: string;
  status?: string;
};

export function GenericSection({ title, description, status = "ACTIVE" }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">이 영역은 API 연동 데이터가 연결될 테이블과 카드 섹션입니다.</p>
      </div>
    </section>
  );
}
