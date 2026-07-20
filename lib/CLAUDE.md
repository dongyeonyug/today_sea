# lib/ — 데이터 계층과 판정 엔진

루트 [CLAUDE.md](../CLAUDE.md)를 먼저 읽을 것. 이 문서는 `lib/` 안에서만 필요한 세부다.

`lib/`는 이 앱에서 가장 밀도가 높은 곳이다(13개 파일). 흐름은 한 방향으로만 간다:

```
sources/ (외부 API 정규화) → engine/ (Signal[] → Verdict) → chat/ · ui/ (표현)
```

역방향 의존은 없다. `sources/`는 `engine/`을 모르고, `engine/`은 `chat/`·`ui/`를 모른다.

## sources/ — 외부 API 정규화 (6 파일)

외부 API 하나당 모듈 하나. **정규화된 순수 데이터**만 반환하고 판정하지 않는다.
등급을 매기는 것은 전부 `engine/`의 일이다.

| 파일 | 담당 |
|---|---|
| [http.ts](sources/http.ts) | 공용 fetch + `SourceError` + `requireDataGoKrKey()` |
| [openMeteo.ts](sources/openMeteo.ts) | 파고·수온 (`MarineHourly`) |
| [tide.ts](sources/tide.ts) | 조석 고저조 (`TideExtreme`) |
| [weatherWarning.ts](sources/weatherWarning.ts) | 기상청 특보 |
| [oceanIndex.ts](sources/oceanIndex.ts) | 이안류·해수욕지수·갯벌체험지수 + `nearestByCoord()` |
| [lifeIndex.ts](sources/lifeIndex.ts) | 생활해양예보지수 |

### http.ts 규약 — 새 소스를 쓸 때 반드시 지킬 것

- **`fetchJson()`을 쓰고 `fetch`를 직접 부르지 않는다.** 본문을 텍스트로 먼저 받은 뒤 JSON을 파싱한다 — data.go.kr은 `dataType=JSON`이어도 오류 시 XML을 뱉으므로 `res.json()`은 원인을 알 수 없는 예외로 죽는다.
- **`revalidate` 기본 900초(15분).** Next ISR이 공공 API 호출량을 막아 준다. 순수 Node(검증 스크립트)에서는 `next` 옵션이 무시된다.
- **키는 `requireDataGoKrKey()`로만 읽는다.** `process.env`를 모듈 스코프에서 읽지 말 것 — 시크릿 없는 빌드가 깨진다.
- **응답 껍데기가 API마다 다르다.** 조석은 `body`가 최상위, 기상특보는 `response.body` 안. 새 소스를 붙이기 전에 [docs/verified-apis.md](../docs/verified-apis.md)의 실측 스키마를 먼저 볼 것.
- **지수 API는 `numOfRows` 300이 상한.** 해수욕지수는 ~500행이라 `oceanIndex.ts`에서 페이지네이션한다.

## engine/ — 판정 (5 파일)

| 파일 | 담당 |
|---|---|
| [types.ts](engine/types.ts) | `Status`·`Signal`·`Verdict`·`combineStatus()`·`nowSeoulISO()` |
| [swim.ts](engine/swim.ts) | 물놀이 — 파고·수온·특보·이안류·해수욕지수 |
| [mudflat.ts](engine/mudflat.ts) | 갯벌 — 조석 안전 창·특보·갯벌체험지수 |
| [warnings.ts](engine/warnings.ts) | 특보 분류 (`SWIM_WARNING_TYPES` / `MUDFLAT_WARNING_TYPES`) |
| [index.ts](engine/index.ts) | `evaluate(stationId, activity)` — 활동별 라우팅 + 화이트리스트 검사 |

### 절대 깨면 안 되는 것

- **`combineStatus`는 가장 위험한 등급을 채택한다.** `데이터없음`/`점검중`은 판정에서 **제외**되지 신중한 추측으로 대체되지 않는다. 빈 칸을 메우려 하지 말 것 — 틀린 `가능`은 사람이 다친다.
- **모르는 등급 문자열은 `데이터없음`.** 기관이 새 등급명을 도입했을 때 `가능`으로 떨어지면 조용히 위험해진다. 새 매핑을 추가할 때 fallback을 낙관적으로 바꾸지 말 것.
- **시간은 전부 `nowSeoulISO()`.** `new Date()` 로컬 시간에 의존하면 배포 환경(UTC)에서 조용히 어긋난다.
- **임계값 수치는 ADR 없이 바꾸지 않는다** — [docs/adr/](../docs/adr/). 파고 0.5/1.0m, 간조 ±3h는 아직 공식 기준으로 검증되지 않은 초안이며, 그 사실이 ADR에 기록돼 있다.

### 새 활동을 추가하려면

1. `engine/<activity>.ts`에 `evaluate<Activity>(station): Promise<Verdict>` 작성
2. `types.ts`의 `Activity` 유니언에 추가
3. `index.ts`의 `switch`에 분기 추가
4. [data/stations.ts](../data/stations.ts)에 해당 활동을 지원하는 지점 등록 — **필요한 신호가 전부 실데이터로 나오는 지점만**. 하나라도 빠지면 부분 지원이 아니라 제외다.
5. 임계값을 새로 정했다면 ADR 작성
6. `npm run verify:verdict` 실행

## chat/ — 챗봇 프롬프트 (1 파일)

[chat/prompt.ts](chat/prompt.ts). `buildSystemPrompt(verdict)`가 판정 근거를 프롬프트에
넣고, 판정이 `불가`면 hard stop 문구를 **마지막 줄에** 덧붙인다. `isValidVerdict()` 등
런타임 검증기가 `/api/chat`의 400 응답을 만든다.

**챗봇은 판정을 뒤집을 수 없다.** `/api/chat`은 클라이언트가 보낸 `Verdict`를 믿지 않고
지점·활동만 받아 서버에서 `evaluate()`를 다시 돌린다. 프롬프트 가드와 서버 재계산은
서로 대체재가 아니라 **둘 다** 있어야 한다.

수정하면 `npm run verify:chat` 실행.

## ui/ — 표시용 맵 (2 파일)

[ui/activity.ts](ui/activity.ts) (`ACTIVITY_LABEL`·`ACTIVITY_EMOJI`),
[ui/status.ts](ui/status.ts) (`STATUS_UI`·`statusUi()`). 로직 없는 순수 매핑이므로
클라이언트 컴포넌트에서 그대로 import 해도 된다.

## claude.ts

모델 핀: `DEFAULT_MODEL = "claude-haiku-4-5"`, `QUALITY_MODEL = "claude-sonnet-5"`.
`getAnthropic()`은 **지연 초기화**다 — 모듈 로드 시점에 키를 읽지 않으므로 시크릿 없이도
빌드가 통과한다. 이 성질을 깨지 말 것 (CI 빌드 게이트가 여기 의존한다).

## 고치면 무엇을 돌리나

| 고친 곳 | 돌릴 것 |
|---|---|
| `sources/` 또는 `engine/` | `npm run verify:verdict` |
| `chat/prompt.ts` | `npm run verify:chat` |
| 외부 API가 죽은 것 같을 때 | `npm run verify:sources` |

셋 다 실 API를 호출하고 `.env`가 필요하므로 CI에 없다. **로컬에서 돌리고 PR에 결과를 붙인다.**
