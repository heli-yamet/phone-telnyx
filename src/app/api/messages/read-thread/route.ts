import { getMyNumber } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { logError, logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/phone";
import { Message } from "@/models/Message";
import { NextResponse } from "next/server";

const log = logger.child({ module: "api.messages.read-thread" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { peer?: string };
    const peer = body.peer ? normalizePhone(body.peer) : "";
    if (!peer) {
      return NextResponse.json({ error: "peer is required" }, { status: 400 });
    }

    await connectDb();
    const myNumber = normalizePhone(getMyNumber());

    const result = await Message.updateMany(
      {
        read: false,
        direction: "inbound",
        from: peer,
        to: myNumber,
      },
      { read: true }
    );

    return NextResponse.json({ modified: result.modifiedCount });
  } catch (error) {
    logError(log, "Read thread failed", error);
    return NextResponse.json({ error: "Failed to mark thread read" }, { status: 500 });
  }
}
