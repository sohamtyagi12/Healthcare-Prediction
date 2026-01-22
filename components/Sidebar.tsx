
import React from 'react';
import { AppView, UserProfile } from '../types';
import { LayoutDashboard, Sparkles, FileText, User, LogOut } from 'lucide-react';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  user: UserProfile | null;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, onLogout }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { id: AppView.ASSISTANT, label: 'AI Assistant', icon: Sparkles },
    { id: AppView.REPORT_ANALYZER, label: 'Report Analyzer', icon: FileText },
    { id: AppView.PROFILE, label: 'My Profile', icon: User },
  ];

  if (!user) return null;

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 hidden md:flex flex-col z-20">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          MedPredict Pro
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === item.id 
              ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold uppercase">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-sm font-medium"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
