
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { Save, User as UserIcon, Scale, Ruler, Droplets, AlertCircle, History, RefreshCw, Share2, Check, Copy, ExternalLink, ShieldCheck } from 'lucide-react';

interface ProfileProps {
  profile: UserProfile;
  onSave: (updated: UserProfile) => void;
}

const Profile: React.FC<ProfileProps> = ({ profile, onSave }) => {
  const [data, setData] = useState(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const isInitialMount = useRef(true);

  // Auto-save logic
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setIsSaving(true);
    const timer = setTimeout(() => {
      onSave(data);
      setIsSaving(false);
      setLastSaved(new Date());
    }, 2000);

    return () => clearTimeout(timer);
  }, [data, onSave]);

  const handleManualSave = () => {
    setIsSaving(true);
    onSave(data);
    setTimeout(() => {
      setIsSaving(false);
      setLastSaved(new Date());
    }, 500);
  };

  const handleChange = (field: keyof UserProfile, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleShare = async () => {
    // Construct the most robust URL possible
    // Use window.location.href to ensure full context is shared (e.g. subpaths/routes)
    const shareUrl = window.location.href.split('?')[0].split('#')[0];
    
    const shareData = {
      title: 'MedPredict AI Pro',
      text: 'Analyze symptoms, clinical reports, and track vitals with MedPredict AI.',
      url: shareUrl,
    };

    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      // Fallback for older browsers or insecure contexts
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 3000);
        }
      } catch (e) {
        console.error("Copy to clipboard failed", e);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Health Profile</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage your clinical context for more accurate AI assessment.</p>
        </div>
        <div className="flex items-center gap-3">
          {isSaving ? (
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full text-xs font-bold animate-pulse">
              <RefreshCw size={14} className="animate-spin" />
              Syncing...
            </div>
          ) : lastSaved ? (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              Last Sync {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : null}
        </div>
      </header>

      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 p-8 md:p-12 overflow-hidden relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-10">
          <div className="space-y-8">
            <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                <UserIcon size={22} />
              </div>
              Identity & Metrics
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="age" className="text-xs font-black text-slate-400 uppercase tracking-widest">Age</label>
                  <input
                    id="age"
                    type="number"
                    value={data.age || ''}
                    onChange={(e) => handleChange('age', e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-inner"
                    placeholder="25"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="gender" className="text-xs font-black text-slate-400 uppercase tracking-widest">Gender</label>
                  <select
                    id="gender"
                    value={data.gender || ''}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 appearance-none shadow-inner"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="weight" className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Scale size={14} /> Weight (kg)
                  </label>
                  <input
                    id="weight"
                    type="number"
                    value={data.weight || ''}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-inner"
                    placeholder="70"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="height" className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Ruler size={14} /> Height (cm)
                  </label>
                  <input
                    id="height"
                    type="number"
                    value={data.height || ''}
                    onChange={(e) => handleChange('height', e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-inner"
                    placeholder="175"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="bloodType" className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Droplets size={14} /> Blood Type
                </label>
                <select
                    id="bloodType"
                    value={data.bloodType || ''}
                    onChange={(e) => handleChange('bloodType', e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-700 shadow-inner"
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h3 className="font-black text-slate-800 flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                <History size={22} />
              </div>
              Medical Context
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="allergies" className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <AlertCircle size={14} className="text-rose-500" /> Allergies
                </label>
                <textarea
                  id="allergies"
                  value={data.allergies || ''}
                  onChange={(e) => handleChange('allergies', e.target.value)}
                  className="w-full h-28 p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 focus:bg-white transition-all outline-none resize-none font-medium text-slate-700 shadow-inner"
                  placeholder="e.g. Penicillin, Peanuts..."
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="medicalHistory" className="text-xs font-black text-slate-400 uppercase tracking-widest">Medical History</label>
                <textarea
                  id="medicalHistory"
                  value={data.medicalHistory || ''}
                  onChange={(e) => handleChange('medicalHistory', e.target.value)}
                  className="w-full h-36 p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] focus:border-blue-500 focus:bg-white transition-all outline-none resize-none font-medium text-slate-700 shadow-inner"
                  placeholder="e.g. Asthma, Hypertension..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={handleManualSave}
            disabled={isSaving}
            className="p-6 bg-blue-600 text-white rounded-[2rem] border border-blue-500 flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl shadow-blue-200 hover:bg-blue-700 group"
          >
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-sm">
              {isSaving ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} className="group-hover:scale-110 transition-transform" />}
            </div>
            <div className="text-left">
               <p className="text-sm font-black uppercase tracking-widest">Save Session</p>
               <p className="text-xs text-blue-100 font-medium">Commit to Health Vault</p>
            </div>
          </button>

          <button 
            onClick={handleShare}
            aria-label="Share application link"
            className={`p-6 rounded-[2rem] border flex items-center justify-center gap-4 transition-all active:scale-95 group relative overflow-hidden ${
              isCopied 
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-2xl shadow-emerald-100' 
              : 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800 shadow-xl'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all duration-300 ${isCopied ? 'bg-white/20' : 'bg-white/10'}`}>
              {isCopied ? <Check size={24} className="animate-in zoom-in" /> : <Share2 size={24} className="group-hover:scale-110" />}
            </div>
            <div className="text-left">
               <p className="text-sm font-black uppercase tracking-widest">
                 {isCopied ? 'Link Copied!' : 'Share Access'}
               </p>
               <p className={`text-xs font-medium ${isCopied ? 'text-emerald-100' : 'text-slate-400'}`}>
                 {isCopied ? 'Ready to broadcast' : 'Invite your network'}
               </p>
            </div>
          </button>
        </div>

        <div className="mt-8 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
               <ShieldCheck size={20} />
            </div>
            <p className="text-xs font-bold text-slate-500">
               Your biometric and clinical data is encrypted at rest. We never sell your personal metrics.
            </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
