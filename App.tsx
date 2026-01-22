
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import { AppView, UserProfile } from './types';
import Dashboard from './pages/Dashboard';
import Assistant from './pages/Assistant';
import ReportAnalyzer from './pages/ReportAnalyzer';
import Profile from './pages/Profile';
import Auth from './pages/Auth';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('medpredict_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setCurrentView(AppView.DASHBOARD);
      } catch (e) {
        localStorage.removeItem('medpredict_user');
      }
    }
    setIsLoaded(true);
  }, []);

  const handleAuth = (newUser: UserProfile) => {
    setUser(newUser);
    localStorage.setItem('medpredict_user', JSON.stringify(newUser));
    setCurrentView(AppView.DASHBOARD);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('medpredict_user');
    setCurrentView(AppView.LOGIN);
  };

  const handleUpdateProfile = (updated: UserProfile) => {
    setUser(updated);
    localStorage.setItem('medpredict_user', JSON.stringify(updated));

    const usersRaw = localStorage.getItem('medpredict_mock_db');
    if (usersRaw) {
      const users = JSON.parse(usersRaw);
      const userIndex = users.findIndex((u: any) => u.email === updated.email);
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updated };
        localStorage.setItem('medpredict_mock_db', JSON.stringify(users));
      }
    }
  };

  if (!isLoaded) return null;

  if (!user && (currentView !== AppView.LOGIN && currentView !== AppView.REGISTER)) {
    return <Auth view={AppView.LOGIN} onAuth={handleAuth} toggleView={() => setCurrentView(AppView.REGISTER)} />;
  }

  if (currentView === AppView.LOGIN || currentView === AppView.REGISTER) {
    return (
      <Auth 
        view={currentView as any} 
        onAuth={handleAuth} 
        toggleView={() => setCurrentView(currentView === AppView.LOGIN ? AppView.REGISTER : AppView.LOGIN)} 
      />
    );
  }

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD: return <Dashboard user={user!} onUpdateUser={handleUpdateProfile} />;
      case AppView.ASSISTANT: return <Assistant user={user!} />;
      case AppView.REPORT_ANALYZER: return <ReportAnalyzer />;
      case AppView.PROFILE: return <Profile profile={user!} onSave={handleUpdateProfile} />;
      default: return <Dashboard user={user!} onUpdateUser={handleUpdateProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-blue-100 selection:text-blue-900 pb-safe">
      <Sidebar currentView={currentView} setView={setCurrentView} user={user} onLogout={handleLogout} />

      <main className="md:pl-64 transition-all pb-24 md:pb-0">
        <div className="md:hidden flex items-center justify-between p-4 bg-white/80 backdrop-blur-lg border-b sticky top-0 z-40">
           <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-200">M</div>
              <h1 className="font-black text-slate-800 tracking-tighter text-lg">MedPredict</h1>
           </div>
           <div 
             onClick={() => setCurrentView(AppView.PROFILE)}
             className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-500 border border-slate-200 uppercase"
           >
              {user?.name?.charAt(0)}
           </div>
        </div>

        <div className="max-w-6xl mx-auto p-5 md:p-10">
          {renderView()}
        </div>
      </main>

      <BottomNav currentView={currentView} setView={setCurrentView} />

      <footer className="hidden md:block md:pl-64 py-12 border-t bg-white mt-20">
        <div className="max-w-6xl mx-auto px-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
             <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px] font-bold">M</div>
             <span className="font-bold text-slate-800">MedPredict AI Pro</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">
            &copy; {new Date().getFullYear()} Advanced Health Intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
