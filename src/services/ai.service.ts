import { GoogleGenAI, Type, Schema } from "@google/genai";

// Ensure we fall back to a dummy key if env is missing to prevent crash on init
const apiKey = process.env.AI_API_KEY || "dummy_key";
const ai = new GoogleGenAI({ apiKey });

export const DEFAULT_TRANSACTION_CATEGORIES = [
  'Salary', 'Freelance', 'Gift', 'Income', 'Transfer In', 'Other Income',
  'Food', 'Transport', 'Housing', 'Utilities', 'Shopping', 'Entertainment',
  'Transfer Out', 'Investment', 'Saving', 'Other Expense'
];

export interface ExtractedTransaction {
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  note: string;
  isSubscriptionPayment?: boolean;
}

function buildAIConfig(userCategories: string[] = []) {
  const allCategories = Array.from(new Set([...DEFAULT_TRANSACTION_CATEGORIES, ...userCategories]));

  const transactionSchema: Schema = {
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
        enum: allCategories, 
        description: "The precise category chosen from the available list." 
      },
      note: { 
        type: Type.STRING, 
        description: "A short, concise description. (e.g., 'ข้าวผัดกะเพรา', 'ค่าช้อปปิ้ง')" 
      },
      isSubscriptionPayment: {
        type: Type.BOOLEAN,
        description: "True ONLY IF this is a transfer of exactly 59 THB to the receiver named 'ณภัทร สุวรรณจินดา' (Napat Suwanjinda). Otherwise, false."
      }
    },
    required: ["type", "amount", "category", "note"]
  };

  const CATEGORY_DEFINITIONS = `
Strictly use these definitions to prevent overlap:
- "Food": Edible items (meals, snacks, coffee, dining out, grocery/supermarket food).
- "Transport": Moving around (BTS, MRT, grab, taxi, gas, flights).
- "Housing": Home related (Rent, home repairs).
- "Utilities": electricity, water, internet, phone bills.
- "Shopping": Physical goods not for eating (Clothes, cosmetics, gadgets, haircuts, Shopee/Lazada items).
- "Entertainment": Leisure (Movies, concerts, games, parties, digital subscriptions like Netflix).
- "Investment": Outbound or inbound cash related to assets, DCA, crypto, gold, funds.
- "Saving": Moving money to savings accounts.
- "Salary": Inbound cash from regular monthly employment/payroll.
- "Freelance": Inbound cash from side-hustles, contract work, odds jobs.
- "Gift": Inbound free money from birthdays, gifts.
- "Transfer In": Money moved between own accounts or refund from friends.
- "Transfer Out": Money moved to other accounts without specific purpose.
- "Income": General inbound cash that does not fit other income types.
- "Other Income": Inbound cash that is not salary/freelance/gift/transfer.
- "Other Expense": Outbound cash that absolutely does not fit anywhere else.
${userCategories.length > 0 ? `\nUser Custom Categories (Prioritize these if the transaction context matches):\n- ${userCategories.join('\n- ')}` : ''}
`;

  const SYSTEM_INSTRUCTION = `You are an expert financial assistant AI. 
Your goal is to parse Thai and English inputs (messages or bank slips) and rigidly extract the exact transaction details into JSON. 
${CATEGORY_DEFINITIONS}
If an image is provided, parse the transfer amount, infer if it's an expense (user paid someone) or income (someone paid user), and categorize it based on the memo/receiver context. Use standard timezone for 'Today'.
IMPORTANT RULES: 
1. You MUST write the 'note' value entirely in the Thai language.
2. If the slip is a transfer of EXACTLY 59.00 THB to the account name "ณภัทร สุวรรณจินดา" (or Napat Suwanjinda), you MUST set 'isSubscriptionPayment' to true.`;

  return { transactionSchema, SYSTEM_INSTRUCTION };
}

export async function extractTransactionsFromText(text: string, userCategories: string[] = []): Promise<ExtractedTransaction[]> {
  const { transactionSchema, SYSTEM_INSTRUCTION } = buildAIConfig(userCategories);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: text,
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}
3. A text message may contain several items (e.g. "ข้าวมันไก่ 50 ชาไทย 35"). Return ONE array entry per item with its own amount. Do NOT sum them into a single entry.
4. If the text contains no monetary transaction, return an empty array.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: transactionSchema
      },
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    }
  });

  if (response.text) {
    try {
      return JSON.parse(response.text) as ExtractedTransaction[];
    } catch (e) {
      console.error("Failed to parse AI JSON:", response.text);
      return [];
    }
  }
  return [];
}

export async function extractTransactionFromImage(imageBuffer: Buffer, mimeType: string = "image/jpeg", userCategories: string[] = []): Promise<ExtractedTransaction | null> {
  const { transactionSchema, SYSTEM_INSTRUCTION } = buildAIConfig(userCategories);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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
    try {
      return JSON.parse(response.text) as ExtractedTransaction;
    } catch (e) {
      console.error("Failed to parse AI JSON from image:", response.text);
      return null;
    }
  }
  return null;
}

export async function extractTransactionsFromImages(images: {buffer: Buffer, mimeType?: string}[], userCategories: string[] = []): Promise<ExtractedTransaction[]> {
  const { transactionSchema, SYSTEM_INSTRUCTION } = buildAIConfig(userCategories);
  
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
    model: "gemini-2.5-flash",
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
    try {
      return JSON.parse(response.text) as ExtractedTransaction[];
    } catch (e) {
      console.error("Failed to parse AI JSON from array:", response.text);
      return [];
    }
  }
  return [];
}
