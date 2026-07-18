# M5 챗봇 구현 인수인계 (Codex / OpenAI 용)

> 대상: 이 저장소를 **처음 보는** 코딩 에이전트(Codex). 이 문서 하나로 M5를 끝까지 구현할 수 있도록 작성됨.
> 프로젝트: **오늘의 바다(Today's Sea)** — 공식 해양 데이터로 물놀이·갯벌체험 안전을 `가능/주의/불가`로 판정하고 초보자 눈높이로 설명하는 Next.js 15 앱 (해커톤 MVP).
> 경로: `/Users/yugdong-yeon/Desktop/soloton2` · git 저장소 아님(필요 시 `git init`).
> 먼저 읽을 것: [progress.md](./progress.md)(전체 진행상황) · [implementation-plan.md](./implementation-plan.md) §6(챗봇 설계) · [verified-apis.md](./verified-apis.md).

---

## 0. 지금 상태 (M1~M4 완료)

- M1 소스 클라이언트, M2 판정 엔진, M3 홈+판정카드, M4 타임라인/물때곡선까지 **실데이터로 동작**.
- 검증 통과 당시: `npm run verify:sources`(8/8), `npm run verify:verdict`, `npm run build`(✓), `npx tsc --noEmit`(clean). 최신 지원 지점과 검증 개수는 [progress.md](./progress.md)를 기준으로 한다.
- **M5 = 챗봇(데모 장면 1)** 이 다음 작업. 그 외 M5 관련 코드는 아직 없음(래퍼만 있음, 아래 참고).

---

## 1. M5 목표 & 산출물

자연어 질문 → 현재 장소·활동의 **Verdict(판정 결과)를 근거로만** 답하는 스트리밍 챗봇.

| 산출물 | 경로 | 역할 |
|---|---|---|
| 채팅 API (스트리밍) | `app/api/chat/route.ts` (신규) | Claude 프록시. verdict 컨텍스트 주입, 키는 서버에만. |
| 채팅 UI | `components/ChatThread.tsx` (신규) | 말풍선 스레드 + 입력창 + 스트리밍 렌더 + 미니 판정 배지/출처. |
| 홈 연동 | `app/page.tsx` (수정) | `VerdictCard`의 `onAskChat` CTA로 챗봇 열기. |
| (선택) 상세 연동 | `app/place/[id]/page.tsx` (수정) | 상세 페이지에서도 챗봇 진입. |

**검증 기준(계획 M5):** "자연어 질문 → 근거 답변". 아래 §7 인수 기준 참고.

---

## 2. 실행 & 환경

```bash
cd /Users/yugdong-yeon/Desktop/soloton2
npm run dev            # http://localhost:3000
npm run build          # 프로덕션 빌드 (타입체크 포함)
npx tsc --noEmit       # 타입만 빠르게 검사
```

- **환경변수**(`.env`, gitignore됨, 이미 SET): `ANTHROPIC_API_KEY`, `DATA_GO_KR_SERVICE_KEY`, `KHOA_OPENAPI_KEY`.
- TS 스크립트 직접 실행 시 로더: `node --env-file=.env --import tsx <script>` (package.json 스크립트에 반영됨).
- 스택: **Next.js 15.5(App Router) · React 19 · TypeScript · Tailwind v4**. 경로 별칭 `@/*` = 저장소 루트.
- `@anthropic-ai/sdk` `^0.68.0` 이미 설치됨.

---

## 3. 반드시 지킬 원칙 (이 프로젝트의 정체성)

1. **키 보호**: `ANTHROPIC_API_KEY` 등 모든 비밀·외부호출은 **서버(Route Handler)에서만**. 클라이언트 번들/네트워크 탭에 노출 금지. (홈이 `/api/verdict`를 호출하는 것과 동일 패턴.)
2. **허위 판정 금지(§9)**: 챗봇은 엔진 판정을 **뒤집지 못한다**. 특히 판정이 **`불가`면 절대 "안전/가능"이라고 답하지 않는다.** `데이터없음`/`점검중` 항목은 단정하지 말고 "확인 불가"로 안내.
3. **근거 기반 답변**: 답은 주입된 Verdict의 신호(파고·수온·특보·이안류·지수·물때)와 수치에만 근거. 지어내지 말 것. 출처(기상청/국립해양조사원/open-meteo) 명시.
4. **초보자 눈높이**: 짧고 실천적(대응법·현장 확인사항). 한국어.
5. **모델**: 기본 `claude-haiku-4-5`, 품질 필요 시 `claude-sonnet-5` (아래 래퍼에 상수 있음).

---

## 4. 재사용할 기존 재료 (중요 — 새로 만들지 말 것)

### 4-1. Anthropic 래퍼 — `lib/claude.ts` (이미 존재)
```ts
export const DEFAULT_MODEL = "claude-haiku-4-5";
export const QUALITY_MODEL = "claude-sonnet-5";
export function getAnthropic(): Anthropic   // 싱글턴 클라이언트(키 가드 포함)
export async function askClaude(userMessage, opts): Promise<string>  // 단발성(비스트리밍)
```
→ **스트리밍은 `getAnthropic().messages.stream(...)`으로 route에서 새로 구현**한다(`askClaude`는 단발용이라 그대로 두고 참고만).

### 4-2. Verdict 타입 — `lib/engine/types.ts` (챗봇 컨텍스트의 핵심)
```ts
type Status = "가능" | "주의" | "불가" | "데이터없음" | "점검중";

interface Signal {
  key: string; label: string; status: Status;
  detail: string;                 // 초보자용 근거 문장
  value?: string | number; unit?: string;
  source: string;                 // "open-meteo" | "기상청" | "국립해양조사원"
}

interface Verdict {
  activity: "swim" | "mudflat";
  stationId: string; stationName: string;
  status: Status;                 // 종합 판정(가장 위험한 신호 채택)
  summary: string;                // 한 줄 요약
  signals: Signal[];              // 근거 신호 목록
  asOf: string;                   // "YYYY-MM-DD HH:mm:ss" (Asia/Seoul)
  timeline?: TimelineBand[];      // M4: 시간대별 밴드
  tideExtremes?: TidePoint[];     // M4: 갯벌 조석 마커
  advisory?: string;              // 갯벌: "○○시까지 복귀" 등
}
```
Verdict는 이미 `GET /api/verdict?station=<id>&activity=<swim|mudflat>`로 얻는다(홈·상세가 그렇게 함). 챗봇에는 **클라이언트가 이미 들고 있는 Verdict 객체를 그대로 POST 본문에 실어** 넘기면 된다(재조회 불필요).

### 4-3. CTA 훅 — `components/VerdictCard.tsx` (이미 존재)
```tsx
interface VerdictCardProps { verdict: Verdict; onAskChat?: (verdict: Verdict) => void; }
// onAskChat 이 주어지면 카드 하단에 "챗봇에게 묻기" 버튼이 렌더됨(이미 구현되어 있음, 현재 미연결).
```
→ 홈/상세에서 `onAskChat`를 넘겨 챗봇을 열면 된다. **버튼 UI는 새로 만들지 말 것.**

### 4-4. UI 토큰 — `lib/ui/status.ts`, `lib/ui/activity.ts`
- `statusUi(status)` → `{ label, chip, dot, accent, emoji }` (신호등 3색 + 데이터없음/점검중). 미니 판정 배지에 재사용.
- `ACTIVITY_LABEL`, `ACTIVITY_EMOJI` (swim/mudflat 라벨·이모지).

### 4-5. 디자인 톤 (기존 컴포넌트와 일치시킬 것)
- 카드: `rounded-2xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5`.
- 브랜드 액센트 = 틸(teal). 버튼 예: `bg-teal-600 hover:bg-teal-500 text-white active:scale-[0.97]`.
- 다크/라이트 모두 대응. `prefers-reduced-motion` 존중. UI 애니메이션 <300ms.

---

## 5. 권장 구현 설계

### 5-1. `app/api/chat/route.ts` — 스트리밍 프록시
- **메서드**: `POST`. `export const runtime = "nodejs";`(Anthropic SDK는 node 런타임 권장).
- **요청 본문(제안 계약)**:
  ```ts
  interface ChatRequest {
    verdict: Verdict;                                  // 클라이언트가 보유한 판정
    messages: { role: "user" | "assistant"; content: string }[];  // 대화 히스토리
  }
  ```
- **처리**:
  1. 본문 파싱·검증(없으면 400). `verdict.status`가 유효한지 정도만 확인.
  2. `buildSystemPrompt(verdict)`로 시스템 프롬프트 구성(§5-3).
  3. `getAnthropic().messages.stream({ model: DEFAULT_MODEL, max_tokens: 1024, system, messages })`.
  4. 텍스트 델타를 `ReadableStream`으로 흘려보냄(아래 스켈레톤).
- **스켈레톤**:
  ```ts
  import { getAnthropic, DEFAULT_MODEL } from "@/lib/claude";
  import type { Verdict } from "@/lib/engine/types";

  export const runtime = "nodejs";

  export async function POST(req: Request) {
    const { verdict, messages } = (await req.json()) as ChatRequest;
    if (!verdict || !Array.isArray(messages)) {
      return new Response("잘못된 요청", { status: 400 });
    }
    const system = buildSystemPrompt(verdict);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          const s = getAnthropic().messages.stream({
            model: DEFAULT_MODEL,
            max_tokens: 1024,
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          });
          s.on("text", (t) => controller.enqueue(enc.encode(t)));
          await s.finalMessage();
          controller.close();
        } catch (e) {
          controller.enqueue(enc.encode("\n\n(응답 중 오류가 발생했습니다.)"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  ```
  > 스트리밍은 **평문(text/plain) 델타**로 단순하게 가는 것을 권장(클라에서 `reader`로 읽어 append). SSE로 해도 되지만 오버엔지니어링 지양.
  > **SDK 시그니처는 설치된 `@anthropic-ai/sdk@0.68.0`에서 실측 검증됨**: `messages.stream(body, options): MessageStream`, `stream.on("text", (delta, snapshot) => …)`, `await stream.finalMessage(): Promise<Message>`. 위 스켈레톤 그대로 동작함.

### 5-2. 시스템 프롬프트 빌더 (안전 가드가 핵심)
`route.ts` 안(또는 `lib/chat/prompt.ts` 신규)에 순수 함수로 작성 → 테스트 가능하게.
```ts
function buildSystemPrompt(v: Verdict): string {
  const lines = v.signals
    .map((s) => `- ${s.label}: [${s.status}]${s.value != null ? ` ${s.value}${s.unit ?? ""}` : ""} — ${s.detail} (출처: ${s.source})`)
    .join("\n");
  const hardStop = v.status === "불가"
    ? "\n\n[중요] 종합 판정이 '불가'다. 어떤 경우에도 안전하다거나 가능하다고 답하지 말 것. 위험을 축소하지 말 것."
    : "";
  return [
    "너는 '오늘의 바다'의 해양안전 어시스턴트다. 아래 실데이터 판정을 근거로만 답한다.",
    "규칙: (1) 판정을 뒤집지 말 것. (2) 데이터없음/점검중 항목은 단정하지 말 것. (3) 초보자 눈높이로 짧고 실천적으로(대응법·현장 확인). (4) 답에 출처를 밝힐 것. (5) 한국어.",
    `장소: ${v.stationName} / 활동: ${v.activity} / 기준시각: ${v.asOf}`,
    `종합 판정: ${v.status} — ${v.summary}`,
    v.advisory ? `안내: ${v.advisory}` : "",
    "근거 신호:",
    lines,
    hardStop,
  ].filter(Boolean).join("\n");
}
```

### 5-3. `components/ChatThread.tsx` — 채팅 UI
- `"use client"`.
- **Props(제안)**: `{ verdict: Verdict; onClose?: () => void }`.
- **상태**: `messages: {role,content}[]`, `input: string`, `streaming: boolean`.
- **동작**:
  1. 열릴 때 판정 요약 말풍선(assistant) 1개를 시드로 표시(선택).
  2. 전송 시 `messages`에 user 추가 → `POST /api/chat`에 `{ verdict, messages }` → 응답 `body.getReader()`로 청크를 읽어 **마지막 assistant 말풍선에 실시간 append**.
  3. 스트리밍 읽기 패턴:
     ```ts
     const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verdict, messages: next }) });
     const reader = res.body!.getReader();
     const dec = new TextDecoder();
     let acc = "";
     for (;;) {
       const { value, done } = await reader.read();
       if (done) break;
       acc += dec.decode(value, { stream: true });
       setMessages((m) => /* 마지막 assistant 버블을 acc로 갱신 */);
     }
     ```
- **표시**: 상단에 `statusUi(verdict.status)` 미니 배지 + `stationName`/활동 라벨. 말풍선(user=우측 틸, assistant=좌측 회색). 하단 입력창 + 전송 버튼(`active:scale-[0.97]`). 스트리밍 중 입력 비활성.
- **출처**: assistant 답변 하단에 판정 출처(`[...new Set(verdict.signals.map(s=>s.source))]`) 작게 표기(VerdictCard 푸터와 동일 톤).
- **접근성**: 메시지 영역 `aria-live="polite"`, 입력에 label, `prefers-reduced-motion` 존중.
- **배치**: 모달/시트 또는 카드 하단 인라인 패널 중 택1(해커톤이면 인라인 패널이 단순·안전). 기존 카드 톤과 일치.

### 5-4. 홈/상세 연동
- `app/page.tsx`: 현재 `<VerdictCard verdict={v} />`에 **`onAskChat`을 넘겨** 클릭 시 해당 verdict로 `ChatThread`를 연다(선택된 verdict를 state로 보관). 이미 버튼은 카드에 구현돼 있으니 핸들러만 연결.
- `app/place/[id]/page.tsx`: 동일 패턴으로 상세에서도 진입 가능(선택).

---

## 6. 데이터 흐름 요약

```
사용자 질문 (ChatThread, client)
  └─ POST /api/chat  { verdict, messages }        ← verdict는 클라가 이미 보유(재조회 X)
       └─ route.ts: buildSystemPrompt(verdict) + Claude 스트리밍   ← 키는 서버에만
            └─ text/plain 델타 스트림
       ← reader로 읽어 assistant 말풍선 실시간 렌더
```

---

## 7. 인수(완료) 기준 — 반드시 통과

1. `npx tsc --noEmit` clean, `npm run build` 성공(`/api/chat` route 잡히는지 확인).
2. `npm run dev` 후 홈에서 지점 선택 → 판정 카드의 **"챗봇에게 묻기"** 클릭 → 채팅 UI 열림.
3. "지금 수영해도 돼?" 류 질문에 **스트리밍**으로 답이 흘러나오고, 답이 **주입된 판정 근거·수치와 일치**.
4. **안전 가드 검증**: 판정이 `불가`인 케이스(예: 제부도 갯벌이 '불가'인 시간대, 또는 파고 높은 해운대)에서 "그냥 들어가도 되지?"라고 물어도 **안전하다고 답하지 않음**. 이걸 실제로 눌러 확인.
5. 네트워크 탭/클라 번들에 `ANTHROPIC_API_KEY`가 노출되지 않음(서버 라우트에서만 사용).
6. (권장) `buildSystemPrompt`를 부르는 가벼운 검증 스크립트를 `scripts/verify-chat.ts`로 추가하고 `package.json`에 `verify:chat` 등록 — `불가` verdict에서 프롬프트에 hard-stop 문구가 포함되는지 assert. 기존 `scripts/verify-verdict.ts` 패턴 참고.

---

## 8. 코드베이스 관례 & 함정 (놓치기 쉬움)

- **App Router / 서버·클라 경계**: 외부호출·키는 route handler(서버)에서만. `ChatThread`는 `"use client"`. 기존 `app/api/verdict/route.ts`가 좋은 참고 예.
- **Next 15 dynamic params**: 페이지의 `params`는 Promise(예: `app/place/[id]/page.tsx`에서 `use(params)` 사용). API route는 해당 없음.
- **Tailwind v4**: `globals.css` 기반. 새 색은 기존 토큰(emerald/amber/rose/teal/slate) 재사용.
- **주석·톤**: 기존 파일들은 한국어 헤더 주석 + `§` 참조 스타일. 맞춰서 작성하면 일관됨.
- **모델 ID 최신값**: haiku=`claude-haiku-4-5`, sonnet=`claude-sonnet-5` (이미 `lib/claude.ts` 상수). 임의 변경 금지.
- **불확실한 SDK 사용은 추측 금지**: `@anthropic-ai/sdk` 스트리밍 시그니처는 `node_modules`의 타입 정의로 확인하고 쓸 것.
- **git 저장소 아님**: 커밋 요구 없음. 필요 시 사용자에게 `git init` 여부 확인.

---

## 9. 작업 후 업데이트할 문서

- `docs/progress.md`: M5 완료로 표(1절)·다음 시작점(2절)·파일 지도(5절) 갱신. `verify:chat` 추가 시 3절 실행법도.
- (선택) 사용자 메모리는 사용자 쪽에서 관리하므로 건드리지 말 것.

---

### 부록 A — 예상 파일 트리(신규/수정)
```
app/
  api/chat/route.ts        [신규] 스트리밍 챗봇 프록시
  page.tsx                 [수정] onAskChat 연결
  place/[id]/page.tsx      [수정, 선택] onAskChat 연결
components/
  ChatThread.tsx           [신규] 채팅 UI
lib/
  chat/prompt.ts           [신규, 선택] buildSystemPrompt 분리(테스트 용이)
scripts/
  verify-chat.ts           [신규, 권장] 안전가드 프롬프트 검증
```
