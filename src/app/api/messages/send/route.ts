import { getMyNumber } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { broadcastSmsEvent } from "@/lib/events";
import { logError, logger, newRequestId } from "@/lib/logger";
import { conversationKey, normalizePhone } from "@/lib/phone";
import { serializeMessage } from "@/lib/serialize";
import { sendSmsViaTelnyx } from "@/lib/telnyx-send";
import { Message } from "@/models/Message";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendBody = {
  from?: string;
  to?: string;
  text?: string;
};

export async function POST(request: Request) {
  const requestId = newRequestId();
  const log = logger.child({ module: "api.messages.send", requestId });

  try {
    const body = (await request.json()) as SendBody;
    const text = body.text?.trim();
    const to = body.to ? normalizePhone(body.to) : "";
    const myNumber = normalizePhone(getMyNumber());
    const from = body.from ? normalizePhone(body.from) : myNumber;

    if (!to || !text) {
      log.warn("Send rejected: missing to or text");
      return NextResponse.json(
        { error: "to and text are required", requestId },
        { status: 400 }
      );
    }

    await connectDb();

    const message = await Message.create({
      from,
      to,
      text,
      date: new Date(),
      direction: "outbound",
      status: "pending",
      read: true,
      conversationKey: conversationKey(myNumber, to),
    });

    log.info("Outbound message queued", {
      messageId: message._id.toString(),
      from,
      to,
      textLength: text.length,
    });

    broadcastSmsEvent({
      type: "message.created",
      message: serializeMessage(message),
    });

    try {
      const result = await sendSmsViaTelnyx({ from, to, text });
      if (result.telnyxMessageId) {
        message.telnyxMessageId = result.telnyxMessageId;
        await message.save();
        broadcastSmsEvent({
          type: "message.updated",
          message: serializeMessage(message),
        });
      }
      log.info("Telnyx send API accepted", {
        messageId: message._id.toString(),
        telnyxMessageId: result.telnyxMessageId,
      });
    } catch (sendError) {
      message.status = "failed";
      await message.save();
      broadcastSmsEvent({
        type: "message.updated",
        message: serializeMessage(message),
      });
      logError(log, "Telnyx send API failed", sendError, {
        messageId: message._id.toString(),
        from,
        to,
      });
      const errMsg =
        sendError instanceof Error ? sendError.message : "Send failed";
      return NextResponse.json(
        { error: errMsg, message: serializeMessage(message), requestId },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: serializeMessage(message),
      requestId,
    });
  } catch (error) {
    logError(log, "Send SMS handler failed", error);
    return NextResponse.json(
      { error: "Failed to send message", requestId },
      { status: 500 }
    );
  }
}
