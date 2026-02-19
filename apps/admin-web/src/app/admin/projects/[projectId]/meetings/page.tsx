"use client";

import { ExternalLink, Video } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectId } from "@/lib/use-project-id";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { Modal } from "@/components/ui/modal";

type MeetingStatus = "SCHEDULED" | "CANCELLED";
type AttendeeResponse = "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

type MeetingAttendee = {
  userId: string;
  userName: string;
  response: AttendeeResponse;
};

type Meeting = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  meetUrl: string;
  status: MeetingStatus;
  attendees?: MeetingAttendee[];
  attendeeCount?: number;
  myResponse?: AttendeeResponse | null;
};

type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

const weekdays: Array<{ value: Weekday; label: string }> = [
  { value: "MON", label: "월" },
  { value: "TUE", label: "화" },
  { value: "WED", label: "수" },
  { value: "THU", label: "목" },
  { value: "FRI", label: "금" },
  { value: "SAT", label: "토" },
  { value: "SUN", label: "일" },
];

const statuses: Array<{ value: MeetingStatus; label: string }> = [
  { value: "SCHEDULED", label: "예정" },
  { value: "CANCELLED", label: "취소" },
];

const statusBadgeStyles: Record<MeetingStatus, string> = {
  SCHEDULED: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
};

const weekdayToJsDay: Record<Weekday, number> = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 0,
};

function nextDateForWeekdayAndTime(weekday: Weekday, time: string) {
  const [hour, minute] = time.split(":").map((value) => Number(value));
  const now = new Date();
  const result = new Date(now);
  const targetDay = weekdayToJsDay[weekday];
  const diff = (targetDay - now.getDay() + 7) % 7;
  result.setDate(now.getDate() + diff);
  result.setHours(hour, minute, 0, 0);
  if (result <= now) {
    result.setDate(result.getDate() + 7);
  }
  return result;
}

function toWeekday(dateIso: string): Weekday {
  const day = new Date(dateIso).getDay();
  const entry = Object.entries(weekdayToJsDay).find(([, value]) => value === day)?.[0] as Weekday | undefined;
  return entry ?? "MON";
}

