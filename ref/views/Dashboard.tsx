import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MOCK_STATS, MOCK_REQUESTS, MOCK_MEETINGS } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

const data = [
  { name: 'Week 1', tasks: 4 },
  { name: 'Week 2', tasks: 3 },
  { name: 'Week 3', tasks: 8 },
  { name: 'Week 4', tasks: 6 },
];

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {MOCK_STATS.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Request Velocity</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="tasks" stroke="#4f46e5" fill="#e0e7ff" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Urgent Actions */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Urgent Actions</h3>
            <div className="space-y-4">
                {MOCK_REQUESTS.filter(r => r.priority >= 4 && r.status !== 'DONE').map(req => (
                    <div key={req.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-900">{req.title}</p>
                            <p className="text-xs text-red-700 mt-1">Due: {new Date(req.dueAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                ))}
                {MOCK_MEETINGS.slice(0,1).map(m => (
                    <div key={m.id} className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <Calendar className="w-5 h-5 text-indigo-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-indigo-900">Next: {m.title}</p>
                            <p className="text-xs text-indigo-700 mt-1">{new Date(m.startAt).toLocaleString()}</p>
                        </div>
                    </div>
                ))}
                {MOCK_REQUESTS.filter(r => r.priority >= 4).length === 0 && (
                     <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-sm">All urgent items cleared</span>
                     </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};