import { Request, Response, Router } from "express";
import OpenAI from "openai";

export const geminiRouter = Router();

geminiRouter.post("/api/gemini/chat", async (req: Request, res: Response) => {
  try {
    const { messages, systemInstruction } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }

    const apiKey = process.env.SUMOPOD_API_KEY || "sk-QAMQLQPvhivx1wsAXdUeIg";
    let baseURL = process.env.SUMOPOD_BASE_URL || "https://ai.sumopod.com/v1";
    if (baseURL.includes("api.sumopod.com")) {
      baseURL = baseURL.replace("api.sumopod.com", "ai.sumopod.com");
    }
    if (!baseURL.endsWith("/v1")) {
      baseURL = baseURL.replace(/\/$/, "") + "/v1";
    }

    const ai = new OpenAI({ apiKey, baseURL });
    
    const formattedMessages: any[] = messages.map((m: any) => ({
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
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
