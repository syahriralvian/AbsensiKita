# AbsensiKita - Backend & Frontend Server

## Deskripsi
AbsensiKita adalah sistem manajemen absensi terpadu yang membantu perusahaan melakukan pencatatan kehadiran karyawan dan manajemen pengaturan yang mendukung multi-device untuk absensi (seperti ADMS, Telegram Bot, WhatsApp, dll).

## Fitur Utama
1. **Absensi lewat WAHA (WhatsApp API)**
   Terintegrasi dengan sistem WhatsApp HTTP API untuk memulai, menghentikan, check status, dan login via Whatsapp.
2. **Bot Telegram**
   Pencatatan absensi yang terintegrasi di fitur Telegram dan sinkronisasi real-time.
3. **Pembayaran dengan Midtrans**
   Dilengkapi dengan gateway pembayaran Midtrans untuk upgrade plan berlangganan (Subscribtion).
4. **Biofinger / ADMS Webhook**
   Tersedia endpoint lengkap untuk terkoneksi pada mesin absensi berprotokol ADMS.

## Konfigurasi Environment Variables (Wajib)
Semua konfigurasi credential perlu di setup melalui Environment Variables untuk keamanan sesuai standar keamanan, sebagai berikut:

| Environment Variable | Keterangan |
| --- | --- |
| `VITE_SUPABASE_URL` | URL Database Supabase / URL Server Utama |
| `VITE_SUPABASE_ANON_KEY` | Public access token Supabase (Bukan Master Key/Secret) |
| `SUPABASE_ANON_KEY` | (Legacy) Backend environment key Supabase |
| `TELEGRAM_BOT_TOKEN` | Token otentikasi Bot Telegram |
| `SUMOPOD_API_KEY` | Konfigurasi sistem AI Sumopod API |
| `SUMOPOD_BASE_URL` | URL Utama layanan AI Sumopod |
| `WAHA_URL` | API URL sistem integrasi Whatsapp |
| `WAHA_API_KEY` | Private key Whatsapp API Waha Webhook |
| `VITE_N8N_WEBHOOK_URL`| Otomasi integrasi n8n |
| `MIDTRANS_SERVER_KEY` | API key Midtrans sisi Server/Backend - Harus dirahasiakan! |
| `VITE_MIDTRANS_CLIENT_KEY` | API key Midtrans sisi Client/Frontend |

## Arsitektur Aplikasi
Dibuat dengan backend Express.js (pada `server.ts` & `telegram.ts`) untuk melayani route konektivitas seperti `ADMS webhook`, `Midtrans Webhook` dengan keamanan `Zod Schema Validation`. Dan sistem frontend menggunakan Vite & React JS. 

## Struktur Skema Database
Sistem absensi dan master data menggunakan `Supabase` dengan tabel utama:
1. `adms_connections` = Data Device/Mesin (ADMS)
2. `machine_commands` = Queue command backend ke mesin absensi
3. `karyawan` = Registrasi User dan Karyawan (NIP, PIN)
4. `absensi` = Data log history record.
5. `billing_history` = Riwayat transaksi.

## Memulai Server Developer
Untuk menjalankan mode _hot-reload_ dev server:
```bash
npm run dev
```

*Catatan Keamanan*: Tolong perhatikan pada file server.ts dan konfigurasi API Keys dari `VITE_*`. Jangan pernah meng-ekspos `SERVER_KEY` secara publik.
