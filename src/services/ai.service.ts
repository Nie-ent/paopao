import { GoogleGenAI, Type } from "@google/genai";

// Ensure we fall back to a dummy key if env is missing to prevent crash on init
const apiKey = process.env.AI_API_KEY || "dummy_key";
const ai = new GoogleGenAI({ apiKey });

export const TRANSACTION_CATEGORIES = [
  "Food & Drink",
  "Transport & Travel",
  "Housing & Utilities",
  "Shopping & Personal Care",
  "Health & Fitness",
  "Entertainment & Social",
  "Education & Self-Improvement",
  "Investment",
  "Salary",
  "Freelance",
  "Gift",
  "Transfer In",
  "Other Income",
  "Other"
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
      description: "The precise category chosen from the available list." 
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

const CATEGORY_DEFINITIONS = `
Strictly use these definitions to prevent overlap:
- "Food & Drink": Edible items (meals, snacks, coffee, dining out, grocery/supermarket food).
- "Transport & Travel": Moving around (BTS, MRT, grab, taxi, gas, flights).
- "Housing & Utilities": Home related (Rent, electricity, water, internet, home repairs).
- "Shopping & Personal Care": Physical goods not for eating (Clothes, cosmetics, gadgets, haircuts, Shopee/Lazada items).
- "Health & Fitness": Wellbeing (Hospital, medicine, supplements, gym, sports equipment).
- "Entertainment & Social": Leisure (Movies, concerts, games, parties, digital subscriptions like Netflix).
- "Education & Self-Improvement": Learning (Books, courses, workshops).
- "Investment": Outbound or inbound cash related to assets, DCA, crypto, gold, funds.
- "Salary": Inbound cash from regular monthly employment/payroll.
- "Freelance": Inbound cash from side-hustles, contract work, odds jobs.
- "Gift": Inbound free money from birthdays, gifts.
- "Transfer In": Money moved between own accounts or refund from friends.
- "Other Income": Inbound cash that is not salary/freelance/gift/transfer.
- "Other": Use ONLY if it absolutely does not fit anywhere else.
`;

const SYSTEM_INSTRUCTION = \`You are an expert financial assistant AI. 
Your goal is to parse Thai and English inputs (messages or bank slips) and rigidly extract the exact transaction details into JSON. 
\${CATEGORY_DEFINITIONS}
If an image is provided, parse the transfer amount, infer if it's an expense (user paid someone) or income (someone paid user), and categorize it based on the memo/receiver context. Use standard timezone for 'Today'.
IMPORTANT: You MUST write the 'note' value entirely in the Thai language.\`;

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
