import { GoogleGenAI, Type } from "@google/genai";

// Ensure we fall back to a dummy key if env is missing to prevent crash on init
const apiKey = process.env.AI_API_KEY || "dummy_key";
const ai = new GoogleGenAI({ apiKey });

export const TRANSACTION_CATEGORIES = [
  "Food & Drink",        // Meals, snacks, coffee, dining out, groceries
  "Transport & Travel",  // BTS, MRT, grab, taxi, gas, flights
  "Housing & Utilities", // Rent, electricity, water, internet, repairs
  "Shopping & Personal Care", // Clothes, cosmetics, gadgets, haircuts
  "Health & Fitness",    // Hospital, medicine, gym, sports equipment
  "Entertainment & Social", // Movies, concerts, games, parties, subscriptions
  "Education & Self-Improvement", // Books, courses, workshops
  "Investment & Savings", // Stocks, DCA, funds, deposits
  "Income & Salary",     // Payroll, freelance, side-hustle, interest
  "Other"                // Anything that completely doesn't fit the above
];

const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    type: { 
      type: Type.STRING, 
      enum: ["INCOME", "EXPENSE"], 
      description: "Whether it is an incoming flow (INCOME) or outgoing flow (EXPENSE)" 
    },
    amount: { 
      type: Type.NUMBER, 
      description: "The absolute monetary amount of the transaction." 
    },
    category: { 
      type: Type.STRING, 
      enum: TRANSACTION_CATEGORIES, 
      description: "The most fitting category perfectly chosen from the available list without overlapping." 
    },
    note: { 
      type: Type.STRING, 
      description: "A short, concise description. (e.g., 'ข้าวผัดกะเพรา', 'ค่าช้อปปิ้ง')" 
    }
  },
  required: ["type", "amount", "category", "note"]
};

export interface ExtractedTransaction {
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  note: string;
}

const SYSTEM_INSTRUCTION = `You are an expert financial assistant AI. 
Your goal is to parse Thai and English inputs (messages or bank slips) and rigidly extract the exact transaction details into JSON. 
Ensure you categorize the transaction precisely using ONLY the provided categories. 
If an image is provided, parse the transfer amount, infer if it's an expense (user paid someone) or income (someone paid user), and categorize it based on the memo/receiver context. Use standard timezone for 'Today'.
IMPORTANT: You MUST write the 'note' value entirely in the Thai language.`;

export async function extractTransactionFromText(text: string): Promise<ExtractedTransaction | null> {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: transactionSchema,
        temperature: 0.1,
      }
    });

  if (response.text) {
    return JSON.parse(response.text) as ExtractedTransaction;
  }
  return null;
}

export async function extractTransactionFromImage(imageBuffer: Buffer, mimeType: string = "image/jpeg"): Promise<ExtractedTransaction | null> {
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
      contents: [
        "Please extract the transaction details from this bank slip.",
        {
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType,
          }
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: transactionSchema,
        temperature: 0.1,
      }
    });

  if (response.text) {
    return JSON.parse(response.text) as ExtractedTransaction;
  }
  return null;
}

export async function extractTransactionsFromImages(images: {buffer: Buffer, mimeType?: string}[]): Promise<ExtractedTransaction[]> {
  const contents: any[] = [
    "Please extract all transaction details from these bank slips. Return an array of transactions in the exact order."
  ];

  for (const img of images) {
    contents.push({
      inlineData: {
        data: img.buffer.toString("base64"),
        mimeType: img.mimeType || "image/jpeg",
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: transactionSchema
      },
      temperature: 0.1,
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as ExtractedTransaction[];
  }
  return [];
}
