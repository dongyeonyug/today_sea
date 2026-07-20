# app/ — 라우트와 서버 경계

루트 [CLAUDE.md](../CLAUDE.md)를 먼저 읽을 것. 이 문서는 `app/` 안에서만 필요한 세부다.

## 먼저 알아야 할 것 — 컴포넌트는 여기 없다

**UI 컴포넌트는 [components/](../components/) — 리포 루트에 있다.** `app/components/`가
아니다. App Router 관례상 `app/` 안을 먼저 뒤지게 되는데 이 리포는 그렇지 않으니
`components/ChatThread.tsx` 같은 경로로 바로 갈 것.

`app/` 안에는 라우트(`page.tsx`·`route.ts`)·레이아웃·전역 스타일만 있다.

## 라우트 지도

| 경로 | 파일 | 내용 |
|---|---|---|
| `/` | [page.tsx](page.tsx) | 홈 — 지점 검색 + 판정 카드 |
| `/place/[id]` | [상세 페이지 소스](place/[id]/page.tsx) | 상세 — 시간대별 타임라인 + 물때 곡선 + 챗봇 |
| `GET /api/verdict` | [api/verdict/route.ts](api/verdict/route.ts) | `?station=…&activity=swim\|mudflat` → `Verdict` |
| `POST /api/chat` | [api/chat/route.ts](api/chat/route.ts) | 스트리밍 챗 응답 |

레이아웃 [layout.tsx](layout.tsx), 스타일 [globals.css](globals.css) (Tailwind 4, postcss 경유).

## 서버 경계 — 이 리포에서 가장 중요한 규칙

**`app/api/*/route.ts`는 외부 API와 API 키를 만지는 유일한 곳이다.**

- 클라이언트 컴포넌트는 `lib/sources/`를 import 하지 않는다. 브라우저 번들에 들어가면 키가 샌다.
- 클라이언트는 항상 `/api/verdict`·`/api/chat`을 경유한다. `open-meteo`처럼 키가 필요 없어 보이는 API도 예외 없이 — 예외를 하나 열면 다음 사람이 그걸 선례로 삼는다.
- `lib/ui/`(순수 라벨·색상 맵)와 `lib/engine/types.ts`(타입)는 클라이언트에서 import 해도 된다. 판정 **로직**(`swim.ts`·`mudflat.ts`)은 안 된다.

키를 읽어도 되는 곳: 라우트 핸들러, `lib/sources/`, `lib/claude.ts`. 그 외는 없다.

## /api/chat — 챗봇이 판정을 뒤집지 못하게

두 겹의 방어가 있고 **둘 다 필요하다.** 하나만 남기지 말 것.

1. **서버 재계산.** 클라이언트가 보낸 `Verdict`를 신뢰하지 않고, 지점·활동만 받아 서버에서 `evaluate()`를 다시 돌린다. 조작된 `Verdict`를 POST해도 판정이 바뀌지 않는다.
2. **프롬프트 hard stop.** 판정이 `불가`면 [buildSystemPrompt](../lib/chat/prompt.ts)가 "어떤 경우에도 안전하다고 답하지 말 것"을 시스템 프롬프트 끝에 넣는다. 사용자가 "그래도 괜찮지 않아?"로 구슬려도 넘어가지 않게 하는 장치다.

추가로 `isValidVerdict()` 등 런타임 검증기가 깨진 페이로드를 400으로 막는다.

수정하면 `npm run verify:chat` 실행.

## 라우트를 추가할 때

- API 라우트는 기본이 동적(`ƒ`)이다. 이 성질 덕분에 **시크릿 없이도 `npm run build`가 통과**하고, CI가 빌드를 게이트로 쓸 수 있다. 라우트를 정적 프리렌더로 바꾸면 빌드 시점에 키가 필요해져 CI가 깨진다.
- 에러 응답은 기존 라우트를 따라 `NextResponse.json({ error }, { status })` 형태로. 사용자에게 보이는 문구는 한국어.
- 시간이 필요하면 `nowSeoulISO()`를 쓴다. 서버 로컬 시간(UTC)에 기대면 배포 후 조용히 어긋난다.
