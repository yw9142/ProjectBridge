import React from 'react';
import { MOCK_MEETINGS } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { Video, CalendarDays, UserCheck, ExternalLink } from 'lucide-react';

export const Meetings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Meetings</h2>
        <div className="flex gap-2">
            <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
               Link Google Calendar
            </button>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
               Schedule New
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_MEETINGS.map(meeting => (
          <div key={meeting.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <CalendarDays className="w-4 h-4" />
                        <span>{new Date(meeting.startAt).toLocaleDateString()}</span>
                    </div>
                    <StatusBadge status={meeting.status} />
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-1">{meeting.title}</h3>
                <p className="text-sm text-slate-600 mb-6">
                    {new Date(meeting.startAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                    {new Date(meeting.endAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>

                <div className="space-y-2 mb-6">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Attendees</p>
                    {meeting.attendees.map((att, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-slate-700">{att.user.name}</span>
                            {att.response === 'ACCEPTED' ? (
                                <UserCheck className="w-4 h-4 text-green-600" />
                            ) : (
                                <span className="text-xs text-slate-400 italic">Pending</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {meeting.meetUrl && (
                <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); alert("Opening Google Meet: " + meeting.meetUrl); }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition"
                >
                    <Video className="w-4 h-4" />
                    Join via Google Meet
                    <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};