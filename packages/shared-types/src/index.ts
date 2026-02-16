export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  code: string;
  message: string;
  details?: unknown;
};

export type EnvelopeStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "VOIDED";

export type RequestStatus =
  | "DRAFT"
  | "SENT"
  | "ACKED"
  | "IN_PROGRESS"
  | "DONE"
  | "REJECTED"
  | "CANCELLED";

export type DecisionStatus = "PROPOSED" | "APPROVED" | "REJECTED";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "CONFIRMED"
  | "CLOSED"
  | "OVERDUE"
  | "CANCELLED";

export type FileCommentStatus = "OPEN" | "RESOLVED";

export type NotificationEventType =
  | "notification.created"
  | "notification.read"
  | "system.ping";
