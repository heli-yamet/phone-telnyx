export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function peerNumber(
  from: string,
  to: string,
  direction: "inbound" | "outbound"
): string {
  const f = normalizePhone(from);
  const t = normalizePhone(to);
  if (direction === "inbound") return f;
  return t;
}

export function conversationKey(myNumber: string, peer: string): string {
  const a = normalizePhone(myNumber);
  const b = normalizePhone(peer);
  return [a, b].sort().join("|");
}
