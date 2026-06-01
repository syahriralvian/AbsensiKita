import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Loader2, Globe, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TrafficTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTraffic();
  }, []);

  const fetchTraffic = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("target_table", "PAGE_VISIT")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setLogs(data);
    setLoading(false);
  };

  const chartDataMap: Record<string, number> = {};
  [...logs].reverse().forEach(log => {
    const d = new Date(log.created_at);
    const dateStr = d.toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
    chartDataMap[dateStr] = (chartDataMap[dateStr] || 0) + 1;
  });
  const chartData = Object.keys(chartDataMap).map(k => ({ name: k, visits: chartDataMap[k] }));

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] dark:text-white tracking-tight">
          Traffic Monitor
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
          Pantau lalulalang pengunjung yang mengakses halaman login website.
        </p>
      </div>

      {!loading && chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm p-6 lg:p-8 h-[350px]">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-6 px-2">Tren Traffic</h2>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tw-prose-bg, #fff)' }}
                  cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="visits" name="Pengunjung" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-slate-100 dark:border-slate-800/60">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Log Kunjungan Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-max">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/50">
                <th className="px-8 py-5">Waktu</th>
                <th className="px-8 py-5">IP Address</th>
                <th className="px-8 py-5">Halaman</th>
                <th className="px-8 py-5">User Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {logs.slice(0, 100).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Activity className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        {new Date(log.created_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-sm font-medium text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-slate-400" />
                      {log.ip_address || "Unknown"}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {log.target_id || "Auth"}
                  </td>
                  <td className="px-8 py-5 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[300px]">
                    {log.new_data?.userAgent || "-"}
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 dark:text-slate-600" />
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Belum ada data traffic yang tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
