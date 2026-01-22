
import React, { useState } from 'react';
import { AppView, UserProfile } from '../types';
import { ShieldCheck, Mail, Lock, User as UserIcon, ArrowRight, AlertCircle } from 'lucide-react';

interface AuthProps {
  view: AppView.LOGIN | AppView.REGISTER;
  onAuth: (user: UserProfile) => void;
  toggleView: () => void;
}

const Auth: React.FC<AuthProps> = ({ view, onAuth, toggleView }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailKey = formData.email.toLowerCase().trim();

    // Mock User Database in LocalStorage
    const usersRaw = localStorage.getItem('medpredict_mock_db');
    const users = usersRaw ? JSON.parse(usersRaw) : [];

    if (view === AppView.REGISTER) {
      // Check if user exists
      if (users.find((u: any) => u.email.toLowerCase() === emailKey)) {
        setError('This email is already registered.');
        return;
      }
      
      // Create a fresh user record
      const newUserRecord = { 
        name: formData.name, 
        email: emailKey, 
        password: formData.password,
        // Initialize empty profile fields
        age: '',
        gender: '',
        bloodType: '',
        weight: '',
        height: '',
        allergies: '',
        medicalHistory: ''
      };
      
      users.push(newUserRecord);
      localStorage.setItem('medpredict_mock_db', JSON.stringify(users));
      
      // Extract profile portion for the session
      const { password, ...profileData } = newUserRecord;
      onAuth(profileData);
    } else {
      // Login logic
      const userRecord = users.find((u: any) => u.email.toLowerCase() === emailKey && u.password === formData.password);
      if (userRecord) {
        // Log in with the FULL stored profile data
        const { password, ...profileData } = userRecord;
        onAuth(profileData);
      } else {
        setError('Invalid email or password. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-indigo-100">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-3xl rounded-[3.5rem] shadow-2xl shadow-indigo-200/50 p-8 md:p-12 border border-white animate-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 mb-8 transform hover:scale-105 transition-transform">
            <ShieldCheck size={48} />
          </div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
            {view === AppView.LOGIN ? 'Welcome Back' : 'Join Us'}
          </h1>
          <p className="text-slate-500 mt-3 font-medium text-lg">
            {view === AppView.LOGIN ? 'Your personalized health AI awaits' : 'Start your journey to better health intelligence'}
          </p>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-3xl flex items-center gap-3 animate-shake">
            <AlertCircle size={20} className="shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {view === AppView.REGISTER && (
            <div className="relative group">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={22} />
              <input
                type="text"
                placeholder="Full Name"
                className="w-full pl-14 pr-6 py-5 bg-slate-100/50 border-2 border-transparent rounded-[1.8rem] focus:border-blue-500 focus:bg-white transition-all outline-none text-slate-700 font-bold placeholder:text-slate-400"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}
          
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={22} />
            <input
              type="email"
              placeholder="Email Address"
              className="w-full pl-14 pr-6 py-5 bg-slate-100/50 border-2 border-transparent rounded-[1.8rem] focus:border-blue-500 focus:bg-white transition-all outline-none text-slate-700 font-bold placeholder:text-slate-400"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={22} />
            <input
              type="password"
              placeholder="Secure Password"
              className="w-full pl-14 pr-6 py-5 bg-slate-100/50 border-2 border-transparent rounded-[1.8rem] focus:border-blue-500 focus:bg-white transition-all outline-none text-slate-700 font-bold placeholder:text-slate-400"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl hover:bg-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group mt-8"
          >
            <span className="text-lg uppercase tracking-widest">{view === AppView.LOGIN ? 'Sign In' : 'Sign Up'}</span>
            <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-12 text-center">
          <p className="text-slate-500 text-sm font-bold tracking-tight">
            {view === AppView.LOGIN ? "New to MedPredict?" : "Already a member?"}{' '}
            <button 
              onClick={toggleView}
              className="text-blue-600 font-black hover:underline ml-1"
            >
              {view === AppView.LOGIN ? 'Create account' : 'Log in here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
