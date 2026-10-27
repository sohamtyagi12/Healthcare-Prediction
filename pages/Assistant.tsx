
import React, { useState, useEffect, useRef } from 'react';
import { analyzeSymptoms, findSpecializedCare, getLiveSocketUrl } from '../services/geminiService';
import { AnalysisResult, UserProfile, HistoryItem } from '../types';
import { Send, Loader2, Info, CheckCircle2, AlertCircle, MapPin, Mic, MicOff, Search, Compass, Hospital, ExternalLink, ChevronRight, Activity, X, Volume2 } from 'lucide-react';

// Decode raw 16-bit PCM bytes from the backend into a playable AudioBuffer
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface AssistantProps {
  user: UserProfile;
}

const Assistant: React.FC<AssistantProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'checker' | 'finder'>('checker');
  const [symptomInput, setSymptomInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(user.history || []);
  
  // Mapping States
  const [mapResults, setMapResults] = useState<{text: string, links: any[]} | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [careLoading, setCareLoading] = useState(false);
  const [careError, setCareError] = useState<string | null>(null);

  // Live Consult States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<WebSocket | null>(null);
  const liveCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    if (activeTab === 'finder') {
      detectLocation();
    }
  }, [activeTab]);

  // Resolve the user's position (reuse it if we already have it).
  const getLocation = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (userLocation) return resolve(userLocation);
      if (!navigator.geolocation) {
        setLocStatus('error');
        return resolve(null);
      }
      setLocStatus('detecting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setLocStatus('success');
          resolve(loc);
        },
        () => {
          setLocStatus('error');
          resolve(null);
        },
        { timeout: 10000 }
      );
    });

  // Hospitals near the user for the condition we just found. Failures here must never
  // hide the symptom analysis, so this has its own error state.
  const loadNearbyCare = async (res: AnalysisResult) => {
    setMapResults(null);
    setCareError(null);
    setCareLoading(true);
    try {
      const loc = await getLocation();
      if (!loc) {
        setCareError('Allow location access in your browser to see hospitals near you.');
        return;
      }
      const kind = res.urgency === 'Emergency' ? 'Emergency' : res.condition;
      setMapResults(await findSpecializedCare(kind, loc.lat, loc.lng));
    } catch {
      setCareError('Could not load nearby hospitals right now.');
    } finally {
      setCareLoading(false);
    }
  };

  const detectLocation = () => {
    if (locStatus === 'success') return;
    setLocStatus('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus('success');
      },
      () => setLocStatus('error'),
      { enableHighAccuracy: true }
    );
  };

  const handleSymptomCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomInput.trim()) return;

    setLoading(true);
    try {
      const res = await analyzeSymptoms(symptomInput, user);
      setAnalysis(res);
      
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        condition: res.condition,
        date: new Date().toLocaleDateString(),
        urgency: res.urgency
      };
      
      const updatedHistory = [newHistoryItem, ...history].slice(0, 5);
      setHistory(updatedHistory);
      
      // Save to local storage mock DB
      const usersRaw = localStorage.getItem('medpredict_mock_db');
      if (usersRaw) {
        const users = JSON.parse(usersRaw);
        const userIdx = users.findIndex((u: any) => u.email === user.email);
        if (userIdx !== -1) {
          users[userIdx].history = updatedHistory;
          localStorage.setItem('medpredict_mock_db', JSON.stringify(users));
        }
      }

      void loadNearbyCare(res);
    } catch (error) {
      alert('Analysis encountered an issue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stopLiveConsult = () => {
    liveCleanupRef.current?.();
    liveCleanupRef.current = null;
    setIsLiveActive(false);
    setLiveStatus('idle');
  };

  // Release mic/audio/socket if the user navigates away mid-call
  useEffect(() => () => { liveCleanupRef.current?.(); }, []);

  const startLiveConsult = async () => {
    setIsLiveActive(true);
    setLiveStatus('connecting');

    let stream: MediaStream | null = null;
    let inputCtx: AudioContext | null = null;
    let outputCtx: AudioContext | null = null;
    let processor: ScriptProcessorNode | null = null;
    let ws: WebSocket | null = null;
    const sources = new Set<AudioBufferSourceNode>();
    let nextStartTime = 0;

    const cleanup = () => {
      processor?.disconnect();
      stream?.getTracks().forEach(t => t.stop());
      sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } });
      sources.clear();
      inputCtx?.close().catch(() => {});
      outputCtx?.close().catch(() => {});
      if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
      ws = null;
      sessionRef.current = null;
    };
    liveCleanupRef.current = cleanup;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputCtx = new AudioContext({ sampleRate: 16000 });
      outputCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      // Audio goes browser -> our Python backend -> Gemini Live. No API key in the browser.
      ws = new WebSocket(getLiveSocketUrl());
      ws.binaryType = 'arraybuffer';
      sessionRef.current = ws;
      const socket = ws;
      const inCtx = inputCtx;
      const outCtx = outputCtx;
      const micStream = stream;

      socket.onmessage = async (event) => {
        // Text frames are control messages; binary frames are 24 kHz PCM16 audio from Gemini.
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ready') {
            setLiveStatus('listening');
            const source = inCtx.createMediaStreamSource(micStream);
            processor = inCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (socket.readyState !== WebSocket.OPEN) return;
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) {
                const v = Math.max(-1, Math.min(1, input[i]));
                int16[i] = v < 0 ? v * 32768 : v * 32767;
              }
              socket.send(int16.buffer);
            };
            source.connect(processor);
            processor.connect(inCtx.destination);
          } else if (msg.type === 'error') {
            console.error('Live consult error:', msg.message);
            alert(msg.message || 'Live consult failed.');
            stopLiveConsult();
          }
          return;
        }

        setLiveStatus('speaking');
        const audioBuffer = await decodeAudioData(new Uint8Array(event.data as ArrayBuffer), outCtx, 24000, 1);
        const source = outCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outCtx.destination);
        nextStartTime = Math.max(nextStartTime, outCtx.currentTime);
        source.start(nextStartTime);
        nextStartTime += audioBuffer.duration;
        source.onended = () => {
          sources.delete(source);
          if (sources.size === 0) setLiveStatus('listening');
        };
        sources.add(source);
      };
      socket.onclose = () => { if (liveCleanupRef.current === cleanup) stopLiveConsult(); };
      socket.onerror = () => { if (liveCleanupRef.current === cleanup) stopLiveConsult(); };
    } catch (e) {
      console.error(e);
      stopLiveConsult();
    }
  };

  const findCareExplicitly = async (spec: string) => {
    if (!userLocation) {
      alert("Location required to find specialists.");
      return;
    }
    setLoading(true);
    try {
      const data = await findSpecializedCare(spec, userLocation.lat, userLocation.lng);
      setMapResults(data);
    } catch (e) {
      alert("Care search failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">AI Health Assistant</h1>
          <p className="text-slate-500 mt-2 font-medium">Symptom logic and clinical mapping in one interface.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
          <button 
            onClick={() => setActiveTab('checker')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'checker' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Symptom Check
          </button>
          <button 
            onClick={() => setActiveTab('finder')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'finder' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Find Care
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Interaction Area */}
        <div className="lg:col-span-7 space-y-6">
          {activeTab === 'checker' ? (
            <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100">
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Diagnostic Hub</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gemini 3.6 Flash Active</p>
                  </div>
               </div>

               <form onSubmit={handleSymptomCheck} className="space-y-6">
                 <div className="relative group">
                    <textarea
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      placeholder="e.g., I have a sharp pain in my lower back that radiates to my leg..."
                      className="w-full h-48 p-8 bg-slate-50 border-2 border-transparent rounded-[2rem] focus:border-blue-500 focus:bg-white transition-all outline-none text-slate-700 font-medium placeholder:text-slate-300 resize-none shadow-inner"
                      disabled={loading}
                    />
                    <div className="absolute bottom-6 right-6 flex gap-2">
                       <button
                         type="button"
                         onClick={startLiveConsult}
                         className="w-12 h-12 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center hover:bg-slate-300 transition-all"
                       >
                         <Mic size={20} />
                       </button>
                       <button
                         type="submit"
                         disabled={loading || !symptomInput.trim()}
                         className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-lg shadow-blue-200"
                       >
                         {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                       </button>
                    </div>
                 </div>
                 <div className="flex items-center justify-center gap-2 text-slate-400">
                    <Info size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Encrypted session • AI Guided</span>
                 </div>
               </form>

               {analysis && (
                 <div className="mt-10 p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100 animate-in zoom-in duration-500">
                   <div className="flex justify-between items-start mb-6">
                     <div>
                       <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${
                         analysis.urgency === 'Emergency' ? 'bg-rose-500 text-white' : 'bg-white text-blue-600'
                       }`}>
                         {analysis.urgency} Urgency
                       </span>
                       <h3 className="text-2xl font-black text-slate-800 mt-4 tracking-tight">{analysis.condition}</h3>
                     </div>
                     <div className="text-right">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Confidence</p>
                       <p className="text-2xl font-black text-blue-600">{analysis.probability}%</p>
                     </div>
                   </div>
                   
                   <p className="text-slate-600 text-sm leading-relaxed font-medium mb-8 bg-white/50 p-6 rounded-3xl border border-white/50">
                     {analysis.description}
                   </p>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                           <CheckCircle2 size={14} /> Actions
                        </h4>
                        <ul className="space-y-3">
                           {analysis.recommendations.map((r, i) => (
                             <li key={i} className="text-xs text-slate-600 font-bold flex items-start gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> {r}
                             </li>
                           ))}
                        </ul>
                     </div>
                     <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                           <AlertCircle size={14} /> Warning
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed italic font-medium">
                           {analysis.caveats}
                        </p>
                     </div>
                   </div>

                   <div className="mt-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                     <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                       <Hospital size={14} /> Hospitals Near You
                     </h4>
                     {careLoading && (
                       <p className="text-xs text-slate-400 font-bold flex items-center gap-2">
                         <Loader2 className="animate-spin" size={14} /> Finding hospitals near you...
                       </p>
                     )}
                     {!careLoading && careError && (
                       <p className="text-xs text-slate-500 font-medium">{careError}</p>
                     )}
                     {!careLoading && !careError && mapResults && mapResults.links.length === 0 && (
                       <p className="text-xs text-slate-500 font-medium">{mapResults.text}</p>
                     )}
                     <ul className="space-y-3">
                       {mapResults?.links.filter(l => l.maps).slice(0, 4).map((l, i) => (
                         <li key={i} className="flex items-center justify-between gap-4">
                           <div className="min-w-0">
                             <p className="text-sm font-black text-slate-800 truncate">{l.maps.title}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                               {l.maps.distanceKm != null ? `${l.maps.distanceKm} km away` : 'Nearby'}
                               {l.maps.emergency ? ' • Emergency' : ''}
                             </p>
                           </div>
                           <a
                             href={l.maps.uri}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="shrink-0 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all"
                           >
                             Directions <ExternalLink size={12} />
                           </a>
                         </li>
                       ))}
                     </ul>
                   </div>

                   {mapResults && mapResults.links.length > 4 && (
                     <button 
                       onClick={() => setActiveTab('finder')}
                       className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
                     >
                       <MapPin size={16} /> View All Nearby Care
                     </button>
                   )}
                 </div>
               )}
            </div>
          ) : (
            <div className="space-y-6">
               <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black text-slate-800">Local Care Search</h2>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${locStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                       <Compass size={12} className={locStatus === 'detecting' ? 'animate-spin' : ''} />
                       {locStatus === 'success' ? 'Location Ready' : 'Acquiring GPS...'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Emergency', 'Dentist', 'Pediatrics', 'Clinic'].map(spec => (
                      <button 
                        key={spec}
                        onClick={() => findCareExplicitly(spec)}
                        className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
                      >
                        {spec}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mapResults?.links.filter(l => l.maps).map((result, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                       <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <Hospital size={24} />
                       </div>
                       <h4 className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{result.maps.title}</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                         {result.maps.distanceKm != null ? `${result.maps.distanceKm} km away` : 'Medical Center'}
                       </p>
                       {result.maps.address && (
                         <p className="text-xs text-slate-500 font-medium mt-2">{result.maps.address}</p>
                       )}
                       <a 
                         href={result.maps.uri} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="mt-6 w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900 hover:text-white transition-all"
                       >
                         Directions <ExternalLink size={12} />
                       </a>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>

        {/* Sidebar Context */}
        <div className="lg:col-span-5 space-y-6">
           <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/30 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="relative">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400">
                      <Mic size={24} />
                    </div>
                    <h3 className="text-xl font-black">Live Consult</h3>
                 </div>
                 <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                    Speak directly with MedPredict AI for hands-free symptom checking or health coaching.
                 </p>
                 <button 
                  onClick={startLiveConsult}
                  className="w-full py-5 bg-blue-600 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-500 shadow-xl shadow-blue-900/40 transition-all active:scale-95"
                 >
                    Start Voice Session <ChevronRight size={18} />
                 </button>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                 <Search size={20} className="text-blue-500" /> Recent History
              </h3>
              <div className="space-y-4">
                 {history.length > 0 ? history.map((h) => (
                   <div key={h.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
                      <div>
                        <p className="text-xs font-black text-slate-700">{h.condition}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{h.date}</p>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${
                        h.urgency === 'Emergency' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-white border-slate-100 text-blue-600'
                      }`}>
                        {h.urgency}
                      </span>
                   </div>
                 )) : (
                   <div className="text-center py-6 text-slate-300">
                      <Activity size={24} className="mx-auto mb-2 opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No entries yet</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* Live Consult Modal */}
      {isLiveActive && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="max-w-md w-full text-center space-y-12">
            <div className="relative">
               <div className={`w-32 h-32 rounded-full border-4 border-blue-600/20 flex items-center justify-center mx-auto relative ${liveStatus === 'listening' ? 'animate-pulse' : ''}`}>
                  <div className={`absolute inset-0 rounded-full bg-blue-600/10 ${liveStatus === 'speaking' ? 'animate-ping' : ''}`} />
                  <Mic size={48} className={`text-blue-600 ${liveStatus === 'listening' ? 'scale-110' : 'scale-100'} transition-transform`} />
               </div>
               {liveStatus === 'speaking' && (
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 items-center">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-1 bg-blue-500 rounded-full animate-[bounce_0.6s_infinite]" style={{ height: `${10 + Math.random() * 40}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                 </div>
               )}
            </div>

            <div>
              <h2 className="text-white text-3xl font-black tracking-tight mb-4">MedPredict Voice</h2>
              <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.2em]">
                {liveStatus === 'connecting' ? 'Establishing secure link...' : 
                 liveStatus === 'listening' ? 'Listening to you...' : 
                 liveStatus === 'speaking' ? 'AI is responding...' : 'Ready'}
              </p>
            </div>

            <div className="flex justify-center gap-6">
               <button 
                onClick={stopLiveConsult}
                className="w-16 h-16 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-rose-900/40 hover:bg-rose-500 transition-all active:scale-90"
               >
                 <X size={24} />
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assistant;
