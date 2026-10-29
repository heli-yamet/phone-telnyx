import { logError, logger, newRequestId } from "@/lib/logger";
import { telnyxWebhookMeta } from "@/lib/telnyx-webhook-meta";
import { handleTelnyxWebhook } from "@/lib/telnyx-webhook";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = newRequestId();
  const log = logger.child({
    module: "api.webhooks.telnyx",
    requestId,
  });

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logError(log, "Invalid webhook JSON body", error);
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const meta = telnyxWebhookMeta(body);
  log.info("Telnyx webhook received", meta);

  try {
    const result = await handleTelnyxWebhook(
      body as Parameters<typeof handleTelnyxWebhook>[0],
      log.child({ handler: "telnyx-webhook" })
    );

    const level =
      result.action === "outbound_failed" ? "warn" : "info";
    log[level]("Telnyx webhook processed", { ...meta, action: result.action });

    return NextResponse.json({ ...result, requestId });
  } catch (error) {
    logError(log, "Telnyx webhook processing failed", error, meta);
    return NextResponse.json(
      { ok: false, error: "Webhook processing failed", requestId },
      { status: 500 }
    );
  }
}
