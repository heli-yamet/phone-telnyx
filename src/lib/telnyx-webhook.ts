import { getMyNumber } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { broadcastSmsEvent } from "@/lib/events";
import {
  isTerminalStatus,
  statusFromFinalized,
  webhookTimestamp,
} from "@/lib/outbound-status";
import { conversationKey, normalizePhone } from "@/lib/phone";
import { serializeMessage } from "@/lib/serialize";
import type { HydratedDocument } from "mongoose";
import { Detail } from "@/models/Detail";
import { Message, type IMessage } from "@/models/Message";

type MessageDoc = HydratedDocument<IMessage>;

type TelnyxWebhookBody = {
  data?: {
    id?: string;
    event_type?: string;
    payload?: TelnyxMessagePayload;
  };
  meta?: Record<string, unknown>;
};

type TelnyxMessagePayload = {
  id?: string;
  direction?: "inbound" | "outbound";
  text?: string;
  received_at?: string | null;
  sent_at?: string | null;
  completed_at?: string | null;
  from?: { phone_number?: string };
  to?: Array<{ phone_number?: string; status?: string }>;
  record_type?: string;
  errors?: Array<{ code?: string; title?: string; detail?: string }>;
};

function extractPayload(body: TelnyxWebhookBody): TelnyxMessagePayload | null {
  const payload = body.data?.payload;
  if (!payload || payload.record_type !== "message") return null;
  return payload;
}

function messageDate(payload: TelnyxMessagePayload): Date {
  const raw =
    payload.received_at ||
    payload.sent_at ||
    payload.completed_at ||
    new Date().toISOString();
  return new Date(raw);
}

function primaryTo(payload: TelnyxMessagePayload): string {
  const first = payload.to?.[0]?.phone_number;
  if (!first) throw new Error("Webhook payload missing to.phone_number");
  return normalizePhone(first);
}

async function findOutboundMessage(
  telnyxMessageId: string | undefined,
  from: string,
  myNumber: string,
  to: string,
  text: string
): Promise<MessageDoc | null> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);

  if (telnyxMessageId) {
    const byTelnyx = await Message.findOne({
      telnyxMessageId,
      direction: "outbound",
    });
    if (byTelnyx) return byTelnyx;
  }

  return Message.findOne({
    direction: "outbound",
    status: { $in: ["pending", "sent"] },
    from: normalizePhone(from || myNumber),
    to,
    text,
    date: { $gte: windowStart },
  }).sort({ date: -1 });
}

function applyWebhookDate(message: MessageDoc, at: Date): void {
  if (at.getTime() > message.date.getTime()) {
    message.date = at;
  }
}

async function persistDetailAndBroadcast(
  message: MessageDoc,
  body: TelnyxWebhookBody,
  eventId: string | undefined,
  telnyxMessageId: string | undefined,
  created: boolean
): Promise<void> {
  await Detail.create({
    messageId: message._id,
    eventId,
    telnyxMessageId,
    raw: body,
  });

  const dto = serializeMessage(message);
  broadcastSmsEvent(
    created
      ? { type: "message.created", message: dto }
      : { type: "message.updated", message: dto }
  );
}

export async function handleTelnyxWebhook(
  body: TelnyxWebhookBody
): Promise<{ ok: true; action: string }> {
  await connectDb();
  const myNumber = normalizePhone(getMyNumber());
  const payload = extractPayload(body);
  if (!payload) {
    return { ok: true, action: "ignored_non_message" };
  }

  const eventId = body.data?.id;
  const eventType = body.data?.event_type;
  const telnyxMessageId = payload.id;

  if (eventId) {
    const existingDetail = await Detail.findOne({ eventId }).lean();
    if (existingDetail) {
      return { ok: true, action: "duplicate_event" };
    }
  }

  const direction = payload.direction;
  const from = normalizePhone(payload.from?.phone_number || "");
  const to = primaryTo(payload);
  const text = payload.text ?? "";

  if (direction === "inbound") {
    if (telnyxMessageId) {
      const dup = await Message.findOne({ telnyxMessageId }).lean();
      if (dup) {
        await Detail.create({
          messageId: dup._id,
          eventId,
          telnyxMessageId,
          raw: body,
        });
        return { ok: true, action: "duplicate_inbound_message" };
      }
    }

    const peer = from;
    const message = await Message.create({
      from,
      to,
      text,
      date: messageDate(payload),
      direction: "inbound",
      status: "received",
      read: false,
      telnyxMessageId,
      conversationKey: conversationKey(myNumber, peer),
    });

    await persistDetailAndBroadcast(message, body, eventId, telnyxMessageId, true);
    return { ok: true, action: "inbound_created" };
  }

  if (direction === "outbound") {
    if (eventType !== "message.sent" && eventType !== "message.finalized") {
      const linked = await findOutboundMessage(
        telnyxMessageId,
        from,
        myNumber,
        to,
        text
      );
      if (linked) {
        await Detail.create({
          messageId: linked._id,
          eventId,
          telnyxMessageId,
          raw: body,
        });
        return { ok: true, action: "outbound_detail_only" };
      }
      return { ok: true, action: "ignored_outbound_event" };
    }

    let message = await findOutboundMessage(
      telnyxMessageId,
      from,
      myNumber,
      to,
      text
    );

    if (!message) {
      const initial =
        eventType === "message.finalized"
          ? statusFromFinalized(payload)
          : { status: "sent" as const };
      message = await Message.create({
        from: from || myNumber,
        to,
        text,
        date: webhookTimestamp(eventType, payload),
        direction: "outbound",
        status: initial.status === "failed" ? "failed" : initial.status,
        failureReason:
          initial.status === "failed" ? initial.failureReason : undefined,
        read: true,
        telnyxMessageId,
        conversationKey: conversationKey(myNumber, to),
      });
      await persistDetailAndBroadcast(message, body, eventId, telnyxMessageId, true);
      return {
        ok: true,
        action:
          eventType === "message.sent"
            ? "outbound_sent_created"
            : "outbound_finalized_created",
      };
    }

    if (telnyxMessageId) {
      message.telnyxMessageId = telnyxMessageId;
    }

    if (eventType === "message.sent") {
      if (!isTerminalStatus(message.status) && message.status === "pending") {
        message.status = "sent";
      }
      applyWebhookDate(message, webhookTimestamp(eventType, payload));
      await message.save();
      await persistDetailAndBroadcast(message, body, eventId, telnyxMessageId, false);
      return { ok: true, action: "outbound_sent" };
    }

    if (eventType === "message.finalized") {
      const final = statusFromFinalized(payload);
      message.status = final.status;
      message.failureReason = final.failureReason;
      applyWebhookDate(message, webhookTimestamp(eventType, payload));
      await message.save();
      await persistDetailAndBroadcast(message, body, eventId, telnyxMessageId, false);
      return {
        ok: true,
        action:
          final.status === "failed" ? "outbound_failed" : "outbound_delivered",
      };
    }
  }

  return { ok: true, action: "ignored_unknown_direction" };
}
