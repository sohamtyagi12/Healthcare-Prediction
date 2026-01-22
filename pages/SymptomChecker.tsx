
import React, { useState } from 'react';
import { analyzeSymptoms } from '../services/geminiService';
import { AnalysisResult } from '../types';
import { Send, Loader2, Info, CheckCircle2, AlertCircle } from 'lucide-react';

const SymptomChecker: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const analysis = await analyzeSymptoms(input);
      setResult(analysis);
    } catch (error) {
      console.error(error);
      alert('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">Symptom Assessment</h1>
        <p className="text-slate-500 mt-2">Describe what you are feeling in your own words.</p>
      </header>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-10 border border-slate-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Example: I have been having a persistent dull headache for 3 days and I feel slightly nauseous when I wake up..."
              className="w-full h-40 p-6 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all resize-none text-slate-700"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute bottom-4 right-4 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:bg-slate-300 transition-all shadow-lg"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1">
            <Info size={12} /> Privacy notice: Your data is processed anonymously by AI.
          </p>
        </form>
      </div>

      {result && (
        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 border-l-8 border-blue-500 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-6">
              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  result.urgency === 'Emergency' ? 'bg-red-100 text-red-700' :
                  result.urgency === 'High' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {result.urgency} Urgency
                </span>
                <h2 className="text-2xl font-bold text-slate-800 mt-3">Potential: {result.condition}</h2>
                <p className="text-slate-600 mt-2 leading-relaxed">{result.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-50 p-4 rounded-2xl">
                  <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={18} /> Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-rose-50 p-4 rounded-2xl">
                  <h3 className="font-bold text-rose-800 mb-3 flex items-center gap-2">
                    <AlertCircle size={18} /> Important Notes
                  </h3>
                  <p className="text-sm text-rose-700 leading-relaxed italic">
                    {result.caveats}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full md:w-48 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl">
              <div className="relative w-24 h-24 mb-3">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200" />
                  <circle 
                    cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" 
                    className="text-blue-600"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * result.probability) / 100}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-800">
                  {result.probability}%
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">AI Confidence</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SymptomChecker;
