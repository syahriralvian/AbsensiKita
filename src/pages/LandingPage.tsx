import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Zap,
  LayoutGrid,
  DownloadCloud,
  Menu,
  X,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  ScanFace,
  MapPin,
  FileText,
  Users,
  Clock,
  Smartphone,
  Sun,
  Moon,
  CreditCard,
  Server,
  Star,
  MessageCircle,
} from "lucide-react";
import PublicConnectionTestModal from "../components/PublicConnectionTestModal";
import { QRCodeSVG } from "qrcode.react";

export default function LandingPage() {
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass px-4 sm:px-6 md:px-12 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <ShieldCheck className="w-4 h-4 sm:w-5 h-5" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">
            AbsensiKita<span className="text-blue-600">.</span>
          </span>
        </div>

        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
          <a href="#features" className="hover:text-blue-600 transition-colors">
            Fitur
          </a>
          <a
            href="#advantages"
            className="hover:text-blue-600 transition-colors"
          >
            Keunggulan
          </a>
          <a href="#pricing" className="hover:text-blue-600 transition-colors">
            Harga
          </a>
          <a href="#about" className="hover:text-blue-600 transition-colors">
            Tentang
          </a>
          <Link to="/download" className="hover:text-blue-600 transition-colors">
            Download
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all mr-1 sm:mr-2"
            title="Toggle Dark Mode"
          >
            {isDark ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => setIsTestModalOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap border-none"
          >
            <Server className="w-4 h-4 text-blue-500" />
            Cek Koneksi
          </button>
          <Link
            to="/login"
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-600 dark:hover:bg-slate-200 shadow-lg shadow-slate-200 dark:shadow-none transition-all whitespace-nowrap"
          >
            Masuk
          </Link>
          <button
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0"
          >
            <Menu className="w-5 h-5 sm:w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed inset-y-0 right-0 w-64 bg-white dark:bg-slate-900 shadow-2xl z-[70] p-4 sm:p-6 flex flex-col"
            >
              <div className="flex justify-end mb-8">
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="text-slate-500 dark:text-slate-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex flex-col gap-4 sm:gap-6 text-lg font-bold text-slate-700 dark:text-slate-200">
                <a
                  href="#features"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:text-blue-600 transition-colors flex items-center gap-2"
                >
                  <LayoutGrid className="w-5 h-5" /> Fitur
                </a>
                <a
                  href="#advantages"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:text-blue-600 transition-colors flex items-center gap-2"
                >
                  <Zap className="w-5 h-5" /> Keunggulan
                </a>
                <a
                  href="#pricing"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:text-blue-600 transition-colors flex items-center gap-2"
                >
                  <CreditCard className="w-5 h-5" /> Harga
                </a>
                <a
                  href="#about"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:text-blue-600 transition-colors flex items-center gap-2"
                >
                  <Users className="w-5 h-5" /> Tentang
                </a>
                <Link
                  to="/download"
                  onClick={() => setIsMenuOpen(false)}
                  className="hover:text-blue-600 transition-colors flex items-center gap-2"
                >
                  <DownloadCloud className="w-5 h-5" /> Download
                </Link>
                <hr className="border-slate-100 dark:border-slate-800" />
                <Link
                  to="/login"
                  className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 py-4 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition font-bold flex items-center justify-center gap-2 outline-none"
                >
                  <PlayCircle className="w-5 h-5" /> Coba Demo
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center overflow-hidden">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="space-y-8 text-center md:text-left"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold tracking-wider uppercase"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Face Recognition AI
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl font-bold leading-tight text-slate-900 dark:text-white tracking-tight"
          >
            Ubah Smartphone Jadi <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
              Mesin Absensi.
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-slate-500 dark:text-slate-400 text-lg md:text-xl max-w-xl leading-relaxed"
          >
            Gantikan mesin sidik jari yang mahal dan tidak efisien. Sistem
            pengenalan wajah kami terintegrasi langsung dengan payroll secara
            real-time.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start"
          >
            <Link
              to="/register"
              className="bg-blue-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 shadow-xl shadow-blue-500/20 dark:shadow-blue-900/20 transition-all hover:-translate-y-1 font-bold outline-none flex-1"
            >
              Mulai Sekarang <ArrowRight className="w-5 h-5" />
            </Link>
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 px-6 py-3 md:px-8 md:py-4 rounded-2xl flex items-center justify-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-bold text-slate-700 dark:text-slate-200 flex-1 cursor-pointer"
            >
              <MessageCircle className="w-6 h-6 text-sky-500" />
              <div className="text-left">
                <div className="text-[10px] opacity-60 uppercase">
                  Telegram Bot
                </div>
                <div className="text-sm border-none">Buka / Scan QR</div>
              </div>
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative max-w-[320px] w-full mx-auto"
        >
          <div className="absolute -inset-4 bg-gradient-to-tr from-blue-100 to-indigo-50 rounded-[3rem] blur-3xl opacity-40 -z-10" />

          {/* Simulated Mobile Phone Bezel */}
          <div className="relative bg-slate-950 rounded-[3rem] p-3 shadow-2xl border-[6px] border-slate-800 overflow-hidden group">
            {/* Phone Notch */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-slate-950 rounded-b-3xl z-20 flex justify-center items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-800/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-blue-900/50"></div>
            </div>

            <div className="w-full h-[600px] relative rounded-[2.25rem] overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
              {/* Background image animated to simulate movement (holding hand shake) */}
              <motion.img
                animate={{
                  scale: [1.1, 1.15, 1.1],
                  x: ["0%", "2%", "0%", "-2%", "0%"],
                  y: ["0%", "-1%", "1%", "0%", "0%"],
                  rotate: [0, 1, 0, -1, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
                className="absolute inset-0 w-full h-full object-cover object-center scale-110"
                alt="Wajah yang discan"
              />

              {/* Scan UI layer */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Scan box overlay. Using immense box-shadow to dim everything outside this box. */}
                <div className="relative w-48 h-64 border-2 border-emerald-400 rounded-full overflow-hidden shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] backdrop-blur-[1px]">
                  {/* Face landmark guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-40">
                    <ScanFace className="w-24 h-24 text-emerald-400 stroke-[1]" />
                  </div>

                  {/* Scanning Laser Animation */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-400/60 to-transparent h-16 w-full blur-sm"
                    animate={{ y: ["-100%", "500%"] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </div>

                {/* Floating UI Elements */}
                <div className="absolute bottom-16 left-0 right-0 flex justify-center">
                  <motion.div
                    animate={{
                      opacity: [0, 1, 1, 0, 0],
                      scale: [0.9, 1, 1, 0.9, 0.9],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      times: [0, 0.1, 0.5, 0.6, 1],
                      ease: "easeInOut",
                    }}
                    className="absolute bg-emerald-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-xl shadow-emerald-500/30"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Absen Berhasil!
                  </motion.div>

                  <motion.div
                    animate={{
                      opacity: [1, 0, 0, 1, 1],
                      scale: [1, 0.9, 0.9, 1, 1],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      times: [0, 0.1, 0.5, 0.6, 1],
                      ease: "easeInOut",
                    }}
                    className="absolute bg-slate-900/80 backdrop-blur-md text-white px-6 py-3 rounded-full font-medium flex items-center gap-3 shadow-xl border border-white/10"
                  >
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                    Mendeteksi Wajah...
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating 'Waktu Masuk' info overlay */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, type: "spring" }}
            className="absolute top-1/4 -right-8 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-4 border border-slate-100 dark:border-slate-700 z-30"
          >
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="pr-4">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Waktu Masuk
              </p>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">
                07:58 AM
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-24 px-6 md:px-12 bg-white dark:bg-slate-900"
      >
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Fitur Lengkap untuk Manajemen Karyawan Modern
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Semua yang Anda butuhkan untuk absensi, penggajian, dan laporan
              harian dalam satu aplikasi canggih berbasis AI.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: <ScanFace className="w-6 h-6 text-blue-500" />,
                title: "Absen Wajah AI",
                desc: "Karyawan dapat absen dengan scan wajah menggunakan Smartphone. Cepat, presisi, dan mencegah penitipan absen.",
              },
              {
                icon: <MapPin className="w-6 h-6 text-emerald-500" />,
                title: "Geo-Tagging Akurat",
                desc: "Sistem mendeteksi dan mencatat lokasi titik GPS karyawan secara akurat. Cocok untuk tim sales atau dinas.",
              },
              {
                icon: <FileText className="w-6 h-6 text-amber-500" />,
                title: "Laporan Otomatis",
                desc: "Rekapitulasi data kehadiran seperti Keterlambatan, Izin, Lembur secara otomatis. Ekspor mudah ke Excel.",
              },
              {
                icon: <Users className="w-6 h-6 text-purple-500" />,
                title: "Admin Dashboard Live",
                desc: "Pantau aktifitas absensi karyawan secara real-time kapanpun dimanapun dari dashboard web Anda.",
              },
              {
                icon: <Clock className="w-6 h-6 text-rose-500" />,
                title: "Manajemen Shift",
                desc: "Atur jadwal kerja dan shift kompleks secara fleksibel untuk berbagai departemen dan skenario kerja.",
              },
              {
                icon: <MessageCircle className="w-6 h-6 text-sky-500" />,
                title: "Notifikasi & Ekspor Telegram",
                desc: "Dapatkan notifikasi Live, update absensi, serta ekspor laporan rekapitulasi data langsung melalui Telegram Bot yang didesain khusus untuk Anda.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className="p-8 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/5 dark:hover:shadow-blue-900/20 transition-all group"
              >
                <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-600 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Advantage Section */}
      <section
        id="advantages"
        className="bg-slate-950 dark:bg-slate-950 border-t border-slate-900 py-32 px-6 md:px-12 text-white overflow-hidden"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-12">
            <div className="space-y-4">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Kenapa Harus{" "}
                <span className="text-blue-500">Pindah Sistem?</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl max-w-xl">
                Hilangkan biaya maintenance hardware dan risiko kecurangan
                dengan satu sistem terpadu yang jauh lebih murah dan efisien.
              </p>
            </div>

            <div className="space-y-6">
              {[
                {
                  icon: <LayoutGrid className="text-red-400 w-6 h-6" />,
                  title: "Tanpa Biaya Hardware",
                  desc: "Tidak perlu beli alat sidik jari. Cukup gunakan HP atau Tablet yang sudah tersedia di kantor.",
                },
                {
                  icon: <Zap className="text-blue-400 w-6 h-6" />,
                  title: "Real-time Sync",
                  desc: "Setiap data kehadiran langsung terkirim ke panel Admin saat itu juga tanpa perlu tarik data manual.",
                },
                {
                  icon: <ShieldCheck className="text-emerald-400 w-6 h-6" />,
                  title: "Anti-Spoofing AI",
                  desc: "Algoritma AI tercanggih kami mencegah manipulasi absen menggunakan foto, gambar, atau video.",
                },
              ].map((adv, i) => (
                <div
                  key={i}
                  className="flex items-center gap-6 p-6 bg-white/5 dark:bg-slate-900/40 rounded-[2rem] border border-white/5 dark:border-slate-800/50 hover:bg-white/10 dark:hover:bg-slate-800/50 transition-all group"
                >
                  <div className="w-16 h-16 bg-white/10 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform">
                    {adv.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-xl mb-1 text-slate-100">
                      {adv.title}
                    </h4>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {adv.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 relative">
            <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full -z-10" />
            {[
              {
                label: "Hardware Cost",
                value: "IDR 0",
                color: "text-blue-400",
              },
              { label: "Accuracy", value: "99.9%", color: "text-emerald-400" },
              { label: "Sync Speed", value: "< 1s", color: "text-amber-400" },
              { label: "Uptime", value: "99.9%", color: "text-purple-400" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10, scale: 1.05 }}
                className="p-10 bg-white/5 dark:bg-slate-900/50 backdrop-blur-md rounded-[3rem] border border-white/5 text-center shadow-2xl transition-all"
              >
                <h3
                  className={`text-3xl md:text-5xl font-black mb-3 ${stat.color}`}
                >
                  {stat.value}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="testimonials"
        className="py-24 px-6 md:px-12 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/50"
      >
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Apa Kata Mereka?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Komentar dari para HR dan pemilik usaha yang sudah beralih
              menggunakan AbsensiKita.
            </p>
          </div>

          <div className="relative flex overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-slate-50 dark:from-slate-800/30 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-slate-50 dark:from-slate-800/30 to-transparent z-10 pointer-events-none" />

            <motion.div
              className="flex gap-6 md:gap-8 w-max"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ ease: "linear", duration: 40, repeat: Infinity }}
            >
              {(() => {
                const reviews = [
                  {
                    text: "Sejak pindah ke AbsensiKita, rekap laporan akhir bulan jadi jauh lebih gampang. Gak perlu repot narik data flashdisk dari mesin fingerprint lama, semua udah otomatis ke-sync ke pusat. Sangat membantu!",
                    name: "Budi Santoso",
                    role: "HRD Perusahaan Logistik",
                    rating: 5,
                  },
                  {
                    text: "Aplikasi buat karyawannya ringan, absen selfie cepet banget meskipun koneksi kadang kurang stabil. Dan yang paling penting fitur geo-tagging-nya presisi, jadi gampang pantau anak sales canvassing.",
                    name: "Andi Wijaya",
                    role: "Sales Supervisor",
                    rating: 5,
                  },
                  {
                    text: "Dulunya suka pusing ngitung lemburan karena banyak shift yang ribet. Semenjak pake sistem ini, aturan kalkulasi sama potong keterlambatan bisa diatur otomatis, kerjaan tim HR jadi lebih efisien.",
                    name: "Siti Rahmawati",
                    role: "Manager Operasional",
                    rating: 5,
                  },
                  {
                    text: "Cocok banget buat usaha F&B yang punya banyak cabang. Saya bisa pantau jam masuk barista sama pelayan dari satu dashboard aja. Gak ada lagi cerita titip absen temen.",
                    name: "Reza Mahendra",
                    role: "Owner Cafe",
                    rating: 5,
                  },
                  {
                    text: "Fitur broadcast WhatsApp-nya juara sih. Tiap ada pengumuman mendadak atau sekadar ngingetin jam pulang, anak-anak langsung pada baca. Bener-bener ngebantu komunikasi internal.",
                    name: "Nabila Putri",
                    role: "Admin Staff",
                    rating: 5,
                  },
                  {
                    text: "Awalnya sempet skeptis bisa integrasiin mesin absensi lama ke cloud. Ternyata tim support-nya responsif banget ngebantu setup ADMS-nya. Sekarang mesin lama bisa dipake lagi tanpa ribet.",
                    name: "Hendrik Lie",
                    role: "IT Manager",
                    rating: 5,
                  },
                ];
                return [...reviews, ...reviews].map((review, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -5 }}
                    className="p-8 w-[320px] md:w-[400px] shrink-0 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 dark:hover:shadow-blue-900/10 transition-all flex flex-col"
                  >
                    <div className="flex gap-1 mb-6">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-5 h-5 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 mb-8 leading-relaxed text-sm md:text-base italic flex-grow">
                      &quot;{review.text}&quot;
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner shrink-0">
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">
                          {review.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {review.role}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ));
              })()}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="py-24 px-6 md:px-12 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
      >
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
              Pilihan Promo & Paket Berlangganan
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Harga transparan, pembayaran mudah. Gratis masa percobaan (Trial)
              selama 4 Bulan pertama!
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Standard Plan */}
            <div className="p-8 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-md relative flex flex-col hover:border-blue-300 transition-colors">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Paket Standart
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                Cocok untuk UMKM pemula.
              </p>

              <div className="flex flex-col gap-1 mb-8">
                <span className="text-3xl font-black text-slate-900 dark:text-white">
                  Rp 5.000
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                  / karyawan / bulan <span className="text-[10px]">*belum termasuk PPN 12%</span>
                </span>
              </div>

              <ul className="space-y-4 mb-10 w-full flex-grow">
                {[
                  "Karyawan Tidak Terbatas",
                  "Absensi Wajah AI & GPS",
                  "Manajemen Shift Lengkap",
                  "Penyimpanan Data 3 Bulan",
                  "Laporan Excel Dasar",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-slate-700 dark:text-slate-300 text-sm font-medium"
                  >
                    <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />{" "}
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className="block w-full py-4 text-center rounded-xl font-bold bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
              >
                Mulai Uji Coba
              </Link>
            </div>

            {/* Premium Plan */}
            <div className="p-8 bg-blue-600 rounded-[2rem] border border-blue-500 shadow-2xl shadow-blue-500/20 relative flex flex-col md:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-full shadow-lg whitespace-nowrap">
                Paling Diminati
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Paket Premium
              </h3>
              <p className="text-blue-200 text-sm mb-6">
                Untuk usaha menengah (UMKM yang berkembang).
              </p>

              <div className="flex flex-col gap-1 mb-8">
                <span className="text-3xl font-black text-white">
                  Rp 10.000
                </span>
                <span className="text-blue-200 text-sm font-medium">
                  / karyawan / bulan <span className="text-[10px]">*belum termasuk PPN 12%</span>
                </span>
              </div>

              <ul className="space-y-4 mb-10 w-full flex-grow">
                {[
                  "Karyawan Tidak Terbatas",
                  "Semua Fitur Standart",
                  "Penyimpanan Data 1 Tahun",
                  "Export & Auto-Sync Google Sheets",
                  "Notifikasi Presensi ke WhatsApp",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-white text-sm font-medium"
                  >
                    <CheckCircle2 className="w-5 h-5 text-blue-300 shrink-0" />{" "}
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className="block w-full py-4 text-center rounded-xl font-bold bg-white text-blue-600 hover:bg-slate-50 transition-colors shadow-xl shadow-blue-900/20"
              >
                Mulai Uji Coba 4 Bulan
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="py-24 px-6 md:px-12 bg-blue-50 dark:bg-slate-900 border-t border-blue-100 dark:border-slate-800 text-center"
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Tentang <span className="text-blue-600">AbsensiKita</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
            AbsensiKita adalah platform manajemen kehadiran cloud-based yang
            didesain untuk perusahaan modern. Kami percaya bahwa teknologi AI
            dapat menyederhanakan proses HR, mengurangi kecurangan, dan
            memberikan wawasan real-time yang akurat. Baik untuk tim operasional
            lapangan, gudang, maupun staff tingkat atas, AbsensiKita memberikan
            fleksibilitas tanpa kompromi pada keamanan.
          </p>
        </div>
      </section>


      <footer className="mt-auto py-16 px-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-lg text-slate-800 dark:text-slate-100">
                AbsensiKita Cloud
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
              Solusi absensi AI canggih dan integrasi payroll tercepat untuk
              UMKM hingga perusahaan skala besar di Indonesia.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">
              Perusahaan
            </h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link to="/terms" className="hover:text-blue-600 transition">
                  Syarat & Ketentuan
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-blue-600 transition">
                  Kebijakan Privasi
                </Link>
              </li>
              <li>
                <Link to="/guide" className="hover:text-blue-600 transition">
                  Buku Panduan
                </Link>
              </li>
              <li>
                <a href="#about" className="hover:text-blue-600 transition">
                  Tentang Kami
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">
              Hubungi Kami
            </h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Email:
                </span>
                <a
                  href="mailto:absensikitacloud@gmail.com"
                  className="hover:text-blue-600 transition"
                >
                  absensikitacloud@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Telp/WA:
                </span>
                <span>+62 85157004261</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  Alamat:
                </span>
                <span className="leading-snug">
                  Kemiri Indah BG-05, Sidoarjo, Jawa Timur
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 pt-8 border-t border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-left text-center">
            &copy; 2026 AbsensiKita Cloud System. Hak Cipta Dilindungi
            Undang-Undang.
          </p>
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Powered by
            </span>
            <span className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Jagoan Digital Solution
            </span>
          </div>
        </div>
      </footer>

      <PublicConnectionTestModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />

      {isQRModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsQRModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full mx-auto shadow-2xl overflow-hidden flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mb-6">
              <MessageCircle className="w-8 h-8 text-sky-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Bot Telegram</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
              Scan kode QR di bawah ini, atau ketuk tombol untuk membuka AbsensiKita Bot di Telegram.
            </p>
            
            <div className="bg-white p-4 rounded-2xl mb-8 shadow-sm border border-slate-100">
              <QRCodeSVG 
                value="https://t.me/AbsensiKitaIndo_Bot" 
                size={200}
                level="Q"
                includeMargin={false}
              />
            </div>

            <a 
              href="https://t.me/AbsensiKitaIndo_Bot" 
              target="_blank" 
              rel="noreferrer"
              className="w-full bg-sky-500 text-white font-bold py-4 px-6 rounded-2xl hover:bg-sky-600 transition-colors flex justify-center items-center gap-2 mb-4"
              onClick={() => setIsQRModalOpen(false)}
            >
              <MessageCircle className="w-5 h-5" /> Buka Telegram
            </a>
            
            <button 
              onClick={() => setIsQRModalOpen(false)}
              className="text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Tutup
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}


