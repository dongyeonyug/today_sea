/**
 * 공용 fetch 헬퍼.
 * - Next.js 런타임에서는 `revalidate`로 ISR 캐시(공공API 트래픽 보호),
 *   순수 Node(검증 스크립트)에서는 `next` 옵션이 무시된다.
 * - data.go.kr 은 오류 시 dataType=JSON 이어도 XML 을 반환하는 경우가 있어
 *   본문을 텍스트로 먼저 받고 JSON 파싱을 시도한다.
 */

export interface FetchOptions {
  /** ISR 재검증 주기(초). 기본 900초(15분). */
  revalidate?: number;
  signal?: AbortSignal;
}

export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

export async function fetchJson<T>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const { revalidate = 900, signal } = opts;

  // `next` 는 Next.js 런타임 전용 확장 필드(ISR 캐시). 순수 Node 에선 무시됨.
  const init: RequestInit & { next?: { revalidate?: number } } = {
    signal,
    next: { revalidate },
  };

  const res = await fetch(url, init);

  const text = await res.text();

  if (!res.ok) {
    throw new SourceError(
      `요청 실패 (${res.status})`,
      res.status,
      text.slice(0, 500),
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SourceError(
      "JSON 파싱 실패 — 공공API가 오류 XML을 반환했을 수 있습니다.",
      res.status,
      text.slice(0, 500),
    );
  }
}

/** data.go.kr 공통 인증키. 서버에서만 접근. */
export function requireDataGoKrKey(): string {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) {
    throw new SourceError("DATA_GO_KR_SERVICE_KEY 가 설정되지 않았습니다.");
  }
  return key;
}
