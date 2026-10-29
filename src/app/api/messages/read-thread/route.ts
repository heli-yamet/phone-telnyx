import { getMyNumber } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { broadcastSmsEvent } from "@/lib/events";
import { normalizePhone } from "@/lib/phone";
import { serializeMessage } from "@/lib/serialize";
import { Message } from "@/models/Message";
import { logError, logger } from "@/lib/logger";
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

    const updated = await Message.find({
      direction: "inbound",
      from: peer,
      to: myNumber,
    }).sort({ date: -1 }).limit(50);

    for (const message of updated) {
      broadcastSmsEvent({
        type: "message.updated",
        message: serializeMessage(message),
      });
    }

    return NextResponse.json({ modified: result.modifiedCount });
  } catch (error) {
    logError(log, "Read thread failed", error);
    return NextResponse.json({ error: "Failed to mark thread read" }, { status: 500 });
  }
}
