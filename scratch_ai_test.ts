import { extractTransactionsFromImages } from "./src/services/ai.service";
import * as dotenv from 'dotenv';
dotenv.config();

async function testai() {
  try {
     const dummyJpgBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
     const dummyBuffer = Buffer.from(dummyJpgBase64, "base64");
     const res = await extractTransactionsFromImages([{ buffer: dummyBuffer, mimeType: "image/jpeg" }]);
     console.log("AI Result:", JSON.stringify(res, null, 2));
  } catch (err) {
     console.error("AI Error:", err);
  }
}
testai();
