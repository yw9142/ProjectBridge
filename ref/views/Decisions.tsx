import React from 'react';
import { MOCK_DECISIONS } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { FileText, CheckCircle2 } from 'lucide-react';

export const Decisions: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-900">Decisions</h2>
            <p className="text-sm text-slate-500 mt-1">Immutable record of approved items linked to file versions.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          Propose Decision
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MOCK_DECISIONS.map((decision) => (
          <div key={decision.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={decision.status} />
                    <span className="text-xs text-slate-400">{new Date(decision.createdAt).toLocaleDateString()}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{decision.title}</h3>
                
                {decision.approvedBy && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-md w-fit">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approved by {decision.approvedBy.name} on {new Date(decision.approvedAt!).toLocaleDateString()}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                <div className="text-right">
                    <p className="text-xs font-medium text-slate-500 uppercase">Fixed Version</p>
                    <div className="flex items-center gap-1.5 mt-1 text-indigo-600 cursor-pointer hover:underline">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">{decision.relatedFileVersionId}</span>
                    </div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};