import { getMyNumber } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { serializeMessage } from "@/lib/serialize";
import { Message } from "@/models/Message";
import { logError, logger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = logger.child({ module: "api.messages" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await connectDb();
    const myNumber = normalizePhone(getMyNumber());
    const { searchParams } = new URL(request.url);
    const peer = searchParams.get("peer");

    const filter: Record<string, unknown> = {};
    if (peer) {
      const p = normalizePhone(peer);
      filter.$or = [
        { from: p, to: myNumber },
        { from: myNumber, to: p },
      ];
    }

    const messages = await Message.find(filter).sort({ date: 1 }).limit(500);

    return NextResponse.json({
      myNumber,
      messages: messages.map((m) => serializeMessage(m)),
    });
  } catch (error) {
    logError(log, "List messages failed", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}
