import { getSmsToken, getTelnyxApiUrl } from "@/lib/config";
import { normalizePhone } from "@/lib/phone";

export type SendSmsInput = {
  from: string;
  to: string;
  text: string;
};

export type SendSmsResult = {
  telnyxMessageId?: string;
  raw: unknown;
};

export async function sendSmsViaTelnyx(
  input: SendSmsInput
): Promise<SendSmsResult> {
  const token = getSmsToken();
  const url = getTelnyxApiUrl();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: normalizePhone(input.from),
      to: normalizePhone(input.to),
      text: input.text,
    }),
  });

  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof raw === "object" &&
      raw !== null &&
      "errors" in raw &&
      Array.isArray((raw as { errors: unknown[] }).errors)
        ? JSON.stringify((raw as { errors: unknown[] }).errors)
        : response.statusText;
    throw new Error(`Telnyx send failed (${response.status}): ${message}`);
  }

  const data =
    typeof raw === "object" && raw !== null && "data" in raw
      ? (raw as { data: { id?: string } }).data
      : undefined;

  return {
    telnyxMessageId: data?.id,
    raw,
  };
}
