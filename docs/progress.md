# 진행 상황 & 다음 세션 핸드오프 — 오늘의 바다

> 최종 업데이트: 2026-07-18 (지원 지점 확장 완료)
> 근거 문서: [실구현 계획](./implementation-plan.md) · [검증된 API](./verified-apis.md)

---

## 1. 지금까지 완료 (M1 → M6 + 3대 지수 실연동)

| 마일스톤 | 상태 | 산출물 |
|---|---|---|
| **M1** 프로젝트 셋업 + 소스 클라이언트 | ✅ 완료 | Next 15 스캐폴딩, `lib/sources/*` |
| **M2** 지점 매핑 + 판정 엔진 | ✅ 완료 | `data/stations.ts`, `lib/engine/*` |
| **M3** 홈 + 판정 카드 (데모 장면 2) | ✅ 완료 | `app/page.tsx`, `components/*`, `app/api/verdict/route.ts` |
| **지수 실연동**(계획 §10 핵심 TODO) | ✅ 완료 | 갯벌체험·해수욕·이안류 지수 data.go.kr 실호출 |
| **M4** 타임라인 (데모 장면 3) | ✅ 완료 | `components/RiskTimeline.tsx`, `components/TideStrip.tsx`, `app/place/[id]/page.tsx` |
| **M5** 챗봇 (데모 장면 1) | ✅ 완료 | `app/api/chat/route.ts`, `components/ChatThread.tsx`, `lib/chat/prompt.ts` |
| **M6** 디자인 폴리시 + 리허설 | ⚠️ 부분 완료 | 모션 토큰, 포커스/press feedback, reduced-motion 일부, 데모 데이터 재검증 |
| **M6.1** 접근성/문서 정합성 보정 | ✅ 완료 | 검색 키보드 접근성, 타임라인 SR 요약, CTA contrast, 이안류 경계 매핑 |
| **지원 지점 확장** | ✅ 완료 | 완비 규칙에 맞춰 물놀이 7곳, 갯벌 5곳으로 확장 |

**검증 상태 (모두 통과):**
- `npm run verify:sources` → **8/8** 실호출 통과 (open-meteo·조석·기상특보·생활지수목록·갯벌체험지수·해수욕지수·이안류·Claude)
- `npm run verify:verdict` → **12/12** verdict 산출 + **타임라인 24구간·조석 마커 실데이터 확인** (해운대·송정·임랑·대천·중문·경포·속초 물놀이, 제부도·마시안·선감·월하성·병술만 갯벌). 화이트리스트 전체에서 `데이터없음`/`점검중` 신호 없음.
- `npm run verify:chat` → ✅ 불가 판정 hard-stop·근거 신호·타임라인·물때·출처 프롬프트 포함 + malformed `/api/chat` 400 검증
- `npm run build` → ✅ 성공(`/place/[id]` 라우트 포함) · `npx tsc --noEmit` → ✅ clean

**M4 구현 요약:**
- verdict에 `timeline: TimelineBand[]`(시간대별 위험 밴드) + `tideExtremes: TidePoint[]`(갯벌 전용 조석 마커) 부착.
  - swim: `buildSwimTimeline`(open-meteo 24h 파고 + 현재 특보·이안류·해수욕지수 → 종합 밴드), 파고 임계값 재사용(`waveStatus`).
  - mudflat: `buildMudflatTimeline`(간조 안전창 기반 시간별 밴드) + `toTidePoints`(간조/만조 마커).
- `RiskTimeline.tsx`: 24구간 신호등 스트립 + '지금' 세로 마커 + 현재시각 요약.
- 물놀이 타임라인은 파고만 표시하지 않고, 현재 이안류·해수욕지수·특보 위험을 보수적으로 전체 시간대에 반영해 종합 판정과 색상이 모순되지 않게 함.
- `TideStrip.tsx`: 조석 고저조를 코사인 보간으로 이은 SVG 물때 곡선 + 간조/만조 라벨 + '지금' 선.
- `/place/[id]` 상세 페이지(클라이언트): 활동별 VerdictCard + RiskTimeline + (갯벌)TideStrip. 홈 판정 후 링크로 진입.

