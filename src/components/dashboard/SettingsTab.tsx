import { useState, useEffect } from "react";
import {
  User,
  Shield,
  Building,
  Mail,
  Phone,
  Lock,
  Save,
  Globe,
  Smartphone,
  MapPin,
  CreditCard,
  Crosshair,
  Download,
  Plus,
  X,
  History,
  Eye,
  Server,
  Bot,
  MessageCircle,
  CheckCircle2,
  Unplug,
  Search,
  RefreshCcw,
} from "lucide-react";
import ConnectionTestModal from "./ConnectionTestModal";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Company, User as UserType, AuditLog } from "../../types";
import { getLogoSrc } from "../../lib/utils";
import MapPicker from "../MapPicker";
import { toast } from "sonner";
import { createAuditLog } from "../../lib/audit";
import { confirmDialog } from '../../lib/confirmDialog';
import { wahaApi } from "../../lib/waha";

interface SettingsTabProps {
  user: UserType;
  activeCompanyId: string;
}

export default function SettingsTab({ user, activeCompanyId }: SettingsTabProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "company" | "overtime" | "audit">("profile");

  const [overtimeMatrix, setOvertimeMatrix] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");
  const [auditFilterAction, setAuditFilterAction] = useState("ALL");
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);

  const [userName, setUserName] = useState(user.nama);
  const [userPhone, setUserPhone] = useState(user.no_hp_notif || "");
  const [liveResetTime, setLiveResetTime] = useState("");
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [wahaStatus, setWahaStatus] = useState<string | null>(null);
  const [wahaLoading, setWahaLoading] = useState(false);
  const [telegramLinkCode, setTelegramLinkCode] = useState<string | null>(user.telegram_link_code || null);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [employeesForTransfer, setEmployeesForTransfer] = useState<UserType[]>([]);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>("");

  const handleGenerateTelegramLink = async () => {
    try {
      setSaving(true);
      // Ensure the column exists
      try {
        await supabase.rpc('execute_sql', { query: `
          ALTER TABLE karyawan ADD COLUMN IF NOT EXISTS telegram_chat_id text;
          ALTER TABLE karyawan ADD COLUMN IF NOT EXISTS telegram_link_code text;
        `});
      } catch(e) { }

      const code = "LINK-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from('karyawan').update({ telegram_link_code: code }).eq('nip', user.nip).eq('company_id', activeCompanyId);
      if (error) throw error;

      setTelegramLinkCode(code);
      setIsTelegramModalOpen(true);
      user.telegram_link_code = code; // Optimistic update
      toast.success("Kode Link Telegram berhasil dibuat.");
    } catch(e: any) {
      toast.error("Gagal: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!(await confirmDialog('Apakah Anda yakin ingin memutuskan integrasi dengan Telegram Bot?'))) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('karyawan')
        .update({ telegram_chat_id: null, telegram_link_code: null })
        .eq('nip', user.nip)
        .eq('company_id', activeCompanyId);
        
      if (error) throw error;
      
      toast.success("Integrasi Telegram berhasil diputus.");
      
      // Update session storage so it doesn't persist after reload
      const sessionData = sessionStorage.getItem("admin_session");
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        parsed.telegram_chat_id = null;
        parsed.telegram_link_code = null;
        sessionStorage.setItem("admin_session", JSON.stringify(parsed));
      }
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e: any) {
      toast.error("Gagal memutuskan integrasi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchCompany();
    fetchOvertimeMatrix();
    if (activeTab === 'audit') fetchAuditLogs();
    
    // Load local setting for live summary
    const resetTimeLocal = localStorage.getItem(`live_reset_time_${activeCompanyId}`) || "00:00";
    setLiveResetTime(resetTimeLocal);
  }, [activeCompanyId, activeTab]);

  const [wahaQrBase64, setWahaQrBase64] = useState<string | null>(null);
  const [wahaErrorMsg, setWahaErrorMsg] = useState<string | null>(null);

  const fetchWahaQr = async () => {
    try {
      const b64 = await wahaApi.getQrBase64(activeCompanyId);
      if (b64) setWahaQrBase64(b64);
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let interval: any;
    
    const checkStatus = async () => {
      try {
        const data = await wahaApi.getStatus(activeCompanyId);
        if (data.status !== 'ERROR' && data.status !== 'FAILED') setWahaErrorMsg(null);
        setWahaStatus(prev => {
          if (data.status === 'SCAN_QR_CODE' && (!wahaQrBase64 || prev !== 'SCAN_QR_CODE')) {
            fetchWahaQr();
          }
          return data.status;
        });
      } catch(e: any) {
        setWahaStatus('ERROR');
        setWahaErrorMsg(`Status fetch thrown: ${e.message}`);
      }
    };

    if (activeTab === 'company' && company?.whatsapp_enabled) {
      checkStatus();
      interval = setInterval(checkStatus, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, company?.whatsapp_enabled, activeCompanyId]);

  const checkWahaStatusManual = async () => {
    try {
      const data = await wahaApi.getStatus(activeCompanyId);
      if (data.status !== 'ERROR' && data.status !== 'FAILED') setWahaErrorMsg(null);
      setWahaStatus(prev => {
        if (data.status === 'SCAN_QR_CODE') {
          fetchWahaQr();
        }
        return data.status;
      });
    } catch(e: any) {
      setWahaStatus('ERROR');
      setWahaErrorMsg(`M.Status fetch thrown: ${e.message}`);
    }
  };

  const startWahaSession = async () => {
    setWahaErrorMsg(null);
    setWahaLoading(true);
    try {
      await wahaApi.startSession(activeCompanyId);
      await checkWahaStatusManual();
    } catch (e: any) {
      setWahaStatus('ERROR');
      setWahaErrorMsg(e.message);
      toast.error('Gagal memulai sesi WhatsApp: ' + e.message);
    } finally {
      setWahaLoading(false);
    }
  };

  const logoutWahaSession = async () => {
    setWahaErrorMsg(null);
    try {
      await wahaApi.logoutSession(activeCompanyId);
      await checkWahaStatusManual();
    } catch (e: any) {
      setWahaErrorMsg(e.message);
      toast.error('Gagal memutus koneksi WhatsApp: ' + e.message);
    }
  };

  const fetchEmployeesForTransfer = async () => {
    try {
      const { data } = await supabase
        .from("karyawan")
        .select("*")
        .eq("company_id", activeCompanyId)
        .neq("nip", user.nip);
      if (data) setEmployeesForTransfer(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) {
      toast.error('Pilih kandidat pengganti owner terlebih dahulu.');
      return;
    }
    if (!(await confirmDialog('Apakah Anda sangat yakin ingin MEMINDAHTANGANKAN KEPEMILIKAN instansi ini? Anda akan menjadi karyawan biasa (Super Admin) dan akses kontrol tertinggi akan berpindah ke pengguna terpilih.'))) return;
    
    setSaving(true);
    try {
      // 1. Assign selected user to OWNER
      const { error: err1 } = await supabase
        .from('karyawan')
        .update({ role: 'OWNER' })
        .eq('nip', selectedNewOwner)
        .eq('company_id', activeCompanyId);
      if (err1) throw err1;

      // 2. Downgrade current user to SUPER ADMIN
      const { error: err2 } = await supabase
        .from('karyawan')
        .update({ role: 'SUPER ADMIN' })
        .eq('nip', user.nip)
        .eq('company_id', activeCompanyId);
      if (err2) throw err2;

      toast.success('Kepemilikan berhasil dipindahtangankan. Aplikasi akan dimuat ulang...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e: any) {
      toast.error('Gagal memindahtangankan: ' + e.message);
      setSaving(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setAuditLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOvertimeMatrix = async () => {
    try {
      const { data, error } = await supabase
        .from("overtime_matrix")
        .select("*")
        .eq("company_id", activeCompanyId)
        .order("tipe_hari", { ascending: true })
        .order("jam_ke", { ascending: true });
      
      if (data && data.length > 0) {
        setOvertimeMatrix(data);
      } else {
        // Default matrix if not found
        const defaults = [
          { company_id: activeCompanyId, tipe_hari: 'KERJA', jam_ke: 1, pengali: 1.5 },
          { company_id: activeCompanyId, tipe_hari: 'KERJA', jam_ke: 2, pengali: 2.0 },
          { company_id: activeCompanyId, tipe_hari: 'LIBUR', jam_ke: 1, pengali: 2.0 },
          { company_id: activeCompanyId, tipe_hari: 'LIBUR', jam_ke: 8, pengali: 3.0 },
          { company_id: activeCompanyId, tipe_hari: 'LIBUR', jam_ke: 9, pengali: 4.0 },
        ];
        setOvertimeMatrix(defaults);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOvertimeMatrix = async () => {

    setSaving(true);
    try {
      // Get old matrix for logging
      const { data: oldData } = await supabase.from("overtime_matrix").select("*").eq("company_id", activeCompanyId);
      
      // Delete existing and bulk insert
      await supabase.from("overtime_matrix").delete().eq("company_id", activeCompanyId);
      const { error } = await supabase.from("overtime_matrix").insert(
        overtimeMatrix.map(({ id, ...rest }) => ({ ...rest, company_id: activeCompanyId }))
      );
      if (error) throw error;

      await createAuditLog(user, 'UPDATE', 'overtime_matrix', 'MULTIPLE', oldData, overtimeMatrix);
      
      toast.success("Matriks lembur berhasil disimpan!");
    } catch (e: any) {
      toast.error("Gagal menyimpan matriks: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchCompany = async () => {
    try {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("company_id", activeCompanyId)
        .single();
      if (data) setCompany(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {

    setSaving(true);
    try {
      if (userPhone && userPhone !== user.no_hp_notif) {
        const { data: existingHps } = await supabase
          .from("karyawan")
          .select("nip, company_id")
          .eq("no_hp_notif", userPhone);
          
        const isUsedByOther = existingHps?.some(
          hp => !(hp.nip === user.nip && hp.company_id === user.company_id)
        );
        
        if (isUsedByOther) {
          toast.error("Nomor WhatsApp ini sudah digunakan oleh karyawan lain.");
          setSaving(false);
          return;
        }
      }

      // Get old profile
      const { data: oldProfile } = await supabase.from("karyawan").select("*").eq("nip", user.nip).eq("company_id", user.company_id).single();

      const { error } = await supabase
        .from("karyawan")
        .update({
          nama: userName,
          no_hp_notif: userPhone,
        })
        .eq("nip", user.nip)
        .eq("company_id", user.company_id);

      if (error) throw error;

      await createAuditLog(user, 'UPDATE', 'karyawan', user.nip, oldProfile, { nama: userName, no_hp_notif: userPhone });

      toast.success("Profil berhasil diperbarui!");
      // Ideally update global auth state, but we'll reflect it locally.
      user.nama = userName;
      user.no_hp_notif = userPhone;
    } catch (e: any) {
      alert("Gagal: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran logo maksimal 2MB");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        if (company) {
          setCompany({ ...company, logo_base64: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCompany = async () => {
    if (!company) return;

    setSaving(true);
    try {
      // Auto-migrate columns gracefully if execute_sql is available
      try {
        await supabase.rpc('execute_sql', { query: `
          ALTER TABLE companies ADD COLUMN IF NOT EXISTS wa_notif_enabled boolean DEFAULT false;
          ALTER TABLE companies ADD COLUMN IF NOT EXISTS wa_n8n_webhook_url text;
          ALTER TABLE companies ADD COLUMN IF NOT EXISTS telegram_bot_token text;
        ` });
      } catch(e) {
        // ignore if not available
      }

      // Get old company
      const { data: oldCompany } = await supabase.from("companies").select("*").eq("company_id", activeCompanyId).single();

      const payload: any = {
        nama_perusahaan: company.nama_perusahaan,
        email: company.email,
        whatsapp: company.whatsapp,
        logo_base64: company.logo_base64,
        gsheet_enabled: company.gsheet_enabled,
        gsheet_url_kartu: company.gsheet_url_kartu,
        gsheet_url_rekap: company.gsheet_url_rekap,
        gsheet_url_total: company.gsheet_url_total,
        whatsapp_enabled: company.whatsapp_enabled,
        telegram_bot_token: company.telegram_bot_token,
        office_lat: company.office_lat,
        office_lng: company.office_lng,
        office_radius: company.office_radius,
        location_enabled: company.location_enabled,
        enable_half_day_rule: company.enable_half_day_rule,
      };
      let errorUpdate;
      const { error } = await supabase
        .from("companies")
        .update(payload)
        .eq("company_id", activeCompanyId);
      
      errorUpdate = error;
      if (error && (error.message.includes("whatsapp_enabled") || error.message.includes("wa_n8n_webhook_url"))) {
         // Retry without WA columns if they don't exist in DB and rpc failed
         delete payload.whatsapp_enabled;
         const { error: retryError } = await supabase
          .from("companies")
          .update(payload)
          .eq("company_id", activeCompanyId);
         errorUpdate = retryError;
      }

      if (errorUpdate) throw errorUpdate;

      await createAuditLog(user, 'UPDATE', 'companies', activeCompanyId, oldCompany, payload);
      
      localStorage.setItem(`live_reset_time_${activeCompanyId}`, liveResetTime);

      toast.success("Pengaturan perusahaan berhasil disimpan!");
    } catch (e: any) {
      toast.error("Gagal: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100">
            Pengaturan
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Kelola preferensi akun dan informasi instansi Anda.
          </p>
        </div>
      </div>

      <div className="flex overflow-x-auto custom-scrollbar md:flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl md:rounded-[2rem] w-full md:w-fit">
        <button
          onClick={() => setActiveTab("profile")}
          className={`whitespace-nowrap px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-[1.5rem] text-xs md:text-sm font-black transition-all ${activeTab === "profile" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"}`}
        >
          Profil Saya
        </button>
        {user.role !== 'USER' && (
          <>
            <button
              onClick={() => setActiveTab("company")}
              className={`whitespace-nowrap px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-[1.5rem] text-xs md:text-sm font-black transition-all ${activeTab === "company" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"}`}
            >
              Data Instansi
            </button>
            <button
              onClick={() => setActiveTab("overtime")}
              className={`whitespace-nowrap px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-[1.5rem] text-xs md:text-sm font-black transition-all ${activeTab === "overtime" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"}`}
            >
              Kalkulasi Lembur
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`whitespace-nowrap px-4 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-[1.5rem] text-xs md:text-sm font-black transition-all ${activeTab === "audit" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"}`}
            >
              Audit Trail
            </button>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:gap-6 md:gap-8">
        {activeTab === "profile" ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 sm:p-10 border-b border-slate-50 dark:border-slate-800/50 flex flex-col md:flex-row items-center gap-6 sm:gap-10">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 p-[3px] shadow-2xl shadow-blue-500/20 group-hover:scale-105 transition-transform duration-500 cursor-pointer">
                  <div className="w-full h-full rounded-[2.5rem] bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden border-4 border-white dark:border-slate-800">
                    <img
                      src={`https://ui-avatars.com/api/?background=2563eb&color=fff&bold=true&length=1&size=128&name=${user.nama}`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-slate-900 shadow-xl rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 text-blue-600">
                  <Shield className="w-5 h-5" />
                </div>
              </div>
              <div className="text-center md:text-left space-y-2">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {user.nama}
                </h3>
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <Smartphone className="w-3.5 h-3.5" />
                    {user.nip}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                    <Shield className="w-3.5 h-3.5" />
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="grid md:grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                    Nama Lengkap
                  </label>
                  <div className="relative group">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 transition-colors group-focus-within:text-blue-500" />
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                    Nomor Telepon (WhatsApp)
                  </label>
                  <div className="relative group">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 transition-colors group-focus-within:text-blue-500" />
                    <input
                      type="tel"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                      placeholder="+62 812..."
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 dark:border-slate-800/50">
                <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100">Hubungkan ke Telegram Bot</h4>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        Terintegrasi dengan asisten AI AbsensiKita via Telegram secara aman menggunakan metode Account Linking.
                      </p>
                    </div>
                  </div>
                  {user.telegram_chat_id ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-6 py-3 rounded-xl border border-green-100 dark:border-green-800/30">
                        <CheckCircle2 className="w-5 h-5" />
                        Telah Terhubung
                      </div>
                      <button
                        onClick={handleUnlinkTelegram}
                        disabled={saving}
                        title="Putuskan Hubungan"
                        className="p-3 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/30 rounded-xl transition-colors border border-red-100 dark:border-red-900/50 flex-shrink-0"
                      >
                        <Unplug className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleGenerateTelegramLink}
                      disabled={saving}
                      className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0 whitespace-nowrap disabled:opacity-50"
                    >
                       Tautkan Akun (Aman)
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Smartphone className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === "company" ? (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-10 border-b border-slate-50 dark:border-slate-800/50 flex flex-col sm:flex-row items-center text-center sm:text-left gap-6 sm:gap-10">
                <div className="relative group cursor-pointer" onClick={() => document.getElementById("logo-upload")?.click()}>
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] flex items-center justify-center text-slate-500 dark:text-slate-300 border-2 border-dashed border-slate-200 dark:border-slate-800 overflow-hidden relative">
                    {company?.logo_base64 ? (
                      <img src={getLogoSrc(company.logo_base64)} alt="Company Logo" className="w-full h-full object-contain bg-white" />
                    ) : (
                      <Building className="w-10 h-10" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem]">
                      <span className="text-white text-xs font-bold uppercase tracking-widest text-center px-2">Ubah<br/>Logo</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                    {company?.nama_perusahaan}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">
                    ID: {activeCompanyId}
                  </p>
                </div>
              </div>

              <div className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                <div className="grid md:grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                      Nama Instansi
                    </label>
                    <div className="relative group">
                      <Building className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 transition-colors group-focus-within:text-blue-500" />
                      <input
                        type="text"
                        value={company?.nama_perusahaan || ""}
                        onChange={(e) =>
                          company &&
                          setCompany({
                            ...company,
                            nama_perusahaan: e.target.value,
                          })
                        }
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                      Email Perusahaan
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 transition-colors group-focus-within:text-blue-500" />
                      <input
                        type="email"
                        value={company?.email || ""}
                        onChange={(e) =>
                          company &&
                          setCompany({ ...company, email: e.target.value })
                        }
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                      WhatsApp Instansi
                    </label>
                    <div className="relative group">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 transition-colors group-focus-within:text-blue-500" />
                      <input
                        type="tel"
                        value={company?.whatsapp || ""}
                        onChange={(e) =>
                          company &&
                          setCompany({ ...company, whatsapp: e.target.value })
                        }
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                          Geofencing & Lokasi Kantor
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                          Klik pada peta untuk menentukan koordinat pusat kantor.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={company?.location_enabled || false}
                        onChange={(e) =>
                          company &&
                          setCompany({
                            ...company,
                            location_enabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-slate-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                      <span className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                        Aktif
                      </span>
                    </label>
                  </div>

                  <div className="space-y-6">
                    <MapPicker
                      lat={company?.office_lat || 0}
                      lng={company?.office_lng || 0}
                      radius={company?.office_radius || 100}
                      onChange={(office_lat, office_lng) =>
                        company && setCompany({ ...company, office_lat, office_lng })
                      }
                    />

                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                          Latitude
                        </label>
                        <div className="relative group">
                          <input
                            type="number"
                            step="any"
                            placeholder="-6.123456"
                            value={company?.office_lat || ""}
                            onChange={(e) =>
                              company &&
                              setCompany({
                                ...company,
                                office_lat: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 transition-all outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                          Longitude
                        </label>
                        <div className="relative group">
                          <input
                            type="number"
                            step="any"
                            placeholder="106.123456"
                            value={company?.office_lng || ""}
                            onChange={(e) =>
                              company &&
                              setCompany({
                                ...company,
                                office_lng: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 transition-all outline-none"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] ml-2">
                          Radius (Meter)
                        </label>
                        <input
                          type="number"
                          placeholder="100"
                          value={company?.office_radius || ""}
                          onChange={(e) =>
                            company &&
                            setCompany({
                              ...company,
                              office_radius: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-6">
                    <button
                      onClick={() => {
                        setSaving(true);
                        if (navigator.geolocation) {
                          const getLoc = (highAcc: boolean) => {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                if (company) {
                                  setCompany({
                                    ...company,
                                    office_lat: pos.coords.latitude,
                                    office_lng: pos.coords.longitude,
                                  });
                                  toast.success("Lokasi berhasil dideteksi!");
                                }
                                setSaving(false);
                              },
                              (err) => {
                                if (highAcc) {
                                  getLoc(false);
                                } else {
                                  toast.error("Gagal mendapatkan lokasi. " + err.message);
                                  setSaving(false);
                                }
                              },
                              { enableHighAccuracy: highAcc, timeout: highAcc ? 8000 : 15000, maximumAge: 0 }
                            );
                          };
                          getLoc(true);
                        } else {
                          toast.error("Geolocation tidak didukung browser ini.");
                          setSaving(false);
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 text-blue-600 border border-blue-100 dark:border-blue-900/40 rounded-xl font-bold text-xs hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                    >
                      <Crosshair className="w-4 h-4" /> 
                      {saving ? "Mendeteksi..." : "Gunakan Lokasi Saya"}
                    </button>
                    <button
                      onClick={() => {
                        window.open(`https://www.google.com/maps?q=${company?.office_lat},${company?.office_lng}`, '_blank');
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 text-slate-600 border border-slate-100 dark:border-slate-800 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                      <Globe className="w-4 h-4" /> Buka di Google Maps
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Aturan Setengah Hari (Half-Day)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Jika aktif, karyawan yang tidak absen masuk/pulang akan otomatis dianggap Setengah Hari (potongan gaji 50% dari rate Alpha).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={company?.enable_half_day_rule || false}
                        onChange={(e) =>
                          company &&
                          setCompany({
                            ...company,
                            enable_half_day_rule: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-slate-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Waktu Reset Ringkasan Live (Lokal)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium max-w-lg">
                        Tentukan jam pergantian hari (default: <span className="font-bold text-blue-500">00:00</span>). Absensi sebelum jam ini akan dianggap hari sebelumnya. Pengaturan ini hanya tersimpan di perangkat ini.
                      </p>
                    </div>
                    <div className="relative group shrink-0">
                      <History className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                      <input
                        type="time"
                        value={liveResetTime}
                        onChange={(e) => setLiveResetTime(e.target.value)}
                        className="w-full pl-10 pr-5 py-3 bg-slate-50 dark:bg-slate-950 dark:[color-scheme:dark] border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/30 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Integrasi Google Sheets
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Ekspor dan sinkronisasi data absensi otomatis ke Sheet
                        Anda.
                      </p>
                      {(!company?.subscription_plan || company.subscription_plan === 'Standart') && (
                        <span className="inline-block mt-2 px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                          Hanya tersedia di Paket Premium
                        </span>
                      )}
                    </div>
                    <label className={`relative inline-flex items-center ${(!company?.subscription_plan || company.subscription_plan === 'Standart') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        disabled={!company?.subscription_plan || company.subscription_plan === 'Standart'}
                        checked={company?.gsheet_enabled || false}
                        onChange={(e) =>
                          company &&
                          setCompany({
                            ...company,
                            gsheet_enabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-slate-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {company?.gsheet_enabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-600 uppercase mb-2 ml-1">
                          URL Webhook / Google App Script (Kartu Absensi)
                        </label>
                        <input
                          type="url"
                          value={company?.gsheet_url_kartu || ""}
                          onChange={(e) =>
                            company &&
                            setCompany({
                              ...company,
                              gsheet_url_kartu: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-200 focus:border-emerald-500 outline-none transition text-sm text-slate-600 dark:text-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-600 uppercase mb-2 ml-1">
                          URL Webhook / Google App Script (Rekap Absensi)
                        </label>
                        <input
                          type="url"
                          value={company?.gsheet_url_rekap || ""}
                          onChange={(e) =>
                            company &&
                            setCompany({
                              ...company,
                              gsheet_url_rekap: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-200 focus:border-emerald-500 outline-none transition text-sm text-slate-600 dark:text-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-600 uppercase mb-2 ml-1">
                          URL Webhook / Google App Script (Total Absensi)
                        </label>
                        <input
                          type="url"
                          value={company?.gsheet_url_total || ""}
                          onChange={(e) =>
                            company &&
                            setCompany({
                              ...company,
                              gsheet_url_total: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-200 focus:border-emerald-500 outline-none transition text-sm text-slate-600 dark:text-slate-300"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {(user.role === 'OWNER' || user.role === 'SUPER ADMIN') && (
                  <div className="pt-6 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <Smartphone className="w-5 h-5 text-green-500" />
                          Integrasi WhatsApp
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                          Hubungkan nomor WhatsApp untuk mengirimkan notifikasi absensi secara otomatis.
                        </p>
                        {(!company?.subscription_plan || company.subscription_plan === 'Standart') && (
                          <span className="inline-block mt-2 px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                            Hanya tersedia di Paket Premium
                          </span>
                        )}
                      </div>
                      <label className={`relative inline-flex items-center ${(!company?.subscription_plan || company.subscription_plan === 'Standart') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          disabled={!company?.subscription_plan || company.subscription_plan === 'Standart'}
                          checked={company?.whatsapp_enabled || false}
                          onChange={(e) =>
                            company &&
                            setCompany({
                              ...company,
                              whatsapp_enabled: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-slate-800 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>

                  {company?.whatsapp_enabled && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200">Status Koneksi WhatsApp</h5>
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${wahaStatus === 'WORKING' ? 'bg-green-500 animate-pulse' : wahaStatus === 'SCAN_QR_CODE' ? 'bg-orange-500 animate-pulse' : 'bg-rose-500'}`}></div>
                           <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                              {wahaStatus === 'WORKING' ? 'TERHUBUNG' : wahaStatus === 'SCAN_QR_CODE' ? 'MENUNGGU SCAN' : wahaStatus === 'STARTING' ? 'MEMPROSES...' : 'TERPUTUS'}
                           </span>
                        </div>
                      </div>

                      {wahaErrorMsg && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 text-xs font-mono rounded-lg overflow-x-auto whitespace-pre-wrap">
                          <b>Debugging Error Detail:</b><br/>
                          {wahaErrorMsg}
                        </div>
                      )}

                        {(!wahaStatus || wahaStatus === 'STOPPED' || wahaStatus === 'FAILED' || wahaStatus === 'ERROR') && (
                          <div className="text-center py-6">
                            <button
                              type="button"
                              onClick={startWahaSession}
                              disabled={wahaLoading}
                              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center mx-auto"
                            >
                              {wahaLoading ? "Memulai..." : "Hubungkan WhatsApp"}
                            </button>
                            <p className="text-xs text-slate-500 mt-3 max-w-sm mx-auto">
                              Klik tombol di atas untuk memunculkan QR Code WhatsApp yang akan digunakan sebagai pengirim pesan.
                            </p>
                          </div>
                        )}

                        {wahaStatus === 'STARTING' && (
                          <div className="text-center py-6">
                            <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl inline-flex flex-col shadow-sm mb-4 w-48 h-48 items-center justify-center">
                              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                              <p className="text-xs font-bold text-slate-600 text-center">Menyiapkan<br/>QR Code...</p>
                            </div>
                            <h5 className="font-bold text-slate-800 dark:text-slate-100">Memproses Sesi</h5>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                              Harap tunggu sebentar, sistem sedang menyiapkan QR Code untuk akun WhatsApp Anda.
                            </p>
                          </div>
                        )}

                        {wahaStatus === 'SCAN_QR_CODE' && (
                          <div className="text-center py-6">
                            <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-slate-100 mb-4 h-56 w-56 flex items-center justify-center">
                                {wahaQrBase64 ? (
                                  <img 
                                    src={wahaQrBase64.startsWith("data:image/") ? wahaQrBase64 : `data:image/png;base64,${wahaQrBase64}`} 
                                    alt="QR Code WhatsApp" 
                                    className="w-48 h-48 object-contain"
                                    onError={(e) => {
                                      setTimeout(() => fetchWahaQr(), 2000);
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-orange-500 animate-spin"></div>
                                )}
                            </div>
                            <h5 className="font-bold text-slate-800 dark:text-slate-100">Scan QR Code ini</h5>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                              Buka aplikasi WhatsApp di HP Anda, pilih menu Perangkat Tertaut, lalu scan kode QR di atas.
                            </p>
                          </div>
                        )}

                        {wahaStatus === 'WORKING' && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center text-green-600 dark:text-green-300">
                                <Smartphone className="w-5 h-5" />
                              </div>
                              <div>
                                <h6 className="font-bold text-green-800 dark:text-green-300">Perangkat WhatsApp Terhubung</h6>
                                <p className="text-xs text-green-600 dark:text-green-400">Siap mengirimkan notifikasi absensi.</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={logoutWahaSession}
                              className="px-4 py-2 bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/50 text-xs font-bold rounded-lg transition-colors"
                            >
                              Putuskan Koneksi
                            </button>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              )}

              {user.role === "OWNER" && (
                <div className="pt-6 border-t border-slate-50">
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Transfer Kepemilikan (Danger Zone)
                    </h4>
                    <p className="text-xs text-red-500/80 dark:text-red-400/80 mb-6 font-medium">
                      Pindahkan status OWNER Anda ke staff lain. Hati-hati, karena setelah dipindahkan, Anda akan menjadi SUPER ADMIN biasa dan tidak bisa membatalkan tindakan ini sendiri.
                    </p>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsTransferModalOpen(true);
                        fetchEmployeesForTransfer();
                      }}
                      className="px-6 py-3 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 font-bold text-sm rounded-xl transition-colors"
                    >
                      Buka Panel Transfer Owner
                    </button>
                  </div>
                </div>
              )}

                <div className="pt-6 border-t border-slate-50 flex justify-end">
                  <button
                    onClick={handleSaveCompany}
                    disabled={saving}
                    className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <Smartphone className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Simpan Instansi
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden p-6 sm:p-10">
              <h4 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                Integrasi Mesin Fingerprint
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mb-6 sm:mb-8">
                Integrasi mesin absensi Biofinger / ZKTeco dengan layanan Cloud AbsensiKita sangat mudah. Anda hanya perlu mengatur Cloud Server Setting di dalam menu mesin absensi tanpa perlu menggunakan script perantara.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 ml-1">
                    Alamat Cloud Server
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      readOnly
                      value={`absensikita.id`}
                      className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 outline-none"
                    />
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText("absensikita.id");
                          alert("Alamat Server disalin ke clipboard!");
                        }}
                        className="whitespace-nowrap px-6 py-4 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-2xl transition-colors flex-1 sm:flex-none text-center"
                      >
                        Salin URL
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-400 space-y-2">
                    <p className="font-bold border-b border-amber-200/50 pb-2 mb-2">
                      Panduan Konfigurasi di Mesin Absensi:
                    </p>
                    <ol className="list-decimal pl-4 space-y-2">
                      <li>
                        Buka menu pada mesin absensi. Pergi ke bagian <strong>Comm.</strong> (Komunikasi) atau <strong>Pengaturan Jaringan</strong>.
                      </li>
                      <li>
                        Pilih menu <strong>Cloud Server Setting</strong> (Pengaturan Server Cloud).
                      </li>
                      <li>
                        Tekan <strong>Server Address</strong> dan masukkan <code>absensikita.id</code>
                      </li>
                      <li>
                        Atur <strong>Server Port</strong> ke <code>80</code> atau <code>443</code>.
                      </li>
                      <li>
                        Pastikan <strong>Enable Domain Name</strong> dinyalakan (ON).
                      </li>
                      <li>
                        Pastikan mesin terkoneksi ke internet. Log absensi dan pendaftaran karyawan dari mesin akan otomatis masuk ke AbsensiKita. Sebaliknya, karyawan yang ditambah/diubah lewat web AbsensiKita juga otomatis dikirim ke mesin.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "overtime" ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-6 sm:mb-8">
               <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">Matriks Pengali Lembur</h3>
               <p className="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm mt-1">
                 Tentukan faktor pengali upah lembur berdasarkan urutan jam pada hari kerja maupun hari libur.
               </p>
             </div>

             <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">Hari Kerja</h4>
                      <table className="w-full text-sm">
                         <thead>
                            <tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                               <th className="pb-3 text-left">Jam Ke</th>
                               <th className="pb-3 text-left">Pengali (x)</th>
                               <th className="pb-3"></th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {overtimeMatrix.filter(m => m.tipe_hari === 'KERJA').map((m, idx) => (
                               <tr key={idx}>
                                  <td className="py-4 font-bold text-slate-700 dark:text-slate-300">
                                     <input 
                                       type="number" 
                                       value={m.jam_ke} 
                                       onChange={(e) => {
                                          const newM = [...overtimeMatrix];
                                          const itemIdx = newM.findIndex(item => item === m);
                                          newM[itemIdx].jam_ke = parseInt(e.target.value) || 0;
                                          setOvertimeMatrix(newM);
                                       }}
                                       className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                     />
                                  </td>
                                  <td className="py-4">
                                     <input 
                                       type="number" 
                                       step="0.1"
                                       value={m.pengali} 
                                       onChange={(e) => {
                                          const newM = [...overtimeMatrix];
                                          const itemIdx = newM.findIndex(item => item === m);
                                          newM[itemIdx].pengali = parseFloat(e.target.value) || 0;
                                          setOvertimeMatrix(newM);
                                       }}
                                       className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                     />
                                  </td>
                                  <td className="py-4 text-right">
                                     <button 
                                       onClick={() => setOvertimeMatrix(overtimeMatrix.filter(item => item !== m))}
                                       className="p-2 text-red-400 hover:text-red-500 transition-colors"
                                     >
                                        <X className="w-4 h-4" />
                                     </button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                      <button 
                        onClick={() => setOvertimeMatrix([...overtimeMatrix, { company_id: activeCompanyId, tipe_hari: 'KERJA', jam_ke: 1, pengali: 1.5 }])}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 mt-2 flex items-center gap-1"
                      >
                         + Tambah Aturan Hari Kerja
                      </button>
                   </div>

                   <div className="space-y-4">
                      <h4 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">Hari Libur</h4>
                      <table className="w-full text-sm">
                         <thead>
                            <tr className="text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                               <th className="pb-3 text-left">Mulai Jam Ke</th>
                               <th className="pb-3 text-left">Pengali (x)</th>
                               <th className="pb-3"></th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {overtimeMatrix.filter(m => m.tipe_hari === 'LIBUR').map((m, idx) => (
                               <tr key={idx}>
                                  <td className="py-4 font-bold text-slate-700 dark:text-slate-300">
                                     <input 
                                       type="number" 
                                       value={m.jam_ke} 
                                       onChange={(e) => {
                                          const newM = [...overtimeMatrix];
                                          const itemIdx = newM.findIndex(item => item === m);
                                          newM[itemIdx].jam_ke = parseInt(e.target.value) || 0;
                                          setOvertimeMatrix(newM);
                                       }}
                                       className="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                     />
                                  </td>
                                  <td className="py-4">
                                     <input 
                                       type="number" 
                                       step="0.1"
                                       value={m.pengali} 
                                       onChange={(e) => {
                                          const newM = [...overtimeMatrix];
                                          const itemIdx = newM.findIndex(item => item === m);
                                          newM[itemIdx].pengali = parseFloat(e.target.value) || 0;
                                          setOvertimeMatrix(newM);
                                       }}
                                       className="w-20 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                     />
                                  </td>
                                  <td className="py-4 text-right">
                                     <button 
                                       onClick={() => setOvertimeMatrix(overtimeMatrix.filter(item => item !== m))}
                                       className="p-2 text-red-400 hover:text-red-500 transition-colors"
                                     >
                                        <X className="w-4 h-4" />
                                     </button>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                      <button 
                        onClick={() => setOvertimeMatrix([...overtimeMatrix, { company_id: activeCompanyId, tipe_hari: 'LIBUR', jam_ke: 1, pengali: 2.0 }])}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 mt-2 flex items-center gap-1"
                      >
                         + Tambah Aturan Hari Libur
                      </button>
                   </div>
                </div>

                <div className="pt-8 border-t border-slate-50 dark:border-slate-800/50 flex justify-end">
                   <button
                     onClick={handleSaveOvertimeMatrix}
                     disabled={saving}
                     className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-50"
                   >
                     {saving ? <Smartphone className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                     Simpan Matriks
                   </button>
                </div>
             </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-800/60 shadow-sm overflow-hidden p-6 sm:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
               <div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <History className="w-6 h-6 text-blue-500" />
                    Audit Trail
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Catatan perubahan data untuk transparansi dan keamanan sistem.
                  </p>
               </div>
               <div className="flex items-center gap-3 w-full sm:w-auto">
                 <div className="relative flex-1 sm:w-64">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Search className="h-4 w-4 text-slate-400" />
                   </div>
                   <input
                     type="text"
                     placeholder="Cari NIP, Nama, Tabel..."
                     className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                     value={auditSearchTerm}
                     onChange={(e) => setAuditSearchTerm(e.target.value)}
                   />
                 </div>
                 <select
                   className="pl-4 pr-8 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
                   value={auditFilterAction}
                   onChange={(e) => setAuditFilterAction(e.target.value)}
                 >
                   <option value="ALL">Semua Aksi</option>
                   <option value="INSERT">INSERT</option>
                   <option value="UPDATE">UPDATE</option>
                   <option value="DELETE">DELETE</option>
                 </select>
                 <button onClick={fetchAuditLogs} className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 transition-colors">
                    <RefreshCcw className="w-4 h-4 text-slate-600" />
                 </button>
               </div>
             </div>

             <div className="overflow-x-auto">
                <table className="w-full text-sm">
                   <thead>
                      <tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] border-b border-slate-50 dark:border-slate-800">
                         <th className="pb-4 text-left font-black">Waktu</th>
                         <th className="pb-4 text-left font-black">Pelaksana</th>
                         <th className="pb-4 text-left font-black">Aksi</th>
                         <th className="pb-4 text-left font-black">Target</th>
                         <th className="pb-4 text-right font-black">Detail</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {auditLogs.filter(log => {
                        const searchLower = auditSearchTerm.toLowerCase();
                        const matchesSearch = log.nama_executor.toLowerCase().includes(searchLower) ||
                                              log.nip_executor.toLowerCase().includes(searchLower) ||
                                              log.target_table.toLowerCase().includes(searchLower) ||
                                              (log.target_id && log.target_id.toLowerCase().includes(searchLower));
                        const matchesFilter = auditFilterAction === 'ALL' || log.action_type === auditFilterAction;
                        return matchesSearch && matchesFilter;
                      }).map((log) => (
                         <tr key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                               {new Date(log.created_at).toLocaleString('id-ID')}
                            </td>
                            <td className="py-4">
                               <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 dark:text-slate-200">{log.nama_executor}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">{log.nip_executor}</span>
                               </div>
                            </td>
                            <td className="py-4">
                               <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                  log.action_type === 'INSERT' ? 'bg-emerald-50 text-emerald-600' :
                                  log.action_type === 'UPDATE' ? 'bg-blue-50 text-blue-600' :
                                  log.action_type === 'DELETE' ? 'bg-rose-50 text-rose-600' :
                                  'bg-slate-50 text-slate-600'
                               }`}>
                                  {log.action_type}
                               </span>
                            </td>
                            <td className="py-4">
                               <div className="flex flex-col">
                                  <span className="text-slate-600 dark:text-slate-300 font-bold capitalize">{log.target_table}</span>
                                  <span className="text-[10px] text-slate-400 font-mono tracking-tight">{log.target_id}</span>
                               </div>
                            </td>
                            <td className="py-4 text-right">
                               <button 
                                 onClick={() => setSelectedAudit(log)}
                                 className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                               >
                                  <Eye className="w-5 h-5" />
                               </button>
                            </td>
                         </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-20 text-center text-slate-400 italic">Belum ada catatan audit.</td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Detail Perubahan</h3>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">
                  {selectedAudit.action_type} - {selectedAudit.target_table}
                </p>
              </div>
              <button 
                onClick={() => setSelectedAudit(null)}
                className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                  <span className="text-slate-400 uppercase tracking-widest block mb-2">Pelaksana</span>
                  <p className="text-slate-700 dark:text-slate-200 font-bold">{selectedAudit.nama_executor} ({selectedAudit.nip_executor})</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl">
                  <span className="text-slate-400 uppercase tracking-widest block mb-2">IP Address</span>
                  <p className="text-slate-700 dark:text-slate-200 font-bold">{selectedAudit.ip_address || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 ml-1">Data Lama</h4>
                  <pre className="p-4 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs font-mono overflow-x-auto dark:text-slate-300">
                    {JSON.stringify(selectedAudit.old_data, null, 2)}
                  </pre>
                </div>
                <div>
                  <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 ml-1">Data Baru</h4>
                  <pre className="p-4 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-xs font-mono overflow-x-auto dark:text-slate-300">
                    {JSON.stringify(selectedAudit.new_data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 dark:bg-slate-950 flex justify-end">
              <button 
                onClick={() => setSelectedAudit(null)}
                className="px-8 py-3 bg-white dark:bg-slate-900 text-slate-600 font-black rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <ConnectionTestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        activeCompanyId={activeCompanyId}
      />

      {isTelegramModalOpen && telegramLinkCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full mx-auto flex items-center justify-center text-blue-600">
                <Bot className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">Buka Telegram</h3>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
                  Klik tombol di bawah ini atau buka Telegram dan kirim pesan ke bot kami untuk mengaitkan akun Anda.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Bot Target</p>
                <div className="font-mono font-bold text-slate-700 dark:text-slate-200">@AbsensiKitaIndo_Bot</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Kode Tautan (Otomatis)</p>
                <div className="font-mono font-black text-blue-600 text-lg tracking-wider">{telegramLinkCode}</div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={() => setIsTelegramModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-xl font-black text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Tutup
                </button>
                <a
                  href={`https://t.me/AbsensiKitaIndo_Bot?start=${telegramLinkCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsTelegramModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-black text-sm text-center shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors"
                >
                  Buka Telegram
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsTransferModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-red-600 mb-2 flex items-center gap-3">
              <Shield className="w-8 h-8" /> Transfer Owner
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">
              Pilih karyawan yang akan menerima kepemilikan aplikasi instansi Anda.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
                  Pilih Owner Baru
                </label>
                <div className="relative">
                  <select
                    value={selectedNewOwner}
                    onChange={(e) => setSelectedNewOwner(e.target.value)}
                    className="w-full pl-5 pr-10 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-red-500 transition-colors appearance-none"
                  >
                    <option value="">-- Silakan Pilih --</option>
                    {employeesForTransfer.map(emp => (
                      <option key={emp.nip} value={emp.nip}>{emp.nama} - {emp.nip} ({emp.role})</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={saving}
                  className="flex-1 px-6 py-4 rounded-xl font-black text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  disabled={saving || !selectedNewOwner}
                  className="flex-1 px-6 py-4 bg-red-600 text-white rounded-xl font-black text-sm text-center shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : "Transfer Sekarang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
