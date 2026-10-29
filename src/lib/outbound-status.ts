type TelnyxError = {
  code?: string;
  title?: string;
  detail?: string;
};

type FinalizePayload = {
  to?: Array<{ status?: string }>;
  errors?: TelnyxError[];
};

const TERMINAL_STATUSES = new Set(["delivered", "failed"]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function statusFromFinalized(payload: FinalizePayload): {
  status: "delivered" | "failed";
  failureReason?: string;
} {
  const errors = payload.errors ?? [];
  if (errors.length > 0) {
    const e = errors[0];
    const failureReason =
      e.title?.trim() ||
      e.detail?.trim() ||
      (e.code ? `Error ${e.code}` : "Delivery failed");
    return { status: "failed", failureReason };
  }

  const recipientStatus = payload.to?.[0]?.status?.toLowerCase() ?? "";
  if (
    recipientStatus.includes("fail") ||
    recipientStatus === "rejected" ||
    recipientStatus === "undelivered"
  ) {
    return {
      status: "failed",
      failureReason: "Delivery failed",
    };
  }

  return { status: "delivered" };
}

export function webhookTimestamp(
  eventType: string | undefined,
  payload: {
    sent_at?: string | null;
    completed_at?: string | null;
    received_at?: string | null;
  }
): Date {
  if (eventType === "message.finalized" && payload.completed_at) {
    return new Date(payload.completed_at);
  }
  if (eventType === "message.sent" && payload.sent_at) {
    return new Date(payload.sent_at);
  }
  const raw =
    payload.completed_at ||
    payload.sent_at ||
    payload.received_at ||
    new Date().toISOString();
  return new Date(raw);
}
