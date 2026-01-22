
import React from 'react';
import { AppView } from '../types';
import { LayoutDashboard, Sparkles, FileText, User } from 'lucide-react';

interface BottomNavProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: AppView.DASHBOARD, label: 'Home', icon: LayoutDashboard },
    { id: AppView.ASSISTANT, label: 'Assistant', icon: Sparkles },
    { id: AppView.REPORT_ANALYZER, label: 'Analyze', icon: FileText },
    { id: AppView.PROFILE, label: 'Me', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-2 pb-safe-area-inset-bottom z-50 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex justify-between items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
              currentView === item.id ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            {currentView === item.id && (
              <span className="absolute -top-1 w-8 h-1 bg-blue-600 rounded-full" />
            )}
            <item.icon size={22} strokeWidth={currentView === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
