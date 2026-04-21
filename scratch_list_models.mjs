import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config();
const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });
async function main() {
  const models = await ai.models.list();
  for await (const m of models) {
     console.log(m.name);
  }
}
main().catch(console.error);
