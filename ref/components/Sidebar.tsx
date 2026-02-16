import React from 'react';
import { ViewState } from '../types';
import { 
  LayoutDashboard, 
  MessageSquare, 
  CheckSquare, 
  Gavel, 
  FolderOpen, 
  Calendar, 
  FileSignature, 
  Receipt, 
  Lock,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView }) => {
  const menuItems: { id: ViewState; label: string; icon: React.ReactNode }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'POSTS', label: 'Posts', icon: <MessageSquare size={20} /> },
    { id: 'REQUESTS', label: 'Requests', icon: <CheckSquare size={20} /> },
    { id: 'DECISIONS', label: 'Decisions', icon: <Gavel size={20} /> },
    { id: 'FILES', label: 'Files', icon: <FolderOpen size={20} /> },
    { id: 'MEETINGS', label: 'Meetings', icon: <Calendar size={20} /> },
    { id: 'CONTRACTS', label: 'Contracts', icon: <FileSignature size={20} /> },
    { id: 'BILLING', label: 'Billing', icon: <Receipt size={20} /> },
    { id: 'VAULT', label: 'Vault', icon: <Lock size={20} /> },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-slate-300 flex flex-col z-50">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-lg">P</span>
            PM Bridge
        </h1>
        <p className="text-xs text-slate-500 mt-2">Project Room: Alpha-1</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentView === item.id 
                ? 'bg-indigo-600 text-white' 
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white w-full transition">
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};