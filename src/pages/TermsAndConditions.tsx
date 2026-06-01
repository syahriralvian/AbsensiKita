import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function TermsAndConditions() {
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
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Syarat dan Ketentuan</h1>
        <p className="text-slate-500 dark:text-slate-400">Pembaruan Terakhir: {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Pendahuluan & Penerimaan Syarat</h2>
            <p>
              Dengan mendaftar, mengakses, atau menggunakan layanan AbsensiKita ("Layanan"), Anda setuju untuk terikat oleh Syarat dan Ketentuan ini. Jika Anda tidak setuju dengan ketentuan apa pun, Anda dilarang menggunakan Layanan.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. Layanan dan Fitur Utama</h2>
            <p>Platform kami menyediakan layanan kehadiran dan SDM yang meliputi namun tidak terbatas pada:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Absensi Terintegrasi:</strong> Pengenalan wajah (Face Recognition), Kode QR, Voice Command, dengan validasi lokasi GPS akurat.</li>
              <li><strong>Notifikasi WhatsApp:</strong> Pemberitahuan sistem, OTP untuk klaim akun / registrasi, serta tagihan.</li>
              <li><strong>Keamanan & Kepemilikan (Transfer & Klaim):</strong> Menyediakan fasilitas Transfer Kepemilikan (Ownership) antar instansi dan Klaim Darurat (Super Admin mengambil alih jika Owner hilang akses).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Masa Percobaan (Trial)</h2>
            <p>
              Instansi baru mendapatkan layanan percobaan gratis selama <strong>4 bulan (120 hari)</strong> berturut-turut. Setelah masa berlaku habis, fungsionalitas utama akan terkunci hingga instansi berlangganan salah satu paket berbayar.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Layanan dan Pembayaran</h2>
            <p>
              Layanan kami menggunakan sistem berlangganan (Subscription) dalam Rupiah (IDR). Semua pembayaran bersifat final dan tidak dapat dikembalikan (Non-Refundable), kecuali terdapat kesalahan sistem pihak kami. Pembayaran dilakukan secara elektronik via Midtrans.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">5. Kebijakan Pengiriman / Aktivasi Layanan (Delivery Policy)</h2>
            <p>
              AbsensiKita adalah layanan berbasis perangkat lunak awan (Software as a Service - SaaS). Layanan, lisensi, atau perpanjangan masa aktif akan dikirimkan dan diaktifkan <strong>secara otomatis</strong> segera setelah sistem pembayaran Anda dikonfirmasi berhasil (success/settlement). Anda tidak memerlukan pengiriman fisik.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">6. Kebijakan Pembatalan & Pengembalian Dana (Refund Policy)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">A. Kebijakan Pembatalan</h3>
                <p>Pengguna dapat membatalkan langganan kapan saja. Namun, tidak ada pengembalian dana prorata untuk periode langganan berjalan yang belum habis masa aktifnya.</p>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">B. Kondisi yang Memenuhi Syarat Refund</h3>
                <p>Pengembalian dana (Refund) <strong>hanya berlaku dalam kondisi:</strong></p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Terjadi kesalahan sistem dari kami yang menyebabkan pemotongan ganda (Double Charge).</li>
                  <li>Layanan gagal diaktifkan secara otomatis dalam waktu lebih dari 3x24 jam setelah pembayaran sukses tervalidasi.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">C. Prosedur Pengajuan Refund</h3>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Pengguna harus mengajukan permintaan tertulis ke <strong>absensikitacloud@gmail.com</strong> maksimal 7 hari sejak transaksi.</li>
                  <li>Harap melampirkan bukti pembayaran via Midtrans/Bank yang valid.</li>
                  <li>Proses investigasi membutuhkan waktu maksimal 3 hari kerja. Proses refund jika disetujui memakan waktu 7-14 hari kerja.</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">7. Privasi & Retensi Data Pengguna</h2>
            <p>
              Data karyawan dan absensi merupakan tanggung jawab Anda sebagai Pengendali Data. Sistem akan secara otomatis membersihkan absensi yang berumur lebih dari 1 tahun. Kami bertindak sebagai Pemroses Data yang melindungi kerahasiaan tersebut dan hanya mengekspos notifikasi khusus ke nomor WhatsApp yang terotorisasi.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">8. Informasi Kontak Bisnis</h2>
            <p>Segala pertanyaan dan keluhan hubungi kami melalui:</p>
            <ul className="space-y-1">
              <li><strong>Email:</strong> absensikitacloud@gmail.com</li>
              <li><strong>Telepon/WhatsApp:</strong> +62 85157004261</li>
              <li><strong>Alamat:</strong> Kemiri Indah BG-05, Sidoarjo, Jawa Timur</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
