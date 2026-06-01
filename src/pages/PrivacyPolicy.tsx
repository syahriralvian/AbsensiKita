import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <nav className="fixed top-0 left-0 right-0 z-50 glass px-6 md:px-12 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold tracking-tight">AbsensiKita.</span>
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-32 space-y-8">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Kebijakan Privasi</h1>
        <p className="text-slate-500 dark:text-slate-400">Pembaruan Terakhir: 19 Mei 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Pengumpulan Data</h2>
            <p>
              Sistem kami mengumpulkan data dasar seperti nama, email, PIN, nomor telepon, dan data presensi (waktu dan GPS). Jika diaktifkan, kami memproses data biometrik (embedding wajah/sidik jari) semata-mata untuk verifikasi absensi.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. Penggunaan Data</h2>
            <p>
              Data yang dikumpulkan digunakan murni untuk menyediakan fitur absensi untuk perusahaan atau instansi yang mendaftarkan Anda. Kami tidak akan pernah menjual, menyewakan, atau memberikan data Anda kepada pihak ketiga untuk tujuan pemasaran.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Keamanan Data</h2>
            <p>
              Data disimpan dalam peladen aman dengan enkripsi terkini. Kami memastikan akses ke data hanya tersedia bagi pengguna yang berhak (Admin HR perusahaan yang bersangkutan).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Kontak Privasi</h2>
            <p>Apabila terdapat pertanyaan lebih lanjut terkait privasi data, Anda dapat menghubungi kami di email:</p>
            <p><strong>absensikitacloud@gmail.com</strong></p>
          </section>
        </div>
      </div>
    </div>
  );
}
