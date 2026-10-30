export function getMessagePollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_MESSAGE_POLL_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed >= 1000) {
    return parsed;
  }
  return 4000;
}
