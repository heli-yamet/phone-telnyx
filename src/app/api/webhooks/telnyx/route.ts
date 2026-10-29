import { handleTelnyxWebhook } from "@/lib/telnyx-webhook";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await handleTelnyxWebhook(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Telnyx webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
