import { Post, Request, Decision, FileEntity, Meeting, Contract, Invoice, VaultSecret, User } from '../types';

const currentUser: User = {
  id: 'u-1',
  name: 'Alex Kim',
  email: 'alex@pm-vendor.com',
  role: 'PM_OWNER',
  avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d'
};

const clientUser: User = {
  id: 'u-2',
  name: 'Sarah Lee',
  email: 'sarah@client-corp.com',
  role: 'CLIENT_OWNER',
  avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d'
};

export const MOCK_POSTS: Post[] = [
  {
    id: 'p-1',
    type: 'ANNOUNCEMENT',
    title: 'Project Kickoff Summary',
    body: 'Thank you everyone for joining the kickoff meeting. We have outlined the initial milestones.',
    author: currentUser,
    createdAt: '2023-10-25T09:00:00Z',
    commentCount: 2,
    pinned: true,
  },
  {
    id: 'p-2',
    type: 'ISSUE',
    title: 'Delay in API specs from 3rd party',
    body: 'We are currently blocked on the payment gateway integration due to missing docs.',
    author: currentUser,
    createdAt: '2023-10-26T14:30:00Z',
    commentCount: 5,
    pinned: false,
  },
  {
    id: 'p-3',
    type: 'QA',
    title: 'Question regarding UAT timeline',
    body: 'Can we move the UAT start date by 2 days?',
    author: clientUser,
    createdAt: '2023-10-27T10:15:00Z',
    commentCount: 1,
    pinned: false,
  },
];

export const MOCK_REQUESTS: Request[] = [
  {
    id: 'r-1',
    type: 'APPROVAL',
    title: 'Approve Wireframe v2',
    status: 'DONE',
    priority: 4,
    dueAt: '2023-10-20T18:00:00Z',
    requester: currentUser,
    assignee: clientUser
  },
  {
    id: 'r-2',
    type: 'INFO_REQUEST',
    title: 'Provide AWS Credentials for Dev Env',
    status: 'IN_PROGRESS',
    priority: 5,
    dueAt: '2023-10-28T12:00:00Z',
    requester: currentUser,
    assignee: clientUser
  },
  {
    id: 'r-3',
    type: 'FEEDBACK',
    title: 'Review Landing Page Copy',
    status: 'SENT',
    priority: 3,
    dueAt: '2023-10-30T18:00:00Z',
    requester: currentUser,
    assignee: clientUser
  },
];

export const MOCK_DECISIONS: Decision[] = [
  {
    id: 'd-1',
    title: 'Homepage Design v3 Final',
    status: 'APPROVED',
    approvedBy: clientUser,
    approvedAt: '2023-10-15T15:20:00Z',
    relatedFileVersionId: 'f-1-v3',
    createdAt: '2023-10-14T09:00:00Z'
  },
  {
    id: 'd-2',
    title: 'Tech Stack Selection (Spring Boot + React)',
    status: 'APPROVED',
    approvedBy: clientUser,
    approvedAt: '2023-09-30T10:00:00Z',
    relatedFileVersionId: 'f-doc-1',
    createdAt: '2023-09-28T09:00:00Z'
  },
  {
    id: 'd-3',
    title: 'Additional Feature: Dark Mode',
    status: 'PROPOSED',
    relatedFileVersionId: 'f-spec-2',
    createdAt: '2023-10-27T11:00:00Z'
  }
];

export const MOCK_FILES: FileEntity[] = [
  {
    id: 'f-1',
    name: 'Homepage_Design_v3.fig',
    type: 'figma',
    size: '12 MB',
    updatedAt: '2023-10-15T14:00:00Z',
    version: 3,
    author: currentUser
  },
  {
    id: 'f-2',
    name: 'System_Architecture_Diagram.pdf',
    type: 'pdf',
    size: '2.4 MB',
    updatedAt: '2023-10-10T09:30:00Z',
    version: 1,
    author: currentUser
  },
  {
    id: 'f-3',
    name: 'Project_Timeline.xlsx',
    type: 'xlsx',
    size: '450 KB',
    updatedAt: '2023-10-26T16:45:00Z',
    version: 5,
    author: currentUser
  }
];

export const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'm-1',
    title: 'Weekly Sync',
    startAt: '2023-10-30T10:00:00Z',
    endAt: '2023-10-30T11:00:00Z',
    status: 'SCHEDULED',
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    attendees: [
      { user: currentUser, response: 'ACCEPTED' },
      { user: clientUser, response: 'PENDING' }
    ]
  },
  {
    id: 'm-2',
    title: 'Design Review',
    startAt: '2023-11-02T14:00:00Z',
    endAt: '2023-11-02T15:30:00Z',
    status: 'SCHEDULED',
    meetUrl: 'https://meet.google.com/xyz-uvw-rst',
    attendees: [
        { user: currentUser, response: 'ACCEPTED' },
        { user: clientUser, response: 'ACCEPTED' }
    ]
  }
];

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c-1',
    name: 'Master Services Agreement (MSA)',
    status: 'COMPLETED',
    lastActivity: '2023-09-01T10:00:00Z'
  },
  {
    id: 'c-2',
    name: 'Phase 1 SOW',
    status: 'COMPLETED',
    lastActivity: '2023-09-05T11:00:00Z'
  },
  {
    id: 'c-3',
    name: 'Change Order #1 (Mobile Add-on)',
    status: 'PARTIALLY_SIGNED',
    lastActivity: '2023-10-28T09:15:00Z'
  }
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2023-001',
    amount: 5000000,
    currency: 'KRW',
    status: 'CONFIRMED',
    dueAt: '2023-09-30T00:00:00Z'
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2023-002',
    amount: 5000000,
    currency: 'KRW',
    status: 'ISSUED',
    dueAt: '2023-10-31T00:00:00Z'
  }
];

export const MOCK_SECRETS: VaultSecret[] = [
  {
    id: 'v-1',
    name: 'Production DB Master',
    type: 'DB',
    status: 'ACTIVE',
    lastViewedBy: 'Alex Kim',
    lastViewedAt: '2023-10-20T14:00:00Z'
  },
  {
    id: 'v-2',
    name: 'AWS Root Account',
    type: 'CLOUD',
    status: 'ACTIVE'
  },
  {
    id: 'v-3',
    name: 'Legacy Server SSH',
    type: 'SERVER',
    status: 'REVOKED',
    lastViewedBy: 'Sarah Lee',
    lastViewedAt: '2023-09-10T09:00:00Z'
  }
];

export const MOCK_STATS = [
    { label: 'Active Requests', value: '4', trend: 'neutral' },
    { label: 'Pending Approvals', value: '1', trend: 'warning' },
    { label: 'Upcoming Meetings', value: '2', trend: 'neutral' },
    { label: 'Invoices Issued', value: '₩5.0M', trend: 'positive' }
];