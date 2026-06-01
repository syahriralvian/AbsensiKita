import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, ShieldCheck, Zap, 
  LayoutDashboard, ScanFace, Check, 
  MessageCircle, Users
} from 'lucide-react';

const SWIPE_CONFIDENCE_THRESHOLD = 5000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

const pages = [
  // Page 0: Cover
  (
    <div className="flex flex-col items-center justify-center p-8 h-full text-center bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-8">
        <ShieldCheck className="w-12 h-12" />
      </div>
      <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
        Buku Panduan
      </h1>
      <p className="text-2xl text-blue-600 dark:text-blue-400 font-bold mb-4">
        Sistem AbsensiKita
      </p>
      <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto mb-8 text-lg">
        Panduan operasional pengguna & petunjuk teknis.
      </p>
      <div className="mt-auto animate-pulse flex flex-col items-center gap-2">
         <span className="text-sm text-slate-400 font-medium tracking-widest uppercase">Geser untuk membuka</span>
         <ArrowRight className="w-4 h-4 text-slate-300" />
      </div>
    </div>
  ),
  // Page 1: Pengantar
  (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">1. Gambaran Umum</h2>
      </div>
      <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
        <p>
          Sistem Absensi menggunakan validasi <strong>AI Face Recognition</strong> dan <strong>Geo-Tagging</strong>.
        </p>
        <ul className="mt-4 list-none pl-0 space-y-3">
          <li className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
            <span><strong>Dashboard:</strong> Manajemen aktivitas, laporan & shift untuk Admin.</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
            <span><strong>Portal Web:</strong> Absen masuk/pulang lewat kamera smartphone.</span>
          </li>
        </ul>
      </div>
       <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700">
            <div className="flex gap-4 items-end">
               <div className="w-32 h-24 bg-white dark:bg-slate-900 rounded-t-lg border border-slate-300 dark:border-slate-600 relative flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-8 h-8 text-blue-500 opacity-50" />
                  <div className="absolute -bottom-1.5 w-36 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-b-md -ml-2"></div>
               </div>
               <div className="w-12 h-24 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                  <ScanFace className="w-6 h-6 text-emerald-500 opacity-50" />
               </div>
            </div>
            <p className="text-xs text-slate-500 mt-4 font-medium italic">PC Dashboard vs Mobile Portal</p>
       </div>
    </div>
  ),
  // Page 2: Panduan Admin
  (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
          <LayoutDashboard className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. Admin Dashboard</h2>
      </div>
      <div className="space-y-6">
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">2.1 Pantau Real-Time</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Lihat aktivitas siapa saja yang masuk, telat, absen atau sedang mengajukan izin hari ini.</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">2.2 Input Karyawan & Shift</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Tambahkan karyawan dari menu dan tetapkan shift mereka agar portal login mereka aktif digunakan.</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2">2.3 Verifikasi Wajah</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Minta karyawan Anda untuk login & merekam bentuk wajah minimal 1 kali di halaman portal mandiri mereka.</p>
        </div>
      </div>
    </div>
  ),
  // Page 3: Cara Absen Pegawai
  (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
          <ScanFace className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">3. Cara Absen (Pegawai)</h2>
      </div>
      <div className="space-y-4">
         <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center font-black text-rose-500 text-lg shrink-0">1</div>
            <div className="mt-1">
               <h4 className="font-bold text-slate-800 dark:text-slate-200">Buka Portal Karyawan</h4>
               <p className="text-slate-600 dark:text-slate-400 text-sm">Gunakan browser HP, masukkan NIP beserta dengan kata sandinya.</p>
            </div>
         </div>
         <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center font-black text-rose-500 text-lg shrink-0">2</div>
            <div className="mt-1">
               <h4 className="font-bold text-slate-800 dark:text-slate-200">Pindai Wajah</h4>
               <p className="text-slate-600 dark:text-slate-400 text-sm">Arahkan kamera hingga wajah terlihat jelas. Izinkan Akses GPS ketika ditanyakan.</p>
            </div>
         </div>
         <div className="flex items-start gap-4 pt-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg">
               <Check className="w-6 h-6" />
            </div>
            <div className="mt-1">
               <h4 className="font-bold text-slate-800 dark:text-slate-200">Tekan Simpan Data</h4>
               <p className="text-slate-600 dark:text-slate-400 text-sm">Sistem akan segera mencatat presensi.</p>
            </div>
         </div>
      </div>
    </div>
  ),
  // Page 4: Telegram
  (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 text-sky-600 rounded-xl flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">4. Fitur Telegram Bot</h2>
      </div>
      <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">Notifikasi instan real-time untuk absen & pengunduhan laporan.</p>
      
      <div className="space-y-4">
         <div className="flex gap-4 items-start bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
            <ShieldCheck className="w-8 h-8 text-blue-500 shrink-0" />
            <div>
               <h4 className="font-bold text-sm text-slate-800 dark:text-white">Bagi Administrator</h4>
               <p className="text-xs text-slate-500 mt-1">Gunakan fitur ini untuk menarik laporan absen ke bentuk Excel, atau monitor keterlambatan harian secara langsung.</p>
            </div>
         </div>
         
         <div className="flex gap-4 items-start bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
            <Users className="w-8 h-8 text-emerald-500 shrink-0" />
            <div>
               <h4 className="font-bold text-sm text-slate-800 dark:text-white">Bagi Karyawan</h4>
               <p className="text-xs text-slate-500 mt-1">Dapatkan bukti (struk absen) di telegram setiap sukses absen.</p>
            </div>
         </div>
         
         <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-xl border border-sky-100 dark:border-sky-800/30">
            <p className="text-xs text-sky-800 dark:text-sky-300 font-medium text-center">
               Cari <b>@absensikitabot</b> di app Telegram & Hubungkan.
            </p>
         </div>
      </div>
    </div>
  ),
  // Page 5: FAQ & Help
  (
    <div className="p-8 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">5. Solusi Cepat (FAQ)</h2>
      <div className="space-y-6 text-sm">
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200">Bagaimana jika HP offline / no sinyal?</h4>
          <p className="text-slate-600 dark:text-slate-400 mt-1 mb-0">Sistem PWA akan menyimpan data absensi Anda kedalam memori cache, dan segera mengirimnya ketika internet tersedia.</p>
        </div>
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200">Dapatkah karyawan menggunakan fake GPS?</h4>
          <p className="text-slate-600 dark:text-slate-400 mt-1 mb-0">Tidak, engine kami dibekali pembacaan Mock Location yang memblokir perangkat apabila lokasi dimanipulasi.</p>
        </div>
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-200">Kamera error atau tidak mau hidup?</h4>
          <p className="text-slate-600 dark:text-slate-400 mt-1 mb-0">Rekomendasi gunakan Google Chrome/Safari ter-update.</p>
        </div>
      </div>
      <div className="text-center mt-12 mb-4 text-xs font-medium text-slate-400">
         Akhir dari Buku Panduan
      </div>
    </div>
  )
];

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
    rotateY: direction > 0 ? -15 : 15,
    scale: 0.95
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    rotateY: 0,
    scale: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0,
    rotateY: direction < 0 ? -15 : 15,
    scale: 0.95
  }),
};

