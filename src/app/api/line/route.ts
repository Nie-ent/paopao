import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // TODO: Integrate LINE webhook processing
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