function toTime(dateIso: string) {
  const date = new Date(dateIso);
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatDateTime(value: string) {
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

function sortByStartAt(items: Meeting[]) {
  return [...items].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

const attendeeResponseLabel: Record<AttendeeResponse, string> = {
  INVITED: "초대",
  ACCEPTED: "참석",
  DECLINED: "불참",
  TENTATIVE: "미정",
};

function summarizeAttendees(meeting: Meeting) {
  const attendees = meeting.attendees ?? [];
  if (attendees.length === 0) {
    return { count: 0, byResponse: "아직 응답 없음", names: "-" };
  }

  const counts: Record<AttendeeResponse, number> = {
    INVITED: 0,
    ACCEPTED: 0,
    DECLINED: 0,
    TENTATIVE: 0,
  };
  for (const attendee of attendees) {
    counts[attendee.response] += 1;
  }

  const byResponse = [
    `${attendeeResponseLabel.ACCEPTED} ${counts.ACCEPTED}`,
    `${attendeeResponseLabel.TENTATIVE} ${counts.TENTATIVE}`,
    `${attendeeResponseLabel.DECLINED} ${counts.DECLINED}`,
  ].join(" · ");
  const names = attendees.map((attendee) => `${attendee.userName}(${attendeeResponseLabel[attendee.response]})`).join(", ");
  return { count: meeting.attendeeCount ?? attendees.length, byResponse, names };
}

export default function ProjectMeetingsPage() {
  const projectId = useProjectId();
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createMeetUrl, setCreateMeetUrl] = useState("");
  const [createWeekday, setCreateWeekday] = useState<Weekday>("MON");
  const [createTime, setCreateTime] = useState("10:00");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMeetUrl, setEditMeetUrl] = useState("");
  const [editWeekday, setEditWeekday] = useState<Weekday>("MON");
  const [editTime, setEditTime] = useState("10:00");
  const [editStatus, setEditStatus] = useState<MeetingStatus>("SCHEDULED");

  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(() => sortByStartAt(items), [items]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<Meeting[]>(`/api/projects/${projectId}/meetings`);
      setItems(data);
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "회의 목록을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 10000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const startAt = nextDateForWeekdayAndTime(createWeekday, createTime);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
      await apiFetch(`/api/projects/${projectId}/meetings`, {
        method: "POST",
        body: JSON.stringify({
          title: createTitle,
          meetUrl: createMeetUrl,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        }),
      });
      setCreateOpen(false);
      setCreateTitle("");
      setCreateMeetUrl("");
      setCreateWeekday("MON");
      setCreateTime("10:00");
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "회의 생성에 실패했습니다.");
      }
    }
  }

  function openEditModal(item: Meeting) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditMeetUrl(item.meetUrl ?? "");
    setEditWeekday(toWeekday(item.startAt));
    setEditTime(toTime(item.startAt));
    setEditStatus(item.status);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      const startAt = nextDateForWeekdayAndTime(editWeekday, editTime);
      const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
      await apiFetch(`/api/meetings/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle,
          meetUrl: editMeetUrl,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          status: editStatus,
        }),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "회의 수정에 실패했습니다.");
      }
    }
  }

  async function deleteMeeting(meetingId: string) {
    setError(null);
    try {
      await apiFetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
      if (editingId === meetingId) {
        setEditingId(null);
      }
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/admin/login")) {
        setError(e instanceof Error ? e.message : "회의 삭제에 실패했습니다.");
      }
    }
  }

  function joinMeeting(meetUrl: string) {
    window.open(meetUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">회의</h1>
          <p className="text-sm text-slate-500">회의를 생성하고 참석 버튼으로 바로 입장합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700"
        >
          회의 생성
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">회의명</th>
              <th className="px-4 py-3">일정</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">참석자</th>
              <th className="px-4 py-3">참석</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={99} className="px-4 py-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </td>
              </tr>
            ) : null}
            {sortedItems.map((item) => {
              const attendeeSummary = summarizeAttendees(item);
              return (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(item.startAt)}</td>
                <td className="px-4 py-3 text-slate-700">
                  <a className="inline-flex items-center gap-1 text-indigo-600 hover:underline" href={item.meetUrl} target="_blank" rel="noreferrer">
                    {item.meetUrl}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyles[item.status]}`}>
                    {statuses.find((status) => status.value === item.status)?.label ?? item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-slate-800">총 {attendeeSummary.count}명</p>
                    <p className="text-slate-600">{attendeeSummary.byResponse}</p>
                    <p className="line-clamp-1 text-slate-500" title={attendeeSummary.names}>
                      {attendeeSummary.names}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => joinMeeting(item.meetUrl)}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    참석
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      수정
                    </button>
                    <ConfirmActionButton
                      label="삭제"
                      title="회의를 삭제할까요?"
                      description="삭제 후 되돌릴 수 없습니다."
                      onConfirm={() => deleteMeeting(item.id)}
                      triggerVariant="destructive"
                      triggerSize="sm"
                      triggerClassName="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                      confirmVariant="destructive"
                    />
                  </div>
                </td>
              </tr>
              );
            })}
            {!loading && sortedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  등록된 회의가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="회의 생성" description="요약 정보로 회의를 생성합니다.">
        <form onSubmit={createMeeting} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="회의 제목" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="회의 링크" value={createMeetUrl} onChange={(e) => setCreateMeetUrl(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={createWeekday} onChange={(e) => setCreateWeekday(e.target.value as Weekday)}>
              {weekdays.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
            <input type="time" className="rounded-lg border border-slate-300 px-3 py-2" value={createTime} onChange={(e) => setCreateTime(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold !text-white hover:bg-indigo-700">
              생성
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingId)} onClose={() => setEditingId(null)} title="회의 수정" description="회의 정보를 수정합니다.">
        <form onSubmit={saveEdit} className="space-y-3">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={editMeetUrl} onChange={(e) => setEditMeetUrl(e.target.value)} required />
          <div className="grid grid-cols-3 gap-2">
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={editWeekday} onChange={(e) => setEditWeekday(e.target.value as Weekday)}>
              {weekdays.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
            <input type="time" className="rounded-lg border border-slate-300 px-3 py-2" value={editTime} onChange={(e) => setEditTime(e.target.value)} required />
            <select className="rounded-lg border border-slate-300 px-3 py-2" value={editStatus} onChange={(e) => setEditStatus(e.target.value as MeetingStatus)}>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">
              취소
            </button>
            <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold !text-white hover:bg-slate-800">
              저장
            </button>
          </div>
        </form>
      </Modal>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

