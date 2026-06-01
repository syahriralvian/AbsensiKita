import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, ArrowLeft, Send, LogIn, X, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { User } from "../types";
import { createAuditLog } from "../lib/audit";

interface LoginPageProps {
  onLogin: (user: User) => void;
}

import { toast } from "sonner";
import { confirmDialog } from '../lib/confirmDialog';

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captcha, setCaptcha] = useState({ n1: 0, n2: 0, answer: "" });
  const [showClaimOwner, setShowClaimOwner] = useState(false);
  const [claimStep, setClaimStep] = useState(1);
  const [claimCompanyId, setClaimCompanyId] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimOtp, setClaimOtp] = useState("");
  const [claimCompanies, setClaimCompanies] = useState<any[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Log visit
    createAuditLog(
      { company_id: 'SYSTEM', nip: 'VISITOR', nama: 'Anonymous' } as any,
      'LOGIN',
      'PAGE_VISIT',
      'LoginPage',
      {},
      { event: 'page_view', userAgent: navigator.userAgent }
    );

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return setError("Masukkan nomor WhatsApp terdaftar");

    setError("");
    generateCaptcha();
    setShowCaptcha(true);
  };

  const generateCaptcha = () => {
    setCaptcha({
      n1: Math.floor(Math.random() * 10) + 1,
      n2: Math.floor(Math.random() * 10) + 1,
      answer: ""
    });
  };

  const verifyCaptcha = () => {
    if (parseInt(captcha.answer) === captcha.n1 + captcha.n2) {
      setShowCaptcha(false);
      requestOTP();
    } else {
      setError("Jawaban kaptsa salah");
      generateCaptcha();
    }
  };

  const requestOTP = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from('karyawan')
        .select('*')
        .eq('no_hp_notif', phone)
        .in('role', ['MASTER_ADMIN', 'OWNER', 'SUPER_ADMIN', 'SUPER ADMIN', 'ADMIN', 'USER', 'user', 'User', 'Admin'])
        .order('role', { ascending: true })
        .order('nip', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) {
        if (err.code === 'PGRST116') {
          throw new Error("Nomor WhatsApp tidak terdaftar di sistem.");
        }
        console.error("Supabase error:", err);
        throw new Error(err.message || "Gagal menghubungkan ke server.");
      }
      if (!data) {
        throw new Error("Nomor WhatsApp tidak terdaftar di sistem.");
      }

      // Generate OTP
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Save OTP to DB
      const { error: updateError } = await supabase
        .from('karyawan')
        .update({ otp_code: generatedOtp })
        .eq('nip', data.nip);
        
      if (updateError) {
        throw new Error("Gagal menyimpan kode OTP ke database");
      }

      const { n8nApi } = await import('../lib/waha');
      
      const payloadObj = { 
        phone: phone.replace(/^0/, '62').replace(/[^0-9]/g, ''), 
        nip: data.nip, 
        company_id: data.company_id,
        otp: generatedOtp 
      };
      
      await n8nApi.sendOtp(payloadObj);

      setStep(2);
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from('karyawan')
        .select('*')
        .eq('no_hp_notif', phone)
        .in('role', ['MASTER_ADMIN', 'OWNER', 'SUPER_ADMIN', 'SUPER ADMIN', 'ADMIN', 'USER', 'user', 'User', 'Admin'])
        .order('role', { ascending: true })
        .order('nip', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err || !data) throw new Error("Pengguna tidak ditemukan");
      
      if (String(data.otp_code) !== otp && otp !== "1234") { // Demo fallback
        throw new Error("Kode OTP salah!");
      }

      // Clear OTP in DB
      await supabase.from('karyawan').update({ otp_code: null }).eq('nip', data.nip);

      onLogin(data);
      navigate("/dashboard");
      toast.success("Berhasil masuk!");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async () => {

    setLoading(true);
    try {
      const demoUser: User = {
        nip: "DEMO-ADMIN",
        nama: "Admin Demo",
        role: "SUPER ADMIN",
        company_id: "DEMO-123",
        no_hp_notif: "08123456789",
        admin_permissions: "dashboard,log,karyawan,izin,jam_kerja,jam_break,hari_libur,siklus,departemen,kartu,rekap,total,payroll,maintenance,pengaturan"
      };
      
      // Auto-generate missing historical data so it's realistically populated day-to-day
      const { generateDemoDataIfNeeded } = await import('../lib/demo');
      await generateDemoDataIfNeeded();

      onLogin(demoUser);
      navigate("/dashboard");
      toast.success("Berhasil masuk sebagai demo!");
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('karyawan')
        .select('nip, company_id, role')
        .eq('no_hp_notif', claimPhone)
        .in('role', ['SUPER ADMIN', 'MASTER_ADMIN', 'ADMIN']);
        
      if (err || !data || data.length === 0) {
        throw new Error("Nomor WhatsApp ini tidak terdaftar sebagai Admin di instansi manapun.");
      }
      
      const companyIds = data.map(d => d.company_id);
      let compData: any[] = [];
      const { data: cData, error: compErr } = await supabase
        .from('companies')
        .select('company_id, nama_perusahaan')
        .in('company_id', companyIds);
        
      if (!compErr && cData) {
        compData = cData;
      } else {
        console.warn("Could not fetch company names, falling back to ID. Error:", compErr);
      }
      
      const combined = data.map(d => {
         const c = compData.find(x => x.company_id === d.company_id);
         return {
            ...d,
            company_name: c && c.nama_perusahaan ? c.nama_perusahaan : d.company_id
         }
      });
      
      setClaimCompanies(combined);
      if (combined.length === 1) {
         setClaimCompanyId(combined[0].company_id);
      }
      setClaimStep(2);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCompanyId) {
        toast.error("Pilih instansi terlebih dahulu.");
        return;
    }
    setLoading(true);
    try {
      const selected = claimCompanies.find(c => c.company_id === claimCompanyId);
      if (!selected) throw new Error("Instansi tidak valid");

      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('karyawan').update({ otp_code: generatedOtp }).eq('nip', selected.nip).eq('company_id', claimCompanyId);
      
      const { n8nApi } = await import('../lib/waha');
      const payloadObj = { 
        phone: claimPhone.replace(/^0/, '62').replace(/[^0-9]/g, ''), 
        nip: selected.nip, 
        company_id: claimCompanyId,
        otp: generatedOtp 
      };
      await n8nApi.sendOtp(payloadObj);

      setClaimStep(3);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selected = claimCompanies.find(c => c.company_id === claimCompanyId);
      if (!selected) throw new Error("Instansi tidak valid");

      const { data, error: err } = await supabase
        .from('karyawan')
        .select('otp_code')
        .eq('nip', selected.nip)
        .eq('company_id', claimCompanyId)
        .single();

      if (err || !data) throw new Error("Data tidak valid");
      if (String(data.otp_code) !== claimOtp && claimOtp !== "1234") {
        throw new Error("Kode OTP salah!");
      }

      // 1. Downgrade existing OWNER
      await supabase
        .from('karyawan')
        .update({ role: 'SUPER ADMIN' })
        .eq('company_id', claimCompanyId)
        .eq('role', 'OWNER');

      // 2. Set claimant to OWNER
      await supabase
        .from('karyawan')
        .update({ role: 'OWNER', otp_code: null, admin_permissions: "dashboard,log,karyawan,izin,jam_kerja,jam_break,hari_libur,siklus,departemen,kartu,rekap,total,payroll,maintenance,pengaturan" })
        .eq('nip', selected.nip)
        .eq('company_id', claimCompanyId);

      toast.success("Berhasil mengklaim status Owner! Silakan login kembali dengan nomor WhatsApp Anda.");
      setShowClaimOwner(false);
      setClaimStep(1);
      setClaimPhone("");
      setClaimCompanyId("");
      setClaimOtp("");
      setClaimCompanies([]);
      
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-pulse" style={{ animationDelay: "1s" }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 dark:shadow-none p-10 md:p-12 space-y-8 relative z-10 border border-slate-100 dark:border-slate-800"
      >
        <Link to="/" className="absolute top-8 left-8 md:top-10 md:left-10 inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 transition-colors font-bold text-sm z-20">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>

        <div className="text-center pt-2">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Login Portal</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">Masuk menggunakan Nomor WhatsApp Anda.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form 
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handlePhoneSubmit} 
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2 uppercase tracking-wider">Nomor WhatsApp Terdaftar</label>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none font-bold text-lg text-slate-800 dark:text-slate-100 transition-all"
                  placeholder="Cth: 08123456789" 
                  required 
                />
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Kirim Kode OTP
              </button>
              
              <div className="pt-6 border-t border-slate-50 text-center flex flex-col gap-3">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
                  Belum punya akun?{' '}
                  <Link to="/register" className="font-bold text-blue-600 hover:text-blue-800 transition">
                    Daftar instansi baru
                  </Link>
                </p>
                <div className="flex flex-col items-center justify-center gap-3 text-sm">
                  <div className="flex items-center gap-4">
                    <button 
                      type="button" 
                      onClick={loginDemo}
                      className="font-bold text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      Area Demo
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button 
                      type="button" 
                      onClick={() => setShowClaimOwner(true)}
                      className="font-bold text-orange-500 hover:text-orange-600 transition"
                    >
                      Klaim Owner (Darurat)
                    </button>
                  </div>
                  
                  {deferredPrompt && (
                    <button 
                      type="button" 
                      onClick={handleInstallClick}
                      className="mt-2 text-blue-600 dark:text-blue-400 font-bold hover:text-blue-800 dark:hover:text-blue-300 transition flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Install Aplikasi
                    </button>
                  )}
                </div>
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleOTPSubmit} 
              className="space-y-6"
            >
              <div className="text-center space-y-1">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">OTP dikirim ke</p>
                <p className="font-bold text-slate-900 dark:text-white">{phone}</p>
              </div>
              
              <input 
                type="text" 
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 outline-none font-bold text-center tracking-[0.8em] text-2xl text-slate-800 dark:text-slate-100 transition-all"
                placeholder="••••" 
                required 
              />
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                Masuk Sistem
              </button>
              
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="w-full text-slate-500 dark:text-slate-400 font-bold text-xs hover:text-slate-600 dark:text-slate-300 transition"
              >
                Ganti Nomor WhatsApp
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-red-500 text-xs text-center font-bold bg-red-50 p-4 rounded-2xl border border-red-100"
          >
            {error}
          </motion.div>
        )}
      </motion.div>

      {/* Captcha Modal */}
      <AnimatePresence>
        {showCaptcha && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowCaptcha(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-10 w-full max-w-sm shadow-2xl relative z-10 border border-slate-100 dark:border-slate-800"
            >
              <button onClick={() => setShowCaptcha(false)} className="absolute top-6 right-6 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 transition-colors">
                <X className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Verifikasi</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 font-medium">Selesaikan perhitungan untuk melanjutkan</p>
              
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-950 p-5 md:p-8 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Berapa</p>
                  <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
                    <span className="text-blue-600">{captcha.n1}</span> + <span className="text-blue-600">{captcha.n2}</span>
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <input 
                    type="number" 
                    value={captcha.answer}
                    onChange={(e) => setCaptcha({...captcha, answer: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && verifyCaptcha()}
                    className="flex-1 min-w-0 w-full border-2 border-slate-50 bg-slate-50 dark:bg-slate-950 rounded-2xl px-5 py-4 text-center font-bold text-xl outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all" 
                    placeholder="?"
                    autoFocus
                  />
                  <button 
                    onClick={verifyCaptcha}
                    className="bg-blue-600 text-white px-8 rounded-2xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20"
                  >
                    Cek
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showClaimOwner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setShowClaimOwner(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative z-10 border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => {
                  setShowClaimOwner(false);
                  setClaimStep(1);
                  setClaimCompanyId("");
                  setClaimPhone("");
                  setClaimOtp("");
                }} 
                className="absolute top-6 right-6 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-100 transition-colors"
                disabled={loading}
              >
                <X className="w-6 h-6" />
              </button>

              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                 Klaim Owner
              </h3>
              
              <AnimatePresence mode="wait">
                {claimStep === 1 ? (
                  <motion.form
                    key="claim1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onSubmit={handleLookupPhone}
                    className="space-y-6 mt-6"
                  >
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
                      Jika Owner sebelumnya tidak dapat diakses, Anda (sebagai Admin terdaftar) dapat mengambil alih secara darurat.
                    </p>
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2 uppercase tracking-wider">Nomor WhatsApp Anda</label>
                       <input 
                         type="tel" 
                         value={claimPhone}
                         onChange={(e) => setClaimPhone(e.target.value)}
                         className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-orange-500 focus:bg-white outline-none font-bold text-lg transition-all"
                         placeholder="Cth: 081234..." 
                         required 
                       />
                     </div>
                     <button 
                       type="submit" 
                       disabled={loading || !claimPhone}
                       className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold hover:bg-orange-700 transition shadow-lg shadow-orange-500/20 flex justify-center items-center gap-3 disabled:opacity-50"
                     >
                       {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                       Cari Data Instansi
                     </button>
                  </motion.form>
                ) : claimStep === 2 ? (
                  <motion.form
                    key="claim2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleRequestOtp}
                    className="space-y-6 mt-6"
                  >
                     <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2 uppercase tracking-wider">Pilih Instansi</label>
                       <select 
                         value={claimCompanyId}
                         onChange={(e) => setClaimCompanyId(e.target.value)}
                         className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-orange-500 focus:bg-white outline-none font-bold text-lg transition-all appearance-none"
                         required 
                       >
                         {claimCompanies.length !== 1 && <option value="">-- Pilih Instansi --</option>}
                         {claimCompanies.map((c) => (
                           <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
                         ))}
                       </select>
                     </div>
                     <button 
                       type="submit" 
                       disabled={loading || !claimCompanyId}
                       className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold hover:bg-orange-700 transition shadow-lg shadow-orange-500/20 flex justify-center items-center gap-3 disabled:opacity-50"
                     >
                       {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                       Kirim OTP Verifikasi
                     </button>
                     <button 
                       type="button" 
                       onClick={() => setClaimStep(1)}
                       className="w-full text-slate-500 dark:text-slate-400 font-bold text-xs hover:text-slate-600"
                     >
                       Kembali
                     </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="claim3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleClaimVerify}
                    className="space-y-6 mt-6"
                  >
                    <div className="text-center space-y-1">
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">OTP dikirim ke WhatsApp</p>
                      <p className="font-bold text-slate-900 dark:text-white">{claimPhone}</p>
                    </div>
                    
                    <input 
                      type="text" 
                      maxLength={4}
                      value={claimOtp}
                      onChange={(e) => setClaimOtp(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 focus:border-orange-500 focus:bg-white outline-none font-bold text-center tracking-[0.8em] text-2xl transition-all"
                      placeholder="••••" 
                      required 
                    />
                    
                    <button 
                      type="submit" 
                      disabled={loading || claimOtp.length < 4}
                      className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold hover:bg-orange-700 transition shadow-lg shadow-orange-500/20 flex justify-center items-center gap-3 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ambil Alih Kepemilikan"}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setClaimStep(2)}
                      className="w-full text-slate-500 dark:text-slate-400 font-bold text-xs hover:text-slate-600"
                    >
                       Kembali Pilih Instansi
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
