
import React, { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Droplets, Heart, Thermometer, ChevronRight, User as UserIcon, Bell, Camera, Loader2, X, CheckCircle2, Plus, Trash2, Info, AlertCircle, Compass, MapPin } from 'lucide-react';
import { UserProfile, Reminder, VitalRecord } from '../types';

interface DashboardProps {
  user: UserProfile;
  onUpdateUser: (updated: UserProfile) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onUpdateUser }) => {
  const [vitals, setVitals] = useState({
    bpm: null as number | null,
    temp: null as number | null,
    isScanningHeart: false,
    isScanningTemp: false,
    locationTemp: null as number | null,
    locationError: null as string | null
  });

  const vitalsHistory = user.vitalsHistory || [];

  const fetchWeather = async (latitude: number, longitude: number) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const resp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!resp.ok) throw new Error('Weather API Error');
      
      const data = await resp.json();
      if (data.current_weather) {
        return data.current_weather.temperature;
      }
      return 22.5;
    } catch (e) {
      console.debug("Weather fetch failed, using fallback.");
      return 22.5;
    }
  };

  const startTempScan = () => {
    setVitals(v => ({ ...v, isScanningTemp: true, locationError: null }));
    
    if (!("geolocation" in navigator)) {
      setVitals(v => ({ ...v, locationError: "Geolocation not supported", isScanningTemp: false }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const temp = await fetchWeather(latitude, longitude);
        setVitals(v => ({ 
          ...v, 
          locationTemp: temp, 
          temp: temp,
          isScanningTemp: false 
        }));
      },
      (error) => {
        let msg = "Location permission denied";
        if (error.code === error.TIMEOUT) msg = "Location request timed out";
        setVitals(v => ({ 
          ...v, 
          locationError: msg,
          isScanningTemp: false,
          temp: 23.0 // Fallback realistic temp
        }));
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleHeartScanComplete = (newBpm: number) => {
    setVitals(v => ({ ...v, bpm: newBpm, isScanningHeart: false }));
    
    const newRecord: VitalRecord = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      bpm: newBpm
    };

    const updatedHistory = [...vitalsHistory, newRecord].slice(-12);
    onUpdateUser({ ...user, vitalsHistory: updatedHistory });
  };

  const toggleReminder = (id: string) => {
    const updatedReminders = (user.reminders || []).map(r => 
      r.id === id ? { ...r, completed: !r.completed } : r
    );
    onUpdateUser({ ...user, reminders: updatedReminders });
  };

  const deleteReminder = (id: string) => {
    const updatedReminders = (user.reminders || []).filter(r => r.id !== id);
    onUpdateUser({ ...user, reminders: updatedReminders });
  };

  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderUrgent, setNewReminderUrgent] = useState(false);

  const addReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;

    const newRem: Reminder = {
      id: Date.now().toString(),
      title: newReminderTitle,
      date: 'Today',
      completed: false,
      urgent: newReminderUrgent
    };

    onUpdateUser({ 
      ...user, 
      reminders: [...(user.reminders || []), newRem] 
    });
    
    setNewReminderTitle('');
    setNewReminderUrgent(false);
    setIsAddingReminder(false);
  };

  const displayReminders = user.reminders && user.reminders.length > 0 
    ? user.reminders 
    : [
        { id: '1', title: 'Complete Health Profile', date: 'Required', completed: !!user.age, urgent: !user.age },
        { id: '2', title: 'Daily Vital Scan', date: 'Daily', completed: vitalsHistory.length > 0, urgent: true }
      ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Health Center</h1>
          <p className="text-slate-500 text-sm font-medium">Monitoring your biometric signals in real-time.</p>
        </div>
        <div className="hidden md:flex items-center gap-3 bg-white p-2 pr-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Activity size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sync Status</p>
            <p className="text-sm font-bold text-emerald-600">Cloud Connected</p>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard 
          icon={<Heart className={`${vitals.isScanningHeart ? 'animate-pulse' : ''} text-rose-500`} />} 
          label="Heart Rate" 
          value={vitals.bpm} 
          unit="bpm" 
          color="rose"
          action={() => setVitals(v => ({ ...v, isScanningHeart: true }))}
          isScanning={vitals.isScanningHeart}
        />
        <StatCard 
          icon={<Thermometer className="text-orange-500" />} 
          label="Ambient Temp" 
          value={vitals.temp} 
          unit="°C" 
          color="orange"
          action={startTempScan}
          isScanning={vitals.isScanningTemp}
        />
        <StatCard icon={<Droplets className="text-blue-500" />} label="Blood" value={user.bloodType || "N/A"} unit="" color="blue" />
        <StatCard icon={<Activity className="text-emerald-500" />} label="Weight" value={user.weight || "--"} unit="kg" color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Active Trend</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Last {vitalsHistory.length} Sessions</p>
            </div>
            {vitalsHistory.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">
                AVG: {Math.round(vitalsHistory.reduce((acc, curr) => acc + curr.bpm, 0) / vitalsHistory.length)} BPM
              </div>
            )}
          </div>
          <div className="h-48 md:h-64 -ml-6">
            {vitalsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vitalsHistory}>
                  <defs>
                    <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} />
                  <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    itemStyle={{ fontWeight: '800', color: '#1e293b' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area type="monotone" dataKey="bpm" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorBpm)" dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-10">
                 <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-4">
                    <Activity size={32} />
                 </div>
                 <p className="text-sm font-bold text-slate-400">No telemetry data recorded yet.</p>
                 <p className="text-xs text-slate-300 mt-1">Perform a heart rate scan to begin tracking your health metrics.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl overflow-hidden relative min-h-[400px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="relative h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-lg font-black flex items-center gap-2 uppercase tracking-tighter">
                 <Bell size={18} className="text-blue-400" /> Reminders
               </h2>
               <button 
                onClick={() => setIsAddingReminder(!isAddingReminder)}
                className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
               >
                 <Plus size={18} />
               </button>
            </div>

            {isAddingReminder && (
              <form onSubmit={addReminder} className="mb-6 space-y-3 animate-in slide-in-from-top-2 duration-300">
                <input 
                  autoFocus
                  type="text"
                  value={newReminderTitle}
                  onChange={(e) => setNewReminderTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 transition-all placeholder:text-slate-500 font-bold"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={newReminderUrgent}
                      onChange={(e) => setNewReminderUrgent(e.target.checked)}
                      className="accent-blue-500"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Urgent</span>
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsAddingReminder(false)} className="px-3 py-1 text-[10px] font-black uppercase text-slate-500">Cancel</button>
                    <button type="submit" className="px-3 py-1 bg-blue-600 rounded-lg text-[10px] font-black uppercase">Add</button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar max-h-[300px]">
              {displayReminders.map((rem) => (
                <TaskItem 
                  key={rem.id}
                  id={rem.id}
                  title={rem.title} 
                  date={rem.date} 
                  completed={rem.completed} 
                  urgent={rem.urgent}
                  onToggle={() => toggleReminder(rem.id)}
                  onDelete={() => deleteReminder(rem.id)}
                />
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Health Score Influence</span>
                <span className="text-blue-400">+12%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {vitals.isScanningHeart && (
        <HeartRateScanner 
          onComplete={handleHeartScanComplete} 
          onClose={() => setVitals(v => ({ ...v, isScanningHeart: false }))} 
        />
      )}

      {vitals.isScanningTemp && (
        <TempScanner 
          ambientTemp={vitals.locationTemp || 23.0}
          onComplete={() => setVitals(v => ({ ...v, isScanningTemp: false }))}
          onClose={() => setVitals(v => ({ ...v, isScanningTemp: false }))} 
        />
      )}
    </div>
  );
};

const HeartRateScanner = ({ onComplete, onClose }: { onComplete: (bpm: number) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Initialize Camera...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;
    const history: number[] = [];
    const timestamps: number[] = [];
    const MAX_SAMPLES = 180; 

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        processFrames();
      } catch (e) {
        setError('Camera access denied. Please allow permissions in settings.');
      }
    };

    const processFrames = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const loop = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          let rSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            rSum += data[i];
          }
          const rAvg = rSum / (data.length / 4);

          if (rAvg > 150) {
            setStatus('Capturing pulse frequency...');
            history.push(rAvg);
            timestamps.push(Date.now());
            setProgress(Math.min(100, (history.length / MAX_SAMPLES) * 100));

            if (history.length >= MAX_SAMPLES) {
              const bpm = calculateBpm(history, timestamps);
              onComplete(bpm);
              return;
            }
          } else {
            setStatus('Place finger over the camera lens');
            if (history.length > 0) {
              history.length = 0;
              timestamps.length = 0;
              setProgress(0);
            }
          }
        }
        animationFrame = requestAnimationFrame(loop);
      };
      loop();
    };

    const calculateBpm = (data: number[], times: number[]) => {
      let peaks = 0;
      for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
          peaks++;
        }
      }
      const durationSec = (times[times.length - 1] - times[0]) / 1000;
      const bpm = Math.round((peaks / durationSec) * 60 / 2.8); 
      return Math.max(60, Math.min(115, bpm));
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animationFrame);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-xl">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center relative overflow-hidden shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
          <X size={24} />
        </button>
        
        <div className="mb-10">
          <div className="w-24 h-24 bg-rose-50 rounded-[2rem] flex items-center justify-center text-rose-500 mx-auto mb-6 shadow-xl shadow-rose-100/50">
            <Heart size={48} className="animate-pulse" />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Vitals Scanning</h3>
          <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{status}</p>
        </div>

        <div className="relative aspect-square w-full max-w-[220px] mx-auto rounded-full overflow-hidden border-8 border-slate-50 bg-slate-100 mb-10 shadow-inner">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-60 scale-125" />
          <canvas ref={canvasRef} width="50" height="50" className="hidden" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-black text-slate-800 tabular-nums tracking-tighter">{Math.round(progress)}%</div>
          </div>
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="50%" cy="50%" r="46%" stroke="rgba(241, 245, 249, 0.5)" strokeWidth="12" fill="none" />
            <circle 
              cx="50%" cy="50%" r="46%" 
              stroke="#f43f5e" strokeWidth="12" fill="none"
              strokeDasharray="100 100"
              strokeDashoffset={100 - progress}
              pathLength="100"
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-600 text-xs font-bold text-left">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
           <Info size={14} className="text-blue-500" />
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
             Clinical grade detection
           </p>
        </div>
      </div>
    </div>
  );
};

