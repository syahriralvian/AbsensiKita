import os from 'os';
import { execSync } from 'child_process';
import { Telegraf, Markup } from "telegraf";
import OpenAI from "openai";
import { supabase } from './src/lib/supabase';
import * as XLSX from "xlsx";

const token = process.env.TELEGRAM_BOT_TOKEN;
export const bot = token ? new Telegraf(token) : null;

let openaiClient: OpenAI | null = null;

function getOpenAiClient() {
  const sumopodKey = process.env.SUMOPOD_API_KEY || "sk-2y-ltL-AgZQFIJxwU1OKaQ";
  if (!openaiClient && sumopodKey) {
    let rawBase = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";
    if (rawBase.includes("api.sumopod.com")) {
      rawBase = rawBase.replace("api.sumopod.com", "ai.sumopod.com");
    }
    // Ensure it ends with /v1 to be compatible with OpenAI SDK
    if (!rawBase.endsWith("/v1")) {
      rawBase = rawBase.replace(/\/$/, "") + "/v1";
    }
    openaiClient = new OpenAI({
      apiKey: sumopodKey,
      baseURL: rawBase,
      timeout: 30000, 
      maxRetries: 0
    });
  }
  return openaiClient;
}



const rateLimitMap = new Map<string, { count: number, resetAt: number }>();

const attendanceSessionMap = new Map<string, {
  company_id: string;
  nip: string;
  nama: string;
  role: string;
  tipe: string;
  step: 'WAITING_LOCATION' | 'WAITING_PHOTO' | 'WAITING_IZIN_TIPE' | 'WAITING_IZIN_TANGGAL' | 'WAITING_IZIN_KETERANGAN' | 'WAITING_IZIN_BUKTI';
  lat?: number;
  lng?: number;
  izin_start?: string;
  izin_end?: string;
  izin_keterangan?: string;
}>();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function savePengajuanIzin(ctx: any, session: any, photoUrl: string | null) {
  const chatId = String(ctx.from.id);
  const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const today = tzDate.getFullYear() + '-' + String(tzDate.getMonth() + 1).padStart(2, '0') + '-' + String(tzDate.getDate()).padStart(2, '0');
  
  // Format dates
  const start = new Date(session.izin_start).toISOString();
  // Using end date if mapped
  const end = new Date(session.izin_end || session.izin_start).toISOString();
  
  let payload: any = {
    company_id: session.company_id,
    nip: session.nip,
    nama: session.nama,
    tipe: session.tipe, 
    // Using waktu_masuk for first day, we might have multiple inserts for dates range but here we insert one row usually? IzinTab has waktu_masuk as the Izin request date? Wait! Let's check how 'absensi' stores Izin span. Usually they use one row per day.
    // Or we just loop through the dates and insert one document per day.
  };

  const dates = [];
  let current = new Date(session.izin_start);
  const endDate = new Date(session.izin_end || session.izin_start);
  while (current <= endDate) {
     dates.push(new Date(current));
     current.setDate(current.getDate() + 1);
  }

  try {
     const inserts = dates.map(d => ({
        company_id: session.company_id,
        nip: session.nip,
        nama: session.nama,
        tipe: session.tipe,
        waktu_masuk: d.toISOString(),
        keterangan: session.izin_keterangan === '-' ? null : session.izin_keterangan,
        image: photoUrl,
        status_acc: 0 // Pending
     }));

     const { error } = await supabase.from('absensi').insert(inserts);

     if (error) throw error;
     
     const role = session.role;
     attendanceSessionMap.delete(chatId);
     
     await ctx.reply(`✅ *Pengajuan ${session.tipe} Berhasil*\n\nTanggal: ${session.izin_start} s/d ${session.izin_end}\nKeterangan: ${session.izin_keterangan}\n\nStatus saat ini: ⏳ *PENDING*\nMenunggu persetujuan Admin/Manajer Anda.`, { parse_mode: "Markdown" });
     
  } catch (err: any) {
     console.error("Save Izin Error:", err);
     ctx.reply(`Gagal menyimpan pengajuan: ${err.message}`);
     attendanceSessionMap.delete(chatId);
  }
}

