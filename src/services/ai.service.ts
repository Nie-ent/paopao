import { Type, Schema } from "@google/genai";
import { generateContent } from "@/lib/ai";
import { CATEGORIES, CATEGORY_NAMES } from "@/lib/categories";

export interface ExtractedTransaction {
  type: "INCOME" | "EXPENSE";
  amount: number;
  category: string;
  note: string;
  isSubscriptionPayment?: boolean;
  /** Bank reference printed on a slip, as read by the AI */
  referenceNo?: string;
}

function buildAIConfig(userCategories: string[] = []) {
  const allCategories = Array.from(new Set([...CATEGORY_NAMES, ...userCategories]));

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
      referenceNo: {
        type: Type.STRING,
        description: "For bank slips only: the transaction reference number exactly as printed (labels like 'เลขที่รายการ', 'รหัสอ้างอิง', 'Ref', 'Transaction ID'). Empty string if there is none or it is not a slip."
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
${CATEGORIES.map(c => `- "${c.name}" (${c.type}): ${c.aiHint}.`).join('\n')}
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

  const response = await generateContent({
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
  
  const response = await generateContent({
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

  const response = await generateContent({
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

const STATEMENT_ROW_SCHEMA = (categories: string[]): Schema => ({
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "Transaction date as YYYY-MM-DD. Convert Buddhist-era years to Gregorian (2569 → 2026). Two-digit years like 69 mean 2569 BE = 2026." },
      time: { type: Type.STRING, description: "Time as HH:mm (24h) if the statement shows it, otherwise empty string" },
      type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"], description: "INCOME for money in (deposit/credit/รับโอน), EXPENSE for money out (withdrawal/debit/โอนออก/ชำระ)" },
      amount: { type: Type.NUMBER, description: "Positive amount of this transaction (not the running balance)" },
      category: { type: Type.STRING, enum: categories },
      note: { type: Type.STRING, description: "Short Thai description: merchant, counterparty or memo" },
      reference: { type: Type.STRING, description: "Transaction reference number if shown, otherwise empty string" },
    },
    required: ["date", "type", "amount", "category", "note"],
  },
})

const STATEMENT_INSTRUCTION = `You read Thai and English bank statements (PDF, spreadsheet text or app screenshots) and list every individual transaction.
Rules:
- One entry per transaction row. Skip opening/closing balance, totals, summaries, headers and fee notices that are not transactions.
- amount is the transaction amount, never the balance column.
- Dates must be Gregorian YYYY-MM-DD.
- Write 'note' in Thai.
- Salary deposits are already net: do not add deductions.`

export type StatementInput =
  | { kind: "text"; text: string }
  | { kind: "file"; data: Buffer; mimeType: string }

/** Extracts all transaction rows from a statement. Long text is split into chunks to stay within output limits. */
export async function extractStatementRows(input: StatementInput, userCategories: string[] = []) {
  const { SYSTEM_INSTRUCTION } = buildAIConfig(userCategories)
  const categories = Array.from(new Set([...CATEGORY_NAMES, ...userCategories]))
  const config = {
    systemInstruction: `${STATEMENT_INSTRUCTION}\n\n${SYSTEM_INSTRUCTION.split("IMPORTANT RULES")[0]}`,
    responseMimeType: "application/json",
    responseSchema: STATEMENT_ROW_SCHEMA(categories),
    temperature: 0,
    maxOutputTokens: 32768,
  }

  const parts: unknown[][] = input.kind === "file"
    ? [["List every transaction in this bank statement.", { inlineData: { data: input.data.toString("base64"), mimeType: input.mimeType } }]]
    : chunkLines(input.text, 120).map(chunk => [`List every transaction in this part of a bank statement:\n\n${chunk}`])

  const rows: RawStatementRow[] = []
  for (const contents of parts) {
    // A statement can produce a lot of output, so each model gets longer than the default
    const response = await generateContent({ contents: contents as never, config }, { timeoutMs: 45_000 })
    if (!response.text) continue
    try {
      rows.push(...(JSON.parse(response.text) as RawStatementRow[]))
    } catch {
      console.error("Failed to parse statement JSON chunk")
    }
  }
  return rows
}

export type RawStatementRow = { date: string; time?: string; type: "INCOME" | "EXPENSE"; amount: number; category: string; note: string; reference?: string }

function chunkLines(text: string, linesPerChunk: number) {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  const header = lines.slice(0, 3).join("\n")
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    // Repeat the first lines (column headers) so every chunk can be read on its own
    chunks.push(i === 0 ? lines.slice(0, linesPerChunk).join("\n") : `${header}\n...\n${lines.slice(i, i + linesPerChunk).join("\n")}`)
  }
  return chunks
}