**M5 구현 요약:**
- `/api/chat` 서버 라우트가 클라이언트가 보유한 `Verdict`의 지점/활동과 대화 히스토리를 받고, 서버에서 `evaluate(stationId, activity)`로 권위 판정을 재계산한 뒤 Claude 평문 스트리밍을 반환. `ANTHROPIC_API_KEY`는 서버에서만 사용.
- `buildSystemPrompt`가 종합 판정, 신호별 수치/출처, 타임라인 요약, 물때 마커, `불가` hard-stop을 주입해 판정을 뒤집지 못하게 고정.
- `ChatThread.tsx`: 판정 배지·말풍선·입력창·스트리밍 렌더·출처 표시. 홈과 상세의 `VerdictCard` CTA(`챗봇에게 묻기`)에서 진입.

**M6 구현 요약:**
- `app/globals.css`에 UI 모션 토큰(`--ease-sea-out`, `--ease-sea-in-out`), 공용 `sea-focus`/`sea-press`/패널 진입/검색 팝오버 진입 클래스를 추가.
- 홈·상세·카드·타임라인·물때·챗봇 UI에 속성 한정 transition, press feedback, focus-visible 링, `prefers-reduced-motion` 대응을 적용.
- 챗봇 자동 스크롤은 reduced-motion 환경에서 `smooth` 대신 `auto`로 동작.
- 2026-07-18 지원 지점 확장: 해수욕지수·이안류·파고/수온·기상특보가 모두 실호출되는 송정(`SONGJUNG`)·임랑(`IMRANG`)·대천(`DAECHON`)·중문(`JUNGMUN`)·경포(`GYEONGPO`)·속초(`SOKCHO`)를 물놀이 지점에 추가. 갯벌은 조석·갯벌체험지수·기상특보가 모두 실호출되는 마시안·선감·월하성·병술만을 추가. 이안류 미제공 다대포는 완비 규칙에 맞춰 제외.
- 감사 결과 M6는 “완료”가 아니라 부분 완료로 정정. 남은 보정 대상은 검색 combobox semantics, 타임라인 스크린리더 세부, CTA 대비, reduced-motion press transform, 이안류 `경계` 매핑이었다.

---

## 2. 다음에 할 일 (우선순위 순)

### ▶ 최종 리허설 / 배포 준비
- 실제 브라우저에서 홈 → 판정 카드 → 챗봇 → 상세 타임라인 순서로 3장면 발표 동선 리허설
- 배포 환경변수 확인 후 Vercel 배포

### 남은 데이터 TODO (급하지 않음)
- [ ] 판정 임계값을 공식 안전기준으로 검증 (현재 `swim.ts`/`mudflat.ts` 초안)
- [ ] 간조/만조 안전창 시간폭(현재 간조 ±3h, 복귀 60분 전) 해수부 갯벌 가이드로 검증

---

## 3. 실행 방법 (다음 세션 빠른 시작)

```bash
cd /Users/yugdong-yeon/Desktop/soloton2
npm run dev                 # http://localhost:3000 (또는 -p 로 포트 지정)
npm run verify:sources      # 8개 소스 실호출 검증
npm run verify:verdict      # 화이트리스트 전체 판정 검증
npm run verify:chat         # 챗봇 프롬프트 안전가드 검증
npm run build               # 프로덕션 빌드
```
- **환경변수**(`.env`, gitignore됨): `ANTHROPIC_API_KEY`, `DATA_GO_KR_SERVICE_KEY`, `KHOA_OPENAPI_KEY` 모두 SET.
  - ⚠️ 실제로 쓰는 지수 API 인증키는 **`DATA_GO_KR_SERVICE_KEY`** (KHOA 바다누리 키는 이 앱에선 미사용 — 아래 4번 참고).
- TS 직접 실행은 `tsx` 로더 사용: `node --env-file=.env --import tsx <script>` (package.json 스크립트에 반영됨).
- git 저장소 아님(필요 시 `git init`).

---

## 4. 핵심 발견 사실 (다음 세션에서 반드시 기억)

1. **지수 API 인증 = data.go.kr 키 + 활용신청** (KHOA 바다누리 별도 키 아님).
   - 세 지수 모두 `https://apis.data.go.kr/1192136/{svc}/{op}` 로 `serviceKey`=DATA_GO_KR 키.
   - 갯벌: `fcstMudflatv2/GetFcstMudflatApiServicev2` / 해수욕: `fcstBeachv2/GetFcstBeachApiServicev2` / 이안류: `ripCurrent/GetRipCurrentApiService`
   - 응답: `{ header.resultCode("00"정상), body.items.item[] }`. 상세는 [verified-apis.md](./verified-apis.md).
