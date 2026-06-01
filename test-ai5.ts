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
    const text = "ui";
    const tools: any = [
          {
            type: "function",
            function: {
              name: "getTodayAttendance",
              description: "Mendapatkan laporan absensi seluruh karyawan khusus untuk hari ini saja."
            }
          }
        ];
    const response = await openai.chat.completions.create({
      model: "gemini/gemini-2.5-flash",
      messages: [
        { role: "system", content: sysInstructions },
        { role: "user", content: text }
      ],
      tools: tools,
      temperature: 0.7
    });
    
    console.log("Success:", JSON.stringify(response.choices[0].message));
    console.log("Finish Reason:", response.choices[0].finish_reason);
  } catch (err: any) {
    console.error("Error:", err.message);
    if(err.response) console.error(err.response.data);
  }
}
test();
