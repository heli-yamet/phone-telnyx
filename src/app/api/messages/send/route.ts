import { getMyNumber } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { broadcastSmsEvent } from "@/lib/events";
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
  try {
    const body = (await request.json()) as SendBody;
    const text = body.text?.trim();
    const to = body.to ? normalizePhone(body.to) : "";
    const myNumber = normalizePhone(getMyNumber());
    const from = body.from ? normalizePhone(body.from) : myNumber;

    if (!to || !text) {
      return NextResponse.json(
        { error: "to and text are required" },
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
    } catch (sendError) {
      message.status = "failed";
      await message.save();
      broadcastSmsEvent({
        type: "message.updated",
        message: serializeMessage(message),
      });
      const errMsg =
        sendError instanceof Error ? sendError.message : "Send failed";
      return NextResponse.json(
        { error: errMsg, message: serializeMessage(message) },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: serializeMessage(message),
    });
  } catch (error) {
    console.error("Send SMS error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
