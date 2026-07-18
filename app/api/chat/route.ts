/**
 * M5 챗봇 API — Verdict 기반 Claude 스트리밍 프록시.
 * 키와 외부 호출은 서버 라우트에만 둔다.
 */
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { DEFAULT_MODEL, getAnthropic } from "@/lib/claude";
import { buildSystemPrompt, isValidVerdict } from "@/lib/chat/prompt";
import { evaluate } from "@/lib/engine";
import type { Verdict } from "@/lib/engine/types";

export const runtime = "nodejs";

interface ChatRequest {
  verdict: Verdict;
  messages: ChatMessage[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  let body: Partial<ChatRequest>;
  try {
    body = (await req.json()) as Partial<ChatRequest>;
  } catch {
    return new Response("잘못된 요청입니다.", { status: 400 });
  }

  if (!isValidVerdict(body.verdict) || !Array.isArray(body.messages)) {
    return new Response("verdict 와 messages 가 필요합니다.", { status: 400 });
  }

  const messages = normalizeMessages(body.messages);
  if (messages.length === 0) {
    return new Response("메시지가 필요합니다.", { status: 400 });
  }

  let verdict: Verdict;
  try {
    verdict = await evaluate(body.verdict.stationId, body.verdict.activity);
  } catch (err) {
    const message = err instanceof Error ? err.message : "판정 재계산 실패";
    return new Response(message, { status: 400 });
  }

  const system = buildSystemPrompt(verdict);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const claudeStream = getAnthropic().messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system,
          messages,
        });

        claudeStream.on("text", (text) => {
          controller.enqueue(encoder.encode(text));
        });

        await claudeStream.finalMessage();
      } catch (err) {
        console.error("chat stream failed", err);
        controller.enqueue(
          encoder.encode("\n\n(응답 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.)"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeMessages(messages: ChatMessage[]): MessageParam[] {
  return messages
    .filter(
      (message): message is ChatMessage =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}
