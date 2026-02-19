import { Badge } from "@/components/ui/badge";

const variants: Record<string, "secondary" | "success" | "warning" | "destructive" | "outline" | "info"> = {
  DRAFT: "secondary",
  SENT: "info",
  ACKED: "info",
  IN_PROGRESS: "warning",
  DONE: "success",
  REJECTED: "destructive",
  CANCELLED: "outline",
  SCHEDULED: "info",
  ACTIVE: "success",
  ARCHIVED: "outline",
  PENDING: "warning",
  VIEWED: "info",
  SIGNED: "success",
  COMPLETED: "success",
  ISSUED: "info",
  CONFIRMED: "success",
  CLOSED: "success",
  OVERDUE: "destructive",
};

const labels: Record<string, string> = {
  DRAFT: "초안",
  SENT: "발송",
  ACKED: "확인",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
  REJECTED: "반려",
  CANCELLED: "취소",
  SCHEDULED: "일정",
  ACTIVE: "활성",
  ARCHIVED: "보관",
  PENDING: "대기",
  VIEWED: "열람",
  SIGNED: "서명 완료",
  COMPLETED: "완료",
  ISSUED: "발행",
  CONFIRMED: "확정",
  CLOSED: "종료",
  OVERDUE: "연체",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={variants[status] ?? "secondary"}>{labels[status] ?? status.replaceAll("_", " ")}</Badge>;
}
