import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // TODO: Integrate Gemini API
    return NextResponse.json({ success: true, message: "AI processed" });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
