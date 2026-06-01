import 'dotenv/config';
import OpenAI from 'openai';

async function test() {
  const sumopodKey = process.env.SUMOPOD_API_KEY || "sk-QAMQLQPvhivx1wsAXdUeIg";
  const openai = new OpenAI({
    apiKey: sumopodKey,
    baseURL: "https://ai.sumopod.com/v1"
  });

  try {
    const sysInstructions = "Hello";
    const text = "Laporan Total";
    const tools: any = [
          {
            type: "function",
            function: {
              name: "getTodayAttendance",
              description: "Mendapatkan laporan absensi seluruh karyawan khusus untuk hari ini saja.",
              parameters: { type: "object", properties: {} }
            }
          }
        ];
    const response = await openai.chat.completions.create({
      model: process.env.SUMOPOD_MODEL || "gemini/gemini-2.5-flash",
      messages: [
        { role: "system", content: sysInstructions },
        { role: "user", content: text }
      ],
      temperature: 0.7
    });
    console.log("Success:", JSON.stringify(response.choices));
  } catch (err: any) {
    console.error("Error calling sumopod:", err);
    if(err.response) console.error(err.response.data);
  }
}
test();
