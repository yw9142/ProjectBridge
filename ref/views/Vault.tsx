import React, { useState } from 'react';
import { MOCK_SECRETS } from '../services/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { Lock, Eye, EyeOff, ShieldAlert, Key } from 'lucide-react';

export const Vault: React.FC = () => {
  const [revealedId, setRevealedId] = useState<string | null>(null);

  const handleReveal = (id: string) => {
    if (revealedId === id) {
        setRevealedId(null);
    } else {
        const confirmed = window.confirm("This action will be logged in the audit trail. Continue?");
        if (confirmed) setRevealedId(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-6 h-6 text-slate-800" />
                Vault
            </h2>
            <p className="text-sm text-slate-500 mt-1">Secure storage with audit logging. All reveals are tracked.</p>
        </div>
        <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
          Add Secret
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" />
        <div className="text-sm text-amber-800">
            <span className="font-semibold">Security Notice:</span> Credentials displayed here are server-side encrypted. Access requests require PM Owner approval.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_SECRETS.map(secret => (
          <div key={secret.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        <Key className="w-5 h-5 text-slate-600" />
                    </div>
                    <StatusBadge status={secret.status} />
                </div>
                
                <h3 className="font-bold text-slate-900 mb-1">{secret.name}</h3>
                <p className="text-xs font-semibold text-slate-400 tracking-wider mb-6">{secret.type}</p>

                <div className="bg-slate-100 rounded p-3 mb-4 relative group">
                    <p className="font-mono text-sm text-slate-700 break-all">
                        {revealedId === secret.id ? 'A8d#9zk!m29@sL' : '••••••••••••••••'}
                    </p>
                    <button 
                        onClick={() => handleReveal(secret.id)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-indigo-600"
                    >
                        {revealedId === secret.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>

                {secret.lastViewedBy && (
                    <div className="text-xs text-slate-400 border-t border-slate-100 pt-3">
                        Last viewed by <span className="text-slate-600 font-medium">{secret.lastViewedBy}</span>
                        <br />
                        {new Date(secret.lastViewedAt!).toLocaleString()}
                    </div>
                )}
            </div>
            {secret.status === 'REVOKED' && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold border border-red-200">ACCESS REVOKED</span>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};