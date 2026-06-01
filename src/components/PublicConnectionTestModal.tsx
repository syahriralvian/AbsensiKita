import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, RefreshCw, Server, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

interface PublicConnectionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ADMSConnection {
  sn_mesin: string;
  ip_mesin: string;
  realtime: string;
  status: string;
  merk_tipe: string;
  created_at?: string;
  company_id?: string;
}

export default function PublicConnectionTestModal({
  isOpen,
  onClose,
}: PublicConnectionTestModalProps) {
  const [connections, setConnections] = useState<ADMSConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchConnections = async () => {
    // Only show loading on initial fetch if empty
    if (connections.length === 0) setLoading(true);
    
    try {
      // Kita fetch dari tabel adms_connections untuk mesin yang baru konek (mungkin belum ter-assign ke company)
      // Tampilkan 50 koneksi terbaru
      const { data, error } = await supabase
        .from("adms_connections")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        if (error.code === "42P01" || error.code === "PGRST205") {
          // Table does not exist
          setErrorMsg("Tabel 'adms_connections' belum dibuat di Supabase.");
          if (connections.length === 0) setConnections([]);
          return false;
        } else {
          throw error;
        }
      } else {
        // Kick/Block logic: if connection is older than 24 hours, kick and block to avoid queue
        const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
        
        // Group by sn_mesin first to get the absolute latest status
        const latestConns: Record<string, ADMSConnection> = {};
        data.forEach((row) => {
          const sn = row.sn_mesin;
          const current = latestConns[sn];
          
          if (!current) {
            latestConns[sn] = row;
          } else {
            // Priority for REGISTERED status 
            const isRegistered = row.status === 'REGISTERED';
            const currentIsRegistered = current.status === 'REGISTERED';
            
            if (isRegistered && !currentIsRegistered) {
              latestConns[sn] = row;
            } else if (isRegistered && currentIsRegistered) {
              if (getAdjustedTimestamp(row.created_at || row.realtime) > getAdjustedTimestamp(current.created_at || current.realtime)) {
                latestConns[sn] = row;
              }
            } else if (!currentIsRegistered) {
              if (getAdjustedTimestamp(row.created_at || row.realtime) > getAdjustedTimestamp(current.created_at || current.realtime)) {
                latestConns[sn] = row;
              }
            }
          }
        });

        const toBlockIds: string[] = [];
        const validConns: ADMSConnection[] = [];

        Object.values(latestConns).forEach(row => {
          if (row.status === 'BLOCKED') {
            toBlockIds.push(row.sn_mesin);
            return;
          }
          if (row.status === 'REGISTERED' || (row.company_id && row.company_id !== "")) {
            return; // exclude already registered machines from pending list
          }

          const rowTime = getAdjustedTimestamp(row.realtime || row.created_at);
          if (rowTime < cutoffTime) {
            toBlockIds.push(row.sn_mesin);
            return;
          }
          
          validConns.push(row);
        });

        // Perform kick/block action (update status to BLOCKED)
        if (toBlockIds.length > 0) {
          // Run asynchronously without waiting to avoid blocking UI update
          const uniqueBlockIds = [...new Set(toBlockIds)];
          supabase.from('adms_connections').update({ status: 'BLOCKED' })
            .in('sn_mesin', uniqueBlockIds)
            .or('company_id.is.null,company_id.eq.""')
            .then();
        }

        if (validConns.length > 0) {
          setConnections(validConns);
          setErrorMsg(""); // Clear errors if we have valid data
        } else {
          const hasBlocked = Object.values(latestConns).some(row => 
            row.status === 'BLOCKED' || 
            (row.status !== 'REGISTERED' && (!row.company_id || row.company_id === "") && getAdjustedTimestamp(row.realtime || row.created_at) < cutoffTime)
          );
          
          if (hasBlocked) {
             setErrorMsg("Mesin yang terkoneksi sudah ditendang karena melebihi batas waktu (24 Jam) tidak didaftarkan.");
          }
          
          // Switch to empty state
          setConnections([]);
        }
        return true;
      }
    } catch (err: any) {
      console.error(err);
      if (connections.length === 0) {
         if (err?.status === 401 || err?.message?.includes('401') || err?.message?.includes('JWT')) {
           setErrorMsg("Autentikasi Supabase gagal (401 Unauthorized). Periksa pengaturan URL dan Anon Key Anda di Settings.");
         } else {
           setErrorMsg("Gagal memuat data koneksi mesin.");
         }
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timeoutId: any;
    let isSubscribed = true;

    const poll = async () => {
      if (!isSubscribed) return;
      const shouldContinue = await fetchConnections();
      if (isSubscribed && shouldContinue) {
        timeoutId = setTimeout(poll, 3000);
      }
    };

    if (isOpen) {
      poll();
    }
    
    return () => {
      isSubscribed = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Helper to reliably parse timestamp from DB taking into account timezone offset bugs
  const getAdjustedTimestamp = (dateStr: string | null | undefined): number => {
    if (!dateStr) return 0;
    
    let normalizedDate = dateStr;
    if (!dateStr.includes('T') && dateStr.includes(' ')) {
      normalizedDate = dateStr.replace(' ', 'T');
    }
    if (!normalizedDate.includes('+') && !normalizedDate.endsWith('Z')) {
      normalizedDate += 'Z';
    }

    return new Date(normalizedDate).getTime();
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const timestamp = getAdjustedTimestamp(dateStr);
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch (e) {
      return String(dateStr).replace("T", " ").split("+")[0].split(".")[0];
    }
  };

  const formatMerkTipe = (merk: string) => {
    if (!merk || merk === "ADMS Connection" || merk === "ADMS Device") return "Mesin Absensi";
    if (merk === "AGENT_TEST") return "Sistem Webhook";
    return merk;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
              <Server className="w-5 h-5 text-blue-500" />
              Lolos Testing Koneksi
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchConnections}
                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 lg:px-8 custom-scrollbar">
            {errorMsg && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest pl-8 w-[40%] sm:w-[25%]">SN Mesin</th>
                      <th className="hidden sm:table-cell py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest w-[20%]">IP Mesin</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest w-[35%] sm:w-[25%]">RealTime</th>
                      <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest w-[25%] sm:w-[15%]">Status</th>
                      <th className="hidden lg:table-cell py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-widest text-right pr-8 w-[15%]">Merk Tipe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {(() => {
                      if (connections.length > 0) {
                        return connections.map((conn, idx) => {
                          const lastPingTime = getAdjustedTimestamp(conn.realtime || conn.created_at);
                          const isOffline = Date.now() - lastPingTime > 5 * 60 * 1000;
                          return (
                          <tr key={idx} className="hover:bg-white dark:hover:bg-slate-900/50 transition-colors">
                            <td className="py-4 px-6 pl-8 font-mono text-xs">{conn.sn_mesin}</td>
                            <td className="hidden sm:table-cell py-4 px-6 font-mono text-xs text-slate-500">{conn.ip_mesin}</td>
                            <td className="py-4 px-6 text-slate-500 font-mono text-xs">{formatDateTime(conn.realtime || conn.created_at || "")}</td>
                            <td className="py-4 px-6">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                  !isOffline
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {!isOffline ? 'ONLINE' : 'OFFLINE'}
                              </span>
                            </td>
                            <td className="hidden lg:table-cell py-4 px-6 text-right text-slate-500 dark:text-slate-400 font-medium">{formatMerkTipe(conn.merk_tipe)}</td>
                          </tr>
                          )
                        });
                      }
                      return (
                        <tr>
                          <td colSpan={5} className="py-8 px-6 text-center text-slate-500">
                            {loading ? "Memuat data mesin..." : "Belum ada mesin yang terkoneksi."}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 lg:px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
