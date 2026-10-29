import { peerNumber } from "@/lib/phone";
import type { IMessage } from "@/models/Message";
import type { MessageDTO } from "@/types/sms";

export type { MessageDTO };

export function serializeMessage(doc: IMessage): MessageDTO {
  const peer = peerNumber(doc.from, doc.to, doc.direction);

  return {
    id: doc._id.toString(),
    from: doc.from,
    to: doc.to,
    text: doc.text,
    date: doc.date.toISOString(),
    direction: doc.direction,
    status: doc.status,
    read: doc.read,
    peer,
    telnyxMessageId: doc.telnyxMessageId ?? undefined,
    failureReason: doc.failureReason ?? undefined,
  };
}
