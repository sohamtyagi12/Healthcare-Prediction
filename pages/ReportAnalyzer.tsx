
import React, { useState, useEffect } from 'react';
import { analyzeLabReport } from '../services/geminiService';
import { LabReportSummary } from '../types';
import { Upload, FileSearch, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCcw, ArrowRight, ShieldCheck, Microscope } from 'lucide-react';

const ReportAnalyzer: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [report, setReport] = useState<LabReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    "Scanning document structure...",
    "Extracting clinical data points...",
    "Benchmarking against standard ranges...",
    "Synthesizing health score...",
    "Finalizing interpretation..."
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 50);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processReport = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setReport(null);

    // Simulate analysis steps for better UX
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      if (stepIndex < steps.length) {
        setAnalysisStep(steps[stepIndex]);
        stepIndex++;
      }
    }, 1500);

    try {
      const base64 = image.split(',')[1];
      const result = await analyzeLabReport(base64);
      setReport(result);
    } catch (err) {
      console.error(err);
      setError('Analysis failed. The report might be blurry or the format is unsupported. Please try a clearer photo.');
    } finally {
      setLoading(false);
      clearInterval(stepInterval);
      setAnalysisStep('');
    }
  };

  const reset = () => {
    setImage(null);
    setReport(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Lab Intelligence</h1>
          <p className="text-slate-500 mt-2 font-medium">Professional-grade clinical report extraction and interpretation.</p>
        </div>
        {report && (
          <button onClick={reset} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl transition-all">
            <RefreshCcw size={16} /> New Analysis
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Upload & Interaction Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`relative bg-white border-2 border-dashed rounded-[3rem] p-4 transition-all min-h-[450px] flex flex-col items-center justify-center shadow-sm ${image ? 'border-blue-400' : 'border-slate-200 hover:border-blue-300'}`}>
            {image ? (
              <div className="relative w-full h-full flex flex-col p-4">
                <div className="flex-1 min-h-[300px] relative rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 mb-4">
                  <img src={image} alt="Report Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                </div>
                
                {uploadProgress < 100 && (
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={reset}
                    disabled={loading}
                    className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Replace
                  </button>
                  <button
                    onClick={processReport}
                    disabled={loading || uploadProgress < 100}
                    className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300 transition-all flex items-center justify-center gap-2 group"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Microscope size={20} className="group-hover:scale-110 transition-transform" />}
                    {loading ? 'Analyzing...' : 'Begin Analysis'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 group cursor-pointer w-full h-full flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-[2.5rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <Upload size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800">Upload Lab Report</h3>
                <p className="text-slate-400 font-medium mt-2 max-w-xs">Drag and drop your clinical documents or browse files.</p>
                <div className="mt-8 flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                   <ShieldCheck size={14} className="text-blue-500" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure & Encrypted</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
              </div>
            )}
          </div>

          {loading && (
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl animate-in slide-in-from-bottom-4">
               <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <Loader2 className="animate-spin text-blue-400" size={32} />
                  </div>
                  <div>
                    <h3 className="font-black tracking-tight">AI Engine Busy</h3>
                    <p className="text-xs text-slate-400 font-medium">{analysisStep || 'Initializing Gemini...'}</p>
                  </div>
               </div>
               <div className="space-y-3">
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[loading_10s_ease-in-out_infinite]" />
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Processing biomedical data points...</p>
               </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border-2 border-rose-100 p-8 rounded-[2.5rem] animate-in shake">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="font-black text-rose-800">Analysis Error</h3>
              </div>
              <p className="text-rose-700 font-medium text-sm leading-relaxed mb-6">{error}</p>
              <button 
                onClick={processReport}
                className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCcw size={18} /> Retry Analysis
              </button>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="lg:col-span-7">
          {report ? (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-700">
              <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Clinical Insights</h2>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Verified Extract</p>
                  </div>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Score</p>
                      <p className="text-2xl font-black text-slate-800">{report.overallHealthScore}<span className="text-sm text-slate-400">/100</span></p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                      <div className={`w-8 h-8 rounded-full border-4 ${report.overallHealthScore > 70 ? 'border-emerald-500' : 'border-orange-400'}`} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  {report.parameters.map((param, i) => (
                    <div key={i} className="group p-6 rounded-[2rem] bg-slate-50 border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-xl hover:shadow-blue-50 transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-700 text-sm group-hover:text-blue-600 transition-colors">{param.name}</h4>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-900 tracking-tight">{param.value}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{param.unit}</span>
                          </div>
                        </div>
                        <StatusBadge status={param.status} />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium bg-white/50 p-3 rounded-xl border border-slate-100/50 italic">
                        {param.notes}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="relative">
                    <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                      <Microscope size={20} className="text-blue-400" /> Executive Interpretation
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed font-medium">
                      {report.interpretation}
                    </p>
                    <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">AI Synthesized Report • Not a diagnosis</span>
                       <button className="text-xs font-black text-blue-400 flex items-center gap-1 hover:text-blue-300 transition-colors">
                          SAVE PDF <ArrowRight size={14} />
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[4rem] border-2 border-dashed border-slate-200 h-[600px] flex flex-col items-center justify-center p-12 text-center shadow-inner relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-8 shadow-inner group-hover:scale-110 transition-transform duration-700">
                <FileSearch size={56} className="text-slate-200 group-hover:text-blue-200 transition-colors" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Awaiting Analysis</h3>
              <p className="text-slate-400 font-medium mt-3 max-w-sm leading-relaxed">
                Once you upload and process your lab report, a comprehensive parameter breakdown and health score will appear here.
              </p>
              
              <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-md">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
                    <CheckCircle2 size={20} className="text-slate-300" />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Normal Range Checks</span>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-2">
                    <Microscope size={20} className="text-slate-300" />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Abnormal Detection</span>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          10% { width: 30%; }
          30% { width: 50%; }
          60% { width: 85%; }
          90% { width: 95%; }
          100% { width: 100%; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'Normal': return <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full shadow-sm"><CheckCircle2 size={12}/> {status}</span>;
    case 'Warning': return <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-orange-100 text-orange-700 px-3 py-1 rounded-full shadow-sm"><AlertTriangle size={12}/> {status}</span>;
    case 'Abnormal': return <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-rose-100 text-rose-700 px-3 py-1 rounded-full shadow-sm"><XCircle size={12}/> {status}</span>;
    default: return null;
  }
};

export default ReportAnalyzer;
