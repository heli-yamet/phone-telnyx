import { getSmsEventEmitter } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const emitter = getSmsEventEmitter();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const onEvent = (payload: string) => send(payload);

      send(JSON.stringify({ type: "connected" }));

      emitter.on("sms", onEvent);

      heartbeat = setInterval(() => {
        send(JSON.stringify({ type: "ping" }));
      }, 25000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        emitter.off("sms", onEvent);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
