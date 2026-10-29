import { connectDb } from "@/lib/db";
import { broadcastSmsEvent } from "@/lib/events";
import { serializeMessage } from "@/lib/serialize";
import { Message } from "@/models/Message";
import { logError, logger } from "@/lib/logger";
import { NextResponse } from "next/server";

const log = logger.child({ module: "api.messages.read" });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  context: { params: { id: string } }
) {
  try {
    await connectDb();
    const message = await Message.findByIdAndUpdate(
      context.params.id,
      { read: true },
      { new: true }
    );

    if (!message) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const dto = serializeMessage(message);
    broadcastSmsEvent({ type: "message.updated", message: dto });

    return NextResponse.json({ message: dto });
  } catch (error) {
    logError(log, "Mark read failed", error);
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
  }
}
