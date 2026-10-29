export function getMyNumber(): string {
  return process.env.MY_NUMBER?.trim() || "+16674218122";
}

export function getSmsToken(): string {
  const token = process.env.SMS_TOKEN?.trim();
  if (!token) {
    throw new Error("SMS_TOKEN is not configured");
  }
  return token;
}

export function getTelnyxApiUrl(): string {
  return (
    process.env.TELNYX_SMS_API_URL?.trim() ||
    "https://api.telnyx.com/v2/messages"
  );
}
