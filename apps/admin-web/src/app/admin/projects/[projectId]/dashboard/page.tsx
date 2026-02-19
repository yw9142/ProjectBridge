"use client";

import { CalendarClock, CheckCheck, ClipboardList, HandCoins, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useProjectId } from "@/lib/use-project-id";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

type Project = { id: string; name: string; description?: string | null; status: string };
type RequestType = "APPROVAL" | "INFO_REQUEST" | "FEEDBACK" | "SIGNATURE" | "PAYMENT_CONFIRMATION" | "VAULT_ACCESS" | "MEETING_CONFIRMATION";
type RequestStatus = "DRAFT" | "SENT" | "ACKED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";
type MeetingStatus = "SCHEDULED" | "CANCELLED";
type InvoiceStatus = "DRAFT" | "ISSUED" | "CONFIRMED" | "CLOSED" | "OVERDUE" | "CANCELLED";

type RequestItem = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  createdAt?: string;
};

type MeetingItem = {
  id: string;
  startAt: string;
  status: MeetingStatus;
};

type InvoiceItem = {
  id: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
};

type Notice = {
  id: string;
  title: string;
  message: string;
  eventType: string;
  createdAt: string;
};

type TrendPoint = {
  label: string;
  count: number;
};

const terminalRequestStatuses = new Set<RequestStatus>(["DONE", "REJECTED", "CANCELLED"]);

