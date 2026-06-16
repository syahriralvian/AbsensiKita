import { Request, Response, Router } from "express";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const geminiRouter = Router();

geminiRouter.post("/api/gemini/chat", async (req: Request, res: Response) => {
  try {
    const { messages, systemInstruction } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const apiKey = process.env.SUMOPOD_API_KEY || "sk-2y-ltL-AgZQFIJxwU1OKaQ";
    let baseURL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";
    if (baseURL.includes("api.sumopod.com")) {
      baseURL = baseURL.replace("api.sumopod.com", "ai.sumopod.com");
    }
    if (!baseURL.endsWith("/v1")) {
      baseURL = baseURL.replace(/\/$/, "") + "/v1";
    }

    const ai = new OpenAI({ apiKey, baseURL });
    
    const formattedMessages: ChatCompletionMessageParam[] = messages.map((m: any) => ({
      role: (m.role === "model" || m.role === "assistant") ? "assistant" : "user",
      content: String(m.text || m.content || "")
    }));

    if (systemInstruction) {
      formattedMessages.unshift({ role: "system", content: systemInstruction });
    }

    const response = await ai.chat.completions.create({
      model: process.env.SUMOPOD_MODEL || "gemini/gemini-2.5-flash",
      messages: formattedMessages,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || "Maaf, tidak ada respons yang dihasilkan.";
    res.json({ reply });

  } catch (error: any) {
    console.error("Sumopod Chat Error:", error);
    
    // Attempt elegant fallback to keep chat responsive instead of crashing
    let fallbackReply = "Halo! Server asisten AI saat ini sedang dalam pemeliharaan berkala, namun kami siap melayani Anda. Silakan hubungi admin atau gunakan menu navigasi utama untuk mengelola absensi Anda.";
    try {
      const { messages } = req.body;
      let lastQuery = "";
      if (messages && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        lastQuery = String(lastMsg.text || lastMsg.content || "").toLowerCase();
      }

      if (lastQuery.includes("halo") || lastQuery.includes("hi") || lastQuery.includes("pagi") || lastQuery.includes("siang") || lastQuery.includes("malam")) {
        fallbackReply = "Halo! Saya Asisten AbsensiKita. Layanan AI kami saat ini sedang diistirahatkan sejenak untuk pemeliharaan sistem. Apakah ada menu absensi, karyawan, atau rekapitulasi laporan yang ingin Anda akses langsung?";
      } else if (lastQuery.includes("absen") || lastQuery.includes("hadir")) {
        fallbackReply = "Untuk melakukan absensi, silakan gunakan tombol **📸 Menu Absensi** di bot Telegram atau gunakan menu absensi langsung dari dashboard halaman Web.";
      } else if (lastQuery.includes("laporan") || lastQuery.includes("rekap") || lastQuery.includes("kartu")) {
        fallbackReply = "Anda bisa mengunduh rekapitulasi laporan absensi bulanan melalui menu **Laporan / Rekap** di panel kiri halaman web utama atau melalui bot Telegram langsung di sub-menu **📊 Menu Laporan**.";
      } else if (lastQuery.includes("izin") || lastQuery.includes("cuti") || lastQuery.includes("sakit")) {
        fallbackReply = "Pengajuan izin, sakit, atau cuti dapat dilakukan dengan mudah di halaman Web pada tab **Izin** maupun via bot Telegram dengan mengklik tombol **📝 Pengajuan Izin**.";
      } else if (lastQuery.includes("karyawan") || lastQuery.includes("tim")) {
        fallbackReply = "Daftar karyawan dan tim dapat dilihat secara langsung di halaman Web melalui menu **Data Karyawan / Staff** pada panel admin.";
      }
    } catch (fallbackErr) {
      console.error("Error generating fallback:", fallbackErr);
    }

    res.json({ reply: fallbackReply });
  }
});
