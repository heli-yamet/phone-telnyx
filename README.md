# Phone Telnyx

Next.js app for sending and receiving SMS through Telnyx, with MongoDB persistence and real-time updates via Server-Sent Events (SSE).

## Setup

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Set:

- `DB_URL` — MongoDB connection string
- `SMS_TOKEN` — Telnyx API key (Bearer token for outbound SMS)
- `MY_NUMBER` — your Telnyx number (default `+16674218122`)
- `TELNYX_SMS_API_URL` — optional (default `https://api.telnyx.com/v2/messages`)
- `LOG_LEVEL` — optional (`debug` | `info` | `warn` | `error`; default `info` in production)

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Telnyx webhook

Point your messaging profile webhook to:

```
POST https://<your-host>/api/webhooks/telnyx
```

The webhook:

- Saves the full payload in the `details` collection
- Creates **inbound** rows in `messages`
- On outbound **`message.sent`**, marks matching **pending** messages as **sent**
- On outbound **`message.finalized`**, sets **delivered** or **failed** (uses `errors` and recipient `status`)

## Data model

- **`messages`** — `from`, `to`, `text`, `date`, `direction`, `status`, `read`
- **`details`** — full webhook JSON linked by `messageId`
- **`contacts`** — optional address book

Outbound sends create `pending` messages via `POST /api/messages/send`. Delivery is confirmed when Telnyx posts an outbound webhook event.

## Real-time

The UI subscribes to `GET /api/events` (SSE). New inbound messages and status updates appear without refresh.

## Cloud logging

In production (`NODE_ENV=production`), logs are **one JSON object per line** on stdout/stderr. Platforms such as Vercel, Railway, Render, Fly.io, and AWS CloudWatch can search and filter these fields:

- `level`, `message`, `timestamp`, `service` (`phone-telnyx`)
- `module` (e.g. `api.webhooks.telnyx`)
- `requestId` (correlate webhook/send requests; also returned in some API error responses)
- Telnyx fields: `eventType`, `eventId`, `direction`, `telnyxMessageId`, `action`

Message **text** is not logged. Set `LOG_LEVEL=debug` temporarily for more detail in cloud environments.
