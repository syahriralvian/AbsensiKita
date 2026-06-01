import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, UserCheck, UserX, CalendarCheck2, Clock4, ChevronRight, ScanFace, X, MapPin, CheckCircle, Loader2, QrCode } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { Attendance, User, Department, Company, Cycle, Shift, Holiday } from "../../types";
import { calculateDistance, checkIsDayOff, getSyncedDate, toLocalDateString, evaluateAttendanceStatus, getShiftForDate } from "../../lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { supabase } from "../../lib/supabase";
import AINoticeWidget from "./AINoticeWidget";

interface MonitoringTabProps {
  stats: { hadir: number; alpha: number; izin: number; telat: number };
  user: User;
  attendances: Attendance[];
  employees: User[];
  departments: Department[];
  shifts: Shift[];
  cycles: Cycle[];
  holidays: Holiday[];
  onOpenAttendance: () => void;
  company: Company | null;
}

export default function MonitoringTab({ 
  stats, 
  user,
  attendances, 
  employees,
  departments,
  shifts,
  cycles,
  holidays,
  onOpenAttendance,
  company
}: MonitoringTabProps) {
  const [selectedDeptId, setSelectedDeptId] = useState<number | "all" | null>("all");
  const [showDetailModal, setShowDetailModal] = useState<{type: 'hadir' | 'alpha' | 'izin' | 'telat' | null, open: boolean}>({ type: null, open: false });
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrToken, setQrToken] = useState<string>("");
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [loadingTrend, setLoadingTrend] = useState(false);

  useEffect(() => {
    const fetchWeeklyTrend = async () => {
      if (!company?.company_id) return;
      setLoadingTrend(true);
      const syncedDate = getSyncedDate();
      const resetTimeStr = localStorage.getItem(`live_reset_time_${company.company_id}`) || "00:00";
      const [resetHour, resetMinute] = resetTimeStr.split(":").map(Number);
      const resetOffsetMs = (resetHour * 60 + resetMinute) * 60 * 1000;
      const logicalNow = new Date(syncedDate.getTime() - resetOffsetMs);
      
      const endDate = new Date(logicalNow);
      const startDate = new Date(logicalNow);
      startDate.setDate(startDate.getDate() - 6);
      
      const startDateStr = toLocalDateString(startDate);
      
      const { data, error } = await supabase
        .from('absensi')
        .select('*')
        .eq('company_id', company.company_id)
        .gte('waktu_masuk', `${startDateStr} 00:00:00`);
        
      if (!error && data) {
        // Group by day
        const trendMap = new Map<string, { hadir: number, telat: number }>();
        for (let i = 0; i < 7; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const dateStr = toLocalDateString(d);
          trendMap.set(dateStr, { hadir: 0, telat: 0 });
        }
        
        // Count hadir and telat
        // We only approximate based on MASUK/IJIN/etc here for speed
        // Getting actual evaluation requires Shift matching per row which is heavy
        // This is a simplified analytic trend
        const byDateNip = new Map<string, Set<string>>();
        const telatSet = new Map<string, Set<string>>();
        
        data.forEach(log => {
          let logDateStr = "";
          try {
            const dateObj = new Date(log.waktu_masuk.replace(' ', 'T'));
            logDateStr = toLocalDateString(dateObj);
          } catch (e) {
            logDateStr = log.waktu_masuk.substring(0, 10);
          }
          
          if (trendMap.has(logDateStr)) {
             if (log.tipe === 'MASUK' || log.tipe === 'PULANG') {
                if (!byDateNip.has(logDateStr)) byDateNip.set(logDateStr, new Set());
                byDateNip.get(logDateStr)!.add(log.nip);
                // approx late check
                if (log.tipe === 'MASUK' && log.late_minutes && log.late_minutes > 0) {
                   if (!telatSet.has(logDateStr)) telatSet.set(logDateStr, new Set());
                   telatSet.get(logDateStr)!.add(log.nip);
                }
             }
          }
        });
        
        const trendArray = Array.from(trendMap.entries()).map(([date, _val]) => {
          const dayName = new Date(date).toLocaleDateString("id-ID", { weekday: 'short' });
          return {
             name: dayName,
             hadir: byDateNip.get(date)?.size || 0,
             telat: telatSet.get(date)?.size || 0
          };
        });
        setWeeklyTrend(trendArray);
      }
      setLoadingTrend(false);
    };
    
    fetchWeeklyTrend();
  }, [company?.company_id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showQRModal) {
      // Initialize immediately
      setQrToken(JSON.stringify({ nip: user.nip, t: Date.now() }));
      // Update every 10 seconds to ensure it is fresh
      interval = setInterval(() => {
        setQrToken(JSON.stringify({ nip: user.nip, t: Date.now() }));
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [showQRModal, user.nip]);

  useEffect(() => {
    setSelectedDeptId("all");
  }, [company?.company_id]);

  const isDayOff = (dateObj: Date, deptId?: number) => {
    const dateStr = toLocalDateString(dateObj);
    const isHoliday = holidays.some(h => h.tanggal === dateStr);
    return isHoliday || checkIsDayOff(dateObj, deptId, departments, cycles);
  };

  const employeesMap = useMemo(() => {
    const map = new Map<string, User>();
    employees.forEach(e => map.set(e.nip, e));
    return map;
  }, [employees]);

  const chartData = [
    { name: 'Hadir', value: stats.hadir, color: '#2563eb' },
    { name: 'Alpha', value: stats.alpha, color: '#ef4444' },
    { name: 'Izin', value: stats.izin, color: '#10b981' },
    { name: 'Telat', value: stats.telat, color: '#f59e0b' },
  ];

  const statusData = useMemo(() => {
    if (!showDetailModal.type) return [];
    
    // Filter by department if selected
    const filteredEmployees = selectedDeptId !== "all"
      ? employees.filter(e => {
        if (selectedDeptId === null) return !e.departemen_id;
        return e.departemen_id === selectedDeptId;
      })
      : employees;

    const resetTimeStr = localStorage.getItem(`live_reset_time_${company?.company_id}`) || "00:00";
    const [resetHour, resetMinute] = resetTimeStr.split(":").map(Number);
    const resetOffsetMs = (resetHour * 60 + resetMinute) * 60 * 1000;
    const logicalNow = new Date(getSyncedDate().getTime() - resetOffsetMs);

    // Group attendances by nip
    const attByNip = new Map<string, Attendance[]>();
    attendances.forEach(a => {
      if (!attByNip.has(a.nip)) attByNip.set(a.nip, []);
      attByNip.get(a.nip)!.push(a);
    });

    return filteredEmployees.filter(emp => {
      let todayAttendances = attByNip.get(emp.nip) || [];
      if (todayAttendances.length > 1) {
        todayAttendances = [...todayAttendances].sort((a,b) => 
          new Date(a.waktu_masuk.replace(' ', 'T')).getTime() - new Date(b.waktu_masuk.replace(' ', 'T')).getTime()
        );
      }
      
      const hasPresence = todayAttendances.some((l) => ['MASUK', 'PULANG', 'KEMBALI', 'KELUAR', 'LEMBUR_MASUK', 'LEMBUR_KELUAR'].includes(l.tipe));
      const firstMasuk = emp.departemen_id && departments.find(d => d.id === emp.departemen_id)?.calculation_rule === 4
        ? todayAttendances.find(a => !['CUTI', 'SAKIT', 'IJIN', 'LUPA_ABSEN', 'KEMBALI', 'KELUAR'].includes(a.tipe))
        : todayAttendances.find(a => a.tipe === 'MASUK');
      const firstIzin = todayAttendances.find(a => ['IJIN', 'SAKIT', 'CUTI', 'LUPA_ABSEN'].includes(a.tipe) && Number(a.status_acc) === 1);
      
      const isOff = isDayOff(logicalNow, emp.departemen_id);

      const isIzin = !!firstIzin;
      const isHadir = hasPresence && !isIzin && !isOff;
      const isTelat = (firstMasuk && !isIzin && !isOff) ? (firstMasuk.late_minutes ?? 0) > 0 : false;
      
      if (showDetailModal.type === 'hadir') return isHadir;
      if (showDetailModal.type === 'telat') return isTelat;
      if (showDetailModal.type === 'alpha') return !hasPresence && !isIzin && !isOff;
      if (showDetailModal.type === 'izin') return isIzin;
      return false;
    });
  }, [showDetailModal.type, selectedDeptId, employees, attendances, departments, company?.company_id]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Ringkasan Live</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">Ringkasan status kehadiran karyawan secara real-time.</p>
        </div>
        <div className="flex gap-3">
          {(user.role === 'USER' || user.role === 'SUPER ADMIN') && (
            <button 
              onClick={() => setShowQRModal(true)}
              className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 px-5 py-3 md:px-6 md:py-4 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 group active:scale-95 border border-slate-200 dark:border-slate-700"
            >
              <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform text-blue-600" /> 
              <span className="tracking-tight">QR Absensi</span>
            </button>
          )}
          {(user.role === 'OWNER' || user.role === 'MASTER_ADMIN') && (
            <button 
              onClick={onOpenAttendance}
              className="bg-blue-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center gap-3 group active:scale-95"
            >
              <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" /> 
              <span className="tracking-tight">Scan Absensi</span>
            </button>
          )}
          {(user.role === 'USER' || user.role === 'SUPER ADMIN') && (
            <button 
              onClick={onOpenAttendance}
              className="bg-blue-600 text-white px-5 py-3 md:px-6 md:py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all flex items-center gap-3 group active:scale-95"
            >
              <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" /> 
              <span className="tracking-tight">Absensi Wajah</span>
            </button>
          )}
        </div>
      </div>

      {(user.role === 'OWNER' || user.role === 'MASTER_ADMIN' || user.role === 'SUPER ADMIN') && (
        <AINoticeWidget 
          attendances={attendances} 
          employees={employees} 
          departments={departments} 
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard icon={<UserCheck className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />} label="Hadir" value={stats.hadir} color="blue" onClick={() => setShowDetailModal({ type: 'hadir', open: true })} />
        <StatCard icon={<UserX className="text-red-600 w-5 h-5 sm:w-6 sm:h-6" />} label="Alpha" value={stats.alpha} color="red" onClick={() => setShowDetailModal({ type: 'alpha', open: true })} />
        <StatCard icon={<CalendarCheck2 className="text-emerald-600 w-5 h-5 sm:w-6 sm:h-6" />} label="Izin" value={stats.izin} color="emerald" onClick={() => setShowDetailModal({ type: 'izin', open: true })} />
        <StatCard icon={<Clock4 className="text-amber-600 w-5 h-5 sm:w-6 sm:h-6" />} label="Telat" value={stats.telat} color="amber" onClick={() => setShowDetailModal({ type: 'telat', open: true })} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        {/* Chart */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col h-auto min-h-[450px] lg:h-[500px]">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Grafik Presensi</h3>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Persentase kehadiran karyawan hari ini</p>
          </div>
          <div className="flex-1 w-full relative h-[250px] min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="90%"
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                    if (percent === 0) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-(midAngle || 0) * RADIAN);
                    const y = cy + radius * Math.sin(-(midAngle || 0) * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[11px] font-bold">
                        {`${((percent || 0) * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                >
                  {chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{value}</span>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Trend Chart */}
        <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900 overflow-hidden relative rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm flex flex-col h-auto min-h-[450px] lg:h-[500px]">
          <div className="p-5 md:p-8">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Tren Absensi Live (7 Hari)</h3>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Estimasi tingkat kehadiran dan keterlambatan</p>
          </div>
          <div className="flex-1 w-full relative h-[300px] min-h-[300px] px-2 md:px-6 pb-6">
            {loadingTrend ? (
               <div className="absolute inset-0 flex items-center justify-center">
                 <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
               </div>
            ) : weeklyTrend.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                 <AreaChart data={weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorTelat" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} allowDecimals={false} />
                   <Tooltip 
                     contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-prose-bg, #fff)' }}
                     cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                   />
                   <Legend verticalAlign="top" align="right" height={30} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}/>
                   <Area type="monotone" dataKey="hadir" name="Hadir" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHadir)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
                   <Area type="monotone" dataKey="telat" name="Telat" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTelat)" activeDot={{ r: 6, strokeWidth: 0, fill: '#f59e0b' }} />
                 </AreaChart>
               </ResponsiveContainer>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-1 gap-4 sm:gap-6 md:gap-8">
        {/* Activity Log */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-5 md:p-8 pb-4 flex justify-between items-center shrink-0">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">Log Aktivitas Live</h3>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Live Updates
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="sticky top-0 bg-white dark:bg-slate-900/80 backdrop-blur-md z-10">
                  <tr className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                    <th className="pl-6 pr-3 py-5">Waktu</th>
                    <th className="px-3 py-5">Nama</th>
                    <th className="px-3 py-5">Tipe</th>
                    <th className="px-3 py-5">Validasi</th>
                    <th className="pl-3 pr-6 py-5 text-right">Bukti Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {attendances.length > 0 ? attendances.slice(0, 20).map((log, index) => (
                    <tr key={`log-${log.id || index}-${log.nip}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950/50 transition-colors group">
                        <td className="pl-6 pr-3 py-5 font-mono tracking-tighter whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-[9px] font-medium text-slate-400 mt-0.5">
                              {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        </td>
                      <td className="px-3 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[13px]">
                            {log.nama?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-xs">{log.nama}</p>
                            <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest opacity-60">NIP: {log.nip}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-5">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                          log.tipe === 'MASUK' || log.tipe === 'LEMBUR_MASUK' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                        }`}>
                          {log.tipe?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-5">
                        <div className="flex flex-col gap-1">
                          {['IJIN', 'SAKIT', 'CUTI', 'LUPA_ABSEN'].includes(log.tipe) ? (
                            <div className={`flex items-center gap-1.5 py-1 px-2.5 rounded-full w-fit ${
                              Number(log.status_acc) === 1 ? 'bg-emerald-50 text-emerald-600' :
                              Number(log.status_acc) === 2 ? 'bg-rose-50 text-rose-600' :
                              'bg-amber-50 text-amber-600'
                            }`}>
                              <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                {Number(log.status_acc) === 1 ? <><CheckCircle className="w-2.5 h-2.5"/> DISETUJUI</> :
                                 Number(log.status_acc) === 2 ? <><X className="w-2.5 h-2.5"/> DITOLAK</> :
                                 <><Loader2 className="w-2.5 h-2.5"/> PENDING</>}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 py-1 px-2.5 bg-emerald-50 rounded-full w-fit">
                              <ScanFace className="w-2.5 h-2.5 text-emerald-500" />
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">AI Verified</span>
                            </div>
                          )}
                          {log.lat && log.lng && (
                            (() => {
                              const emp = employeesMap.get(log.nip);
                              const dept = departments.find(d => d.id === emp?.departemen_id);
                              
                              const targetLat = dept?.lat || company?.office_lat;
                              const targetLng = dept?.lng || company?.office_lng;
                              const targetRadius = dept?.radius || company?.office_radius || 100;

                              if (targetLat && targetLng) {
                                const dist = calculateDistance(log.lat!, log.lng!, targetLat, targetLng);
                                const isWithin = dist <= targetRadius;
                                return (
                                  <div className={`flex items-center gap-1 py-0.5 px-2 rounded-full w-fit border ${isWithin ? 'bg-emerald-50/50 text-emerald-500 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                    <MapPin className="w-2 h-2" />
                                    <span className="text-[8px] font-bold">
                                      {isWithin ? 'Lokasi OK' : `Luar Area ${Math.round(dist)}m`}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()
                          )}
                        </div>
                      </td>
                      <td className="pl-3 pr-6 py-5 text-right w-24">
                        <div className="flex justify-end">
                          {log.image ? (
                            <div className="relative group/photo cursor-pointer" onClick={() => setEnlargedImage(log.image || null)}>
                              <img src={log.image.startsWith('data:image') || log.image.startsWith('http') ? log.image : `data:image/jpeg;base64,${log.image}`} alt="Proof" className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shadow-sm transition-transform group-hover/photo:scale-110 object-center bg-slate-100" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800">
                              <Camera className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="opacity-20 flex flex-col items-center gap-3">
                          <Clock4 className="w-12 h-12 text-slate-500 dark:text-slate-400" />
                          <p className="italic font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">Belum ada aktivitas hari ini</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-4 p-4">
              {attendances.length > 0 ? attendances.slice(0, 15).map((log, index) => (
                <div key={`log-mobile-${log.id || index}`} className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[13px]">
                        {log.nama?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-100 text-xs tracking-tight">{log.nama}</p>
                        <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">NIP: {log.nip}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[8px] font-medium text-slate-400 mt-0.5">
                        {new Date(log.waktu_masuk.replace(' ', 'T')).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                      log.tipe === 'MASUK' || log.tipe === 'LEMBUR_MASUK' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {log.tipe?.replace('_', ' ')}
                    </span>
                    
                    <div className="flex items-center gap-1.5 py-0.5 px-2 bg-emerald-50 rounded-full">
                      <ScanFace className="w-2 h-2 text-emerald-500" />
                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                    </div>

                    {log.lat && log.lng && (
                      (() => {
                        const emp = employeesMap.get(log.nip);
                        const dept = departments.find(d => d.id === emp?.departemen_id);
                        const targetLat = dept?.lat || company?.office_lat;
                        const targetLng = dept?.lng || company?.office_lng;
                        const targetRadius = dept?.radius || company?.office_radius || 100;

                        if (targetLat && targetLng) {
                          const dist = calculateDistance(log.lat!, log.lng!, targetLat, targetLng);
                          const isWithin = dist <= targetRadius;
                          return (
                            <div className={`flex items-center gap-1 py-0.5 px-2 rounded-full border ${isWithin ? 'bg-emerald-50/50 text-emerald-500 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                              <MapPin className="w-2 h-2" />
                              <span className="text-[8px] font-bold">
                                {isWithin ? 'Lokasi OK' : `${Math.round(dist)}m`}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}
                  </div>

                  {log.image && (
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 cursor-pointer" onClick={() => setEnlargedImage(log.image || null)}>
                      <img src={log.image.startsWith('data:image') || log.image.startsWith('http') ? log.image : `data:image/jpeg;base64,${log.image}`} alt="Proof" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              )) : (
                <div className="py-12 text-center opacity-20">
                  <Clock4 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Kosong</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDetailModal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDetailModal({ type: null, open: false })} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 sm:p-5 md:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900/50">
                <div className="flex justify-between items-start sm:items-center w-full sm:w-auto">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex flex-wrap items-center gap-2">
                    <span>
                      {showDetailModal.type === 'hadir' && 'Daftar Kehadiran'}
                      {showDetailModal.type === 'alpha' && 'Tidak Masuk'}
                      {showDetailModal.type === 'izin' && 'Izin / Sakit / Cuti'}
                      {showDetailModal.type === 'telat' && 'Telat Masuk'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">= {statusData.length}</span>
                  </h3>
                  <button 
                    onClick={() => setShowDetailModal({ type: null, open: false })}
                    className="sm:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors shrink-0"
                  >
                    <X className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                  </button>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  <div className="flex flex-1 sm:flex-none items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 sm:px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] hidden sm:inline">Departemen</span>
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] sm:hidden">Dept</span>
                    <select 
                      value={selectedDeptId === null ? "null" : selectedDeptId}
                      onChange={(e) => {
                        const val = (e.target.value || "");
                        if (val === "all") setSelectedDeptId("all");
                        else if (val === "null") setSelectedDeptId(null);
                        else setSelectedDeptId(parseInt(val));
                      }}
                      className="bg-transparent border-none p-0 text-xs font-bold outline-none text-slate-600 dark:text-slate-300 focus:ring-0 uppercase tracking-wider flex-1 sm:flex-none text-right sm:text-left"
                    >
                      <option value="all">Semua Departemen</option>
                      <option value="null">General</option>
                      {departments.filter(d => d.nama_departemen?.toLowerCase() !== "management").map(d => <option key={`dept-${d.id}`} value={d.id}>{d.nama_departemen}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={() => setShowDetailModal({ type: null, open: false })}
                    className="hidden sm:block p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors shrink-0"
                  >
                    <X className="w-6 h-6 text-slate-500 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-0 sm:p-5 md:p-8 custom-scrollbar">
                <table className="w-full text-left whitespace-nowrap min-w-max">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 py-4 sm:pb-5">NIP</th>
                      <th className="px-4 py-4 sm:pb-5">Nama</th>
                      {showDetailModal.type === 'hadir' && (
                        <>
                          <th className="px-4 py-4 sm:pb-5">Pertama</th>
                          <th className="px-4 py-4 sm:pb-5">Terakhir</th>
                        </>
                      )}
                      {showDetailModal.type === 'alpha' && (
                        <th className="px-4 py-4 sm:pb-5">Jam_Kerja</th>
                      )}
                      {showDetailModal.type === 'telat' && (
                        <>
                          <th className="px-4 py-4 sm:pb-5">Masuk</th>
                          <th className="px-4 py-4 sm:pb-5">Telat</th>
                        </>
                      )}
                      {showDetailModal.type === 'izin' && (
                        <>
                          <th className="px-4 py-4 sm:pb-5">Tipe Izin</th>
                          <th className="px-4 py-4 sm:pb-5">Keterangan</th>
                        </>
                      )}
                      <th className="px-4 py-4 sm:pb-5 text-right">Depart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {statusData.map((emp, index) => {
                      const todayAtt = [...attendances.filter(a => a.nip === emp.nip)].sort((a, b) => 
                        new Date(a.waktu_masuk.replace(' ', 'T')).getTime() - new Date(b.waktu_masuk.replace(' ', 'T')).getTime()
                      );
                      
                      const dept = departments.find(d => d.id === emp.departemen_id);
                      let pMasuk: any = null;
                      let pPulang: any = null;

                      if (dept?.calculation_rule === 4) {
                        const allLogs = todayAtt.filter(a => !['CUTI', 'SAKIT', 'IJIN', 'LUPA_ABSEN', 'KEMBALI', 'KELUAR'].includes(a.tipe));
                        if (allLogs.length > 0) {
                          pMasuk = allLogs[0];
                          if (allLogs.length > 1) pPulang = allLogs[allLogs.length - 1];
                        }
                      } else {
                        pMasuk = todayAtt.find(a => a.tipe === 'MASUK');
                        const filteredPulang = todayAtt.filter(a => typeof a.tipe === 'string' && a.tipe.includes('PULANG') && !a.tipe.includes('LEMBUR') && (!pMasuk || new Date(a.waktu_masuk.replace(' ', 'T')).getTime() > new Date(pMasuk.waktu_masuk.replace(' ', 'T')).getTime()));
                        pPulang = filteredPulang.length > 0 ? filteredPulang[filteredPulang.length - 1] : null;
                      }
                      
                      const masuk = pMasuk;
                      const pulang = pPulang;
                      
                      const izin = todayAtt.find(a => ['IJIN','SAKIT','CUTI','LUPA_ABSEN'].includes(a.tipe) && Number(a.status_acc) === 1);

                      return (
                        <tr key={`emp-${emp.nip || index}`} className="group hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950/50 transition-colors">
                          <td className="px-4 py-4 sm:py-5 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 tracking-tighter">{emp.nip}</td>
                          <td className="px-4 py-4 sm:py-5">
                            <p className="font-bold text-slate-700 dark:text-slate-200 uppercase text-xs tracking-tight">{emp.nama}</p>
                          </td>
                          
                          {showDetailModal.type === 'hadir' && (
                            <>
                              <td className="px-4 py-4 sm:py-5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                {masuk ? new Date(masuk.waktu_masuk.replace(' ', 'T')).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                              </td>
                              <td className="px-4 py-4 sm:py-5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                {pulang && pulang !== masuk ? new Date(pulang.waktu_masuk.replace(' ', 'T')).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                              </td>
                            </>
                          )}

                          {showDetailModal.type === 'alpha' && (() => {
                            let expectedShiftName = 'Auto Shift';
                            if (dept?.calculation_rule === 2 && dept.fixed_shift_id) {
                              const s = shifts.find(s => s.id === dept.fixed_shift_id);
                              if (s) expectedShiftName = s.nama_shift;
                            } else if (dept?.calculation_rule === 1 && dept.siklus_id) {
                              const sik = cycles.find(c => c.id === dept.siklus_id);
                              if (sik) {
                                const isWeekly = sik.tipe_periode === 'Mingguan' || sik.tipe_periode === 'WEEKLY';
                                if (isWeekly) {
                                  try {
                                    const parsed = JSON.parse(sik.auto_shift_ids || "{}");
                                    const dayNum = getSyncedDate().getDay();
                                    const config = parsed[dayNum] || parsed[String(dayNum)];
                                    if (config && config.enabled && config.shift_id) {
                                      const s = shifts.find(s => s.id === config.shift_id);
                                      if (s) expectedShiftName = s.nama_shift;
                                    }
                                  } catch(e) {}
                                } else {
                                  try {
                                    const shiftIds = JSON.parse(sik.auto_shift_ids || "[]");
                                    if (Array.isArray(shiftIds) && shiftIds.length > 0) {
                                      const dateObj = getSyncedDate();
                                      const localDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
                                      const daysSinceEpoch = Math.floor(localDate.getTime() / 86400000);
                                      const cycleDay = Math.abs(daysSinceEpoch) % shiftIds.length;
                                      const targetShiftId = shiftIds[cycleDay];
                                      if (targetShiftId) {
                                        const s = shifts.find(s => s.id === targetShiftId);
                                        if (s) expectedShiftName = s.nama_shift;
                                      }
                                    }
                                  } catch(e) {}
                                }
                              }
                            }
                            return (
                              <td className="px-4 py-4 sm:py-5">
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-950/50 rounded-lg px-2 py-1 w-fit border border-slate-100 dark:border-slate-800">
                                  {expectedShiftName}
                                </span>
                              </td>
                            );
                          })()}

                          {showDetailModal.type === 'telat' && (
                            <>
                              <td className="px-4 py-4 sm:py-5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                {masuk ? new Date(masuk.waktu_masuk.replace(' ', 'T')).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                              </td>
                              <td className="px-4 py-4 sm:py-5">
                                <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-xl text-[10px] font-black w-fit">
                                  {masuk?.late_minutes || 0}m
                                </div>
                              </td>
                            </>
                          )}

                          {showDetailModal.type === 'izin' && (
                            <>
                              <td className="px-4 py-4 sm:py-5">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                  izin?.tipe === 'SAKIT' ? 'bg-red-50 text-red-600' :
                                  izin?.tipe === 'CUTI' ? 'bg-blue-50 text-blue-600' :
                                  'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {izin?.tipe || 'IZIN'}
                                </span>
                              </td>
                              <td className="px-4 py-4 sm:py-5 text-[11px] font-medium text-slate-500 dark:text-slate-400 italic max-w-[150px] truncate">
                                {izin?.keterangan || '-'}
                              </td>
                            </>
                          )}

                          <td className="px-4 py-4 sm:py-5 text-right">
                             <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest whitespace-nowrap">{dept?.nama_departemen || '-'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-5 md:p-8 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button className="px-8 py-3.5 bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Tampil</button>
                <button onClick={() => setShowDetailModal({ type: null, open: false })} className="px-8 py-3.5 bg-slate-700 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-700/20 active:scale-95 transition-all">Tutup</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enlarged Image Modal */}
      <AnimatePresence>
        {enlargedImage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-3xl max-h-[90vh] w-full bg-black rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setEnlargedImage(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img 
                src={enlargedImage.startsWith('data:image') || enlargedImage.startsWith('http') ? enlargedImage : `data:image/jpeg;base64,${enlargedImage}`} 
                alt="Enlarged Proof" 
                className="w-full h-full object-contain max-h-[90vh]" 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowQRModal(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 md:p-8 flex flex-col items-center justify-center text-center">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight mb-2">QR Absensi Anda</h3>
                <p className="text-xs text-slate-500 font-medium mb-8">Tunjukkan QR Code ini ke Scanner untuk melakukan absensi. Berubah setiap 10 detik.</p>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
                   <QRCodeSVG value={qrToken} size={250} level="H" includeMargin={true} />
                </div>
                <div className="mt-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black px-6 py-3 rounded-2xl tracking-widest text-[10px] uppercase">
                  {user.nama} • {user.nip}
                </div>
              </div>
              <div className="p-5 md:p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="w-full py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function StatCard({ icon, label, value, color, onClick }: { icon: React.ReactNode, label: string, value: number, color: string, onClick?: () => void }) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50',
    red: 'bg-red-50',
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50'
  };

  return (
    <div 
      onClick={label === 'Hadir' || label === 'Telat' || label === 'Alpha' || label === 'Izin' ? onClick : undefined}
      className={`bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800/60 shadow-sm transition-all duration-500 ${onClick ? 'hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/5 cursor-pointer' : 'cursor-default'} group relative overflow-hidden`}
    >
      <div className="flex items-start justify-between mb-4 sm:mb-6 md:mb-8 relative z-10">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl ${bgColors[color]} flex items-center justify-center transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        {onClick && (
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-black text-[9px] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all uppercase tracking-widest">
            <span className="hidden sm:inline">Lihat </span><ChevronRight className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[9px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-1 md:mb-2">{label}</p>
        <div className="flex items-baseline gap-1 sm:gap-2">
          <h4 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-tight">{value}</h4>
          <span className="text-[9px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Staf</span>
        </div>
      </div>
      {/* Ghost background icon */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-slate-900 dark:text-white group-hover:opacity-[0.05] transition-opacity">
        <div className="scale-[3] sm:scale-[4]">
          {icon}
        </div>
      </div>
    </div>
  );
}
