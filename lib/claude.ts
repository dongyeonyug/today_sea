/**
 * Anthropic SDK 래퍼 — 챗봇 해설(데모 장면 1).
 * 서버에서만 사용(키 노출 금지). 기본 모델은 빠르고 저렴한 haiku.
 */
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-haiku-4-5";
/** 품질이 필요할 때 사용. */
export const QUALITY_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았습니다.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface AskOptions {
  system?: string;
  model?: string;
  maxTokens?: number;
}

/** 단발성 질의 헬퍼. 스트리밍은 API Route(M5)에서 별도 처리. */
export async function askClaude(
  userMessage: string,
  opts: AskOptions = {},
): Promise<string> {
  const res = await getAnthropic().messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: userMessage }],
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