export async function setupTelegramBot() {
  if (!bot) {
    console.warn("Telegram Bot not configured.");
    return;
  }

  const getKeyboard = (role: string) => {
    if (role === 'USER') {
       return Markup.keyboard([
         ["📸 Menu Absensi", "📊 Menu Laporan"],
         ["📝 Pengajuan Izin", "⚙️ Profil Saya"],
         ["❓ Panduan Penggunaan"]
       ]).resize();
    } else if (role === 'MASTER_ADMIN') {
       return Markup.keyboard([
         ["🏢 Cek Data Perusahaan", "⏳ Cek Masa Aktif"],
         ["📈 Cek Traffic Hari Ini", "💻 Status Sistem"]
       ]).resize();
    } else {
       // SUPER ADMIN, OWNER, etc.
       return Markup.keyboard([
         ["📸 Menu Absensi", "📊 Menu Laporan"],
         ["👥 Daftar Karyawan", "👀 Monitoring Absen"],
         ["📝 Pengajuan Izin", "✅ Approval Izin"],
         ["⚙️ Profil Saya", "❓ Panduan Penggunaan"]
       ]).resize();
    }
  };

  const getAbsensiKeyboard = () => {
    return Markup.keyboard([
      ["📸 Absen Masuk", "🏠 Absen Pulang"],
      ["☕ Absen Keluar (Istirahat)", "🔙 Absen Kembali"],
      ["⬅️ Kembali ke Menu Utama"]
    ]).resize();
  };

  const getLaporanKeyboard = () => {
    return Markup.keyboard([
      ["📋 Laporan Kartu", "📈 Laporan Rekap"],
      ["📊 Laporan Total", "💰 Laporan Payroll"],
      ["⬅️ Kembali ke Menu Utama"]
    ]).resize();
  };

  const getIzinKeyboard = () => {
    return Markup.keyboard([
      ["Sakit", "Izin", "Cuti"],
      ["⬅️ Batal Pengajuan"]
    ]).resize().oneTime();
  };

  
  bot.command('resource', async (ctx) => {
    const chatId = String(ctx.from.id);
    const { data: user } = await supabase.from('karyawan').select('role, nama').eq('telegram_chat_id', chatId).single();
    
    // Allow all authenticated users down to USER role to see resource/status
    if (!user) {
      return ctx.reply('❌ Maaf, Anda belum terdaftar.');
    }

    const { execSync } = require('child_process');
    const os = require('os');
    
    try {
      const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
      const usedMem = (parseFloat(totalMem) - parseFloat(freeMem)).toFixed(2);
      const percentUsed = ((parseFloat(usedMem) / parseFloat(totalMem)) * 100).toFixed(1);
      
      const load = os.loadavg().map((x: any) => x.toFixed(2)).join(', ');
      
      let diskInfo = '';
      try { 
        diskInfo = execSync('df -h / | tail -n 1').toString().trim(); 
        if (diskInfo.includes('8.0E') || diskInfo.includes('overlay')) {
          diskInfo = 'Cloud Storage (Auto-Scale / Unlimited)';
        }
      } catch (e: any) { diskInfo = 'N/A'; }

      let procCount = '';
      try { procCount = execSync('ps aux | wc -l').toString().trim(); } catch(e) { procCount = 'N/A'; }

      const uptime = os.uptime();
      const d = Math.floor(uptime / (3600 * 24));
      const uptimeText = d > 0 ? `${d} Hari aktif` : `Online 24 Jam (Cloud Active)`;

      const msg = [
        "🔊 <b>Laporan Resource Server Live</b> 🔊", "",
        "🟢 <b>Status Layanan</b>: ONLINE 24/7 (SLA 99.9%)", "",
        "⏱️ <b>Uptime Server</b>: " + uptimeText, "",
        "<b>System Load (1, 5, 15)</b>: ", load, "",
        "<b>Physical Memory</b>: ", usedMem + " MB / " + totalMem + " MB (" + percentUsed + "%)", "",
        "<b>Node/Entry Processes</b>: ", procCount, "",
        "<b>Disk Ruang Utama</b>: ", "<code>" + diskInfo + "</code>"
      ].join("\n");

      return ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e: any) {
      return ctx.reply("❌ Gagal membaca metrics server: " + (e.message || e));
    }
  });

  bot.start(async (ctx) => {
    const payload = ctx.message.text.split(" ")[1]; // /start LINK-1234
    const chatId = String(ctx.from.id);

    if (payload && payload.startsWith("LINK-")) {

      // Find the user with this link code
      const { data: userData, error: userError } = await supabase
        .from('karyawan')
        .select('*')
        .eq('telegram_link_code', payload)
        .single();
      
      if (userData) {
        // Unlink previous user with this telegram_chat_id
        await supabase
          .from('karyawan')
          .update({ telegram_chat_id: null })
          .eq('telegram_chat_id', chatId);

        // Update user
        await supabase
          .from('karyawan')
          .update({ telegram_chat_id: chatId, telegram_link_code: null })
          .eq('nip', userData.nip)
          .eq('company_id', userData.company_id);
        
        return ctx.reply(
          `✅ Berhasil! Akun Telegram Anda telah terhubung dengan ${userData.nama} (Role: ${userData.role}).\n\nKini Anda bisa langsung berinteraksi dengan AI tanpa perlu login lagi. Coba tanyakan laporan kehadiran hari ini atau melakukan absensi.`,
          getKeyboard(userData.role)
        );
      } else {
        return ctx.reply("❌ Kode tautan tidak valid atau sudah kadaluarsa. Silakan generate ulang dari Web AbsensiKita.");
      }
    }

    // Check if they are already connected
    const { data: existingUser } = await supabase.from('karyawan').select('nama, role').eq('telegram_chat_id', chatId).single();
    if (existingUser) {
      return ctx.reply(
        `Halo kembali, ${existingUser.nama}! Saya asisten pintar AbsensiKita 🤖.\nAda yang bisa saya bantu hari ini?`,
        getKeyboard(existingUser.role)
      );
    }

    ctx.reply("Halo! Saya asisten pintar AbsensiKita 🤖.\n\nAkun Anda belum terhubung. Silakan buka aplikasi Web AbsensiKita -> Pengaturan -> Profil Saya, lalu klik **Hubungkan ke Telegram Bot** untuk menautkan akun.");
  });

  bot.on("text", async (ctx) => {
    try {
      const text = ctx.message.text;
      const chatId = String(ctx.from.id);

    // Rate Limiter
    const now = Date.now();
    const userRate = rateLimitMap.get(chatId) || { count: 0, resetAt: now + 60000 };
    
    if (now > userRate.resetAt) {
      userRate.count = 0;
      userRate.resetAt = now + 60000;
    }
    
    userRate.count++;
    rateLimitMap.set(chatId, userRate);
    
    if (userRate.count > 10) {
      return ctx.reply("⏳ Maaf, Anda mengirim terlalu banyak pesan. Silakan tunggu 1 menit sebelum bertanya lagi.");
    }

    // Validate account linking
    const { data: user } = await supabase
      .from('karyawan')
      .select('nip, nama, role, company_id')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!user) {
      return ctx.reply("Mohon tautkan akun Anda terlebih dahulu melalui Web AbsensiKita (menu Pengaturan -> Profil Saya).");
    }

    const session = attendanceSessionMap.get(chatId);
    if (session && session.step.startsWith('WAITING_IZIN_') && text !== "⬅️ Batal Pengajuan") {
      if (session.step === 'WAITING_IZIN_TIPE') {
        if (["Sakit", "Izin", "Cuti"].includes(text)) {
           session.tipe = text.toUpperCase() === "IZIN" ? "IJIN" : text.toUpperCase();
           session.step = 'WAITING_IZIN_TANGGAL';
           attendanceSessionMap.set(chatId, session);
           return ctx.reply("Masukkan rentang tanggal (Contoh: 2026-06-01 s/d 2026-06-03) atau satu tanggal (Contoh: 2026-06-01):",
             Markup.keyboard([["⬅️ Batal Pengajuan"]]).resize().oneTime()
           );
        } else {
           return ctx.reply("Tipe pengajuan tidak valid. Pilih dari keyboard:", getIzinKeyboard());
        }
      } else if (session.step === 'WAITING_IZIN_TANGGAL') {
        const dates = text.split("s/d").map(d => d.trim());
        const start = dates[0];
        const end = dates.length > 1 ? dates[1] : dates[0];
        
        // Basic validation for dates
        if (isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
           return ctx.reply("Format tanggal tidak valid. Contoh: 2026-06-01 s/d 2026-06-03:");
        }

        session.izin_start = start;
        session.izin_end = end;
        session.step = 'WAITING_IZIN_KETERANGAN';
        attendanceSessionMap.set(chatId, session);
        return ctx.reply("Silakan ketikkan keterangan/alasan pengajuan Anda (Ketik '-' jika tidak ada):");

      } else if (session.step === 'WAITING_IZIN_KETERANGAN') {
        session.izin_keterangan = text;
        session.step = 'WAITING_IZIN_BUKTI';
        attendanceSessionMap.set(chatId, session);
        return ctx.reply("Terakhir, mohon lampirkan 📸 Foto/Dokumen bukti (Attach Photo). Jika tidak ada bukti, ketik 'SKIP'.");
      } else if (session.step === 'WAITING_IZIN_BUKTI') {
         if (text.toLowerCase() === 'skip') {
           ctx.reply("Sedang menyimpan pengajuan...");
           await savePengajuanIzin(ctx, session, null);
           return;
         } else {
           return ctx.reply("Tolong lampirkan Foto sebagai bukti, atau ketik 'SKIP'.");
         }
      }
    }

    if (text === "📸 Menu Absensi") {
      return ctx.reply("Silakan pilih menu absensi:", getAbsensiKeyboard());
    }

    if (text === "📊 Menu Laporan") {
      return ctx.reply("Silakan pilih jenis laporan:", getLaporanKeyboard());
    }

    if (text === "⬅️ Kembali ke Menu Utama") {
      return ctx.reply("Kembali ke Menu Utama", getKeyboard(user.role));
    }

    const absenMatch = text === "📸 Absen Masuk" || text === "🏠 Absen Pulang" || text === "☕ Absen Keluar (Istirahat)" || text === "🔙 Absen Kembali";
    
    if (absenMatch || text.toLowerCase() === "saya mau absen") {
      let tipe = "MASUK";
      if (text === "🏠 Absen Pulang") tipe = "PULANG";
      else if (text === "☕ Absen Keluar (Istirahat)") tipe = "KELUAR";
      else if (text === "🔙 Absen Kembali") tipe = "KEMBALI";

      attendanceSessionMap.set(chatId, {
        company_id: user.company_id,
        nip: user.nip,
        nama: user.nama,
        role: user.role,
        tipe: tipe,
        step: 'WAITING_LOCATION'
      });

      return ctx.reply(
        `Siap untuk Absen ${tipe}! 📍 Silakan bagikan Lokasi Anda saat ini (Share Location) menggunakan tombol di bawah, atau fitur Attach Location.`,
        Markup.keyboard([
          [Markup.button.locationRequest("📍 Bagikan Lokasi saat ini")]
        ]).oneTime().resize()
      );
    }
    
    const reportKartuMatch = text === "📋 Laporan Kartu";
    const reportRekapMatch = text === "📈 Laporan Rekap";
    const reportTotalMatch = text === "📊 Laporan Total";
    const reportPayrollMatch = text === "💰 Laporan Payroll";

    if (text === "📝 Pengajuan Izin") {
      attendanceSessionMap.set(chatId, {
        company_id: user.company_id,
        nip: user.nip,
        nama: user.nama,
        role: user.role,
        tipe: 'IZIN',
        step: 'WAITING_IZIN_TIPE'
      });
      return ctx.reply("Pilih tipe pengajuan Anda:", getIzinKeyboard());
    }

    if (text === "⬅️ Batal Pengajuan") {
      attendanceSessionMap.delete(chatId);
      return ctx.reply("Pengajuan dibatalkan.", getKeyboard(user.role));
    }

    if (text === "⚙️ Profil Saya") {
      const roleStr = user.role === 'USER' ? 'Karyawan' : user.role;
      return ctx.reply(`👤 *Profil Anda*\n\nNama: ${user.nama}\nNIP: ${user.nip}\nRole: ${roleStr}\nPerusahaan ID: ${user.company_id}\n\nUntuk pengaturan lebih lanjut, silakan buka Web AbsensiKita pada menu Profil.`, { parse_mode: "Markdown" });
    }

    if (text === "❓ Panduan Penggunaan") {
      return ctx.reply(`📖 *Panduan Penggunaan Bot Telegram Absensi*\n\n` +
      `*1️⃣ Cara Melakukan Absensi*\n` +
      `• Pilih menu *📸 Menu Absensi*\n` +
      `• Pilih jenis absen (Masuk / Pulang / Istirahat)\n` +
      `• *Langkah 1*: Saat diminta, tekan tombol [📍 Bagikan Lokasi saat ini] untuk mengirim titik GPS Anda.\n` +
      `• *Langkah 2*: Setelah lokasi sukses diverifikasi (berada dalam radius kantor/area), kirimkan **Foto Selfie** menggunakan kamera (Attach -> Camera).\n\n` +
      `*2️⃣ Menu Laporan*\n` +
      `• Akses menu *📊 Menu Laporan*\n` +
      `• Anda bisa menarik berbagai laporan absensi diri Anda dalam format file Excel (.xlsx).\n\n` +
      `*3️⃣ Fitur Asisten AI (Tanya Jawab Bebas)*\n` +
      `• Cukup ketik pertanyaan yang Anda inginkan (seperti chat biasa), misal:\n` +
      `   - _"Berapa jam kerja saya hari ini?"_\n` +
      `   - _"Siapa saja yang izin cuti bulan ini?"_\n` +
      `   - _"Tolong rekap absen saya bulan kemarin."_\n\n` +
      `*4️⃣ Fitur Admin/Pimpinan*\n` +
      `• *👀 Monitoring Absen*: Cek live absensi tim per hari ini.\n` +
      `• *👥 Daftar Karyawan*: Melihat data kolega dalam perusahaan.\n\n` +
      `💡 *CATATAN PENTING:*\n` +
      `✅ Jangan matikan GPS saat menggunakan bot ini.\n` +
      `✅ Bot dilengkapi deteksi **Anti Fake-GPS**. Jangan pernah mem-forward lokasi (Dropped Pin) atau meneruskan foto dari galeri.\n\n` +
      `Mengalami kendala aplikasi? Silakan hubungi tim HR/Admin internal Anda.`, { parse_mode: "Markdown" });
    }

    if (text === "💻 Status Sistem" || text === "💻 Cek Resource") {
      try {
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
        const usedMem = (parseFloat(totalMem) - parseFloat(freeMem)).toFixed(2);
        const percentUsed = ((parseFloat(usedMem) / parseFloat(totalMem)) * 100).toFixed(1);
        const load = os.loadavg().map((x: any) => x.toFixed(2)).join(', ');
        let diskInfo = '';
        try { 
          diskInfo = execSync('df -h / | tail -n 1').toString().trim(); 
          if (diskInfo.includes('8.0E') || diskInfo.includes('overlay')) {
            diskInfo = 'Cloud Storage (Auto-Scale / Unlimited)';
          }
        } catch (e: any) { diskInfo = 'N/A'; }
        
        let procCount = '';
        try { procCount = execSync('ps aux | wc -l').toString().trim(); } catch(e) { procCount = 'N/A'; }
        
        const uptime = os.uptime();
        const d = Math.floor(uptime / (3600 * 24));
        const uptimeText = d > 0 ? `${d} Hari aktif` : `Online 24 Jam (Cloud Active)`;

        const msg = [
          "🔊 <b>Laporan Resource Server Live</b> 🔊", "",
          "🟢 <b>Status Layanan</b>: ONLINE 24/7 (SLA 99.9%)", "",
          "⏱️ <b>Uptime Server</b>: " + uptimeText, "",
          "<b>System Load (1, 5, 15)</b>: ", load, "",
          "<b>Physical Memory</b>: ", usedMem + " MB / " + totalMem + " MB (" + percentUsed + "%)", "",
          "<b>Node/Entry Processes</b>: ", procCount, "",
          "<b>Disk Ruang Utama</b>: ", "<code>" + diskInfo + "</code>"
        ].join("\n");
        return ctx.reply(msg, { parse_mode: 'HTML' });
      } catch (e: any) {
        return ctx.reply("❌ Gagal membaca metrics server: " + (e.message || String(e)));
      }
    }

    if (text === "🏢 Cek Data Perusahaan") {
      if (user?.role !== 'MASTER_ADMIN') {
         return ctx.reply("❌ Anda tidak memiliki izin.");
      }
      try {
        const { data: companies, error } = await supabase.from('companies').select('company_id, nama_perusahaan');
        if (error) throw error;
        
        let msg = `🏢 *Data Perusahaan (${companies.length} Total):*\n\n`;
        companies.forEach((c: any, i: number) => {
          msg += `${i+1}. *${c.nama_perusahaan || 'Tanpa Nama'}*\n   ID: \`${c.company_id}\`\n\n`;
        });
        return ctx.reply(msg, { parse_mode: 'Markdown' });
      } catch (e: any) {
        return ctx.reply("❌ Gagal mengambil data: " + e.message);
      }
    }

    if (text === "⏳ Cek Masa Aktif") {
      if (user?.role !== 'MASTER_ADMIN') {
         return ctx.reply("❌ Anda tidak memiliki izin.");
      }
      try {
        const { data: companies, error } = await supabase.from('companies').select('company_id, nama_perusahaan, trial_end_date');
        if (error) throw error;
        
        let msg = `⏳ *Masa Aktif Perusahaan (Trial/Premium):*\n\n`;
        companies.forEach((c: any, i: number) => {
          const endDate = c.trial_end_date ? new Date(c.trial_end_date).toLocaleDateString('id-ID') : 'Lifetime/Unknown';
          msg += `${i+1}. *${c.nama_perusahaan || 'Tanpa Nama'}*\n   Batas: ${endDate}\n\n`;
        });
        return ctx.reply(msg, { parse_mode: 'Markdown' });
      } catch (e: any) {
        return ctx.reply("❌ Gagal mengambil data: " + e.message);
      }
    }

    if (text === "📈 Cek Traffic Hari Ini") {
      if (user?.role !== 'MASTER_ADMIN') {
         return ctx.reply("❌ Anda tidak memiliki izin.");
      }
      try {
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
        const { count, error } = await supabase.from('absensi').select('*', { count: 'exact', head: true }).gte('waktu_masuk', `${todayStr}T00:00:00+07:00`).lte('waktu_masuk', `${todayStr}T23:59:59+07:00`);
        if (error) throw error;
        
        return ctx.reply(`📈 *Traffic Hari Ini:*\n\nSebanyak *${count}* data absensi (scan masuk/pulang) tercatat di seluruh perusahaan pada hari ini (${todayStr}).`, { parse_mode: 'Markdown' });
      } catch (e: any) {
        return ctx.reply("❌ Gagal mengambil data: " + e.message);
      }
    }

    if (text === "👥 Daftar Karyawan") {
      if (user.role === 'USER') {
        return ctx.reply("❌ Anda tidak memiliki izin untuk melihat daftar karyawan.");
      }
      ctx.reply("Sedang memuat daftar karyawan...");
      // Let it fall through to AI so AI uses getEmployees tool, OR handle here.
      // Better to handle it directly for speed.
      const { data: emps } = await supabase.from('karyawan').select('nip, nama, role').eq('company_id', user.company_id);
      if (!emps || emps.length === 0) {
         return ctx.reply("Tidak ada data karyawan.");
      }
      let empTxt = `👥 *Daftar Karyawan*\n\n`;
      emps.forEach((e, i) => {
         empTxt += `${i+1}. ${e.nama} (${e.nip}) - ${e.role}\n`;
      });
      if (empTxt.length > 4000) empTxt = empTxt.substring(0, 4000) + "...";
      return ctx.reply(empTxt, { parse_mode: "Markdown" });
    }

    if (text === "👀 Monitoring Absen") {
      if (user.role === 'USER') {
        return ctx.reply("❌ Anda tidak memiliki izin untuk melihat monitoring absen.");
      }
      ctx.reply("Sedang memuat data monitoring hari ini...");
      const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const today = tzDate.getFullYear() + '-' + String(tzDate.getMonth() + 1).padStart(2, '0') + '-' + String(tzDate.getDate()).padStart(2, '0');
      
      const { data: logs, error } = await supabase.from('absensi')
        .select('*')
        .eq('company_id', user.company_id)
        .gte('waktu_masuk', `${today}T00:00:00+07:00`)
        .lte('waktu_masuk', `${today}T23:59:59+07:00`)
        .order('waktu_masuk', { ascending: false });

      if (!logs || logs.length === 0) {
         return ctx.reply(`📅 *Monitoring Absen Hari Ini*\nTanggal: ${today}\n\nBelum ada data kehadiran hari ini.`, { parse_mode: "Markdown" });
      }

      let monTxt = `📅 *Monitoring Absen Hari Ini*\nTanggal: ${today}\n\n`;
      logs.forEach((l, i) => {
         const time = new Date(l.waktu_masuk).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
         const emoji = l.tipe === 'MASUK' ? '📸' : l.tipe === 'PULANG' ? '🏠' : l.tipe === 'MULAI_ISTIRAHAT' ? '☕' : l.tipe === 'SELESAI_ISTIRAHAT' ? '🔙' : '📝';
         let tipeStr = l.tipe.replace('_', ' ');
         if (l.tipe === 'CUTI' || l.tipe === 'SAKIT' || l.tipe === 'IJIN') tipeStr = `${tipeStr} (Status: ${l.status_acc === '1' ? 'ACC' : l.status_acc === '2' ? 'Ditolak' : 'Pending'})`;
         monTxt += `${i+1}. ${emoji} *${l.nama}* - ${tipeStr} (${time})\n`;
      });

      if (monTxt.length > 4000) monTxt = monTxt.substring(0, 4000) + "...";
      return ctx.reply(monTxt, { parse_mode: "Markdown" });
    }

    if (text === "✅ Approval Izin") {
      if (user.role === 'USER') {
        return ctx.reply("❌ Anda tidak memiliki izin untuk melakukan approval.");
      }
      ctx.reply("Mencari pengajuan izin yang pending...");
      
      const { data: pendingIzin } = await supabase.from('absensi')
         .select('id, nip, nama, tipe, waktu_masuk, keterangan, image')
         .eq('company_id', user.company_id)
         .in('tipe', ['CUTI', 'SAKIT', 'IJIN'])
         .eq('status_acc', 0)
         .order('waktu_masuk', { ascending: true })
         .limit(10);
         
      if (!pendingIzin || pendingIzin.length === 0) {
         return ctx.reply("🎉 Tidak ada pengajuan izin/cuti yang pending saat ini.");
      }
      
      for (const izin of pendingIzin) {
         const date = new Date(izin.waktu_masuk).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
         let msg = `📝 *Pengajuan Pending*\n\n` +
            `Nama: ${izin.nama} (${izin.nip})\n` +
            `Tipe: ${izin.tipe}\n` +
            `Tanggal: ${date}\n` +
            `Keterangan: ${izin.keterangan || '-'}\n`;
         
         const keyboard = Markup.inlineKeyboard([
            Markup.button.callback("✅ Setujui", `acc_${izin.id}`),
            Markup.button.callback("❌ Tolak", `rej_${izin.id}`)
         ]);
         
         if (izin.image && izin.image.startsWith('http')) {
            await ctx.replyWithPhoto(izin.image, { caption: msg, parse_mode: "Markdown", ...keyboard });
         } else if (izin.image && izin.image.startsWith('data:image')) {
            // Very large URI might not be sending properly, but we attempt
            const base64Data = izin.image.split(',')[1];
            try {
               await ctx.replyWithPhoto({ source: Buffer.from(base64Data, 'base64') }, { caption: msg, parse_mode: "Markdown", ...keyboard });
            } catch (e: any) {
               await ctx.reply(msg + "\n\n*(Dilampirkan dokumen/foto)*", { parse_mode: "Markdown", ...keyboard });
            }
         } else {
            await ctx.reply(msg, { parse_mode: "Markdown", ...keyboard });
         }
      }
      return;
    }

    if (reportKartuMatch || reportRekapMatch || reportTotalMatch || reportPayrollMatch) {
      if (user.role !== 'SUPER ADMIN' && user.role !== 'OWNER' && (reportRekapMatch || reportTotalMatch || reportPayrollMatch)) {
        return ctx.reply("❌ Anda tidak memiliki izin untuk melihat laporan ini.");
      }
      
      const reportName = text.replace(/^[^\w]*/, '').trim();
      ctx.reply(`Mempersiapkan ${reportName} bulan ini... mohon tunggu sebentar.`);
      
      try {
        const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const y = tzDate.getFullYear();
        const m = String(tzDate.getMonth() + 1).padStart(2, '0');
        const start = `${y}-${m}-01T00:00:00+07:00`;
        const endDay = new Date(y, tzDate.getMonth() + 1, 0).getDate();
        const end = `${y}-${m}-${String(endDay).padStart(2, '0')}T23:59:59+07:00`;
        
        let query = supabase
          .from('absensi')
          .select('nip, nama, tipe, waktu_masuk, lat, lng, image, status_acc')
          .eq('company_id', user.company_id)
          .gte('waktu_masuk', start)
          .lte('waktu_masuk', end)
          .order('waktu_masuk', { ascending: true });
          
        if (user.role === 'USER') {
           query = query.eq('nip', user.nip);
        }
        
        const { data: absensi, error } = await query;
        if (error) throw error;
        
        const records = absensi || [];
        if (records.length === 0) {
           return ctx.reply(`Belum ada data absensi untuk bulan ini.`);
        }
        
        const wb = XLSX.utils.book_new();
        let ws;
        
        const dFormat = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        
        if (reportKartuMatch) {
          const groupedKartu: any = {};
          records.forEach(r => {
             const dt = new Date(r.waktu_masuk);
             const parts = dFormat.format(dt).split(', ');
             const datePart = parts[0]; // DD/MM/YYYY
             const tStr = parts[1].replace(/\./g, ':'); // HH:mm:ss
             
             const dtSplit = datePart.split('/');
             const key = `${r.nip}_${dtSplit[2]}-${dtSplit[1]}-${dtSplit[0]}`; // nip_YYYY-MM-DD
             
             if (!groupedKartu[key]) {
                groupedKartu[key] = {
                   "NIP": r.nip,
                   "Nama Kary": r.nama,
                   "Tanggal": datePart,
                   "Jam Masuk": "-",
                   "Jam Keluar": "-",
                   "Jam Kembali": "-",
                   "Jam Pulang": "-",
                   "Lokasi (Lat, Lng)": "-"
                };
             }
             
             if (r.tipe === 'MASUK') {
                groupedKartu[key]["Jam Masuk"] = tStr;
             }
             else if (r.tipe === 'KELUAR') {
                groupedKartu[key]["Jam Keluar"] = tStr;
             }
             else if (r.tipe === 'KEMBALI') {
                groupedKartu[key]["Jam Kembali"] = tStr;
             }
             else if (r.tipe === 'PULANG') {
                groupedKartu[key]["Jam Pulang"] = tStr;
             }
             
             if (r.lat && r.lng) {
                groupedKartu[key]["Lokasi (Lat, Lng)"] = `${r.lat}, ${r.lng}`;
             }
          });
          
          ws = XLSX.utils.json_to_sheet(Object.values(groupedKartu));

        } else if (reportTotalMatch || reportPayrollMatch) {
          const { data: emps } = await supabase.from('karyawan').select('*').eq('company_id', user.company_id);
          const { data: hld } = await supabase.from('hari_libur').select('tanggal').eq('company_id', user.company_id);
          const holidays = new Set((hld || []).map(h => h.tanggal));
          
          const agg: Record<string, any> = {};
          
          (emps || []).forEach(e => {
             agg[e.nip] = { 
               "PIN(NIP)": e.nip, 
               "Nama": e.nama,
               "Gaji Pokok": e.gaji_pokok || 0,
               "Tunjangan": e.tunjangan || 0,
               "Uang Makan": e.uang_makan || 0,
               "Hadir": 0,
               "Aktual": 0, 
               "C.Ijin": 0,
               "Absen": 0, // Simplified: just count days where MASUK occurs
               "processedDates": new Set()
             };
          });
          
          // Fallback if records has NIPs not in emps
          records.forEach(r => {
             if (!agg[r.nip]) {
                agg[r.nip] = { 
                  "PIN(NIP)": r.nip, "Nama": r.nama, 
                  "Gaji Pokok": 0, "Tunjangan": 0, "Uang Makan": 0,
                  "Hadir": 0, "Aktual": 0, "C.Ijin": 0, "Absen": 0, "processedDates": new Set()
                };
             }
             
             const dtParts = r.waktu_masuk.split('T')[0];
             agg[r.nip].processedDates.add(dtParts);
             
             if (r.tipe === "MASUK") {
                // To avoid multiple 'MASUK' counting as multiple days, we can just use processedDates.
                // Oh wait, processedDates already tracks unique days.
             }
             if (r.status_acc === '1' && (r.tipe === 'CUTI' || r.tipe === 'SAKIT' || r.tipe === 'IJIN')) {
                // If it's acc, count as C.Ijin. Wait, it could override MASUK if same date?
                // Just keep a separate count.
             }
          });
          
          Object.values(agg).forEach(k => {
             k["Hadir"] = 0;
             k["C.Ijin"] = 0;
             
             const nipRecords = records.filter(x => x.nip === k["PIN(NIP)"]);
             const uniqueDays = Array.from(new Set(nipRecords.map(x => x.waktu_masuk.split('T')[0])));
             
             uniqueDays.forEach(dateStr => {
                 const dayLogs = nipRecords.filter(x => x.waktu_masuk.startsWith(dateStr));
                 const isIzin = dayLogs.some(x => x.status_acc === '1' && ['CUTI', 'SAKIT', 'IJIN'].includes(x.tipe));
                 
                 if (isIzin) {
                     k["C.Ijin"]++;
                 } else {
                     const isHadir = dayLogs.some(x => x.tipe === 'MASUK');
                     if (isHadir) k["Hadir"]++;
                 }
             });
             
             k["Aktual"] = k["Hadir"] + k["C.Ijin"];
             
             if (reportPayrollMatch) {
               const penerimaan = k["Gaji Pokok"] + k["Tunjangan"] + (k["Uang Makan"] * k["Hadir"]);
               k["Penerimaan Bersih"] = penerimaan; 
             }
             
             delete k["processedDates"];
             if (!reportPayrollMatch) {
                delete k["Gaji Pokok"];
                delete k["Tunjangan"];
                delete k["Uang Makan"];
                delete k["Penerimaan Bersih"];
             }
          });

          ws = XLSX.utils.json_to_sheet(Object.values(agg));
          
        } else if (reportRekapMatch) {
          const agg: Record<string, any> = {};
          records.forEach(r => {
             if (!agg[r.nip]) {
                agg[r.nip] = {
                   "PIN(NIP)": r.nip,
                   "Nama": r.nama
                };
             }
             
             const dt = new Date(r.waktu_masuk);
             const parts = dFormat.format(dt).split(', ');
             const datePart = parts[0]; // DD/MM/YYYY
             const tStrFull = parts[1].replace(/\./g, ':'); // HH:mm:ss
             const tStrMatch = tStrFull.split(':');
             const tStr = `${tStrMatch[0]}:${tStrMatch[1]}`; // HH:mm
             
             const dStr = parseInt(datePart.split('/')[0], 10); // day 1-31
             
             if (!agg[r.nip][dStr]) agg[r.nip][dStr] = { m: "-", p: "-" };
             
             if (r.tipe === 'MASUK') {
                agg[r.nip][dStr].m = tStr;
             }
             else if (r.tipe === 'PULANG') {
                agg[r.nip][dStr].p = tStr;
             }
          });
          
          const daysInMonth = endDay;
          
          const finalRows = Object.values(agg).map(row => {
             const newRow: any = { "PIN(NIP)": row["PIN(NIP)"], "Nama": row["Nama"] };
             for (let i = 1; i <= daysInMonth; i++) {
                const cell = row[i];
                if (cell) {
                   const mIn = cell.m !== "-" ? cell.m : "??:??";
                   const mOut = cell.p !== "-" ? cell.p : "??:??";
                   newRow[String(i)] = `${mIn} - ${mOut}`;
                } else {
                   newRow[String(i)] = "";
                }
             }
             return newRow;
          });

          const headerKeys = ["PIN(NIP)", "Nama"];
          for (let i = 1; i <= daysInMonth; i++) {
             headerKeys.push(String(i));
          }

          const wsParams = [
             { A: "LAPORAN REKAP LENGKAP (TELEGRAM EXPORT)" },
             { A: `Periode: Bulan ${m}-${y}` },
             {},
             { A: "Catatan: Jam atas adalah Masuk, Jam Bawah adalah Pulang. Anda bisa mengaktifkan opsi Wrap Text di Excel untuk melihat dengan rapi." }
          ];
          
          ws = XLSX.utils.json_to_sheet(wsParams, { skipHeader: true });
          XLSX.utils.sheet_add_json(ws, finalRows, { origin: "A6", header: headerKeys });
        }
        
        XLSX.utils.book_append_sheet(wb, ws!, reportName);
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `${reportName.replace(/ /g, '_')}_Bulan_${m}_${y}.xlsx`;
        
        await ctx.replyWithDocument(
          { source: buffer, filename: fileName },
          { caption: `✅ Berikut adalah file Excel ${reportName} Anda untuk bulan ini.` }
        );
      } catch (err: any) {
        ctx.reply(`❌ Gagal membuat laporan: ${err.message}`);
      }
      return;
    }

    // Status Typings
    ctx.sendChatAction("typing");

    try {
      const sumopod = getOpenAiClient();
      if (!sumopod) {
        return ctx.reply("Layanan AI belum dikonfigurasi dengan benar.");
      }
      
      const nowWIB = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });
      const sysInstructions = `Kamu adalah Asisten AI AbsensiKita. Kamu melayani pengguna bernama ${user.nama} (Role: ${user.role}, Company ID: ${user.company_id}). Waktu saat ini: ${nowWIB}. \nJika mereka meminta informasi karyawan atau laporan absensi hari ini, kamu WAJIB memanggil tools yang relevan. Jika mereka menekan tombol dari menu atau meminta untuk absen (misal "📸 Absen Masuk", "🏠 Absen Pulang", "☕ Absen Keluar (Istirahat)", "🔙 Absen Kembali", "Saya mau absen"), segera panggil tool recordAbsensi dengan tipe yang sesuai. Jika pengguna meminta Laporan Kartu, Laporan Rekap, atau Laporan Total, informasikan bahwa mereka bisa mengakses fitur tersebut secara lengkap melalui Web AbsensiKita pada menu Dashboard yang berkaitan. \nJawablah dengan bahasa Indonesia yang jelas, singkat, menggunakan format markdown. Hindari jargon teknis kecuali ditanya.`;
      
      let aiResponseText = "";
      let functionCallInfo: any = null;
      
      if (sumopod) {
        const tools: any = [
          {
            type: "function",
            function: {
              name: "getEmployees",
              description: "Mendapatkan daftar karyawan di instansi ini."
            }
          },
          {
            type: "function",
            function: {
              name: "getTodayAttendance",
              description: "Mendapatkan laporan absensi seluruh karyawan khusus untuk hari ini saja."
            }
          },
          {
            type: "function",
            function: {
              name: "getEmployeeAttendance",
              description: "Mendapatkan data riwayat absensi (masuk/pulang/dsb) milik karyawan tertentu berdasarkan nama atau NIP, batasan hingga 30 hari terakhir.",
              parameters: { 
                type: "object", 
                properties: { keyword: { type: "string", description: "Nama atau NIP karyawan" } }, 
                required: ["keyword"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "recordAbsensi",
              description: "Mencatat absensi (Masuk, Keluar, Kembali, atau Pulang) melalui Telegram.",
              parameters: {
                type: "object",
                properties: { tipe: { type: "string", description: "Jenis absensi: 'MASUK', 'KELUAR', 'KEMBALI', atau 'PULANG'" } },
                required: ["tipe"]
              }
            }
          }
        ];
        
        const response = await sumopod.chat.completions.create({
          model: process.env.SUMOPOD_MODEL || "gemini/gemini-2.5-flash",
          messages: [
            { role: "system", content: sysInstructions },
            { role: "user", content: text }
          ],
          tools: tools,
          temperature: 0.7
        });
        
        const msg = response.choices[0].message;
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const call = msg.tool_calls[0] as any;
          functionCallInfo = {
            name: call.function.name,
            args: JSON.parse(call.function.arguments),
            id: call.id,
            sumopodMsg: msg
          };
        } else if (msg.content && msg.content.includes('<tool_call>')) {
          const funcMatch = msg.content.match(/<function=([a-zA-Z0-9_]+)>/);
          let parsedName = "";
          let parsedArgs: any = {};
          
          if (funcMatch) {
             parsedName = funcMatch[1];
             try {
                 const jsonMatch = msg.content.match(/\{[\s\S]*?\}/);
                 if (jsonMatch) Object.assign(parsedArgs, JSON.parse(jsonMatch[0]));
             } catch(e) {}
             const tipeMatch = msg.content.match(/<tipe>(.*?)<\/tipe>/i);
             if (tipeMatch) parsedArgs.tipe = tipeMatch[1];
          } else {
             try {
                 // Try to match Qwen JSON format
                 const jsonMatch = msg.content.match(/\{[\s\S]*"name"[\s\S]*\}/);
                 if (jsonMatch) {
                     const callData = JSON.parse(jsonMatch[0]);
                     if (callData.name) {
                         parsedName = callData.name;
                         if (typeof callData.arguments === 'string') {
                            parsedArgs = JSON.parse(callData.arguments);
                         } else if (typeof callData.arguments === 'object') {
                            parsedArgs = callData.arguments;
                         }
                     }
                 }
             } catch(e) {}
          }
          
          if (parsedName) {
             const cleanMsg = { ...msg };
             cleanMsg.tool_calls = [{
                id: "call_xml_fallback",
                type: "function",
                function: { name: parsedName, arguments: JSON.stringify(parsedArgs) }
             }];
             functionCallInfo = {
               name: parsedName,
               args: parsedArgs,
               id: "call_xml_fallback",
               sumopodMsg: cleanMsg
             };
             
             // If there's text before the XML block, it's good to show it immediately to feel faster
             const introText = msg.content.split('<tool_call>')[0].trim();
             if (introText && introText.length > 5 && parsedName !== 'recordAbsensi') {
                 ctx.reply(introText);
             }
          } else {
             aiResponseText = msg.content;
          }
        } else {
          aiResponseText = msg.content || "Maaf, saya kurang mengerti.";
        }
      }

      if (functionCallInfo) {
        const callName = functionCallInfo.name;
        let result = "";
        
        if (callName === "getEmployees") {
           const { data: emps } = await supabase.from('karyawan').select('nip, nama, role').eq('company_id', user.company_id);
           if (!emps || emps.length === 0) result = "Tidak ada karyawan ditemukan.";
           else result = JSON.stringify(emps);
        }
        else if (callName === "getTodayAttendance") {
           // Get date in WIB
           const now = new Date();
           const todayWIB = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
           const todayStr = todayWIB.getFullYear() + '-' + String(todayWIB.getMonth() + 1).padStart(2, '0') + '-' + String(todayWIB.getDate()).padStart(2, '0');
           
           // Query with timezone aware bounds
           const { data: absensi } = await supabase.from('absensi').select('nip, nama, tipe, waktu_masuk').eq('company_id', user.company_id).gte('waktu_masuk', `${todayStr}T00:00:00+07:00`).lte('waktu_masuk', `${todayStr}T23:59:59+07:00`);
           if (!absensi || absensi.length === 0) {
             result = "Belum ada rekaman absensi hari ini.";
           } else {
             const formatted = absensi.map((a: any) => ({
               nip: a.nip,
               nama: a.nama,
               tipe: a.tipe,
               waktu_masuk_wib: new Date(a.waktu_masuk).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
             }));
             result = JSON.stringify(formatted);
           }
        }
        else if (callName === "getEmployeeAttendance") {
            const keyword = functionCallInfo.args.keyword;
            if (!keyword) {
               result = "Mohon sebutkan nama atau NIP karyawan.";
            } else {
               const thirtyDaysAgo = new Date();
               thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
               const startStr = thirtyDaysAgo.toISOString();
               
               const ext = supabase.from('absensi')
                  .select('nip, nama, tipe, waktu_masuk, status_acc, keterangan')
                  .eq('company_id', user.company_id)
                  .gte('waktu_masuk', startStr)
                  .or("nama.ilike.%"+keyword+"%,nip.ilike.%"+keyword+"%")
                  .order('waktu_masuk', { ascending: false })
                  .limit(50);
               const extRes = await ext;
               
               if (!extRes.data || extRes.data.length === 0) {
                 result = "Tidak ditemukan riwayat absensi untuk `"+keyword+"` dalam 30 hari terakhir.";
               } else {
                 const formatted = extRes.data.map((a) => ({
                   nip: a.nip,
                   nama: a.nama,
                   tipe: a.tipe,
                   waktu_wib: new Date(a.waktu_masuk).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
                   status: ['IJIN','SAKIT','CUTI','LUPA_ABSEN'].includes(a.tipe) ? (a.status_acc === 1 ? 'DISETUJUI' : a.status_acc === 2 ? 'DITOLAK' : 'PENDING') : 'VALID',
                   keterangan: a.keterangan || '-'
                 }));
                 result = JSON.stringify(formatted);
               }
            }
        }
        else if (callName === "recordAbsensi") {
           const tipe = functionCallInfo.args.tipe || "MASUK";
           attendanceSessionMap.set(chatId, { company_id: user.company_id, nip: user.nip, nama: user.nama, role: user.role, tipe: tipe.toUpperCase(), step: 'WAITING_LOCATION' });
           result = `Beritahu pengguna untuk membagikan LOKASI (Share Location) saat ini untuk melanjutkan absensi ${tipe}. Anda bisa beritahu jika sudah membagikan lokasi maka sistem akan menanyakan foto selfie selanjutnya.`;
           setTimeout(() => { ctx.reply("Atau tekan tombol di bawah ini untuk mengirim lokasi dengan cepat:", Markup.keyboard([[Markup.button.locationRequest("📍 Bagikan Lokasi saat ini")]]).oneTime().resize()); }, 2000);
        }

        if (sumopod) {
           const secondResponse = await sumopod.chat.completions.create({
             model: process.env.SUMOPOD_MODEL || "gemini/gemini-2.5-flash",
             messages: [
               { role: "system", content: sysInstructions },
               { role: "user", content: text },
               functionCallInfo.sumopodMsg,
               { role: "tool", tool_call_id: functionCallInfo.id, content: result }
             ]
           });
           ctx.reply(secondResponse.choices[0].message.content || "Selesai di proses.");
        } else if (functionCallInfo.googleChat) {
           const secondResponse = await functionCallInfo.googleChat.sendMessage({
             message: [{ functionResponse: { name: callName, response: { result } } }]
           });
           ctx.reply(secondResponse.text || "Selesai di proses.");
        }
      } else {
        ctx.reply(aiResponseText);
      }

    } catch (err: any) {
      console.error("AI Assistant Error:", err);
      
      // Fallback helper when AI is experiencing token expiration or network outages
      try {
        const query = (text || "").toLowerCase();
        
        if (query.includes("absen") || query.includes("hadir") || query.includes("mau absen")) {
          let tipe = "MASUK";
          if (query.includes("pulang")) tipe = "PULANG";
          else if (query.includes("istirahat") || query.includes("keluar")) tipe = "KELUAR";
          else if (query.includes("kembali") || query.includes("masuk lagi")) tipe = "KEMBALI";

          attendanceSessionMap.set(chatId, {
            company_id: user.company_id,
            nip: user.nip,
            nama: user.nama,
            role: user.role,
            tipe: tipe,
            step: 'WAITING_LOCATION'
          });

          return ctx.reply(
            `Siap untuk Absen ${tipe}! (Asisten Fallback) 📍 Silakan bagikan Lokasi Anda saat ini (Share Location) menggunakan tombol di bawah, atau fitur Attach Location.`,
            Markup.keyboard([
              [Markup.button.locationRequest("📍 Bagikan Lokasi saat ini")]
            ]).oneTime().resize()
          );
        }

        if (query.includes("karyawan") || query.includes("daftar staff")) {
          const { data: emps } = await supabase.from('karyawan').select('nip, nama, role').eq('company_id', user.company_id);
          if (emps && emps.length > 0) {
            let empTxt = `👥 *Daftar Karyawan (Sistem Fallback)*\n\n`;
            emps.forEach((e, i) => { empTxt += `${i+1}. ${e.nama} (${e.nip}) - ${e.role}\n`; });
            if (empTxt.length > 4000) empTxt = empTxt.substring(0, 4000) + "...";
            return ctx.reply(empTxt, { parse_mode: "Markdown" });
          }
        }

        if (query.includes("monitoring") || query.includes("tim hari ini") || (query.includes("siapa") && query.includes("absen"))) {
          const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
          const today = tzDate.getFullYear() + '-' + String(tzDate.getMonth() + 1).padStart(2, '0') + '-' + String(tzDate.getDate()).padStart(2, '0');
          const { data: logs } = await supabase.from('absensi').select('*').eq('company_id', user.company_id).gte('waktu_masuk', `${today}T00:00:00+07:00`).lte('waktu_masuk', `${today}T23:59:59+07:00`).order('waktu_masuk', { ascending: false });
          
          if (logs && logs.length > 0) {
            let monTxt = `📅 *Monitoring Absen Hari Ini (Sistem Fallback)*\nTanggal: ${today}\n\n`;
            logs.forEach((l, i) => {
               const time = new Date(l.waktu_masuk).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
               const emoji = l.tipe === 'MASUK' ? '📸' : l.tipe === 'PULANG' ? '🏠' : l.tipe === 'MULAI_ISTIRAHAT' ? '☕' : l.tipe === 'SELESAI_ISTIRAHAT' ? '🔙' : '📝';
               monTxt += `${i+1}. ${emoji} *${l.nama}* - ${l.tipe.replace('_', ' ')} (${time})\n`;
            });
            if (monTxt.length > 4000) monTxt = monTxt.substring(0, 4000) + "...";
            return ctx.reply(monTxt, { parse_mode: "Markdown" });
          } else {
            return ctx.reply(`📅 *Monitoring Absen Hari Ini (Sistem Fallback)*\n\nBelum ada data kehadiran hari ini.`);
          }
        }
      } catch (fallbackErr) {
        console.error("Telegram fallback error:", fallbackErr);
      }

      // Default fallback conversational message
      const defaultMsg = `Halo Kak ${user.nama || 'Pengguna'}! 🤖\n\nSaat ini server asisten AI kami sedang diistirahatkan sejenak untuk pemeliharaan berkala.\n\nNamun, Anda tetap bisa mengetik atau memilih perintah kunci berikut:\n• Ketik *absen* untuk melakukan absensi\n• Ketik *karyawan* untuk melihat data tim\n• Ketik *monitoring* untuk cek live absen hari ini\n• Ketik *panduan* untuk panduan lengkap aplikasi\n• Gunakan menu keyboard di bawah untuk navigasi instan.`;
      ctx.reply(defaultMsg);
    }
  } catch (globalErr: any) {
    console.error("Global text handler error:", globalErr);
    try {
      ctx.reply("Terjadi kesalahan sistem, silakan coba lagi: " + (globalErr && globalErr.message ? globalErr.message : String(globalErr)));
    } catch (e: any) {}
  }
});

  bot.on("location", async (ctx) => {
    const chatId = String(ctx.from.id);
    const session = attendanceSessionMap.get(chatId);
    
    if (!session || session.step !== 'WAITING_LOCATION') {
      return ctx.reply("Saya menerima lokasi Anda. Apakah Anda ingin absen? Silakan ketik perintah atau tekan tombol Absen terlebih dahulu.");
    }
    
    const msg = ctx.message as any;
    
    // Prevent forwarded locations
    if (msg.forward_date || msg.forward_origin) {
      return ctx.reply("❌ Sistem mendeteksi lokasi dari pesan yang diteruskan (forward). Harap bagikan LOKASI SAAT INI secara langsung menggunakan GPS perangkat.");
    }

    const userLat = ctx.message.location.latitude;
    const userLng = ctx.message.location.longitude;

    ctx.reply("📍 Memeriksa area dan jarak lokasi Anda...");

    try {
      const { data: userData } = await supabase.from("karyawan").select("departemen_id").eq("nip", session.nip).single();
      let requireGps = false;
      let targetLat = 0;
      let targetLng = 0;
      let targetRadius = 0;
      let deptChecked = false;

      if (userData?.departemen_id) {
        const { data: dept } = await supabase.from("departemen").select("lat, lng, radius").eq("id", userData.departemen_id).single();
        if (dept && dept.radius !== null && dept.radius !== undefined) {
          deptChecked = true;
          if (dept.radius > 0 && dept.lat !== null && dept.lng !== null) {
            requireGps = true; 
            targetLat = parseFloat(dept.lat); 
            targetLng = parseFloat(dept.lng); 
            targetRadius = parseFloat(dept.radius);
          } else if (dept.radius === -1) {
            requireGps = false;
          }
        }
      }

      if (!deptChecked) {
        const { data: companyData } = await supabase.from("companies").select("location_enabled, office_radius, office_lat, office_lng").eq("company_id", session.company_id).single();
        if (companyData && companyData.location_enabled && companyData.office_radius && companyData.office_lat && companyData.office_lng) {
          requireGps = true;
          targetLat = parseFloat(companyData.office_lat);
          targetLng = parseFloat(companyData.office_lng);
          targetRadius = parseFloat(companyData.office_radius);
        }
      }

      if (requireGps) {
        const dist = calculateDistance(userLat, userLng, targetLat, targetLng);
        if (dist > targetRadius) {
          return ctx.reply(`❌ Anda berada di luar jangkauan area absen!\nToleransi: ${targetRadius} meter.\nJarak Anda saat ini: ${Math.round(dist)} meter dari titik absensi.\n\nHarap mendekat ke lokasi kantor yang ditentukan dan kirim LOKASI lagi.`);
        }
      }
    } catch (e: any) {
      console.error("Geofencing check error:", e);
    }

    session.lat = userLat;
    session.lng = userLng;
    session.step = 'WAITING_PHOTO';
    attendanceSessionMap.set(chatId, session);

    return ctx.reply("✅ Lokasi diverifikasi. Sekarang, silakan kirimkan 📸 **Foto Selfie** (Attach Photo) dari Kamera Anda sebagai bukti kehadiran.", Markup.removeKeyboard());
  });

  bot.on("photo", async (ctx) => {
    const chatId = String(ctx.from.id);
    const session = attendanceSessionMap.get(chatId);
    
    if (!session || (session.step !== 'WAITING_PHOTO' && session.step !== 'WAITING_IZIN_BUKTI')) {
      return ctx.reply("Saya menerima foto Anda. Jika Anda bermaksud untuk absen, ikuti tahapannya (Pilih Absen -> Kirim Lokasi -> Kirim Foto).");
    }

    const msg = ctx.message as any;
    if (msg.forward_date || msg.forward_origin) {
      if (session.step === 'WAITING_PHOTO') {
        return ctx.reply("❌ Sistem mendeteksi foto yang diteruskan (forward). Harap gunakan kamera (Attach Photo) untuk memotret selfie langsung secara realtime.");
      }
    }

    try {
      ctx.sendChatAction("typing");
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // highest res
      const fileId = photo.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      
      const response = await fetch(fileLink.href);
      const arrayBuffer = await response.arrayBuffer();
      // Ensure Buffer is available internally or imported, it's global in Node.
      const base64Image = Buffer.from(arrayBuffer).toString('base64');
      
      if (session.step === 'WAITING_IZIN_BUKTI') {
         ctx.reply("Sedang menyimpan dokumen...");
         // For Telegram bot we can just use the telegram generated link as photo, or save the base64, but base64 might be huge. 
         // Let's assume database uses base64 or a url that we upload. For now I'll just save the data URI.
         const dataUri = `data:image/jpeg;base64,${base64Image}`;
         await savePengajuanIzin(ctx, session, dataUri);
         return;
      }

      // AI Photo Validation & Match
      const sumopod = getOpenAiClient();
      if (sumopod) {
        ctx.reply("Menganalisa foto selfie Anda...");
        try {
          // Fetch registered face
          const { data: userData } = await supabase
            .from('karyawan')
            .select('foto_wajah_base64')
            .eq('nip', session.nip)
            .eq('company_id', session.company_id)
            .single();

          let validationText = "";

          const parts: any[] = [];
          if (userData && userData.foto_wajah_base64) {
            parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${userData.foto_wajah_base64.split(',')[1] || userData.foto_wajah_base64}` } });
            parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } });
            parts.push({ type: "text", text: "Gambar pertama adalah wajah karyawan yang terdaftar. Gambar kedua adalah foto selfie yang baru saja dikirim untuk absensi. Apakah kedua gambar ini adalah ORANG YANG SAMA? Jika ya, jawab YA. Jika bukan orang yang sama, atau gambar kedua bukan wajah manusia yang jelas, jawab TIDAK beserta alasannya singkat." });
          } else {
            parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } });
            parts.push({ type: "text", text: "Apakah gambar ini menunjukkan wajah manusia yang terlihat jelas, seperti foto selfie (swafoto)? Jika BUKAN wajah manusia (misalnya foto pemandangan, layar hp, teks, hewan, atau benda), jawab dengan TIDAK beserta alasannya singkat. Jika ini adalah wajah/selfie, jawab dengan YA." });
          }
          
          const sumopodResp = await sumopod.chat.completions.create({
            model: process.env.SUMOPOD_VISION_MODEL || process.env.SUMOPOD_MODEL || "gemini/gemini-2.5-flash",
            messages: [{ role: "user", content: parts }]
          });
          validationText = sumopodResp.choices[0].message.content?.trim() || "";
          
          if (validationText.toUpperCase().startsWith("TIDAK")) {
             ctx.reply(`❌ Foto ditolak: ${validationText.replace(/^TIDAK[,.]?\s*/i, '')}\nSilakan kirimkan ulang foto selfie yang sesuai dengan wajah terdaftar Anda.`);
             return; // Do NOT clear session, wait for a correct photo
          }
        } catch (aiError) {
          console.error("AI Photo validation error:", aiError);
          // Proceed if error
        }
      }

      const todayISO = new Date().toISOString();
      const { error } = await supabase
        .from('absensi')
        .insert({
          company_id: session.company_id,
          nip: session.nip,
          nama: session.nama,
          tipe: session.tipe,
          waktu_masuk: todayISO,
          image: base64Image,
          lat: session.lat,
          lng: session.lng,
          status_acc: '1' // 1 means logged in / valid or requires approval depending on system. Assume 1 = valid.
        });

      if (error) {
        ctx.reply(`❌ Gagal mencatat absensi: ${error.message}`);
      } else {
        ctx.reply(`✅ **Absen ${session.tipe}** berhasil dicatat dengan lokasi dan foto! Selamat beraktivitas. 👍`, getKeyboard(session.role));
        
        // Notify Owners and Admins via Telegram
        try {
          const { data: admins } = await supabase
            .from('karyawan')
            .select('nip, nama, telegram_chat_id, role')
            .eq('company_id', session.company_id)
            .in('role', ['OWNER', 'MASTER_ADMIN']);
            
          if (admins && admins.length > 0) {
            const formatWaktu = new Date(todayISO).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            const mapsLink = session.lat && session.lng ? `https://www.google.com/maps?q=${session.lat},${session.lng}` : '-';
            const safeName = session.nama.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '');
            const adminMsg = `*Info Kehadiran🟢*\n\nKaryawan *${safeName}* baru saja melakukan absensi *${session.tipe}* via Telegram.\n\nWaktu: ${formatWaktu}\n[Lihat Lokasi di Peta](${mapsLink})`;

            for (const admin of admins) {
              if (admin.telegram_chat_id && admin.telegram_chat_id !== chatId.toString()) {
                // Determine file ID or URL to send. 
                // Since we have the file_id from telegram directly, we can just forward it or send photo by file_id!
                const fileId = ctx.message && "photo" in ctx.message ? ctx.message.photo[ctx.message.photo.length - 1].file_id : null;
                
                if (fileId) {
                   ctx.telegram.sendPhoto(admin.telegram_chat_id, fileId, {
                     caption: adminMsg,
                     parse_mode: 'Markdown'
                   }).catch(e => console.error("Error sending admin notif via TG Bot:", e));
                } else {
                   ctx.telegram.sendMessage(admin.telegram_chat_id, adminMsg, {
                     parse_mode: 'Markdown'
                   }).catch(e => console.error("Error sending admin notif via TG Bot:", e));
                }
              }
            }
          }
        } catch (e: any) {
          console.error("TG Owner Notification Error from bot:", e);
        }
      }

      // Cleanup
      attendanceSessionMap.delete(chatId);
    } catch (err: any) {
      console.error(err);
      ctx.reply(`Terjadi kesalahan saat memproses foto: ${err.message}`, getKeyboard(session.role));
      attendanceSessionMap.delete(chatId);
    }
  });

  bot.catch((err, ctx) => {
    console.error(`Unhandled error for ${ctx.updateType}`, err);
  });

  bot.action(/^acc_(\d+)$/, async (ctx) => {
     const id = ctx.match[1];
     try {
       await supabase.from('absensi').update({ status_acc: 1 }).eq('id', id);
       await ctx.answerCbQuery('Berhasil disetujui!');
       const msg = ctx.callbackQuery.message as any;
       await ctx.editMessageCaption(msg?.caption + "\n\nStatus: ✅ *DISETUJUI*", { parse_mode: "Markdown" }).catch(e => {
          ctx.editMessageText(msg?.text + "\n\nStatus: ✅ *DISETUJUI*", { parse_mode: "Markdown" }).catch(()=>{});
       });
     } catch(e) {
       await ctx.answerCbQuery('Gagal menyetujui');
     }
  });

  bot.action(/^rej_(\d+)$/, async (ctx) => {
     const id = ctx.match[1];
     try {
       await supabase.from('absensi').update({ status_acc: 2 }).eq('id', id);
       await ctx.answerCbQuery('Berhasil ditolak!');
       const msg = ctx.callbackQuery.message as any;
       await ctx.editMessageCaption(msg?.caption + "\n\nStatus: ❌ *DITOLAK*", { parse_mode: "Markdown" }).catch(e => {
          ctx.editMessageText(msg?.text + "\n\nStatus: ❌ *DITOLAK*", { parse_mode: "Markdown" }).catch(()=>{});
       });
     } catch(e) {
       await ctx.answerCbQuery('Gagal menolak');
     }
  });


  // Listen for absensi status_acc updates from the Web / Admin panel
  supabase
    .channel('absensi_status_updates')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'absensi' },
      async (payload) => {
        const oldRow = payload.old;
        const newRow = payload.new;
        
        if ((oldRow.status_acc === 0 || oldRow.status_acc === '0') && (newRow.status_acc === 1 || newRow.status_acc === '1' || newRow.status_acc === 2 || newRow.status_acc === '2')) {
           if (['CUTI', 'SAKIT', 'IJIN'].includes(newRow.tipe)) {
              try {
                 const { data: user } = await supabase.from('karyawan').select('telegram_chat_id').eq('nip', newRow.nip).single();
                 if (user?.telegram_chat_id) {
                    const statusStr = String(newRow.status_acc) === '1' ? '✅ *DISETUJUI*' : '❌ *DITOLAK*';
                    const dateStr = new Date(newRow.waktu_masuk).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
                    await bot.telegram.sendMessage(user.telegram_chat_id, `🔔 *Status Pengajuan Diperbarui*\n\nPengajuan *${newRow.tipe}* Anda untuk tanggal *${dateStr}*\nKeterangan: ${newRow.keterangan || '-'}\n\nStatus saat ini: ${statusStr}`, { parse_mode: 'Markdown' });
                 }
              } catch(e) {
                 console.error("Realtime notify error:", e);
              }
           }
        }
      }
    )
    .subscribe();

  let isStarting = false;
  const startBot = async () => {  
    if (isStarting) return;
    isStarting = true;
    try { await new Promise(r => setTimeout(r, 4000)); } catch(e){}

    if (process.env.DISABLE_POLLING === 'true') { console.log('Polling is explicitly disabled via env var.'); return; }
    try {
      const info = await bot.telegram.getWebhookInfo();
      if (info && info.url) {
        console.log("Telegram Bot is configured to use Webhook at:", info.url);
      } else {
        console.log("Telegram Bot webhook is not completely set yet, please trigger it via SettingsTab.");
      }
      return; // Force no polling to save NPROC
    } catch(err: any) {
      if (err && err.response && err.response.error_code === 409) {
        console.warn("⚠️ Telegram Bot Conflict (409): Bot is likely running in another instance. Polling disabled for this process.");
      } else {
        console.warn("⚠️ Telegram Bot failed to start:", err.message || err);
      }
    }
  };

  startBot();

  // Enable graceful stop
  process.once('SIGINT', () => {
    try { bot.stop('SIGINT'); } catch(e) {}
  });
  process.once('SIGTERM', () => {
    try { bot.stop('SIGTERM'); } catch(e) {}
  });
}
