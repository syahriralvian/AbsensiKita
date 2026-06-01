import { useState, useEffect } from "react";
import { 
  Smartphone, 
  Trash2, 
  RefreshCcw, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Globe,
  Lock,
  Cpu,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { confirmDialog } from '../../lib/confirmDialog';

interface ADMSConnection {
  sn_mesin: string;
  ip_mesin: string;
  realtime: string;
  created_at: string;
  status: string;
  merk_tipe: string;
  company_id: string;
  timezone?: string;
}

interface RegisteredDevicesTabProps {
  activeCompanyId: string;
}

export default function RegisteredDevicesTab({ activeCompanyId }: RegisteredDevicesTabProps) {
  const [machines, setMachines] = useState<ADMSConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<ADMSConnection | null>(null);
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [machineQueue, setMachineQueue] = useState<any[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  const fetchQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const { data, error } = await supabase
        .from('machine_commands')
        .select('*')
        .eq('company_id', activeCompanyId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMachineQueue(data || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Gagal memuat antrian mesin.');
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleResyncAll = async (sn: string) => {
    setIsResyncing(true);
    try {
      // Ambil seluruh karyawan untuk aktif company
      const { data: employees, error: fetchError } = await supabase
        .from("karyawan")
        .select("*")
        .eq("company_id", activeCompanyId);
        
      if (fetchError) throw fetchError;
      
      if (!employees || employees.length === 0) {
        toast.info("Tidak ada staff yang perlu disinkronkan.");
        return;
      }
      
      // Siapkan batch data
      const commands = employees.map(emp => {
        const priv = emp.role === "SUPER ADMIN" || emp.role === "MASTER_ADMIN" ? 14 : 0;
        const cmdStr = `${sn}|DATA UPDATE userinfo PIN=${emp.nip}\tName=${emp.nama}\tPrivilege=${priv}${emp.nfc_uid ? `\tCard=${emp.nfc_uid}` : ''}`;
        
        return {
          company_id: activeCompanyId,
          command: cmdStr,
          status: "PENDING"
        };
      });
      
      const { error: insertError } = await supabase.from("machine_commands").insert(commands);
      if (insertError) throw insertError;
      
      toast.success(`${commands.length} data staff telah masuk antrian mesin.`);
      setConfirmResync(null);
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal sinkronisasi data: " + e.message);
    } finally {
      setIsResyncing(false);
    }
  };

  const [isDeletingQueue, setIsDeletingQueue] = useState(false);
  const [confirmDeleteQueue, setConfirmDeleteQueue] = useState(false);
  const [confirmResync, setConfirmResync] = useState<string | null>(null);

  const handleDeleteQueue = async () => {
    setIsDeletingQueue(true);
    try {
      // Coba hapus dulu
      const { error } = await supabase
        .from('machine_commands')
        .delete()
        .eq('company_id', activeCompanyId)
        .eq('status', 'PENDING');
        
      if (error) {
        throw error;
      }
      
      // Karena RLS bisa membuat delete() return success tapi 0 row terhapus,
      // kita coba update status jadi CANCELLED sebagai fallback juga.
      await supabase
        .from('machine_commands')
        .update({ status: 'CANCELLED' })
        .eq('company_id', activeCompanyId)
        .eq('status', 'PENDING');
      
      toast.success('Seluruh antrian mesin berhasil dihapus.');
      setMachineQueue([]);
      if (isQueueModalOpen) fetchQueue();
      setConfirmDeleteQueue(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Gagal menghapus antrian: ' + e.message);
    } finally {
      setIsDeletingQueue(false);
    }
  };

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("adms_connections")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") {
          setErrorMsg("Tabel 'adms_connections' belum tersedia.");
        } else {
          throw error;
        }
      } else {
        const latestConns: Record<string, ADMSConnection> = {};
        
        // Group by sn_mesin to merge registration status and latest heartbeat
        (data || []).forEach((row) => {
          const sn = row.sn_mesin;
          const current = latestConns[sn];
          
          if (!current) {
            latestConns[sn] = { ...row };
          } else {
            // Priority for REGISTERED status 
            const isRegToMe = row.status === 'REGISTERED' && row.company_id === activeCompanyId;
            const currentIsRegToMe = current.status === 'REGISTERED' && current.company_id === activeCompanyId;
            
            const isRegAny = row.status === 'REGISTERED';
            const currentIsRegAny = current.status === 'REGISTERED';

            const isManualRegRow = row.ip_mesin === 'Manual Registration';
            const currentIsManualRegRow = current.ip_mesin === 'Manual Registration';
            
            const rowTime = getAdjustedTimestamp(row.realtime || row.created_at);
            const currentTime = getAdjustedTimestamp(current.realtime || current.created_at);
            
            if (!isManualRegRow && currentIsManualRegRow) {
               current.ip_mesin = row.ip_mesin;
               current.realtime = row.realtime;
            } else if (rowTime > currentTime && !isManualRegRow) {
               current.ip_mesin = row.ip_mesin;
               current.realtime = row.realtime;
               current.created_at = row.created_at; // update created_at to latest ping
            }

            // Steal registration status if it's better
            if (isRegToMe && !currentIsRegToMe) {
               current.status = row.status;
               current.company_id = row.company_id;
               if (row.timezone) current.timezone = row.timezone; // take the registered timezone
            } else if (isRegAny && !currentIsRegToMe && !currentIsRegAny) {
               current.status = row.status;
               current.company_id = row.company_id;
            }
          }
        });
        
        setMachines(Object.values(latestConns));
        setErrorMsg("");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memuat data mesin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
    const interval = setInterval(fetchMachines, 15000); 
    return () => clearInterval(interval);
  }, [activeCompanyId]);

  const [isAcquiring, setIsAcquiring] = useState<string | null>(null);
  const [confirmSn, setConfirmSn] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const startAcquisition = (sn: string) => {
    setIsAcquiring(sn);
    setConfirmSn("");
    setCountdown(60);
    toast.info(`Memulai akuisisi mesin. Harap masukkan Serial Number lengkap.`);
  };

  const handleRegister = async (sn: string) => {
    if (!sn || isVerifying) return;
    
    if (confirmSn.trim().toUpperCase() !== sn.toUpperCase()) {
      toast.error("Serial Number yang dimasukkan tidak cocok!");
      return;
    }
    
    if (!activeCompanyId) {
      toast.error("ID Perusahaan tidak ditemukan. Silakan muat ulang halaman.");
      return;
    }

    setIsVerifying(true);
    
    try {
      // 1. Check if already registered by someone else
      const { data: existingData, error: checkError } = await supabase
        .from("adms_connections")
        .select("company_id, status")
        .eq("sn_mesin", sn)
        .eq("status", "REGISTERED")
        .neq("company_id", activeCompanyId);

      if (checkError) throw checkError;

      if (existingData && existingData.length > 0) {
        toast.error("Mesin ini sudah terdaftar di organisasi lain. Hubungi support jika ini kesalahan.");
        setIsVerifying(false);
        return;
      }

      // 2. Perform actual registration for all instances of this SN
      const { data: updateData, error } = await supabase
        .from("adms_connections")
        .update({ 
          status: "REGISTERED",
          company_id: activeCompanyId,
          merk_tipe: "Mesin Absensi (ADMS)" // Ensure it has a name
        })
        .eq("sn_mesin", sn)
        .select();
      
      if (error) throw error;

      if (!updateData || updateData.length === 0) {
        // If no rows updated, maybe it's a new SN not yet in DB?
        // Let's try inserting it
        const { error: insertError } = await supabase
          .from("adms_connections")
          .insert({
            sn_mesin: sn,
            status: "REGISTERED",
            company_id: activeCompanyId,
            ip_mesin: "Manual Registration",
            merk_tipe: "Mesin Absensi (ADMS)"
          });
        
        if (insertError) throw insertError;
      }
      
      toast.success(`Mesin ${sn} berhasil diregistrasi!`);
      setIsAcquiring(null);
      setCountdown(0);
      fetchMachines();
    } catch (e: any) {
      console.error("Registration Error:", e);
      toast.error("Gagal registrasi mesin: " + (e.message || "Unknown error"));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnregister = async (sn: string) => {
    if (!(await confirmDialog(`Hapus registrasi mesin ${sn}? Mesin akan dilepaskan dari organisasi Anda.`))) return;
    try {
      const { error } = await supabase
        .from("adms_connections")
        .update({ 
          status: "ONLINE",
          company_id: "" 
        })
        .eq("sn_mesin", sn);

      if (error) throw error;
      
      // Delete any pending commands for this machine
      await supabase
        .from('machine_commands')
        .delete()
        .eq('company_id', activeCompanyId)
        .like('command', `${sn}|%`);

      toast.success(`Registrasi mesin ${sn} telah dihapus.`);
      fetchMachines();
      fetchQueue();
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal menghapus registrasi: " + e.message);
    }
  };

  const handleUpdateTimezone = async (sn: string, timezone: string) => {
    setIsUpdatingTimezone(true);
    try {
      // 1. Update the connection record
      const { error: updateError } = await supabase
        .from("adms_connections")
        .update({ timezone })
        .eq("sn_mesin", sn);

      if (updateError) throw updateError;

      // 2. Map timezone to hours offset for ADMS (ZK devices usually use hours like 7, 8, 9 or 07:00)
      let offset = "7"; // Default Jakarta
      if (timezone === 'Asia/Makassar') offset = "8";
      if (timezone === 'Asia/Jayapura') offset = "9";

      // 3. Insert command for the machine with SN prefixed so we can route it correctly
      // Format: SN|COMMAND
      const { error: cmdError } = await supabase
        .from("machine_commands")
        .insert({
          company_id: activeCompanyId,
          command: `${sn}|SET OPTION TimeZone=${offset}`,
          status: "PENDING"
        });

      if (cmdError) {
        console.warn("Failed to insert command to machine_commands, but record updated.", cmdError);
      }

      toast.success(`Zona waktu mesin ${sn} berhasil diubah ke ${timezone}. Mesin mungkin perlu direstart agar jam di layar diperbarui.`);
      fetchMachines();
      setSelectedMachine(null);
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal mengubah zona waktu: " + e.message);
    } finally {
      setIsUpdatingTimezone(false);
    }
  };

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

  const formatDateTime = (dateStr: string, timezone: string = 'Asia/Jakarta') => {
    if (!dateStr || dateStr === "-") return "-";
    const targetTz = timezone || 'Asia/Jakarta';
    try {
      const timestamp = getAdjustedTimestamp(dateStr);
      const date = new Date(timestamp);
      
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: targetTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);
    } catch (e) {
      console.error("Format date error:", e);
      return String(dateStr).replace("T", " ").split("+")[0].split(".")[0];
    }
  };

  const formatMerkTipe = (merkTipe: string) => {
    if (!merkTipe) return "Mesin Absensi (ADMS)";
    if (merkTipe.length < 3 || merkTipe === "Pending Connection") return "Menunggu Koneksi...";
    return merkTipe;
  };

  const myMachines = machines.filter(m => m.company_id === activeCompanyId);
  const availableMachines = machines.filter(m => {
    const isReg = m.status === 'REGISTERED';
    const isBlocked = m.status === 'BLOCKED';
    const hasCompany = m.company_id && m.company_id !== "";
    
    // Calculate last active time
    const lastTime = getAdjustedTimestamp(m.realtime || m.created_at);
    // Show if detected within the last 24 hours
    const isRecent = Date.now() - lastTime < 24 * 60 * 60 * 1000; 
    
    return !isReg && !isBlocked && !hasCompany && isRecent;
  });

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            Registrasi Mesin
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl text-lg">
            Hubungkan mesin fingerprint ADMS Anda ke infrastruktur cloud organisasi secara aman.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => {
              setIsQueueModalOpen(true);
              fetchQueue();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl font-bold text-sm tracking-wide hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all shadow-sm active:scale-95"
          >
            <Clock className="w-4 h-4" />
            Antrian Sinkronisasi
          </button>
          <button 
            onClick={fetchMachines}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm tracking-wide hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Mesin Organisasi Anda
              </h3>
              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                {myMachines.length} AKTIF
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {myMachines.length > 0 ? (
                myMachines.map((m) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={m.sn_mesin}
                    className="p-6 bg-white dark:bg-slate-900 border-2 border-emerald-500/10 dark:border-emerald-500/5 rounded-[2rem] shadow-sm relative group hover:shadow-xl hover:shadow-emerald-500/5 transition-all"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-500">
                          <Smartphone className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">{m.sn_mesin}</h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatMerkTipe(m.merk_tipe)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const lastPingTime = getAdjustedTimestamp(m.realtime || m.created_at);
                          const isOffline = Date.now() - lastPingTime > 5 * 60 * 1000;
                          return (
                            <>
                              <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                              <span className={`text-[10px] font-black uppercase ${isOffline ? 'text-red-500' : 'text-emerald-500'}`}>
                                {isOffline ? 'OFFLINE' : 'ONLINE'}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase">
                        <span className="text-slate-400">IP ADDRESS</span>
                        <span className="text-slate-700 dark:text-slate-200 font-mono">{m.ip_mesin}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase">
                        <span className="text-slate-400">TIMEZONE</span>
                        <span className="text-blue-600 dark:text-blue-400 font-mono">{m.timezone || 'Asia/Jakarta'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-bold uppercase">
                        <span className="text-slate-400">LAST SYNC</span>
                        <span className="text-slate-700 dark:text-slate-200 font-mono">{formatDateTime(m.realtime || m.created_at, m.timezone)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button 
                        onClick={() => setSelectedMachine(m)}
                        className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all flex items-center justify-center gap-2"
                      >
                        <Globe className="w-3 h-3" />
                        Pengaturan
                      </button>
                      <button 
                        onClick={() => handleUnregister(m.sn_mesin)}
                        className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all"
                      >
                        Hapus Mesin
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-16 px-6 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center text-slate-200 dark:text-slate-700 mb-6 shadow-sm">
                    <Smartphone className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-black text-slate-400 dark:text-slate-600 mb-2 uppercase tracking-tight">Belum Ada Mesin Terdaftar</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[300px] font-medium leading-relaxed">
                    Daftarkan mesin Anda dari daftar "Tersedia" di bawah ini untuk mulai menarik data absensi cloud.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Terdeteksi & Belum Diregistrasi
              </h3>
              <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                {availableMachines.length} BARU
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {availableMachines.map((m) => {
                  const lastPingTime = getAdjustedTimestamp(m.realtime || m.created_at);
                  const isOffline = Date.now() - lastPingTime > 5 * 60 * 1000;
                  const maskedSn = m.sn_mesin.length > 5 ? m.sn_mesin.substring(0, 4) + '****' + m.sn_mesin.substring(m.sn_mesin.length - 3) : m.sn_mesin;
                  return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    key={m.sn_mesin}
                    className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <Smartphone className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tighter uppercase">{maskedSn}</p>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-[9px] font-black tracking-widest uppercase">
                            TERSEDIA
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase ${isOffline ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'}`}>
                            {isOffline ? 'OFFLINE' : 'ONLINE'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                            <Globe className="w-3.5 h-3.5" /> {m.ip_mesin}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                            <Cpu className="w-3.5 h-3.5" /> {formatMerkTipe(m.merk_tipe)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      disabled={isOffline}
                      onClick={() => !isOffline && startAcquisition(m.sn_mesin)}
                      className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all whitespace-nowrap ${isOffline ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95'}`}
                    >
                      Registrasi Sekarang
                    </button>
                  </motion.div>
                )})}
              </AnimatePresence>
              {availableMachines.length === 0 && (
                <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] text-center">
                  <p className="text-sm font-bold text-slate-400">Tidak ada mesin baru yang terdeteksi.</p>
                </div>
              )}
            </div>
          </section>

          {/* Acquisition Overlay/Modal UI */}
          <AnimatePresence>
            {selectedMachine && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden pointer-events-auto"
                >
                  <div className="flex justify-between items-start shrink-0 z-20 gap-4 p-6 sm:p-8 md:p-10 pb-0 sm:pb-0 md:pb-0">
                    <div className="flex gap-4 items-center">
                      <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 shrink-0">
                        <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter italic">Pengaturan</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm tracking-tight break-all">SN: {selectedMachine.sn_mesin}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedMachine(null)}
                      className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all shrink-0 cursor-pointer"
                    >
                      <X className="w-5 h-5 sm:w-6 sm:h-6 pointer-events-none" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 relative z-10 space-y-6 custom-scrollbar min-h-0 overscroll-contain">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Zona Waktu (Timezone)</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'Asia/Jakarta', label: 'WIB (GMT+7)', desc: 'Jakarta, Surabaya, Medan' },
                          { id: 'Asia/Makassar', label: 'WITA (GMT+8)', desc: 'Bali, Makassar, Banjarmasin' },
                          { id: 'Asia/Jayapura', label: 'WIT (GMT+9)', desc: 'Papua, Maluku' }
                        ].map((tz) => (
                          <button
                            key={tz.id}
                            onClick={() => handleUpdateTimezone(selectedMachine.sn_mesin, tz.id)}
                            disabled={isUpdatingTimezone}
                            className={`p-4 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${
                              (selectedMachine.timezone || 'Asia/Jakarta') === tz.id 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800'
                            }`}
                          >
                            <div>
                              <p className={`font-black text-xs uppercase tracking-tight ${
                                (selectedMachine.timezone || 'Asia/Jakarta') === tz.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                              }`}>
                                {tz.label}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">{tz.desc}</p>
                            </div>
                            {(selectedMachine.timezone || 'Asia/Jakarta') === tz.id && (
                              <CheckCircle2 className="w-5 h-5 text-blue-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="space-y-3">
                        <button 
                          onClick={() => {
                            if (confirmResync === selectedMachine.sn_mesin) {
                              handleResyncAll(selectedMachine.sn_mesin);
                            } else {
                              setConfirmResync(selectedMachine.sn_mesin);
                              setTimeout(() => setConfirmResync(null), 3000);
                            }
                          }}
                          disabled={isResyncing}
                          className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                        >
                          {isResyncing ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RefreshCcw className={`w-4 h-4 ${confirmResync === selectedMachine.sn_mesin ? 'animate-pulse' : ''}`} />}
                          {confirmResync === selectedMachine.sn_mesin ? 'Klik Sekali Lagi untuk Kirim' : 'Resinkron Data Staff ke Mesin'}
                        </button>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed text-center italic">
                          * Klik jika ingin mengirim ulang seluruh profil staff ke antrian Sinkronisasi Mesin.
                        </p>
                      </div>
                      
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                        <button 
                          onClick={() => {
                            if (confirmDeleteQueue) {
                              handleDeleteQueue();
                            } else {
                              setConfirmDeleteQueue(true);
                              setTimeout(() => setConfirmDeleteQueue(false), 3000);
                            }
                          }}
                          disabled={isDeletingQueue}
                          className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                        >
                          {isDeletingQueue ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 pointer-events-none" />}
                          {confirmDeleteQueue ? 'Klik Sekali Lagi untuk Menghapus' : 'Hapus Seluruh Antrian Mesin'}
                        </button>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed text-center italic">
                          * Menghapus seluruh antrian data dan perintah yang belum terkirim ke mesin.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 border border-slate-100 dark:border-slate-700">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-relaxed">
                        1. Zona waktu ini akan digunakan oleh sistem untuk mengonversi timestamp absensi yang masuk, agar sesuai dengan zona waktu perusahaan Anda.
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-relaxed italic">
                        2. Catatan Hardware: Karena keterbatasan sinkronisasi ADMS pada beberapa versi mesin, jika jam pada layar fisik mesin tidak ikut berubah secara otomatis, silakan update atau restart jam secara manual di menu mesin (Menu &gt; Sistem &gt; Tanggal/Waktu).
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {isAcquiring && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 font-black text-9xl">
                    ADMS
                  </div>

                  <div className="relative z-10 text-center space-y-4">
                    <div className="space-y-3 pt-6">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter italic">Langkah Akusisi Mesin</h3>
                      <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed">
                        Masukkan Serial Number Penuh (SN) yang tertera di belakang mesin untuk mengonfirmasi akses fisik.
                      </p>
                    </div>

                    <div className="text-left mt-6">
                      <input 
                        type="text" 
                        value={confirmSn}
                        onChange={(e) => setConfirmSn(e.target.value)}
                        placeholder="Contoh: CPAK221060305"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-lg text-slate-800 dark:text-slate-100 uppercase tracking-wider focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition-all placeholder:font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-col gap-3 pt-4">
                      <button 
                        disabled={isVerifying || confirmSn.trim().length < 5}
                        onClick={() => handleRegister(isAcquiring)}
                        className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/40 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCcw className="w-5 h-5 animate-spin" />
                            Memverifikasi...
                          </>
                        ) : (
                          "Verifikasi Kepemilikan"
                        )}
                      </button>
                      <button 
                        disabled={isVerifying}
                        onClick={() => { setIsAcquiring(null); setCountdown(0); }}
                        className="w-full py-4 text-slate-400 hover:text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        Batalkan Sesi
                      </button>
                    </div>

                    <div className="pt-4 flex items-center justify-center gap-2 border-t border-slate-100 dark:border-slate-800">
                       <AlertCircle className="w-4 h-4 text-amber-500" />
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Menghindari penyusup meregistrasi mesin dari luar</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
            {/* Queue Modal */}
            {isQueueModalOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] shadow-2xl relative overflow-hidden pointer-events-auto"
                >
                  <div className="flex justify-between items-start shrink-0 z-20 gap-4 p-6 sm:p-8 md:p-10 pb-0 sm:pb-0 md:pb-0">
                    <div className="flex items-center gap-4">
                      <div className="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 shrink-0">
                        <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter italic">Antrian Sinkronisasi</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm tracking-tight">{machineQueue.length} Perintah Menunggu</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={fetchQueue}
                        disabled={isLoadingQueue}
                        className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 rounded-2xl transition-all cursor-pointer"
                      >
                        <RefreshCcw className={`w-5 h-5 sm:w-6 sm:h-6 pointer-events-none ${isLoadingQueue ? 'animate-spin' : ''}`} />
                      </button>
                      <button 
                        onClick={() => setIsQueueModalOpen(false)}
                        className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all cursor-pointer"
                      >
                        <X className="w-5 h-5 sm:w-6 sm:h-6 pointer-events-none" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 space-y-4 relative z-10 custom-scrollbar min-h-0 overscroll-contain">
                    {isLoadingQueue ? (
                      <div className="h-full flex items-center justify-center">
                        <RefreshCcw className="w-8 h-8 animate-spin text-slate-300" />
                      </div>
                    ) : machineQueue.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-700 dark:text-slate-200">Antrian Kosong</h4>
                          <p className="text-sm font-medium text-slate-500">Semua data ke mesin sudah tersinkronisasi.</p>
                        </div>
                      </div>
                    ) : (
                      machineQueue.map((cmd) => (
                        <div key={cmd.id} className="p-4 rounded-3xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-lg">
                              {cmd.status}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {new Date(cmd.created_at).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all leading-relaxed bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            {cmd.command}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>
    </div>
  );
}
