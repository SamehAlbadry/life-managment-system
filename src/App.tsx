import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Calendar, Settings, Bell, MapPin, Moon, Sun, Play, Square, Loader2, Trash2, Plus } from 'lucide-react';
import { format, isWithinInterval, parse, addDays, subDays } from 'date-fns';
import { cn } from './lib/utils';
import { TimeSlot, PrayerTimes, UserSettings } from './types';
import { INITIAL_SCHEDULE } from './constants';
import { fetchPrayerTimes, getCurrentLocation, reverseGeocode } from './services/prayerService';

export default function App() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'settings'>('schedule');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('barakah_settings');
    const defaults: UserSettings = {
      schedule: INITIAL_SCHEDULE,
      autoPrayerAlarm: true,
      focusMinutes: 25,
      breakMinutes: 5,
      earlyWarningMinutes: 5,
      calculationMethod: 2,
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  });
  const [loading, setLoading] = useState(false);
  const [alarmActive, setAlarmActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Pomodoro State
  const [pomodoro, setPomodoro] = useState<{
    timeLeft: number;
    isActive: boolean;
    mode: 'focus' | 'break';
    totalTime: number;
  }>({
    timeLeft: settings.focusMinutes * 60,
    isActive: false,
    mode: 'focus',
    totalTime: settings.focusMinutes * 60
  });

  // Sound ref for alarm
  const alarmSound = useMemo(() => new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'), []);
  alarmSound.loop = true;

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('barakah_settings', JSON.stringify(settings));
  }, [settings]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Pomodoro countdown logic
      setPomodoro(prev => {
        if (!prev.isActive || prev.timeLeft <= 0) return prev;
        
        // When timer hits zero
        if (prev.timeLeft === 1) {
          setAlarmActive(prev.mode === 'focus' ? 'Focus Session Complete!' : 'Break Over!');
          alarmSound.play().catch(e => console.log('Autoplay blocked', e));
          return { ...prev, timeLeft: 0, isActive: false };
        }
        
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [alarmSound]);

  // Fetch prayer times
  const getPrayers = useCallback(async (lat?: number, lng?: number, method?: number) => {
    setLoading(true);
    try {
      let l = lat, n = lng, m = method || settings.calculationMethod;
      if (!l || !n) {
        const pos = await getCurrentLocation();
        l = pos.coords.latitude;
        n = pos.coords.longitude;
        const name = await reverseGeocode(l!, n!);
        setSettings(prev => ({ ...prev, location: { latitude: l!, longitude: n!, name } }));
      }
      const times = await fetchPrayerTimes(l!, n!, m);
      setPrayerTimes(times);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Could not get prayer times');
    } finally {
      setLoading(false);
    }
  }, [settings.calculationMethod]);

  useEffect(() => {
    if (settings.location) {
      getPrayers(settings.location.latitude, settings.location.longitude, settings.calculationMethod);
    } else {
      getPrayers();
    }
  }, [getPrayers, settings.calculationMethod]);

  // Alarm Check Logic
  useEffect(() => {
    const now = currentTime;
    const nowStr = format(now, 'HH:mm');
    const seconds = now.getSeconds();

    // Check at the start of every minute (00s)
    if (seconds === 0) {
      // 1. Precise Start Alarm
      const activeSlot = settings.schedule.find(slot => slot.from === nowStr);
      if (activeSlot) {
        setAlarmActive(activeSlot.category);
        alarmSound.play().catch(e => console.log('Autoplay blocked', e));
      }

      // 2. Early Warning Alarm
      if (settings.earlyWarningMinutes > 0) {
        const warningTime = new Date(now.getTime() + settings.earlyWarningMinutes * 60000);
        const warningStr = format(warningTime, 'HH:mm');
        const upcomingSlot = settings.schedule.find(slot => slot.from === warningStr);
        if (upcomingSlot) {
          setAlarmActive(`Reminder: ${upcomingSlot.category} starts in ${settings.earlyWarningMinutes} min`);
          alarmSound.play().catch(e => console.log('Autoplay blocked', e));
        }
      }

      // 3. Prayer Times
      if (prayerTimes && settings.autoPrayerAlarm) {
        const prayers = Object.entries(prayerTimes);
        
        // Exact time
        const activePrayer = prayers.find(([_, time]) => time === nowStr);
        if (activePrayer) {
          setAlarmActive(`Time for ${activePrayer[0]} Prayer`);
          alarmSound.play().catch(e => console.log('Autoplay blocked', e));
        }

        // Early warning for prayers
        if (settings.earlyWarningMinutes > 0) {
          const warningTime = new Date(now.getTime() + settings.earlyWarningMinutes * 60000);
          const warningStr = format(warningTime, 'HH:mm');
          const upcomingPrayer = prayers.find(([_, time]) => time === warningStr);
          if (upcomingPrayer) {
            setAlarmActive(`${upcomingPrayer[0]} Prayer in ${settings.earlyWarningMinutes} min`);
            alarmSound.play().catch(e => console.log('Autoplay blocked', e));
          }
        }
      }
    }
  }, [currentTime, settings.schedule, prayerTimes, settings.autoPrayerAlarm, settings.earlyWarningMinutes, alarmSound]);

  const stopAlarm = () => {
    alarmSound.pause();
    alarmSound.currentTime = 0;
    setAlarmActive(null);
  };

  const currentSlot = useMemo(() => {
    const now = format(currentTime, 'HH:mm');
    return settings.schedule.find(slot => {
      const from = slot.from;
      const to = slot.to;
      if (from < to) {
        return now >= from && now < to;
      } else {
        // Overnight slot (e.g., 21:00 to 03:00)
        return now >= from || now < to;
      }
    });
  }, [currentTime, settings.schedule]);

  const nextSlot = useMemo(() => {
    if (!currentSlot) return null;
    const currentIndex = settings.schedule.findIndex(s => s.id === currentSlot.id);
    return settings.schedule[(currentIndex + 1) % settings.schedule.length];
  }, [currentSlot, settings.schedule]);

  const addTimeSlot = () => {
    const newSlot: TimeSlot = {
      id: Math.random().toString(36).substr(2, 9),
      from: '00:00',
      to: '01:00',
      category: 'New Activity',
      color: 'bg-white border-slate-200'
    };
    setSettings(prev => ({
      ...prev,
      schedule: [...prev.schedule, newSlot].sort((a, b) => a.from.localeCompare(b.from))
    }));
  };

  const deleteSlot = (id: string) => {
    setSettings(prev => ({
      ...prev,
      schedule: prev.schedule.filter(s => s.id !== id)
    }));
  };

  const updateSlot = (id: string, field: keyof TimeSlot, value: string) => {
    setSettings(prev => ({
      ...prev,
      schedule: prev.schedule.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const startPomodoro = (mode: 'focus' | 'break') => {
    const minutes = mode === 'focus' ? settings.focusMinutes : settings.breakMinutes;
    setPomodoro({
      timeLeft: minutes * 60,
      isActive: true,
      mode,
      totalTime: minutes * 60
    });
  };

  const togglePomodoro = () => {
    setPomodoro(prev => ({ ...prev, isActive: !prev.isActive }));
  };

  const resetPomodoro = () => {
    const minutes = pomodoro.mode === 'focus' ? settings.focusMinutes : settings.breakMinutes;
    setPomodoro(prev => ({
      ...prev,
      timeLeft: minutes * 60,
      isActive: false,
      totalTime: minutes * 60
    }));
  };

  const formatPomodoroTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const pomodoroProgress = (pomodoro.timeLeft / pomodoro.totalTime) * 100;

  // Google Sheets Logic
  useEffect(() => {
    fetch('/api/auth/status')
      .then(r => r.json())
      .then(data => setIsGoogleConnected(data.isAuthenticated));

    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleConnectGoogle = async () => {
    const res = await fetch('/api/auth/google/url');
    const { url } = await res.json();
    window.open(url, 'google_auth', 'width=600,height=700');
  };

  const exportToSheets = async () => {
    if (!isGoogleConnected) return handleConnectGoogle();
    
    setLoading(true);
    const dateStr = format(currentTime, 'yyyy-MM-dd');
    const reportData = settings.schedule.map(slot => [
      dateStr,
      slot.from,
      slot.to,
      slot.category,
      'Scheduled'
    ]);

    try {
      const res = await fetch('/api/export/sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: reportData,
          sheetId: settings.googleSheetId
        })
      });
      const data = await res.json();
      if (data.success) {
        setSettings(s => ({ ...s, googleSheetId: data.sheetId }));
        alert('Daily report exported successfully!');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to export to Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  // Reusable Section Title Component for Geometric Theme
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center mb-6">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 whitespace-nowrap">
        {children}
      </h2>
      <div className="flex-1 h-[1px] bg-slate-200 ml-3" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="h-18 border-b border-slate-200 bg-white flex items-center justify-between px-10 shrink-0">
        <div className="text-2xl font-black tracking-[-0.05em] text-indigo-500">PULSE.</div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded text-[11px] font-bold uppercase tracking-widest text-slate-500 max-w-[200px] truncate">
          <MapPin className="w-3 h-3" />
          {settings.location?.name || (settings.location ? `${settings.location.latitude.toFixed(2)}°, ${settings.location.longitude.toFixed(2)}°` : 'Location unknown')}
        </div>
      </header>

      {/* Alarm Modal */}
      <AnimatePresence>
        {alarmActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="bg-white rounded p-8 max-w-sm w-full text-center shadow-xl border border-slate-200"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500">
                <Bell className="w-8 h-8" />
              </div>
              <SectionTitle>Alarm Active</SectionTitle>
              <h2 className="text-2xl font-bold mb-8">{alarmActive}</h2>
              <button 
                onClick={stopAlarm}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded font-bold uppercase tracking-widest transition-all"
              >
                Dismiss Alarm
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden grid lg:grid-cols-[320px_1fr_320px]">
        
        {/* Left Panel: Schedule & Prayer (Visible as tab on mobile, static on desktop) */}
        <aside className={cn(
          "bg-white border-r border-slate-200 p-8 overflow-y-auto flex-col h-full",
          activeTab === 'schedule' ? 'flex' : 'hidden lg:flex'
        )}>
          <div className="mb-12">
            <SectionTitle>Prayer Times</SectionTitle>
            <div className="space-y-1">
              {prayerTimes ? (
                (['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).map(p => {
                  const now = format(currentTime, 'HH:mm');
                  const pTime = prayerTimes[p];
                  // Find next prayer logic
                  const isActive = pTime === now; 
                  return (
                    <div key={p} className={cn(
                      "flex justify-between items-center py-3 border-b border-slate-50 last:border-0 transition-colors",
                      isActive && "text-indigo-500 font-bold bg-indigo-50/50 -mx-4 px-4"
                    )}>
                      <span className="text-sm font-medium">{p}</span>
                      <span className={cn(
                        "font-mono text-sm px-2 py-0.5 rounded transition-all",
                        isActive ? "bg-indigo-500 text-white" : "text-slate-500"
                      )}>
                        {pTime}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="space-y-3 pt-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-slate-50 animate-pulse rounded" />)}
                </div>
              )}
            </div>
          </div>

          <div>
            <SectionTitle>Daily Timeline</SectionTitle>
            <div className="space-y-3">
              {settings.schedule.map(slot => (
                <div key={slot.id} className={cn(
                  "p-4 border rounded flex flex-col gap-1 transition-all",
                  currentSlot?.id === slot.id ? "border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500/20" : "border-slate-100 bg-slate-50/20"
                )}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{slot.from} — {slot.to}</span>
                    {currentSlot?.id === slot.id && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                  </div>
                  <span className={cn(
                    "text-sm font-bold tracking-tight line-clamp-1",
                    currentSlot?.id === slot.id ? "text-indigo-600" : "text-slate-700"
                  )}>{slot.category}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Hero Clock */}
        <main className={cn(
          "flex flex-col items-center justify-center text-center p-8 lg:p-20 relative overflow-hidden",
          activeTab === 'schedule' || activeTab === 'settings' ? 'flex lg:flex' : 'hidden lg:flex'
        )}>
           <AnimatePresence mode="wait">
             <motion.div 
               key={currentSlot?.id || 'none'}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="text-lg font-medium text-slate-500 mb-2"
             >
               {currentSlot?.category || 'Time to reflect'}
             </motion.div>
           </AnimatePresence>

           <div className="text-[120px] font-[200] tracking-[-0.04em] leading-none mb-4 text-slate-900 font-sans">
             {format(currentTime, 'HH:mm')}
           </div>

           <div className="text-2xl font-light text-slate-400 mb-12">
             {format(currentTime, 'EEEE, MMMM d')}
           </div>

           {/* Progress Line */}
           <div className="w-full max-w-sm h-1 bg-slate-200 rounded-full relative mb-12">
              <motion.div 
                className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full"
                style={{ width: `${(currentTime.getSeconds() / 60) * 100}%` }}
              />
           </div>

           {/* Pomodoro Timer Section */}
           <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6 mb-12 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
             <div className="absolute top-0 left-0 w-full h-[2px] bg-slate-100">
               <motion.div 
                 className={cn("h-full transition-all duration-1000", pomodoro.mode === 'focus' ? "bg-indigo-500" : "bg-emerald-500")}
                 style={{ width: `${100 - pomodoroProgress}%` }}
               />
             </div>
             
             <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-2">
                 <div className={cn("w-2 h-2 rounded-full", pomodoro.mode === 'focus' ? "bg-indigo-500" : "bg-emerald-500")} />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                   {pomodoro.mode === 'focus' ? 'Deep Work' : 'Rest Phase'}
                 </span>
               </div>
               <span className="text-xs font-mono font-medium text-slate-400">
                 {formatPomodoroTime(pomodoro.timeLeft)}
               </span>
             </div>

             <div className="flex gap-2">
               <button 
                 onClick={togglePomodoro}
                 className={cn(
                   "flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all",
                   pomodoro.isActive 
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                    : (pomodoro.mode === 'focus' ? "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20")
                 )}
               >
                 {pomodoro.isActive ? 'Pause' : 'Resume'}
               </button>
               <button 
                 onClick={resetPomodoro}
                 className="px-4 py-2 bg-white border border-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
               >
                 <Trash2 className="w-3 h-3" />
               </button>
             </div>
           </div>

           <div className="flex flex-wrap justify-center gap-4">
             <button 
               onClick={() => startPomodoro('focus')}
               className="px-10 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-500/20 active:translate-y-0.5"
             >
               START FOCUS
             </button>
             <button 
               onClick={() => startPomodoro('break')}
               className="px-10 py-3 border border-slate-200 hover:bg-white text-slate-500 rounded font-bold uppercase tracking-widest text-xs transition-all"
             >
               BREAK
             </button>
           </div>
        </main>

        {/* Right Panel: Settings (Tab 2 on mobile, static on desktop) */}
        <aside className={cn(
          "bg-slate-50/50 border-l lg:border-slate-200 p-8 overflow-y-auto flex-col h-full",
          activeTab === 'settings' ? 'flex' : 'hidden lg:flex'
        )}>
          <div className="mb-10">
            <SectionTitle>Focus Settings</SectionTitle>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Focus Session</label>
                  <div className="flex items-center gap-2 bg-white p-3 rounded border border-slate-200">
                    <input 
                      type="number"
                      value={settings.focusMinutes}
                      onChange={(e) => setSettings(s => ({ ...s, focusMinutes: parseInt(e.target.value) || 0 }))}
                      className="w-full text-sm font-bold bg-transparent outline-none"
                    />
                    <span className="text-[10px] text-slate-400">MIN</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Early Warning</label>
                  <div className="flex items-center gap-2 bg-white p-3 rounded border border-slate-200">
                    <input 
                      type="number"
                      value={settings.earlyWarningMinutes}
                      onChange={(e) => setSettings(s => ({ ...s, earlyWarningMinutes: parseInt(e.target.value) || 0 }))}
                      className="w-full text-sm font-bold bg-transparent outline-none"
                    />
                    <span className="text-[10px] text-slate-400">MIN</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data & Export</label>
                <div className="space-y-3">
                  <button 
                    onClick={isGoogleConnected ? exportToSheets : handleConnectGoogle}
                    className={cn(
                      "w-full py-3 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                      isGoogleConnected ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-slate-600"
                    )}
                  >
                    {isGoogleConnected ? 'EXPORT TO SHEETS' : 'CONNECT GOOGLE SHEETS'}
                  </button>
                  {settings.googleSheetId && (
                    <a 
                      href={`https://docs.google.com/spreadsheets/d/${settings.googleSheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-[10px] font-medium text-slate-400 underline"
                    >
                      View Current Sheet
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Calculation Method</label>
                <select 
                  value={settings.calculationMethod}
                  onChange={(e) => setSettings(s => ({ ...s, calculationMethod: parseInt(e.target.value) }))}
                  className="w-full bg-white p-3 rounded border border-slate-200 text-sm font-medium"
                >
                  <option value={1}>University of Islamic Sciences, Karachi</option>
                  <option value={2}>Islamic Society of North America (ISNA)</option>
                  <option value={3}>Muslim World League</option>
                  <option value={4}>Umm Al-Qura University, Makkah</option>
                  <option value={5}>Egyptian General Authority of Survey</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prayer Alarms</label>
                <div className="flex justify-between items-center bg-white p-3 rounded border border-slate-200">
                  <span className="text-sm font-medium">Automatic Alerts</span>
                  <button 
                    onClick={() => setSettings(s => ({ ...s, autoPrayerAlarm: !s.autoPrayerAlarm }))}
                    className={cn(
                      "text-xs font-bold px-3 py-1 rounded",
                      settings.autoPrayerAlarm ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {settings.autoPrayerAlarm ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Current Schedule</label>
                <div className="space-y-4">
                   {settings.schedule.map(slot => (
                     <div key={slot.id} className="bg-white p-4 rounded border border-slate-200 space-y-3 group relative">
                       <div className="flex gap-2">
                         <input 
                           type="time" 
                           value={slot.from} 
                           onChange={(e) => updateSlot(slot.id, 'from', e.target.value)}
                           className="flex-1 bg-slate-50 text-xs font-mono p-1.5 rounded border border-slate-100 hover:border-slate-200"
                         />
                         <input 
                           type="time" 
                           value={slot.to} 
                           onChange={(e) => updateSlot(slot.id, 'to', e.target.value)}
                           className="flex-1 bg-slate-50 text-xs font-mono p-1.5 rounded border border-slate-100 hover:border-slate-200"
                         />
                       </div>
                       <input 
                         type="text" 
                         value={slot.category} 
                         onChange={(e) => updateSlot(slot.id, 'category', e.target.value)}
                         className="w-full text-sm font-bold bg-transparent border-b border-transparent focus:border-indigo-500 outline-none pb-1 transition-all"
                       />
                       <button 
                         onClick={() => deleteSlot(slot.id)}
                         className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                       >
                         <Trash2 className="w-3 h-3" />
                       </button>
                     </div>
                   ))}
                   <button 
                    onClick={addTimeSlot}
                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded text-slate-300 hover:border-indigo-300 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                   >
                     <Plus className="w-4 h-4" /> ADD SESSION
                   </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-auto pt-8">
             <button 
               onClick={() => confirm('Clear all customizations?') && setSettings(s => ({ ...s, schedule: INITIAL_SCHEDULE }))}
               className="w-full py-3 bg-white border border-slate-200 rounded text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
             >
               Reset Defaults
             </button>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation Bar */}
      <nav className="lg:hidden h-20 border-t border-slate-200 bg-white flex items-center px-6 shrink-0">
        <button 
          onClick={() => setActiveTab('schedule')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-2 rounded transition-all",
            activeTab === 'schedule' ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-400'
          )}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest">Dash</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-2 rounded transition-all",
            activeTab === 'settings' ? 'text-indigo-600 bg-indigo-50 font-bold' : 'text-slate-400'
          )}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] uppercase tracking-widest">Setup</span>
        </button>
      </nav>
    </div>
  );
}