function getWeekStart(date: Date) {
  const value = new Date(date);
  const diffFromMonday = (value.getDay() + 6) % 7;
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - diffFromMonday);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatActionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(total: number, currency: string) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(total);
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }
  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${path} L ${point.x} ${point.y}`;
  }, "");
}

export default function DashboardPage() {
  const projectId = useProjectId();
  const [project, setProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [recentActions, setRecentActions] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [projectData, requestsData, meetingsData, invoicesData, noticesData] = await Promise.all([
          apiFetch<Project>(`/api/projects/${projectId}`),
          apiFetch<RequestItem[]>(`/api/projects/${projectId}/requests`),
          apiFetch<MeetingItem[]>(`/api/projects/${projectId}/meetings`),
          apiFetch<InvoiceItem[]>(`/api/projects/${projectId}/invoices`),
          apiFetch<Notice[]>(`/api/notifications`),
        ]);

        if (!active) {
          return;
        }

        setProject(projectData);
        setRequests(requestsData);
        setMeetings(meetingsData);
        setInvoices(invoicesData);
        setRecentActions(
          [...noticesData]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3),
        );
      } catch (e) {
        if (!handleAuthError(e, "/admin/login") && active) {
          setError(e instanceof Error ? e.message : "대시보드 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [projectId]);

  const summary = useMemo(() => {
    const now = Date.now();
    const activeRequests = requests.filter((item) => !terminalRequestStatuses.has(item.status)).length;
    const pendingApprovals = requests.filter((item) => item.type === "APPROVAL" && (item.status === "SENT" || item.status === "ACKED" || item.status === "IN_PROGRESS")).length;
    const upcomingMeetings = meetings.filter((item) => item.status === "SCHEDULED" && new Date(item.startAt).getTime() > now).length;
    const validInvoices = invoices.filter((item) => item.status !== "CANCELLED");
    const invoiceTotal = validInvoices.reduce((sum, item) => sum + item.amount, 0);
    const invoiceCurrency = validInvoices[0]?.currency ?? "KRW";

    return {
      activeRequests,
      pendingApprovals,
      upcomingMeetings,
      invoiceAmountText: formatMoney(invoiceTotal, invoiceCurrency),
    };
  }, [invoices, meetings, requests]);

  const requestTrend = useMemo<TrendPoint[]>(() => {
    const currentWeekStart = getWeekStart(new Date());
    const weeks = [3, 2, 1, 0].map((offset) => {
      const start = addDays(currentWeekStart, -offset * 7);
      const end = addDays(start, 7);
      return { start, end };
    });

    const labels = ["4주 전", "3주 전", "2주 전", "이번 주"];
    const counts = [0, 0, 0, 0];

    for (const item of requests) {
      if (!item.createdAt) {
        continue;
      }
      const created = new Date(item.createdAt);
      if (Number.isNaN(created.getTime())) {
        continue;
      }
      weeks.forEach((range, index) => {
        if (created >= range.start && created < range.end) {
          counts[index] += 1;
        }
      });
    }

    return labels.map((label, index) => ({ label, count: counts[index] }));
  }, [requests]);

  const chart = useMemo(() => {
    const width = 720;
    const height = 260;
    const padding = { top: 16, right: 18, bottom: 28, left: 36 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...requestTrend.map((point) => point.count), 1);
    const baseY = padding.top + innerHeight;

    const points = requestTrend.map((point, index) => {
      const x = padding.left + (index * innerWidth) / Math.max(requestTrend.length - 1, 1);
      const y = padding.top + ((maxValue - point.count) / maxValue) * innerHeight;
      return { ...point, x, y };
    });

    const linePath = buildLinePath(points);
    const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${baseY} L ${points[0]?.x ?? 0} ${baseY} Z`;
    const guides = [0, 1, 2, 3, 4].map((step) => {
      const y = padding.top + (innerHeight * step) / 4;
      return { y, value: Math.round(maxValue - (maxValue * step) / 4) };
    });

    return { width, height, points, linePath, areaPath, guides };
  }, [requestTrend]);

  const kpiCards = [
    { title: "요청", value: summary.activeRequests.toLocaleString("ko-KR"), icon: ClipboardList, accent: "text-indigo-600" },
    { title: "승인 대기", value: summary.pendingApprovals.toLocaleString("ko-KR"), icon: CheckCheck, accent: "text-amber-600" },
    { title: "다가오는 회의", value: summary.upcomingMeetings.toLocaleString("ko-KR"), icon: CalendarClock, accent: "text-sky-600" },
    { title: "정산 금액", value: summary.invoiceAmountText, icon: HandCoins, accent: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{project?.name ?? "프로젝트"}</h1>
        <p className="text-sm text-slate-500">{project?.description || "프로젝트 룸 운영 현황"}</p>
        <p className="mt-2 text-xs text-slate-400">status: {project?.status ?? "-"}</p>
      </section>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">{card.title}</p>
                <Icon className={`h-4 w-4 ${card.accent}`} />
              </div>
              {loading ? <Skeleton className="mt-3 h-9 w-20" /> : <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</p>}
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">테스크 추이</h2>
              <p className="text-xs text-slate-500">최근 4주 요청 생성 건수</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">총 {requests.length.toLocaleString("ko-KR")}건</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 w-full">
              <defs>
                <linearGradient id="taskAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              {chart.guides.map((guide, index) => (
                <g key={index}>
                  <line x1={36} x2={702} y1={guide.y} y2={guide.y} stroke="#cbd5e1" strokeDasharray="4 6" />
                  <text x={10} y={guide.y + 4} fontSize={10} fill="#64748b">
                    {guide.value}
                  </text>
                </g>
              ))}
              <path d={chart.areaPath} fill="url(#taskAreaGradient)" />
              <path d={chart.linePath} fill="none" stroke="#4f46e5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {chart.points.map((point) => (
                <circle key={point.label} cx={point.x} cy={point.y} r={4} fill="#4f46e5" />
              ))}
            </svg>
            <div className="mt-1 grid grid-cols-4 text-center text-xs text-slate-500">
              {requestTrend.map((point) => (
                <div key={point.label}>{point.label}</div>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">최근 액션</h2>
              <p className="text-xs text-slate-500">클라이언트 액션 최신 3개</p>
            </div>
          </div>
          <div className="space-y-3">
            {recentActions.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatActionTime(item.createdAt)} · {item.eventType}
                </p>
              </article>
            ))}
            {!loading && recentActions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">표시할 최근 액션이 없습니다.</p> : null}
            {loading ? <Skeleton className="h-16 w-full rounded-lg" /> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

