import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { 
  ArrowLeft, 
  Printer, 
  MapPin, 
  ScanFace, 
  FileText, 
  Clock, 
  Smartphone, 
  MessageCircle,
  Users,
  ShieldCheck,
  Zap,
  Building,
  LayoutDashboard,
  QrCode,
  DownloadCloud
} from "lucide-react";

export default function GuidePage() {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation & Controls - Hidden when printing */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 print:hidden">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-500 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Kembali
          </Link>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            <Printer className="w-5 h-5" /> Cetak / Download PDF
          </button>
        </div>

        {/* Document Content */}
        <div 
          ref={contentRef}
          className="bg-white dark:bg-slate-950 p-8 sm:p-12 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:-m-8 print:p-0"
        >
          {/* Cover Page Style Header */}
          <div className="text-center mb-16 pb-12 border-b border-slate-200 dark:border-slate-800 print:h-[90vh] print:flex print:flex-col print:justify-center">
            <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-8">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              Buku Panduan Lengkap
            </h1>
            <p className="text-2xl text-blue-600 dark:text-blue-400 font-bold mb-4">
              Sistem Manajemen AbsensiKita
            </p>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-8 text-lg">
              Panduan operasional dan petunjuk teknis penggunaan seluruh fitur aplikasi HR & Absensi berbasis AI.
            </p>
            <div className="text-sm text-slate-400 font-medium space-y-1 mt-auto">
              <p>Dokumen Versi: 2.1.0</p>
              <p>Terakhir Diperbarui: {new Date().toLocaleDateString('id-ID')}</p>
            </div>
          </div>

          <div className="print:break-before-page"></div>

          {/* Section 1: Pengantar */}
          <section className="mb-12 print:break-inside-avoid">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">1. Gambaran Umum Sistem</h2>
            </div>
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              <p>
                <strong>AbsensiKita</strong> merupakan platform modern manajemen kehadiran karyawan yang mengandalkan teknologi <i>Face Recognition</i> (AI), <i>Geo-Tagging</i> Presisi, dan terintegrasi penuh dengan <strong>Telegram Bot</strong>. Sistem terbagi menjadi dua antarmuka utama:
              </p>
              <ul className="mt-4 list-disc pl-6 space-y-2">
                <li><strong>Admin Dashboard:</strong> Panel manajemen (Web) untuk HR / Pemilik Perusahaan guna mengelola data karyawan, shift, rekapan absen, dan statistik.</li>
                <li><strong>Portal Karyawan:</strong> Antarmuka Web App / Mobile bagi karyawan untuk melakukan absen masuk dan pulang menggunakan kamera smartphone.</li>
              </ul>
            </div>
            
            {/* Mock Image Representation */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700">
               <div className="flex gap-4 items-end">
                  {/* Laptop Mockup */}
                  <div className="w-48 h-32 bg-white dark:bg-slate-900 rounded-t-lg border-4 border-slate-700 dark:border-slate-500 relative flex items-center justify-center">
                     <LayoutDashboard className="w-8 h-8 text-blue-500 opacity-50" />
                     <div className="absolute -bottom-2 w-56 h-2 bg-slate-700 dark:bg-slate-500 rounded-b-md -ml-4"></div>
                  </div>
                  {/* Phone Mockup */}
                  <div className="w-16 h-32 bg-white dark:bg-slate-900 rounded-xl border-4 border-slate-700 dark:border-slate-500 relative flex items-center justify-center">
                     <ScanFace className="w-6 h-6 text-emerald-500 opacity-50" />
                  </div>
               </div>
               <p className="text-xs text-slate-500 mt-4 font-medium italic">Ilustrasi: Akses Admin Dashboard (PC/Laptop) & Portal Karyawan (Smartphone)</p>
            </div>
          </section>

          {/* Section 2: Panduan Admin Dashboard */}
          <section className="mb-12 print:break-before-page">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">2. Panduan Admin Dashboard</h2>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">2.1. Akses & Login Admin</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Admin dapat mengakses dashboard melalui halaman utama (Landing Page) lalu mengklik tombol <strong>Login</strong>. Masukkan NIP Admin dan Password yang telah didaftarkan.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">2.2. Pemantauan Statistik Real-Time</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Di halaman utama Dashboard, Admin akan melihat statistik harian:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                   <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">Hadir</div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-500">45</div>
                   </div>
                   <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-800/30">
                      <div className="font-bold text-rose-700 dark:text-rose-400 text-sm">Terlambat</div>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-500">3</div>
                   </div>
                   <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                      <div className="font-bold text-amber-700 dark:text-amber-400 text-sm">Izin</div>
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-500">2</div>
                   </div>
                   <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="font-bold text-slate-700 dark:text-slate-400 text-sm">Absen</div>
                      <div className="text-2xl font-black text-slate-600 dark:text-slate-300">5</div>
                   </div>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Data ini diperbarui secara otomatis setiap kali ada karyawan yang menekan tombol absen dari perangkat mereka. Admin dapat menyetujui (<i>Approve</i>) atau menolak (<i>Reject</i>) apabila foto tidak wajar (misal: kondisi gelap/memakai topeng).
                </p>
              </div>

              <div className="print:break-inside-avoid">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">2.3. Manajemen Karyawan & Cetak QR</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Pada menu <strong>Karyawan</strong>, Admin dapat menambah data pegawai baru. Setiap pegawai yang didaftarkan akan otomatis dibuatkan <strong>QR Code Unik</strong>.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col sm:flex-row items-center gap-6">
                   <div className="bg-white p-2 rounded-xl shadow-sm hide-print-bg">
                      <QrCode className="w-16 h-16 text-slate-800" />
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">Fungsi QR Code Karyawan</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        QR Code ini dicetak dan diberikan ke pegawai. Pegawai dapat melakukan <i>scan</i> QR ini menggunakan HP mereka untuk langsung masuk ke portal absen pribadi mereka tanpa perlu repot mengetik link/URL.
                      </p>
                   </div>
                </div>
              </div>
              
              <div className="print:break-inside-avoid">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-3">2.4. Rekapitulasi Data & Ekspor Excel</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Admin tidak perlu lagi merekap data kehadiran secara manual. Pada Tab <strong>Laporan</strong>, sistem secara otomatis menghitung Jumlah Jam Kerja, Keterlambatan, dan Akumulasi Potongan. Data dapat diekspor langsung ke spreadsheet format Excel / CSV untuk kebutuhan penggajian bulanan (Payroll).
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Portal Karyawan (Penggunaan Harian) */}
          <section className="mb-12 print:break-before-page">
             <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">3. Tata Cara Absensi Karyawan</h2>
            </div>
            
            <div className="space-y-6">
               <p className="text-slate-600 dark:text-slate-400">
                  Aplikasi didesain sesederhana mungkin agar seluruh pegawai (bahkan yang kurang terbiasa dengan teknologi) dapat melakukan absen dengan mudah setiap harinya.
               </p>

               <div className="grid sm:grid-cols-2 gap-6 mt-6">
                  {/* Step 1 */}
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                     <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 dark:border-slate-950">1</div>
                     <Smartphone className="w-8 h-8 text-blue-500 mb-4" />
                     <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-2">Buka Portal / Scan QR</h4>
                     <p className="text-slate-600 dark:text-slate-400 text-sm">Pegawai membuka link unik absen pegawai, atau cukup <i>Scan</i> QR Code mereka lewat kamera HP yang akan mengarahkan ke halaman absen pribadi.</p>
                  </div>
                  
                  {/* Step 2 */}
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                     <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 dark:border-slate-950">2</div>
                     <ScanFace className="w-8 h-8 text-emerald-500 mb-4" />
                     <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-2">Ambil Foto Wajah (Selfie)</h4>
                     <p className="text-slate-600 dark:text-slate-400 text-sm">Tekan tombol "Absen Masuk". Browser akan meminta izin akses kamera. Izinkan, lalu sejajarkan wajah, dan klik tombol jepret foto.</p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                     <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 dark:border-slate-950">3</div>
                     <MapPin className="w-8 h-8 text-rose-500 mb-4" />
                     <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-2">Tunggu Deteksi GPS</h4>
                     <p className="text-slate-600 dark:text-slate-400 text-sm">Sistem akan secara otomatis mencari titik koordinat GPS perangkat. Pastikan GPS HP aktif. Peta kecil akan muncul menunjukkan lokasi presisi.</p>
                  </div>

                  {/* Step 4 */}
                  <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                     <div className="absolute -top-4 -left-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xl border-4 border-slate-50 dark:border-slate-950">4</div>
                     <ShieldCheck className="w-8 h-8 text-amber-500 mb-4" />
                     <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-2">Kirim & Selesai Selesai</h4>
                     <p className="text-slate-600 dark:text-slate-400 text-sm">Klik Simpan Data. Status akan otomatis berubah menjadi HIJAU (Hadir) untuk hari tersebut. Cepat dan anti antre!</p>
                  </div>
               </div>
            </div>
          </section>

          {/* Section 4: Telegram Bot Integration */}
          <section className="mb-12 print:break-before-page">
             <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 text-sky-600 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">4. Integrasi Telegram Bot Lengkap</h2>
            </div>
            
            <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
               <p>
                  Sistem AbsensiKita dilengkapi dengan bot cerdas yang dapat diakses langsung melalui aplikasi Telegram. Hal ini memudahkan baik Admin maupun Karyawan memantau aktivitas tanpa harus selalu membuka layar laptop.
               </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
               {/* Untuk Admin */}
               <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                     <ShieldCheck className="w-5 h-5 text-blue-500" /> Bagi Administrator
                  </h3>
                  <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                     <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <span><strong>Notifikasi Instan:</strong> Menerima pesan real-time jika ada karyawan yang masuk, terlambat, atau tidak terverifikasi (jaringan putus).</span>
                     </li>
                     <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <span><strong>Tarik Data Excel:</strong> Command <code>/ekspor_bulanan</code> akan mengirimkan file format `.xlsx` berisi rekap kehadiran penuh bulan ini langsung ke chat.</span>
                     </li>
                     <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <span><strong>Pantau Shift:</strong> Cek ringkasan tim yang aktif bekerja hari ini.</span>
                     </li>
                  </ul>
               </div>

               {/* Untuk Pegawai */}
               <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-2xl">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                     <Users className="w-5 h-5 text-emerald-500" /> Bagi Karyawan
                  </h3>
                  <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                     <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                        <span><strong>Bukti Absensi Harian:</strong> Setelah berhasil absen di Portal Web, Telegram Bot akan otomatis mengirim resi notifikasi ke HP pegawai sebagai bukti.</span>
                     </li>
                     <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                        <span><strong>Riwayat Personal:</strong> Pegawai bisa menarik laporan pribadinya kapan saja agar transparansi dan perhitungan jam lembur/telat jelas.</span>
                     </li>
                  </ul>
               </div>
            </div>

            <div className="mt-8 flex items-center gap-4 bg-sky-50 dark:bg-sky-900/20 p-5 rounded-2xl border border-sky-100 dark:border-sky-800/30 text-sky-800 dark:text-sky-300">
               <MessageCircle className="w-8 h-8 shrink-0" />
               <p className="text-sm">
                  <strong>Cara Gabung Bot:</strong> Buka Aplikasi Telegram, search <strong>@AbsensiKitaIndo_Bot</strong>. Klik START, lalu klik menu "Hubungkan Akun", Masukkan NIP dan Sandi. Selesai!
               </p>
            </div>
          </section>
          
          <div className="print:break-before-page"></div>

          {/* Section 5: FAQ */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">Pertanyaan yang Sering Diajukan (FAQ)</h2>
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Bagaimana jika jaringan internet di lokasi kerja buruk?</h4>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Sistem AbsensiKita dioptimisasi menggunakan PWA, perangkat dapat menyimpan antrean absen offline sementara, lalu mengirimkannya ketika sinyal membaik.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Apakah karyawan bisa menduplikasi atau memanipulasi koordinat GPS?</h4>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Sistem kami dibangun diatas framework modern yang memblokir modul manipulasi lokasi eksternal / <i>Mock Location / Fake GPS</i> di browser.</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200">Bagaimana jika HP karyawan tidak mendukung browser terbaru?</h4>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Sistem kami mendukung luas hingga browser versi lawas (Android 6+ atau iOS 12+). Pastikan memberikan izin Kamera dari pengaturan peramban seperti Google Chrome atau Safari.</p>
              </div>
            </div>
          </section>

          {/* Footer note */}
          <div className="text-center pt-8 mt-12 border-t border-slate-200 dark:border-slate-800 print:break-inside-avoid">
            <p className="text-slate-500 dark:text-slate-400 italic">
               Terima kasih telah mempercayai AbsensiKita sebagai solusi manajemen tim Anda. 
               Jika membutuhkan bantuan lebih lanjut, hubungi layanan dukungan kami dari panel Dashboard Administrator.
            </p>
          </div>
        </div>
      </div>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body { 
             background-color: white !important; 
             -webkit-print-color-adjust: exact !important; 
             print-color-adjust: exact !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .hide-print-bg { background: transparent !important; }
          /* Enforce background colors for printing */
          .bg-blue-600 { background-color: #2563eb !important; color: white !important;}
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .bg-amber-50 { background-color: #fffbeb !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-sky-50 { background-color: #f0f9ff !important; }
        }
      `}</style>
    </div>
  );
}

