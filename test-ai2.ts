import 'dotenv/config';
import OpenAI from 'openai';

async function test() {
  const sumopodKey = process.env.SUMOPOD_API_KEY || "sk-QAMQLQPvhivx1wsAXdUeIg";
  const openai = new OpenAI({
    apiKey: sumopodKey,
    baseURL: "https://ai.sumopod.com/v1"
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gemini/gemini-2.5-flash",
      messages: [{ role: "user", content: "Halo" }]
    });
    console.log("Success:", response.choices[0].message.content);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
test();