export default function GuidePage() {
  const [[page, direction], setPage] = useState([0, 0]);

  const paginate = (newDirection: number) => {
    const nextPage = page + newDirection;
    if (nextPage >= 0 && nextPage < pages.length) {
      setPage([nextPage, newDirection]);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col pt-safe font-sans">
      {/* Top Header */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 shrink-0 flex items-center justify-between shadow-sm">
         <Link to="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-5 h-5" /> 
            <span className="font-bold">Kembali</span>
         </Link>
         <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Hal {page + 1}/{pages.length}
            </span>
         </div>
      </div>

      {/* Swipeable Book Area */}
      <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 overflow-hidden">
         <div 
           className="relative w-full max-w-sm aspect-[4/5] sm:aspect-[3/4] bg-transparent perspective-[1500px]"
         >
            <AnimatePresence initial={false} custom={direction}>
               <motion.div
                 key={page}
                 custom={direction}
                 variants={variants}
                 initial="enter"
                 animate="center"
                 exit="exit"
                 transition={{
                   x: { type: "spring", stiffness: 300, damping: 30 },
                   opacity: { duration: 0.2 },
                   rotateY: { type: "spring", stiffness: 200, damping: 30 }
                 }}
                 drag="x"
                 dragConstraints={{ left: 0, right: 0 }}
                 dragElastic={0.8}
                 onDragEnd={(e, { offset, velocity }) => {
                   const swipe = swipePower(offset.x, velocity.x);
                   if (swipe < -SWIPE_CONFIDENCE_THRESHOLD) {
                     paginate(1);
                   } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD) {
                     paginate(-1);
                   }
                 }}
                 className="absolute inset-0 w-full h-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-grab active:cursor-grabbing transform-gpu"
                 style={{ backfaceVisibility: "hidden" }}
               >
                 {pages[page]}
               </motion.div>
            </AnimatePresence>
         </div>
      </div>

      {/* Pagination Controls */}
      <div className="pb-8 pt-2 px-4 flex flex-col items-center justify-center shrink-0">
         <div className="flex items-center gap-8 mb-6">
            <button
               onClick={() => paginate(-1)}
               disabled={page === 0}
               className="w-14 h-14 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 transition-all active:scale-95 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
               <ArrowLeft className="w-6 h-6 ml-[-2px]" />
            </button>
            
            <div className="flex gap-2">
               {pages.map((_, i) => (
                  <div 
                     key={i} 
                     className={`h-2.5 rounded-full transition-all ${i === page ? 'w-8 bg-blue-600' : 'w-2.5 bg-slate-300 dark:bg-slate-700 cursor-pointer hover:bg-slate-400'}`} 
                     onClick={() => {
                        if (i !== page) setPage([i, i > page ? 1 : -1])
                     }} 
                  />
               ))}
            </div>

            <button
               onClick={() => paginate(1)}
               disabled={page === pages.length - 1}
               className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-md shadow-blue-500/30 disabled:opacity-40 transition-all active:scale-95 hover:bg-blue-700"
            >
               <ArrowRight className="w-6 h-6 mr-[-2px]" />
            </button>
         </div>
      </div>
    </div>
  );
}
