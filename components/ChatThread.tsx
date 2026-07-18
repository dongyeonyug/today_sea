"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Verdict } from "@/lib/engine/types";
import { statusUi } from "@/lib/ui/status";
import { ACTIVITY_LABEL } from "@/lib/ui/activity";

interface ChatThreadProps {
  verdict: Verdict;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function ChatThread({ verdict, onClose }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    seedMessages(verdict),
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ui = statusUi(verdict.status);
  const sources = useMemo(
    () => [...new Set(verdict.signals.map((signal) => signal.source))].join(", "),
    [verdict],
  );

  useEffect(() => {
    setMessages(seedMessages(verdict));
    setInput("");
    setError(null);
    setStreaming(false);
  }, [verdict]);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollRef.current?.scrollIntoView({
      block: "end",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages, streaming]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };
    const history = [...messages, userMessage];

    setInput("");
    setError(null);
    setStreaming(true);
    setMessages([...history, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verdict,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `챗봇 요청 실패 (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        updateAssistantMessage(assistantMessage.id, answer);
      }

      answer += decoder.decode();
      updateAssistantMessage(assistantMessage.id, answer);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "챗봇 응답을 불러오지 못했습니다.";
      setError(message);
      updateAssistantMessage(
        assistantMessage.id,
        "응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setStreaming(false);
    }
  }

  function updateAssistantMessage(id: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, content } : message,
      ),
    );
  }

  return (
    <section
      className="sea-panel-enter rounded-2xl border p-5"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--surface-border)",
          boxShadow: "var(--shadow-card)",
        } as CSSProperties
      }
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ui.chip}`}
            >
              <span className={`h-2 w-2 rounded-full ${ui.dot}`} aria-hidden />
              {ui.label}
            </span>
            <span className="text-sm font-medium opacity-70">
              {verdict.stationName} · {ACTIVITY_LABEL[verdict.activity]}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            해양안전 챗봇
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="sea-focus sea-press rounded-lg px-2.5 py-1.5 text-sm font-medium opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            aria-label="챗봇 닫기"
          >
            닫기
          </button>
        )}
      </header>

      <div
        className="mt-4 flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} sources={sources} />
        ))}
        {streaming && (
          <div
            className="flex items-center gap-1 pl-1.5"
            aria-label="답변 생성 중"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-teal-500/80 motion-safe:animate-bounce"
                style={{ animationDelay: `${i * 140}ms` }}
              />
            ))}
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <label htmlFor="chat-question" className="sr-only">
          챗봇에게 물어볼 질문
        </label>
        <input
          id="chat-question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={streaming}
          placeholder="예: 지금 들어가도 돼?"
          className="sea-focus min-w-0 flex-1 rounded-xl border border-black/10 bg-black/[0.015] px-4 py-3 text-sm transition-[border-color,box-shadow,opacity] duration-150 placeholder:opacity-45 focus:border-teal-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03]"
        />
        <button
          type="submit"
          disabled={streaming || input.trim().length === 0}
          className="sea-focus sea-press rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
        >
          전송
        </button>
      </form>
    </section>
  );
}

function MessageBubble({
  message,
  sources,
}: {
  message: ChatMessage;
  sources: string;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={`sea-panel-enter flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[88%] px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-2xl rounded-br-md bg-teal-600 text-white shadow-teal-600/15"
            : "rounded-2xl rounded-bl-md bg-slate-100 text-slate-900 dark:bg-white/[0.07] dark:text-white"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content || " "}
        </p>
        {!isUser && sources && (
          <p className="mt-2 border-t border-black/5 pt-2 text-xs opacity-60 dark:border-white/10">
            출처 {sources}
          </p>
        )}
      </div>
    </div>
  );
}

function seedMessages(verdict: Verdict): ChatMessage[] {
  return [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `${verdict.stationName} ${ACTIVITY_LABEL[verdict.activity]} 판정은 '${verdict.status}'입니다. ${verdict.summary}`,
    },
  ];
}
