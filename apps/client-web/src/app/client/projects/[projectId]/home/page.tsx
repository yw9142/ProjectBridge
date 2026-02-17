"use client";

import { CalendarClock, CheckCheck, ClipboardList, FileSignature, History } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Project = { id: string; name: string; description?: string | null; status: string };
type RequestStatus = "DRAFT" | "SENT" | "ACKED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";
type RequestType = "APPROVAL" | "INFO_REQUEST" | "FEEDBACK" | "SIGNATURE" | "PAYMENT_CONFIRMATION" | "VAULT_ACCESS" | "MEETING_CONFIRMATION";
type MeetingStatus = "SCHEDULED" | "CANCELLED";
type ContractStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

type RequestItem = {
  id: string;
  type: RequestType;
  title: string;
  status: RequestStatus;
  createdAt?: string;
};

type PostItem = {
  id: string;
  title: string;
  createdAt?: string;
};

type MeetingItem = {
  id: string;
  title: string;
  startAt: string;
  status: MeetingStatus;
  createdAt?: string;
};

type ContractItem = {
  id: string;
  name: string;
  status: ContractStatus;
  createdAt?: string;
};

type TrendPoint = {
  label: string;
  count: number;
};

type Activity = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

const terminalRequestStatuses = new Set<RequestStatus>(["DONE", "REJECTED", "CANCELLED"]);
const statusLabels: Record<string, string> = {
  DRAFT: "초안",
  SENT: "발송",
  ACKED: "확인",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
  REJECTED: "반려",
  CANCELLED: "취소",
};

function formatStatusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

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
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    return `${path} L ${point.x} ${point.y}`;
  }, "");
}

export default function ClientHomePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [projectData, requestData, postData, meetingData, contractData] = await Promise.all([
          apiFetch<Project>(`/api/projects/${projectId}`),
          apiFetch<RequestItem[]>(`/api/projects/${projectId}/requests`),
          apiFetch<PostItem[]>(`/api/projects/${projectId}/posts`),
          apiFetch<MeetingItem[]>(`/api/projects/${projectId}/meetings`),
          apiFetch<ContractItem[]>(`/api/projects/${projectId}/contracts`),
        ]);

        if (!active) return;

        setProject(projectData);
        setRequests(requestData);
        setPosts(postData);
        setMeetings(meetingData);
        setContracts(contractData);
      } catch (e) {
        if (!handleAuthError(e, "/login") && active) {
          setError(e instanceof Error ? e.message : "홈 데이터를 불러오지 못했습니다.");
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
    const activeContracts = contracts.filter((item) => item.status === "ACTIVE").length;
    return { activeRequests, pendingApprovals, upcomingMeetings, activeContracts };
  }, [contracts, meetings, requests]);

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
      if (!item.createdAt) continue;
      const created = new Date(item.createdAt);
      if (Number.isNaN(created.getTime())) continue;
      weeks.forEach((range, index) => {
        if (created >= range.start && created < range.end) {
          counts[index] += 1;
        }
      });
    }

    return labels.map((label, index) => ({ label, count: counts[index] }));
  }, [requests]);

  const recentActions = useMemo<Activity[]>(() => {
    const requestActions = requests
      .filter((item) => item.createdAt)
      .map((item) => ({
        id: `request-${item.id}`,
        title: "요청 업데이트",
        message: `${item.title} · ${formatStatusLabel(item.status)}`,
        createdAt: item.createdAt as string,
      }));
    const postActions = posts
      .filter((item) => item.createdAt)
      .map((item) => ({
        id: `post-${item.id}`,
        title: "게시글 등록",
        message: item.title,
        createdAt: item.createdAt as string,
      }));
    const meetingActions = meetings
      .filter((item) => item.createdAt)
      .map((item) => ({
        id: `meeting-${item.id}`,
        title: "회의 생성",
        message: item.title,
        createdAt: item.createdAt as string,
      }));
    const contractActions = contracts
      .filter((item) => item.createdAt)
      .map((item) => ({
        id: `contract-${item.id}`,
        title: "계약 생성",
        message: item.name,
        createdAt: item.createdAt as string,
      }));

    return [...requestActions, ...postActions, ...meetingActions, ...contractActions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [contracts, meetings, posts, requests]);

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

  const cards = [
    { title: "요청", value: summary.activeRequests.toLocaleString("ko-KR"), icon: ClipboardList, accent: "text-indigo-600" },
    { title: "승인 대기", value: summary.pendingApprovals.toLocaleString("ko-KR"), icon: CheckCheck, accent: "text-amber-600" },
    { title: "다가오는 회의", value: summary.upcomingMeetings.toLocaleString("ko-KR"), icon: CalendarClock, accent: "text-sky-600" },
    { title: "승인 계약", value: summary.activeContracts.toLocaleString("ko-KR"), icon: FileSignature, accent: "text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{project?.name ?? "프로젝트 홈"}</CardTitle>
          <CardDescription>{project?.description || "클라이언트 관점 프로젝트 현황"}</CardDescription>
          <p className="text-xs text-slate-400">status: {project?.status ?? "-"}</p>
        </CardHeader>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-slate-500">{item.title}</p>
                  <Icon className={`h-4 w-4 ${item.accent}`} />
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{loading ? "-" : item.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>요청 추이</CardTitle>
                <CardDescription>최근 4주 요청 생성 건수</CardDescription>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">총 {requests.length.toLocaleString("ko-KR")}건</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 w-full">
                <defs>
                  <linearGradient id="clientTaskAreaGradient" x1="0" y1="0" x2="0" y2="1">
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
                <path d={chart.areaPath} fill="url(#clientTaskAreaGradient)" />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-600" />
              <div>
                <CardTitle>최근 액션</CardTitle>
                <CardDescription>최신 변경 3건</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActions.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                <p className="mt-2 text-xs text-slate-500">{formatActionTime(item.createdAt)}</p>
              </article>
            ))}
            {!loading && recentActions.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">표시할 액션이 없습니다.</p> : null}
            {loading ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">불러오는 중...</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
