"use client";

import { buildConversations, upsertMessage } from "@/lib/conversations";
import { getMessagePollIntervalMs } from "@/lib/poll-interval";
import type { ContactDTO, MessageDTO } from "@/types/sms";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(message: MessageDTO): string | null {
  if (message.direction !== "outbound") return null;
  if (message.status === "pending") return "Sending…";
  if (message.status === "sent") return "Sent";
  if (message.status === "failed") {
    return message.failureReason
      ? `Failed — ${message.failureReason}`
      : "Failed";
  }
  if (message.status === "delivered") return "Delivered";
  return null;
}

export default function SmsApp() {
  const [myNumber, setMyNumber] = useState("");
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [contacts, setContacts] = useState<ContactDTO[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [toInput, setToInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"chats" | "contacts">("chats");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);
  const syncCursorRef = useRef<string | null>(null);
  const pollIntervalMs = getMessagePollIntervalMs();

  const conversations = useMemo(
    () => buildConversations(messages),
    [messages]
  );

  const threadMessages = useMemo(() => {
    if (!selectedPeer) return [];
    return messages.filter((m) => m.peer === selectedPeer);
  }, [messages, selectedPeer]);

  const contactNameFor = useCallback(
    (peer: string) =>
      contacts.find((c) => c.phoneNumber === peer)?.name ?? peer,
    [contacts]
  );

  const refreshMessages = useCallback(async (mode: "full" | "incremental" = "full") => {
    const incremental = mode === "incremental" && syncCursorRef.current;
    const url = incremental
      ? `/api/messages?updatedSince=${encodeURIComponent(syncCursorRef.current!)}`
      : "/api/messages";

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load messages");
    const data = (await res.json()) as {
      myNumber: string;
      messages: MessageDTO[];
      syncedAt?: string;
    };

    setMyNumber(data.myNumber);
    if (incremental && data.messages.length > 0) {
      setMessages((prev) =>
        data.messages.reduce((acc, msg) => upsertMessage(acc, msg), prev)
      );
    } else if (!incremental) {
      setMessages(data.messages);
    }

    if (data.syncedAt) {
      syncCursorRef.current = data.syncedAt;
    }
  }, []);

  const refreshContacts = useCallback(async () => {
    const res = await fetch("/api/contacts");
    if (!res.ok) return;
    const data = (await res.json()) as { contacts: ContactDTO[] };
    setContacts(data.contacts);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([refreshMessages(), refreshContacts()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMessages, refreshContacts]);

  useEffect(() => {
    const poll = () => {
      void refreshMessages("incremental").catch(() => {
        /* keep polling; next full load on focus */
      });
    };

    const intervalId = window.setInterval(poll, pollIntervalMs);

    const onFocus = () => {
      void refreshMessages("full").catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshMessages("incremental").catch(() => undefined);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollIntervalMs, refreshMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length, selectedPeer]);

  const selectPeer = async (peer: string) => {
    setSelectedPeer(peer);
    setToInput(peer);
    setTab("chats");
    await fetch("/api/messages/read-thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peer }),
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.peer === peer && m.direction === "inbound" ? { ...m, read: true } : m
      )
    );
  };

  const sendMessage = async () => {
    const to = toInput.trim();
    const text = draft.trim();
    if (!to || !text) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: myNumber,
          to,
          text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Send failed");
      }
      if (data.message) {
        setMessages((prev) => upsertMessage(prev, data.message as MessageDTO));
        if (!selectedPeer) {
          setSelectedPeer((data.message as MessageDTO).peer);
        }
      }
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const addContact = async () => {
    const name = contactName.trim();
    const phoneNumber = contactPhone.trim();
    if (!name || !phoneNumber) return;
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phoneNumber }),
    });
    if (!res.ok) {
      setError("Could not save contact");
      return;
    }
    setContactName("");
    setContactPhone("");
    await refreshContacts();
  };

  const deleteContact = async (id: string) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    await refreshContacts();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="flex w-full max-w-sm flex-col border-r border-zinc-800 bg-zinc-900/80">
        <header className="border-b border-zinc-800 px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">Phone Telnyx</h1>
          <p className="mt-1 truncate text-xs text-zinc-400">{myNumber}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("chats")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === "chats"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              Chats
            </button>
            <button
              type="button"
              onClick={() => setTab("contacts")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === "contacts"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300"
              }`}
            >
              Contacts
            </button>
          </div>
        </header>

        {tab === "chats" ? (
          <ul className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-zinc-500">
                No conversations yet
              </li>
            ) : (
              conversations.map((c) => (
                <li key={c.peer}>
                  <button
                    type="button"
                    onClick={() => selectPeer(c.peer)}
                    className={`flex w-full flex-col gap-1 border-b border-zinc-800/80 px-4 py-3 text-left transition hover:bg-zinc-800/60 ${
                      selectedPeer === c.peer ? "bg-zinc-800/80" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {contactNameFor(c.peer)}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {formatTime(c.lastDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-zinc-400">
                        {c.lastText}
                      </span>
                      {c.unreadCount > 0 ? (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold">
                          {c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="space-y-2 border-b border-zinc-800 p-4">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 phone number"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={addContact}
                className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium hover:bg-emerald-500"
              >
                Add contact
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => selectPeer(c.phoneNumber)}
                  >
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-xs text-zinc-400">
                      {c.phoneNumber}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteContact(c.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-800 px-6 py-4">
          <h2 className="text-base font-semibold">
            {selectedPeer ? contactNameFor(selectedPeer) : "New message"}
          </h2>
          {selectedPeer ? (
            <p className="text-xs text-zinc-500">{selectedPeer}</p>
          ) : null}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {selectedPeer ? (
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {threadMessages.map((m) => {
                const outbound = m.direction === "outbound";
                const label = statusLabel(m);
                return (
                  <div
                    key={m.id}
                    className={`flex ${outbound ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        outbound
                          ? "rounded-br-md bg-emerald-700 text-white"
                          : "rounded-bl-md bg-zinc-800 text-zinc-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <div
                        className={`mt-1 flex items-center gap-2 text-[10px] ${
                          outbound ? "text-emerald-100/80" : "text-zinc-400"
                        }`}
                      >
                        <span>{formatTime(m.date)}</span>
                        {label ? <span>{label}</span> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>
          ) : (
            <p className="text-center text-sm text-zinc-500">
              Select a chat or enter a number below to start messaging.
            </p>
          )}
        </div>

        <footer className="border-t border-zinc-800 px-6 py-4">
          {error ? (
            <p className="mb-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="To (E.164, e.g. +18185551234)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
            />
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button
                type="button"
                disabled={sending || !draft.trim() || !toInput.trim()}
                onClick={() => void sendMessage()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
