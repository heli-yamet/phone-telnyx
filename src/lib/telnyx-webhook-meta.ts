export function telnyxWebhookMeta(body: unknown): {
  eventType?: string;
  eventId?: string;
  direction?: string;
  telnyxMessageId?: string;
} {
  if (typeof body !== "object" || body === null) return {};
  const data = (body as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== "object") return {};

  const payload = data.payload as Record<string, unknown> | undefined;

  return {
    eventType: typeof data.event_type === "string" ? data.event_type : undefined,
    eventId: typeof data.id === "string" ? data.id : undefined,
    direction:
      payload && typeof payload.direction === "string"
        ? payload.direction
        : undefined,
    telnyxMessageId:
      payload && typeof payload.id === "string" ? payload.id : undefined,
  };
}