2. **조석 API 응답은 `body` 최상위**(기상특보는 `response.body` 래퍼) — 소스별 파싱 다름.
3. **조석 `extrSe` = 숫자 코드**: 홀수(1,3)=고조(만조), 짝수(2,4)=저조(간조).
4. **지점 매핑**: 갯벌 조석 프록시 제부도/선감=안산 `DT_0008`, 마시안=인천 `DT_0001`, 월하성=서천마량 `DT_0051`, 병술만=보령 `DT_0025`; 특보 stnId 부산=159·강릉=105·속초=90·보령=235·서귀포=189·인천=112·경기=119.
   물놀이 이안류 `beachCode`: 해운대=`HAE`, 송정=`SONGJUNG`, 임랑=`IMRANG`, 대천=`DAECHON`, 중문=`JUNGMUN`, 경포=`GYEONGPO`, 속초=`SOKCHO`. 갯벌·해수욕은 좌표 최근접 매칭.
5. **지원 지점 원칙**: 해당 활동에 필요한 신호가 하나라도 `데이터없음`/`점검중`이면 화이트리스트에서 제외. 다대포는 해수욕지수는 있지만 이안류가 미제공이라 물놀이 지원 지점에서 제외.
6. **판정 원칙**: `combineStatus`가 3색 신호 중 가장 위험한 등급 채택. `데이터없음`/`점검중`은 판정에서 제외(허위 판정 금지).
   - 실제로 제부도는 조석상 안전창이어도 공식 갯벌지수 '매우나쁨'이면 **불가**로 오버라이드됨(정상 동작).
7. 지수 API `numOfRows` 최대 300. 해수욕지수는 총 ~500행이라 `fetchBeachIndex`가 페이지네이션함.

---

## 5. 파일 지도

```
app/
  page.tsx                 홈(검색+판정카드+상세 링크) — 데모 장면 2
  place/[id]/page.tsx      장소 상세(판정+타임라인+물때곡선) — 데모 장면 3
  api/verdict/route.ts     판정 엔진 API(서버, 키 보호)
  api/chat/route.ts        챗봇 스트리밍 API(서버, Claude 키 보호)
components/
  SearchBar.tsx  VerdictCard.tsx
  RiskTimeline.tsx         시간대별 위험 밴드 스트립(M4)
  TideStrip.tsx            조석 곡선 SVG(간조/만조, M4)
  ChatThread.tsx           Verdict 기반 챗봇 UI(M5)
  ※ M6: 주요 UI 컴포넌트에 focus-visible, press feedback, reduced-motion polish 적용
lib/
  chat/
    prompt.ts              Verdict 기반 시스템 프롬프트 + 안전가드 검증
  sources/
    http.ts                공용 fetch(ISR 캐시·에러·키 가드)
    openMeteo.ts           파고·수온
    tide.ts                조석 고저조(간조/만조)
    weatherWarning.ts      기상특보
    lifeIndex.ts           생활해양예보지수 지점목록(odcloud) — 참고용
    oceanIndex.ts          ★ 갯벌체험·해수욕·이안류 지수 실시간 값(data.go.kr)
  engine/
    types.ts               Verdict/Signal/Status, combineStatus
    swim.ts                물놀이: 파고·수온·특보·이안류·해수욕지수
    mudflat.ts             갯벌: 물때 안전창·특보·갯벌체험지수
    warnings.ts            기상특보 텍스트 분류
    index.ts               활동별 라우팅
  claude.ts                Anthropic 래퍼(챗봇 M5용)
  ui/status.ts  ui/activity.ts   상태 색/라벨 토큰
data/stations.ts           화이트리스트(해운대·송정·임랑·대천·중문·경포·속초·제부도·마시안·선감·월하성·병술만)
scripts/
  verify-sources.ts        소스 8종 실호출 검증
  verify-verdict.ts        엔진 verdict 검증
  verify-chat.ts           챗봇 프롬프트 안전가드 검증
```
