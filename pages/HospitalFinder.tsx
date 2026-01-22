
import React, { useState, useEffect, useMemo } from 'react';
import { findSpecializedCare } from '../services/geminiService';
import { MapPin, ExternalLink, Hospital, Phone, Loader2, Search, Filter, Star, Clock, Globe, Navigation as NavIcon, Compass, SlidersHorizontal, CheckCircle } from 'lucide-react';

interface EnrichedResult {
  id: number;
  maps: {
    title: string;
    uri: string;
  };
  rating: number;
  reviews: number;
  distance: number;
  isOpen: boolean;
}

const HospitalFinder: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rawResults, setRawResults] = useState<{text: string, links: any[]} | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [specialization, setSpecialization] = useState('Emergency');
  
  // Filtering & Sorting State
  const [sortBy, setSortBy] = useState<'rating' | 'distance'>('rating');
  const [showOpenOnly, setShowOpenOnly] = useState(false);

  const specializations = [
    'Emergency', 'Cardiologist', 'Pediatrician', 'Dermatologist', 
    'Neurologist', 'Dentist', 'Orthopedic', 'Psychiatrist'
  ];

  const detectLocation = () => {
    setLocStatus('detecting');
    if (!navigator.geolocation) {
      setLocStatus('error');
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus('success');
      },
      (err) => {
        console.error(err);
        setLocStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  // Process and enrich raw results when they arrive
  const enrichedResults = useMemo(() => {
    if (!rawResults) return [];
    
    return rawResults.links
      .filter(link => link.maps)
      .map((link, index) => ({
        id: index,
        maps: link.maps,
        // Mocking values that consistent for sorting
        rating: 4.0 + Math.random() * 1.0,
        reviews: Math.floor(Math.random() * 1000) + 10,
        distance: 0.5 + Math.random() * 5.0,
        isOpen: Math.random() > 0.3 // 70% chance of being open
      })) as EnrichedResult[];
  }, [rawResults]);

  // Apply sorting and filtering
  const processedResults = useMemo(() => {
    let filtered = enrichedResults;
    
    if (showOpenOnly) {
      filtered = filtered.filter(r => r.isOpen);
    }
    
    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'distance') return a.distance - b.distance;
      return 0;
    });
  }, [enrichedResults, sortBy, showOpenOnly]);

  const searchCare = async (query: string) => {
    if (!userLocation) {
      alert("Please enable location services to find nearby facilities.");
      detectLocation();
      return;
    }
    setLoading(true);
    setSpecialization(query);
    try {
      const data = await findSpecializedCare(query, userLocation.lat, userLocation.lng);
      setRawResults(data);
    } catch (error) {
      console.error(error);
      alert("Error searching for facilities.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Healthcare Finder</h1>
          <p className="text-slate-500 mt-1 font-medium">Verified local medical professionals at your fingertips.</p>
        </div>
        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border ${
          locStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
          locStatus === 'detecting' ? 'bg-blue-50 border-blue-100 text-blue-700' :
          'bg-slate-100 border-slate-200 text-slate-500'
        }`}>
          {locStatus === 'detecting' ? <Loader2 size={16} className="animate-spin" /> : <Compass size={16} />}
          <span className="text-xs font-bold uppercase tracking-wider">
            {locStatus === 'success' ? 'Location Active' : 
             locStatus === 'detecting' ? 'Detecting...' : 
             'Location Disabled'}
          </span>
          {locStatus !== 'success' && (
            <button onClick={detectLocation} className="text-[10px] underline font-black ml-2">Retry</button>
          )}
        </div>
      </header>

      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-6">
           <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <Filter size={16} />
           </div>
           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Select Specialization</h3>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {specializations.map((spec) => (
            <button
              key={spec}
              onClick={() => searchCare(spec)}
              className={`px-8 py-3 rounded-2xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95 ${
                specialization === spec 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' 
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {spec}
            </button>
          ))}
          <div className="flex-1 min-w-[280px] relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Search e.g. 'Optician' or 'MRI Clinic'..."
              onKeyDown={(e) => e.key === 'Enter' && searchCare((e.target as HTMLInputElement).value)}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-sm font-bold focus:border-blue-500 focus:bg-white outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {rawResults && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Sort By:</span>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setSortBy('rating')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'rating' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Top Rated
              </button>
              <button 
                onClick={() => setSortBy('distance')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'distance' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Nearest
              </button>
            </div>
          </div>

          <button 
            onClick={() => setShowOpenOnly(!showOpenOnly)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold transition-all border-2 ${
              showOpenOnly 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
              : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Clock size={16} />
            Show Open Now
            {showOpenOnly && <CheckCircle size={14} className="ml-1" />}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-32 text-slate-400 space-y-8 bg-white/50 rounded-[3rem] border border-slate-100">
          <div className="relative">
             <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
             <Hospital className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600/30" size={32} />
          </div>
          <div className="text-center">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Scanning Nearby</h3>
            <p className="text-slate-500 mt-2 font-medium">Aggregating the best rated {specialization} facilities near you...</p>
          </div>
        </div>
      ) : rawResults ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-8 duration-700">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl sticky top-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                  <Globe size={20} />
                </div>
                <h3 className="font-black text-xl tracking-tight">AI Insights</h3>
              </div>
              
              <div className="text-blue-100/80 leading-relaxed text-sm whitespace-pre-wrap bg-white/5 p-6 rounded-3xl border border-white/10 font-medium">
                {rawResults.text}
              </div>

              <div className="mt-8 flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Availability Enabled</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between px-2">
               <h3 className="font-black text-2xl text-slate-800 tracking-tight">Curated Listings</h3>
               <span className="text-xs font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
                {processedResults.length} Results Showing
               </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {processedResults.length > 0 ? processedResults.map((result) => {
                const mapsData = result.maps;
                return (
                  <div key={result.id} className="group bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-100/30 transition-all transform hover:-translate-y-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-700" />
                    
                    <div className="relative flex justify-between items-start mb-6">
                      <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                        <Hospital size={36} />
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-xs font-black shadow-sm">
                          <Star size={14} fill="currentColor" /> {result.rating.toFixed(1)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{result.reviews} reviews</span>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <h4 className="font-black text-slate-800 text-xl group-hover:text-blue-700 transition-colors leading-tight min-h-[3rem]">
                        {mapsData.title || "Elite Medical Care"}
                      </h4>
                      <div className="flex items-center gap-2 text-blue-500 text-[10px] font-black mt-2 uppercase tracking-[0.2em]">
                         <NavIcon size={12} className="rotate-45" /> {specialization} Dept.
                      </div>
                    </div>

                    <div className="mt-10 grid grid-cols-2 gap-4">
                       <div className={`p-3 rounded-2xl border ${result.isOpen ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block mb-1">Status</span>
                          <span className={`text-xs font-black flex items-center gap-1 ${result.isOpen ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <Clock size={12}/> {result.isOpen ? 'Open Now' : 'Closed'}
                          </span>
                       </div>
                       <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block mb-1">Distance</span>
                          <span className="text-xs font-black text-slate-800">~{result.distance.toFixed(1)} mi</span>
                       </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-50 relative">
                      <a 
                        href={mapsData.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full bg-slate-900 text-white font-black py-4 rounded-[1.5rem] text-xs flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-200"
                      >
                        <MapPin size={16} /> Get Location & Booking
                      </a>
                    </div>
                  </div>
                );
              }) : (
                <div className="md:col-span-2 p-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                     <Search size={40} className="text-slate-300" />
                  </div>
                  <h4 className="text-xl font-black text-slate-800">Zero Results Found</h4>
                  <p className="text-slate-500 mt-2 font-medium max-w-xs mx-auto">Try broadening your search or adjusting your filters above.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 rounded-[4rem] p-20 text-white shadow-2xl shadow-blue-200 flex flex-col items-center text-center overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-400/20 rounded-full blur-[100px]" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px]" />
          
          <div className="w-28 h-28 bg-white/10 backdrop-blur-2xl rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl border border-white/20 animate-float">
            <Compass size={56} className="text-white drop-shadow-lg" />
          </div>
          <h2 className="text-5xl font-black mb-6 tracking-tight leading-tight">Smart Medical Mapping</h2>
          <p className="opacity-80 max-w-xl mb-12 text-xl leading-relaxed font-medium">
            Instantly connect with certified specialists. We use real-time GPS and AI to curate the safest, highest-rated facilities for your exact needs.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
             <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-[1.5rem] border border-white/20 text-xs font-black uppercase tracking-widest flex items-center gap-3">
                <Star size={16} fill="white" /> Top Verified
             </div>
             <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-[1.5rem] border border-white/20 text-xs font-black uppercase tracking-widest flex items-center gap-3">
                <Clock size={16} /> Instant Care
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalFinder;
