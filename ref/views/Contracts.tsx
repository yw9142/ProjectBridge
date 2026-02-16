import React from 'react';
import { MOCK_CONTRACTS } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { PenTool, FileSignature, History } from 'lucide-react';

export const Contracts: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Contracts & e-Sign</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
          New Envelope
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
            <div className="flex gap-8">
                <div className="text-center">
                    <span className="block text-2xl font-bold text-slate-900">2</span>
                    <span className="text-xs text-slate-500 uppercase font-semibold">Completed</span>
                </div>
                <div className="text-center">
                    <span className="block text-2xl font-bold text-amber-600">1</span>
                    <span className="text-xs text-slate-500 uppercase font-semibold">In Progress</span>
                </div>
            </div>
        </div>

        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Document Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Last Activity</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {MOCK_CONTRACTS.map((contract) => (
              <tr key={contract.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${contract.status === 'COMPLETED' ? 'bg-green-50' : 'bg-amber-50'}`}>
                        <FileSignature className={`w-5 h-5 ${contract.status === 'COMPLETED' ? 'text-green-600' : 'text-amber-600'}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">{contract.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={contract.status} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-400" />
                    {new Date(contract.lastActivity).toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  {contract.status === 'COMPLETED' ? (
                      <button className="text-indigo-600 hover:text-indigo-900">Download</button>
                  ) : (
                      <button className="flex items-center justify-end gap-1 text-amber-600 hover:text-amber-900 w-full">
                          <PenTool className="w-3 h-3" />
                          Sign Now
                      </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};