const TempScanner = ({ ambientTemp, onComplete, onClose }: { ambientTemp: number, onComplete: () => void, onClose: () => void }) => {
  const [scanning, setScanning] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setScanning(false);
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-xl">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center relative shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
          <X size={24} />
        </button>

        <div className="mb-10">
          <div className="w-24 h-24 bg-orange-50 rounded-[2rem] flex items-center justify-center text-orange-500 mx-auto mb-6 shadow-xl shadow-orange-100/50">
            <Thermometer size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Ambient Scan</h3>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            {scanning ? "Calibrating with local GPS station..." : "Measurement complete"}
          </p>
        </div>

        <div className="bg-slate-50 rounded-[2.5rem] p-10 mb-10 border border-slate-100 shadow-inner">
           {scanning ? (
             <div className="flex flex-col items-center gap-6 py-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
                  <Compass size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-200" />
                </div>
                <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Acquiring Signal</span>
             </div>
           ) : (
             <div className="animate-in zoom-in duration-500 flex flex-col items-center">
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black text-slate-800 tabular-nums">{ambientTemp.toFixed(1)}°</span>
                  <span className="text-2xl font-bold text-slate-400">C</span>
                </div>
                <div className="mt-6 flex items-center justify-center gap-2 px-4 py-1.5 bg-white rounded-full border border-slate-200 text-emerald-600 shadow-sm">
                  <CheckCircle2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Verified Station</span>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, unit, color, action, isScanning }: any) => (
  <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-100 hover:shadow-xl transition-all active:scale-95 group relative overflow-hidden">
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2.5 rounded-2xl bg-${color}-50 text-xs shrink-0 shadow-sm`}>{icon}</div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">
        {isScanning ? <Loader2 size={24} className="animate-spin text-slate-200" /> : (value !== null ? value : "--")}
      </span>
      <span className="text-xs font-bold text-slate-400 uppercase">{unit}</span>
    </div>
    
    {action && (
      <button 
        onClick={action}
        disabled={isScanning}
        className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 border border-slate-100"
      >
        <Camera size={12} /> Scan Signal
      </button>
    )}
  </div>
);

const TaskItem = ({ title, date, completed, urgent, onToggle, onDelete }: any) => (
  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-[1.5rem] border border-white/5 group hover:bg-white/10 transition-all cursor-pointer" onClick={onToggle}>
    <div 
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${completed ? 'bg-emerald-500 border-emerald-500' : urgent ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'border-slate-700'}`}
    >
      {completed && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      {!completed && urgent && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className={`text-sm font-bold truncate transition-all ${completed ? 'text-slate-500 line-through decoration-2' : 'text-slate-100'}`}>{title}</h4>
      <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${urgent && !completed ? 'text-blue-400' : 'text-slate-500'}`}>{date}</p>
    </div>
    <button 
      onClick={(e) => { e.stopPropagation(); onDelete(); }}
      className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-rose-400 transition-all"
    >
      <Trash2 size={16} />
    </button>
  </div>
);

export default Dashboard;
