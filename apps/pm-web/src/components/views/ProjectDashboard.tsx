import { StatusBadge } from "../ui/StatusBadge";

export function ProjectDashboard() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          ["활성 요청", "12"],
          ["미확인 코멘트", "7"],
          ["대기 중 서명", "3"],
          ["예정 회의", "4"],
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </article>
        ))}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">최근 액션</h3>
          <StatusBadge status="IN_PROGRESS" />
        </div>
        <p className="text-sm text-slate-600">요청 상태, 파일 코멘트, 서명 이벤트를 작업 우선순위에 맞게 표시합니다.</p>
      </section>
    </div>
  );
}

