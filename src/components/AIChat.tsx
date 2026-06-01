import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Headset, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";

// Remove global initialization

interface Message {
  role: "user" | "model";
  text: string;
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      if (!hasOpened) {
        setHasOpened(true);
        setIsLoading(true);
        setTimeout(() => {
          setMessages([{ role: "model", text: "Halo! Saya adalah Support Online AbsensiKita. Ada yang bisa saya bantu terkait aplikasi ini?" }]);
          setIsLoading(false);
        }, 800);
      }
    } else {
      const timer = setTimeout(() => {
        setMessages([]);
        setHasOpened(false);
        setInput("");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, hasOpened]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Rate Limiter
    const rateLimitStr = localStorage.getItem("ai_chat_rate_limit");
    let rateLimit = rateLimitStr ? JSON.parse(rateLimitStr) : { count: 0, resetAt: Date.now() + 60000 };
    if (Date.now() > rateLimit.resetAt) {
      rateLimit = { count: 0, resetAt: Date.now() + 60000 };
    }
    rateLimit.count++;
    localStorage.setItem("ai_chat_rate_limit", JSON.stringify(rateLimit));

    if (rateLimit.count > 10) {
      setMessages((prev) => [...prev, { role: "user", text: input.trim() }, { role: "model", text: "⏳ Maaf, Anda mengirim terlalu banyak pertanyaan. Silakan tunggu 1 menit." }]);
      setInput("");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const apiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));
      apiMessages.push({ role: 'user', content: userMessage });

      const systemInstruction = `Anda adalah "Support Online AbsensiKita". Tugas Anda adalah membantu pengguna memahami dan menggunakan aplikasi HRIS ini.
Sifat Anda: Sangat ramah, santai, ringkas, dan langsung ke intinya (to-the-point). Gunakan bahasa Indonesia yang sopan (seperti "Halo Kak!"). Selalu jawab maksimal 2-3 kalimat pendek dan gunakan format list jika perlu. Jangan menggunakan istilah sulit.

Konteks Menu Utama (Sidebar Kiri):
- [Dashboard]: Untuk pantauan harian, ringkasan jumlah absensi, status karyawan, dll. Di sini ada tombol untuk karyawan melakukan Absen masuk/pulang.
- [Log Presensi]: Melihat log mentah (jam & lokasi) absen harian karyawan.
- [Data Karyawan]: Untuk mendaftar/menambah akun karyawan, mengedit data, gaji, shift, dan foto wajah (Face id).
- [Izin & Koreksi]: Menyetujui/menolak izin/cuti dan memperbaiki rekaman waktu jika ada error absen.
- [Data Master]: Mengatur [Jam Kerja], [JamBreak], mendaftarkan [Hari Libur] (tanggal merah), [Siklus Shift], dan [Departemen].
- [Laporan]: Melihat riwayat/akumulasi harian & bulanan, yaitu di [Kartu Absensi], [Rekap Absensi], dan [Total Absensi].
- [Payroll]: Generate atau download laporan slip gaji bulanan karyawan berdasarkan rekapan dari semua komponen di atas.
- [Konfigurasi]: Ada [Pengaturan] (utk mengatur profil & timezone perusahaan saat ini), [Mesin Absen] (untuk integrasi ADMS Device, menghubungkan ke mesin absen fisik fingerprint/wajah), dan [Maintenance].
- [Perusahaan]: Khusus Super Admin untuk mengelola semua perusahaan.

Panduan Jawaban Khusus & Fitur Kalkulasi:
1. "Bagaimana cara absen / scan wajah?": Arahkan untuk menekan tombol absen di halaman [Dashboard]. Atau bisa melalui mesin absen fisik (ADMS) jika perusahaan sudah menghubungkannya.
2. "Cara daftarin / tambah karyawan?": Arahkan langsung klik menu **[Data Karyawan]** di sebelah kiri (bukan Pengaturan / Perusahaan!), lalu klik tombol biru **Tambah Karyawan**.
3. "Apakah bisa disambungkan ke mesin absen fisik?": Arahkan ke menu [Konfigurasi] -> [Mesin Absen/Perangkat] untuk menghubungkan mesin dengan protokol ADMS.
4. "Aturan Kalkulasi Departemen": Di menu Departemen, ada 4 Aturan Kalkulasi yang bisa dipilih: 
   - [Siklus Shift]: Jadwal kerja dinamis/berubah otomatis mengikuti siklus tertentu (misal: masuk 3 hari, libur 1 hari bergantian).
   - [JamKerja Tanpa Siklus Shift]: Jadwal kerja statis/fix (misal: Senin-Jumat jam 8-17), memilih dari template jadwal harian.
   - [FixStatus (Auto Detect)]: Aturan jam kerja bebas dan fleksibel, aplikasi mendeteksi kedatangan pertama sebagai jam masuk dan terakhir sebagai pulang.
   - [Tanpa Shift & Status]: Tidak memberlakukan aturan shift tertentu (cocok untuk pekerja lepas atau lembur tanpa limit batas).
5. Jika pengguna bertanya tentang "cara daftar" atau "buat akun" tanpa konteks yang jelas, tanyakan kembali dengan ramah: "Apakah Kakak ingin mendaftar sebagai Perusahaan Baru, atau ingin mendaftarkan Akun Karyawan?" Jawab sesuai dengan yang mereka minta setelahnya.

SANGAT PENTING: Jangan pernah merekomendasikan menu yang tidak ada di daftar atas. Pandu sesuai Konteks Menu Utama ini. Aplikasi ini MENDUKUNG integrasi mesin absen (ADMS).`;

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          systemInstruction: systemInstruction
        })
      });

      if (!response.ok) {
        let errText = response.statusText;
        try {
          const errData = await response.json();
          if (errData.error) errText = errData.error;
        } catch (e) {}
        throw new Error(`Koneksi AI gagal: ${errText}`);
      }

      const data = await response.json();
      const reply = data.reply || "Mohon maaf, saya tidak dapat memproses permintaan Anda saat ini.";
      
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMessage = `Maaf, terjadi kesalahan: ${error.message}`;
      setMessages((prev) => [...prev, { role: "model", text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden" 
            style={{ maxHeight: "calc(100vh - 120px)", height: "500px" }}
          >
            {/* Header */}
            <div className="bg-blue-600 p-4 text-white flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Headset className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Support Online AbsensiKita</h3>
                <p className="text-xs text-blue-100">Siap membantu Anda</p>
              </div>
            </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300" : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"}`}>
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Headset className="w-4 h-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none shadow-sm"}`}>
                    {msg.role === "user" ? (
                      msg.text
                    ) : (
                      <div className="markdown-body prose dark:prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2 max-w-[85%] flex-row">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 flex items-center justify-center">
                    <Headset className="w-4 h-4" />
                  </div>
                  <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none flex items-center shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="ml-2 text-xs text-slate-500">Bentar ya...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4 shrink-0" />
          </div>

          {/* Input */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Tanya sesuatu..."
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-slate-200"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            >
              <Send className="w-4 h-4 ml-1" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </>
);
}
