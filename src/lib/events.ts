import { EventEmitter } from "events";

const globalWithEmitter = global as typeof globalThis & {
  smsEventEmitter?: EventEmitter;
};

export type SmsServerEvent =
  | { type: "connected" }
  | { type: "ping" }
  | { type: "message.created"; message: Record<string, unknown> }
  | { type: "message.updated"; message: Record<string, unknown> };

export function getSmsEventEmitter(): EventEmitter {
  if (!globalWithEmitter.smsEventEmitter) {
    globalWithEmitter.smsEventEmitter = new EventEmitter();
    globalWithEmitter.smsEventEmitter.setMaxListeners(200);
  }
  return globalWithEmitter.smsEventEmitter;
}

export function broadcastSmsEvent(event: SmsServerEvent): void {
  getSmsEventEmitter().emit("sms", JSON.stringify(event));
}
