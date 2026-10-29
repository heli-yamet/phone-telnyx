export type MessageDTO = {
  id: string;
  from: string;
  to: string;
  text: string;
  date: string;
  direction: "inbound" | "outbound";
  status: "pending" | "sent" | "delivered" | "received" | "failed";
  read: boolean;
  peer: string;
  telnyxMessageId?: string;
  failureReason?: string;
};

export type ContactDTO = {
  id: string;
  name: string;
  phoneNumber: string;
};

export type SmsServerEvent =
  | { type: "connected" }
  | { type: "ping" }
  | { type: "message.created"; message: MessageDTO }
  | { type: "message.updated"; message: MessageDTO };

export type ConversationSummary = {
  peer: string;
  lastText: string;
  lastDate: string;
  unreadCount: number;
};
