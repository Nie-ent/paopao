import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config();
const apiKey = process.env.AI_API_KEY;
const ai = new GoogleGenAI({ apiKey });
async function main() {
  const versions = ["gemini-flash-latest", "gemini-2.0-flash-lite"];
  for (const v of versions) {
    try {
      console.log("Testing:", v);
      const response = await ai.models.generateContent({
        model: v,
        contents: "จ่ายค่าข้าว lineman 300 บาท",
      });
      console.log("Success with:", v, !!response.text);
      return;
    } catch (e) {
      console.log("Failed", v, e.status, e.message.split('\n')[0]);
    }
  }
}
main();
