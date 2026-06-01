import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Loader2, ShieldAlert, CheckCircle, Search } from "lucide-react";
import { toast } from "sonner";

interface ADMSConnection {
  company_id: string;
  sn_mesin: string;
  ip_mesin: string;
  status: string;
  created_at: string;
  realtime: string;
  merk_tipe: string;
}

export default function BlockedMachinesTab() {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ADMSConnection[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchBlockedMachines = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("adms_connections")
      .select("*")
      .eq("status", "BLOCKED")
      .order("created_at", { ascending: false });
    
    if (data) {
      // Group by SN to show unique devices
      const uniqueConns: Record<string, ADMSConnection> = {};
      data.forEach((row) => {
        if (!uniqueConns[row.sn_mesin]) {
          uniqueConns[row.sn_mesin] = row;
        }
      });
      setConnections(Object.values(uniqueConns));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBlockedMachines();
  }, []);

  const handleUnblock = async (sn: string) => {
    try {
      // Just delete the blocked records for this SN so it starts fresh
      const { error } = await supabase.from('adms_connections').delete().eq('sn_mesin', sn);
      if (error) throw error;
      toast.success(`Mesin ${sn} berhasil dibuka blokirannya!`);
      fetchBlockedMachines();
    } catch (err: any) {
      toast.error('Gagal membuka blokir: ' + err.message);
    }
  };

  const filtered = connections.filter(c => 
    c.sn_mesin?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.company_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] dark:text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            Mesin Diblokir
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Daftar mesin ADMS yang diblokir otomatis karena tidak didaftarkan oleh pengguna setelah 2 Jam.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari SN atau Company ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap min-w-max">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/50">
                <th className="px-8 py-5">SN Mesin</th>
                <th className="px-8 py-5">IP Address</th>
                <th className="px-8 py-5">Company ID (Jika ada)</th>
                <th className="px-8 py-5">Waktu Terakhir</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filtered.map((log) => (
                <tr key={log.sn_mesin} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <ShieldAlert className="w-4 h-4" />
                      {log.sn_mesin}
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-sm font-medium text-slate-600 dark:text-slate-400">
                    {log.ip_mesin || "-"}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-600 dark:text-slate-400">
                    {log.company_id || "-"}
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-500 dark:text-slate-400">
                    {new Date(log.realtime || log.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button
                      onClick={() => handleUnblock(log.sn_mesin)}
                      className="px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-xl font-bold flex items-center justify-center gap-2 transform active:scale-95 transition-all text-sm ml-auto"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Buka Blokir
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 dark:text-slate-600" />
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 dark:text-slate-500 font-medium">
                    Tidak ada mesin yang diblokir saat ini.
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
