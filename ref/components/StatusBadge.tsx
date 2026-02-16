import React from 'react';

const colors: Record<string, string> = {
  // General
  ACTIVE: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
  // Posts
  ANNOUNCEMENT: 'bg-blue-100 text-blue-800',
  ISSUE: 'bg-red-100 text-red-800',
  QA: 'bg-purple-100 text-purple-800',
  GENERAL: 'bg-gray-100 text-gray-800',
  // Requests
  DRAFT: 'bg-gray-200 text-gray-600',
  SENT: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  // Decisions
  PROPOSED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  // Meetings
  SCHEDULED: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  // Contracts
  PARTIALLY_SIGNED: 'bg-amber-100 text-amber-800',
  // Billing
  ISSUED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  // Vault
  REVOKED: 'bg-red-100 text-red-800',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorClass = colors[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};