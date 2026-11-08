import { NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { lineConfig } from '@/config/line';
import { handleLineEvent } from '@/services/line.service';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // 1. Grab raw body for signature validation
    const bodyText = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    // 2. Every request must carry LINE's signature. Fails closed when the secret isn't configured.
    if (!lineConfig.channelSecret || !validateSignature(Buffer.from(bodyText), lineConfig.channelSecret, signature)) {
      console.warn("Rejected LINE webhook: missing or invalid signature.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse JSON Body
    const data = JSON.parse(bodyText);

    // 4. Handle events asynchronously 
    if (data.events && data.events.length > 0) {
      await Promise.all(data.events.map((event: any) => handleLineEvent(event)));
    }

    // 5. Always return 200 OK
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("LINE Webhook Processing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

