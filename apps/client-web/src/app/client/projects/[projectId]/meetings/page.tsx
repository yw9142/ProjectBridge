"use client";

import { ExternalLink, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, handleAuthError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionButton } from "@/components/ui/confirm-action";
import { StatusBadge } from "@/components/ui/StatusBadge";

type MeetingStatus = "SCHEDULED" | "CANCELLED";
type AttendeeResponse = "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

type Meeting = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  meetUrl: string;
  status: MeetingStatus;
  createdAt?: string;
  myResponse?: AttendeeResponse | null;
};

const responseOptions: Array<{ value: AttendeeResponse; label: string }> = [
  { value: "ACCEPTED", label: "참석" },
  { value: "TENTATIVE", label: "미정" },
  { value: "DECLINED", label: "불참" },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ClientMeetingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [items, setItems] = useState<Meeting[]>([]);
  const [draftResponses, setDraftResponses] = useState<Record<string, AttendeeResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aTime = new Date(a.startAt).getTime();
        const bTime = new Date(b.startAt).getTime();
        return aTime - bTime;
      }),
    [items],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Meeting[]>(`/api/projects/${projectId}/meetings`);
      setItems(data);
      setDraftResponses(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            item.myResponse && item.myResponse !== "INVITED" ? item.myResponse : ("ACCEPTED" as AttendeeResponse),
          ]),
        ),
      );
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
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

  async function respond(meetingId: string) {
    const response = draftResponses[meetingId];
    if (!response) return;
    setError(null);
    try {
      await apiFetch(`/api/meetings/${meetingId}/respond`, {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      await load();
    } catch (e) {
      if (!handleAuthError(e, "/login")) {
        setError(e instanceof Error ? e.message : "회의 응답에 실패했습니다.");
      }
    }
  }

  function joinMeeting(meetUrl: string) {
    window.open(meetUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>회의</CardTitle>
        <CardDescription>회의 일정 확인 후 참석 여부를 전달합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead>회의명</TableHead>
                <TableHead>일정</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>참석</TableHead>
                <TableHead>내 응답</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-3">
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              {sortedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold text-slate-900">{item.title}</TableCell>
                  <TableCell>{formatDateTime(item.startAt)}</TableCell>
                  <TableCell>
                    <a className="inline-flex items-center gap-1 text-indigo-600 hover:underline" href={item.meetUrl} target="_blank" rel="noreferrer">
                      {item.meetUrl}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => joinMeeting(item.meetUrl)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Video className="h-3.5 w-3.5" aria-hidden="true" />
                      참석
                    </button>
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                      value={draftResponses[item.id] ?? "ACCEPTED"}
                      onChange={(event) =>
                        setDraftResponses((prev) => ({
                          ...prev,
                          [item.id]: event.target.value as AttendeeResponse,
                        }))
                      }
                    >
                      {responseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <ConfirmActionButton
                      label="응답 전송"
                      title="회의 응답을 전송할까요?"
                      description="선택한 참석 상태가 저장됩니다."
                      onConfirm={() => respond(item.id)}
                      triggerVariant="outline"
                      triggerSize="sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-slate-500">
                    표시할 회의가 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
