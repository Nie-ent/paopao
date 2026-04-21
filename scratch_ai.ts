import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";
const apiKey = process.env.AI_API_KEY;
const ai = new GoogleGenAI({ apiKey });
async function main() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "จ่ายค่าข้าว lineman 300 บาท",
    });
    console.log("Success:", !!response.text);
  } catch (error) {
    console.error("AI Error:", error);
  }
}
main();
