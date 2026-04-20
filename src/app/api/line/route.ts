import { NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { lineConfig } from '@/config/line';
import { handleLineEvent } from '@/services/line.service';

export async function POST(req: Request) {
  try {
    // 1. Grab raw body for signature validation
    const bodyText = await req.text();
    const signature = req.headers.get('x-line-signature') || '';

    // 2. Validate Signature (Only if we have a real secret configured)
    if (lineConfig.channelSecret && lineConfig.channelSecret !== "test_secret") {
      const isValid = validateSignature(
        Buffer.from(bodyText),
        lineConfig.channelSecret,
        signature
      );
      
      if (!isValid) {
        console.warn("Invalid LINE webhook signature detected.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 3. Parse JSON Body
    const data = JSON.parse(bodyText);

    // 4. Handle events asynchronously
    if (data.events && data.events.length > 0) {
      await Promise.all(data.events.map((event: any) => handleLineEvent(event)));
    }

    // 5. Always immediately return 200 OK so LINE knows it reached us
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("LINE Webhook Processing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
