import { useState, useEffect } from "react";
import { User, Company } from "../../types";
import {
  Settings,
  RefreshCw,
  Users,
  Server,
  ShieldCheck,
  AlertCircle,
  Cpu,
  WifiOff,
  Wifi,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { getSyncedDate } from "../../lib/utils";
import { confirmDialog } from '../../lib/confirmDialog';

interface MaintenanceTabProps {
  user: User;
  companyInfo: Company | null;
  activeCompanyId: string;
}

export default function MaintenanceTab({
  user,
  companyInfo,
  activeCompanyId,
}: MaintenanceTabProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    title: string;
    desc: string;
    type: "success" | "error";
  } | null>(null);

  const [queue, setQueue] = useState<any[]>([]);

  useEffect(() => {
    checkConnection();
    fetchCommands();

    // Subscribe to realtime inserts
    const channel = supabase
      .channel(`maintenance-${activeCompanyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "absensi",
          filter: `company_id=eq.${activeCompanyId}`,
        },
        (payload) => {
          setIsConnected(true);
          setLastPing(getSyncedDate());
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "machine_commands",
          filter: `company_id=eq.${activeCompanyId}`,
        },
        (payload) => {
          fetchCommands(); // reload immediately
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId]);

  const fetchCommands = async () => {
    try {
      const { data, error } = await supabase
        .from("machine_commands")
        .select("*")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) setQueue(data);
    } catch (e) {
      console.warn("Table machine_commands might missing.", e);
    }
  };

  const checkConnection = async () => {
    setLoading(true);
    try {
      // Cek record absensi terakhir untuk memastikan online
      const { data, error } = await supabase
        .from("absensi")
        .select("waktu_masuk")
        .eq("company_id", activeCompanyId)
        .order("waktu_masuk", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setIsConnected(true);
        setLastPing(new Date(data[0].waktu_masuk.replace(' ', 'T')));
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      console.error(e);
      setIsConnected(false); // Kalau error gak bisa dapet data
    } finally {
      setLoading(false);
    }
  };

  const handleCommand = async (
    type: string,
    commandString: string,
    successMessage: string,
  ) => {
    if (!isConnected) {
      if (
        !(await confirmDialog(
          "Mesin saat ini terdeteksi OFFLINE. Perintah akan dimasukkan ke antrian dan dieksekusi saat mesin kembali online. Lanjutkan?",
        ))
      )
        return;
    }

    setActionLoading(type);
    try {
      const { error } = await supabase.from("machine_commands").insert({
        company_id: activeCompanyId,
        command: commandString,
        status: "PENDING",
      });

      if (error) {
        // Fallback or error handling
        if (error.code === "42P01") {
          // undefined_table
          console.warn(
            "Table machine_commands not found. Falling back to simulation mode.",
          );
          throw new Error("simulated");
        } else {
          console.error("Supabase Error:", error);
          throw error;
        }
      } else {
        setToastMessage({
          title: "Berhasil!",
          desc: successMessage,
          type: "success",
        });
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (e: any) {
      // Simulating if table doesn't exist
      if (e.message === "simulated") {
        setTimeout(() => {
          setToastMessage({
            title: "Terkirim (Simulasi)",
            desc: successMessage,
            type: "success",
          });
          setTimeout(() => setToastMessage(null), 4000);
          setActionLoading(null);
        }, 2000);
        return;
      } else {
        setToastMessage({
          title: "Terjadi Kesalahan",
          desc: e.message || "Gagal mengirim perintah",
          type: "error",
        });
        setTimeout(() => setToastMessage(null), 4000);
      }
    } finally {
      setActionLoading((prev) => (prev === type ? null : prev));
    }
  };

  const handleSyncEmployees = async () => {
    if (!(await confirmDialog("Apakah Anda yakin ingin memicu sinkronisasi data karyawan saat ini?"))) return;
    handleCommand(
      "employees",
      "DATA QUERY USERINFO",
      "Permintaan Sinkronisasi Data Karyawan berhasil ditambahkan ke antrian.",
    );
  };

  const handleSyncAttendance = async () => {
    if (!(await confirmDialog("Apakah Anda yakin ingin memicu sinkronisasi log absensi saat ini?"))) return;
    handleCommand(
      "attendance",
      "DATA QUERY ATTLOG",
      "Permintaan Sinkronisasi Log Absensi berhasil ditambahkan ke antrian.",
    );
  };

  const handleReboot = async () => {
    if (!(await confirmDialog("Apakah Anda yakin ingin me-restart mesin fingerprint absen?")))
      return;
    handleCommand(
      "reboot",
      "REBOOT",
      "Perintah Restart dikirim. Mesin akan me-restart secara otomatis saat polling berikutnya.",
    );
  };

  const isEmployeesPending = queue.some(
    (cmd) => cmd.command === "DATA QUERY USERINFO" && cmd.status === "PENDING",
  );
  const isAttendancePending = queue.some(
    (cmd) => cmd.command === "DATA QUERY ATTLOG" && cmd.status === "PENDING",
  );
  const isRebootPending = queue.some(
    (cmd) => cmd.command === "REBOOT" && cmd.status === "PENDING",
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <Server className="w-8 h-8 text-blue-500" />
            Maintenance Mesin
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">
            Sinkronisasi data, kontrol, dan perawaran mesin jarak jauh.
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div
            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold border shadow-sm ${
              isConnected
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-rose-50 text-rose-600 border-rose-200"
            }`}
          >
            {isConnected ? (
              <Wifi className="w-4 h-4 animate-pulse" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            {isConnected ? "Terhubung (Online)" : "Terputus (Offline)"}
          </div>
          {lastPing && (
            <p className="text-xs text-slate-500 font-medium px-2">
              Terakhir update:{" "}
              {lastPing.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-700 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 shrink-0 mt-1 text-rose-500" />
          <div>
            <h4 className="font-bold text-lg mb-1">Mesin Tidak Terhubung</h4>
            <p className="text-sm font-medium">
              Sistem tidak mendeteksi koneksi aktif dari mesin fingerprint. Menu
              maintenance hanya dapat digunakan jika kondisi koneksi webhook
              sudah valid dan tersambung ke mesin. Silakan cek kembali
              Pengaturan &gt; Integrasi Webhook.
            </p>
            <button
              onClick={() => setIsConnected(true)}
              className="mt-4 bg-white px-4 py-2 rounded-xl text-rose-600 font-bold border border-rose-200 text-sm hover:bg-rose-100 transition"
            >
              Simulasi: Ubah Status jadi Terhubung
            </button>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sync Karyawan */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <Users className="w-10 h-10 text-blue-200 dark:text-blue-800" />
            </div>

            <Users className="w-10 h-10 text-blue-500 mb-6 relative z-10" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 relative z-10">
              Sinkron Data Karyawan
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 relative z-10">
              Tarik data karyawan (nama, nip, sidik jari/wajah) dari mesin ke
              dalam sistem ini agar tersinkronisasi.
            </p>
            <button
              onClick={handleSyncEmployees}
              disabled={actionLoading !== null || isEmployeesPending}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-4 rounded-2xl font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 transition disabled:opacity-50 relative z-10"
            >
              {actionLoading === "employees" || isEmployeesPending ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              {actionLoading === "employees"
                ? "Memproses..."
                : isEmployeesPending
                  ? "Menunggu Eksekusi..."
                  : "Mulai Sinkronisasi"}
            </button>
          </div>

          {/* Sync Absensi */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/10 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform">
              <Server className="w-10 h-10 text-emerald-200 dark:text-emerald-800" />
            </div>

            <Server className="w-10 h-10 text-emerald-500 mb-6 relative z-10" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 relative z-10">
              Sinkron Data Absensi
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 relative z-10">
              Tarik log presensi yang mungkin belum terkirim ke server (backup
              sinkronisasi manual jika missed).
            </p>
            <button
              onClick={handleSyncAttendance}
              disabled={actionLoading !== null || isAttendancePending}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 p-4 rounded-2xl font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 transition disabled:opacity-50 relative z-10"
            >
              {actionLoading === "attendance" || isAttendancePending ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
              {actionLoading === "attendance"
                ? "Memproses..."
                : isAttendancePending
                  ? "Menunggu Eksekusi..."
                  : "Tarik Data Log"}
            </button>
          </div>

          {/* Mesin Setting / Restart */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group md:col-span-2">
            <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
              <div>
                <Cpu className="w-10 h-10 text-amber-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  Setting Mesin
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Fitur pengaturan device secara remote. Jika mesin dirasa
                  lambat atau mengalami gangguan sinkronisasi, Anda dapat
                  memerintahkan mesin untuk restart.
                </p>
              </div>

              <div className="w-full md:w-auto shrink-0 flex flex-col gap-3">
                <button
                  onClick={handleReboot}
                  disabled={actionLoading !== null || isRebootPending}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 px-8 py-4 rounded-2xl font-bold hover:bg-amber-100 transition disabled:opacity-50"
                >
                  {actionLoading === "reboot" || isRebootPending ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                  {isRebootPending ? "Menunggu Restart..." : "Restart Mesin"}
                </button>
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-400 px-8 py-4 rounded-2xl font-bold cursor-not-allowed"
                >
                  <Settings className="w-5 h-5" />
                  Konfigurasi Jaringan (Segera)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deploy / Update Website */}
      {user.role === 'MASTER_ADMIN' && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-[2rem] border border-blue-500 shadow-xl relative overflow-hidden group mt-8">
          <div className="absolute right-0 top-0 w-64 h-full bg-white/10 blur-3xl rounded-full translate-x-1/2" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between">
            <div className="text-white">
              <h3 className="text-xl font-bold flex items-center gap-3 mb-2">
                <RefreshCw className="w-6 h-6" />
                Update Aplikasi (Deploy)
              </h3>
              <p className="text-blue-100 text-sm font-medium max-w-xl">
                Sinkronisasi perubahan kode terbaru ke website production Anda. Fitur ini akan memicu Webhook dari platform hosting Anda (seperti Vercel, Netlify, atau cPanel).
              </p>
            </div>

            <div className="w-full md:w-auto shrink-0 flex flex-col gap-3">
              <button
                disabled={isDeploying}
                onClick={async () => {
                  setIsDeploying(true);
                  const webhookUrl = "https://absensikita.id/cpanel-webhook.php?secret=Hajimekojo12345";
                  
                  try {
                    await fetch(webhookUrl, { method: 'POST', mode: 'no-cors' });
                    // Provide a much more visible response alert
                    alert("Update Berhasil Dikirim!\n\nProses deploy sedang berjalan di server (cPanel). Silakan tunggu sekitar 1-2 menit untuk melihat perubahan pada website.");
                  } catch (e) {
                    console.error("Webhook trigger error:", e);
                    alert("Terjadi kesalahan saat memicu update server. Coba lagi.");
                  } finally {
                    setIsDeploying(false);
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold hover:bg-blue-50 transition shadow-lg ${isDeploying ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <RefreshCw className={`w-5 h-5 ${isDeploying ? 'animate-spin' : ''}`} />
                {isDeploying ? 'Sedang Update...' : 'Mulai Update Website'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render Command Queue if any */}
      {queue.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-blue-500" />
            Log Server Command
          </h3>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Waktu
                  </th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Perintah
                  </th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.map((cmd) => (
                  <tr
                    key={cmd.id}
                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {new Date(cmd.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-blue-600">
                      {cmd.command}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider ${cmd.status === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {cmd.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Popup */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out flex ${toastMessage ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"}`}
      >
        {toastMessage && (
          <div
            className={`flex items-center gap-4 px-6 py-4 rounded-full shadow-xl border ${toastMessage.type === "success" ? "bg-emerald-500 border-emerald-400 text-white" : "bg-rose-500 border-rose-400 text-white"}`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-6 h-6 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="font-bold text-sm">{toastMessage.title}</span>
              <span className="text-sm opacity-90">{toastMessage.desc}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 hover:bg-white/20 p-1 rounded-full transition"
            >
              <XCircle className="w-5 h-5 shrink-0 opacity-70" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
