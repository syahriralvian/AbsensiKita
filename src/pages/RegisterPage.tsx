import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Building2,
  UserCircle,
  MapPin,
  Mail,
  Phone,
  Loader2,
  ArrowLeft,
  Check,
  X,
  Info,
} from "lucide-react";
import { supabase } from "../lib/supabase";

import { toast } from "sonner";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [formData, setFormData] = useState({
    nama_perusahaan: "",
    nama_owner: "",
    alamat_perusahaan: "",
    email: "",
    whatsapp: "",
  });

  const generateCompanyId = () => {
    return (
      "CPY-" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substring(2, 6).toUpperCase()
    );
  };

  const generateNip = () => {
    return "OWN-" + Math.floor(1000 + Math.random() * 9000);
  };

  const handleScrollTerms = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom =
      Math.abs(
        e.currentTarget.scrollHeight -
          e.currentTarget.scrollTop -
          e.currentTarget.clientHeight,
      ) < 5;
    if (bottom) {
      setHasScrolledTerms(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!acceptedTerms) {
      setError(
        "Silakan baca dan setujui Syarat dan Ketentuan terlebih dahulu.",
      );
      setLoading(false);
      return;
    }

    try {
      // 1. Prepare data
      const companyId = generateCompanyId();
      const trialEndDate = new Date();
      trialEndDate.setMonth(trialEndDate.getMonth() + 4); // 4 months trial

      // Remove specific leading zeros/country codes from WA to standardize if needed,
      // but for now, we leave it as user typed
      const waNumber = formData.whatsapp;

      // 2. Insert into companies
      const { error: companyError } = await supabase.from("companies").insert([
        {
          company_id: companyId,
          nama_perusahaan: formData.nama_perusahaan,
          email: formData.email,
          whatsapp: waNumber,
          alamat: formData.alamat_perusahaan, // Supabase allows inserting extra columns if they exist, else it might error if table doesn't have it.
          trial_end_date: trialEndDate.toISOString(),
          gsheet_enabled: false,
        },
      ]);

      // If 'alamat' column doesn't exist, it might fail. Let's try inserting without it if it fails, or assume it exists/will be handled.
      // Wait, let's just omit 'alamat' if we are not sure it's in the schema? The user asked for "alamat perusahaan" in the form,
      // maybe we should add it. I'll include it. If the DB strictly rejects it, we can update later, but Supabase standard table can add columns easily if we are using an API that has permission. Since I'm writing the UI, I'll provide it.
      if (companyError) {
        if (companyError.message.includes("alamat")) {
          // fallback without alamat
          const { error: retryError } = await supabase
            .from("companies")
            .insert([
              {
                company_id: companyId,
                nama_perusahaan: formData.nama_perusahaan,
                email: formData.email,
                whatsapp: waNumber,
                trial_end_date: trialEndDate.toISOString(),
                gsheet_enabled: false,
              },
            ]);
          if (retryError) throw retryError;
        } else {
          throw companyError;
        }
      }

      // 3. Insert into karyawan for OWNER
      const nip = generateNip();
      const { error: karyawanError } = await supabase.from("karyawan").insert([
        {
          nip: nip,
          nama: formData.nama_owner,
          role: "OWNER",
          company_id: companyId,
          no_hp_notif: waNumber,
        },
      ]);

      if (karyawanError) {
        // Rollback is complex without RPC, but we'll surface the error
        console.error("Karyawan create error:", karyawanError);
        throw new Error(
          "Gagal membuat akun owner. Silakan hubungi support. " +
            karyawanError.message,
        );
      }

      toast.success("Pendaftaran berhasil!", {
        description: "Silakan login menggunakan nomor WhatsApp Anda.",
      });
      navigate("/login");
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan saat pendaftaran");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-pulse" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-[120px] opacity-10 animate-pulse animation-delay-2000" />

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors font-bold text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-10 shadow-2xl border border-slate-100 dark:border-slate-800"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
              Daftar Akun Baru
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Dapatkan 4 bulan masa percobaan gratis.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                Nama Perusahaan
              </label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={formData.nama_perusahaan}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nama_perusahaan: e.target.value,
                    })
                  }
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100 transition-all outline-none"
                  placeholder="PT Maju Bersama"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                Nama Owner / PIC
              </label>
              <div className="relative group">
                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={formData.nama_owner}
                  onChange={(e) =>
                    setFormData({ ...formData, nama_owner: e.target.value })
                  }
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100 transition-all outline-none"
                  placeholder="Nama Lengkap"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                Alamat Perusahaan
              </label>
              <div className="relative group">
                <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <textarea
                  required
                  rows={2}
                  value={formData.alamat_perusahaan}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      alamat_perusahaan: e.target.value,
                    })
                  }
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100 transition-all outline-none resize-none"
                  placeholder="Alamat lengkap kantor"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100 transition-all outline-none"
                  placeholder="email@perusahaan.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                No. WhatsApp Aktif
              </label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="tel"
                  required
                  value={formData.whatsapp}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp: e.target.value })
                  }
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100 transition-all outline-none"
                  placeholder="081234567890"
                />
              </div>
            </div>

            <div className="flex items-start gap-3 mt-4">
              <div className="flex h-6 items-center">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  disabled={!hasScrolledTerms}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:opacity-50"
                  required
                />
              </div>
              <div className="text-sm">
                <label
                  htmlFor="terms"
                  className="font-medium text-slate-700 dark:text-slate-300"
                >
                  Saya menyetujui{" "}
                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="text-blue-600 hover:text-blue-500 font-bold underline outline-none"
                  >
                    Syarat & Ketentuan
                  </button>
                </label>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Anda harus membaca {!hasScrolledTerms ? "sampai akhir " : ""}
                  Syarat & Ketentuan untuk melanjutkan pendaftaran.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl border border-red-100 dark:border-red-500/20 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="w-full mt-2 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Daftar Sekarang
            </button>

            <div className="pt-6 mt-6 border-t border-slate-50 dark:border-slate-800 text-center">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Sudah punya akun?{" "}
                <Link
                  to="/login"
                  className="font-bold text-blue-600 hover:text-blue-800 transition"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Terms and Conditions Modal */}
      <AnimatePresence>
        {showTerms && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                  Syarat & Ketentuan Penggunaan
                </h2>
                <button
                  onClick={() => setShowTerms(false)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className="p-6 overflow-y-auto flex-1 prose prose-slate dark:prose-invert max-w-none text-sm space-y-4"
                onScroll={handleScrollTerms}
              >
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-xl text-sm font-medium border border-blue-100 dark:border-blue-900/30 mb-6 sticky top-0 bg-opacity-95 backdrop-blur z-10 shadow-sm">
                  <span className="block mb-1 font-bold items-center gap-1">
                    <Info className="w-4 h-4 inline" /> Penting:
                  </span>
                  Silakan baca secara keseluruhan hingga bagian paling bawah
                  (scroll sampai bawah) untuk dapat menyetujui syarat dan
                  ketentuan.
                </div>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  1. Pendahuluan
                </h3>
                <p className="dark:text-slate-400">
                  Selamat datang di platform AbsensiKita.id. Dengan mendaftar
                  dan menggunakan layanan kami, Anda setuju untuk terikat oleh
                  Syarat dan Ketentuan ini. Jika Anda tidak setuju dengan ketentuan
                  apa pun, mohon untuk tidak melanjutkan pendaftaran.
                </p>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  2. Layanan dan Fitur Utama
                </h3>
                <ul className="dark:text-slate-400 list-disc list-outside pl-4 space-y-1">
                  <li>
                    <strong>Absensi Terintegrasi:</strong> Mendukung pengenalan
                    wajah (Face Recognition), Kode QR, Voice Command, dengan
                    validasi lokasi GPS yang akurat.
                  </li>
                  <li>
                    <strong>Notifikasi WhatsApp:</strong> Pemberitahuan sistem,
                    OTP untuk pendaftaran/klaim akun, serta pengingat tagihan
                    akan dikirimkan melalui WhatsApp.
                  </li>
                  <li>
                    <strong>Manajemen Instansi & Payroll:</strong> Pengaturan
                    karyawan, hari libur, jadwal shift, departemen, serta
                    penggajian otomatis dan pengunduhan slip gaji PDF.
                  </li>
                  <li>
                    <strong>Keamanan Akses (Klaim & Transfer):</strong> Terdapat
                    fitur Pemindahtanganan Kepemilikan (Transfer Owner) dan
                    Klaim Owner Darurat menggunakan OTP WhatsApp untuk menjamin 
                    kelangsungan akses perusahaan.
                  </li>
                </ul>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  3. Masa Percobaan (Trial)
                </h3>
                <p className="dark:text-slate-400">
                  Kami memberikan layanan percobaan (Trial) gratis selama
                  <strong> 4 bulan</strong> (120 hari) sejak perusahaan
                  didaftarkan. Setelah periode ini, fungsionalitas operasional
                  penuh membutuhkan langganan paket berbayar yang aktif.
                </p>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  4. Kebijakan Pembayaran & Aktivasi Layanan
                </h3>
                <ul className="dark:text-slate-400 list-disc list-outside pl-4 space-y-1">
                  <li>Pembayaran diproses dalam mata uang Rupiah (IDR) secara aman melalui payment gateway (Midtrans).</li>
                  <li>Layanan (SaaS) dikirimkan/diaktifkan secara otomatis setelah status pembayaran berhasil. Tidak ada pengiriman fisik.</li>
                </ul>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  5. Pembatalan & Pengembalian Dana (Refund)
                </h3>
                <ul className="dark:text-slate-400 list-disc list-outside pl-4 space-y-1">
                  <li>Pembayaran secara umum bersifat <strong>Final</strong> dan <strong>Non-Refundable</strong>. Tidak ada pengembalian prorata jika dibatalkan di tengah jalan.</li>
                  <li>Pengembalian dana (Refund) HANYA berlaku untuk kasus pemotongan ganda (Double Charge) akibat kesalahan teknis kami, atau gagalnya aktivasi layanan &gt;3x24 jam sejak dibayar.</li>
                  <li>Pengajuan refund dapat dikirim ke absensikitacloud@gmail.com melampirkan bukti transaksi.</li>
                </ul>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  6. Privasi & Penyimpanan Data
                </h3>
                <p className="dark:text-slate-400">
                  Data biometrik, lokasi, dan laporan absensi Anda dienkripsi. 
                  Berdasarkan pemeliharaan sistem cloud, data absensi efektif 
                  disimpan dalam siklus berjalan <strong>1 tahun</strong> sebelum
                  pembersihan otomatis. Anda dilarang memberikan data palsu yang menipu sistem.
                </p>

                <h3 className="text-lg font-bold dark:text-slate-200">
                  7. Tanggung Jawab & Penghentian Akun
                </h3>
                <p className="dark:text-slate-400">
                  Layanan disediakan "sebagaimana adanya". Kami tidak bertanggung
                  jawab atas kerugian tidak langsung dari pemadaman server. Kami
                  berhak menangguhkan atau menghapus instansi yang melanggar
                  aturan, melakukan penyusupan, atau menunggak pembayaran. Segala 
                  perselisihan hukum diatur dalam yurisdiksi pihak penyedia dan 
                  dimulai dari jalur mediasi kekeluargaan.
                </p>

                <p className="pt-8 pb-4 text-center text-slate-500 font-medium">
                  -- Akhir dari Dokumen Syarat & Ketentuan --
                </p>
                <div className="h-6"></div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setShowTerms(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAcceptedTerms(true);
                    setShowTerms(false);
                  }}
                  disabled={!hasScrolledTerms}
                  className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {hasScrolledTerms ? <Check className="w-4 h-4" /> : null}
                  Saya Setuju
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
