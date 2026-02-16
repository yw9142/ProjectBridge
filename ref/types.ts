// Common Types
export type UUID = string;
export type ISODate = string;

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: 'PM_OWNER' | 'PM_MEMBER' | 'CLIENT_OWNER' | 'CLIENT_MEMBER';
  avatar?: string;
}

export interface Project {
  id: UUID;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  code: string;
  description: string;
}

// Module Specific Types

export interface Post {
  id: UUID;
  type: 'ANNOUNCEMENT' | 'GENERAL' | 'QA' | 'ISSUE' | 'MEETING_MINUTES' | 'RISK';
  title: string;
  body: string;
  author: User;
  createdAt: ISODate;
  commentCount: number;
  pinned: boolean;
}

export interface Request {
  id: UUID;
  type: 'APPROVAL' | 'INFO_REQUEST' | 'FEEDBACK' | 'SIGNATURE' | 'PAYMENT' | 'VAULT_ACCESS';
  title: string;
  status: 'DRAFT' | 'SENT' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
  priority: 1 | 2 | 3 | 4 | 5; // 5 is highest
  dueAt: ISODate;
  requester: User;
  assignee?: User;
}

export interface Decision {
  id: UUID;
  title: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  approvedBy?: User;
  approvedAt?: ISODate;
  relatedFileVersionId: UUID; // Critical for linking to specific file version
  createdAt: ISODate;
}

export interface FileEntity {
  id: UUID;
  name: string;
  type: string; // pdf, png, etc.
  size: string;
  updatedAt: ISODate;
  version: number;
  author: User;
}

export interface Meeting {
  id: UUID;
  title: string;
  startAt: ISODate;
  endAt: ISODate;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
  meetUrl?: string;
  attendees: { user: User; response: 'ACCEPTED' | 'DECLINED' | 'PENDING' }[];
}

export interface Contract {
  id: UUID;
  name: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_SIGNED' | 'COMPLETED';
  lastActivity: ISODate;
}

export interface Invoice {
  id: UUID;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'CONFIRMED' | 'OVERDUE';
  dueAt: ISODate;
}

export interface VaultSecret {
  id: UUID;
  name: string;
  type: 'SERVER' | 'DB' | 'CLOUD' | 'OTHER';
  status: 'ACTIVE' | 'REVOKED';
  lastViewedBy?: string;
  lastViewedAt?: ISODate;
}

export type ViewState = 
  | 'DASHBOARD' 
  | 'POSTS' 
  | 'REQUESTS' 
  | 'DECISIONS' 
  | 'FILES' 
  | 'MEETINGS' 
  | 'CONTRACTS' 
  | 'BILLING' 
  | 'VAULT';