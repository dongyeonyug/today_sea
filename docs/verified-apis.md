# 검증된 API 명세 — 오늘의 바다

> 2026-07-18 실제 호출로 전부 검증 완료(8/8). 모든 예시는 응답 200 확인.
> 키는 `.env`(gitignore됨)에서 로드. 아래 문서에 실제 키 값은 넣지 않는다.

## 1. Claude API (챗봇 해설)
- **엔드포인트**: `POST https://api.anthropic.com/v1/messages`
- **헤더**: `x-api-key: $ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- **사용 가능 모델**(키 권한 확인됨): `claude-sonnet-5`, `claude-opus-4-8`, `claude-haiku-4-5-20251001` 등
- **권장**: 챗봇 응답은 `claude-haiku-4-5`(빠름·저렴) 또는 품질 필요 시 `claude-sonnet-5`
- 모델 목록 조회: `GET https://api.anthropic.com/v1/models`

## 2. 기상청 기상특보 조회서비스 (data.go.kr)
- **엔드포인트**: `https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList`
- **필수 파라미터**: `serviceKey`, `pageNo`, `numOfRows`, `dataType`(JSON), `stnId`(지점번호, 서울=108)
- **응답**: `response.body.items.item[]` — `title`(특보 내용), `tmFc`(발표시각)
- 풍랑·강풍·호우 등 12종 특보. 활동 판정의 "불가" 트리거로 사용.
- **응답 구조**: `response.body.items.item[]` (조석 §5와 달리 `response` 래퍼 있음).
- **stnId 매핑**: 서울=108, **부산=159**(해운대·송정·임랑), **강릉=105**(경포), **속초=90**(속초), **보령=235**(대천·월하성·병술만), **서귀포=189**(중문), **인천=112**(마시안), **경기/수원=119**(제부도·선감). M2 실호출 통과.
- 특보 판정(M2): 종류별 최신 상태만 유지하고 "해제"면 제외 → 발효 중 경보=불가·주의보=주의.
  title 예: `[특보] 제07-284호 : ... / 호우주의보 해제 (*)` — "해제" 우선 판별 필수.

## 3. 생활해양예보지수 (국립해양조사원, odcloud 자동변환)
- **지점목록 엔드포인트**: `https://api.odcloud.kr/api/15145389/v1/uddi:f993d3df-732d-4aee-bf1a-d08d681652eb`
- **파라미터**: `serviceKey`, `page`, `perPage`
- **응답 샘플**: `{"경도","위도","권역","주소","지수 코드명":"바다갈라짐체험","지수 코드명(세부)":"SD6","지역명":"실미도"}`
- 갯벌체험("바다갈라짐체험") 지점 목록 + 좌표 확보. 세부코드 SD4(제부도)·SD8(웅도) 등.
- 지점목록은 참고용. 실시간 **지수값**(해수욕지수·갯벌체험지수의 5단계 값)은 아래 data.go.kr 지수 API로 연동 완료.

## 4. open-meteo Marine (파고·수온, 키 불필요)
- **엔드포인트**: `https://marine-api.open-meteo.com/v1/marine`
- **파라미터**: `latitude`, `longitude`, `hourly=wave_height,sea_surface_temperature`(+ `wave_direction`, `wave_period`, `sea_level_height_msl`, `ocean_current_velocity` 등), `timezone=Asia/Seoul`, `forecast_days`
- **응답**: `hourly.time[]`, `hourly.wave_height[]`(m), `hourly.sea_surface_temperature[]`(°C)
- 해운대(35.158, 129.16) 호출 성공. 시간대별 위험 타임라인의 파고 곡선 소스.
- 조위(`sea_level_height_msl`)도 제공 → 조석예보 미지원 지역의 폴백으로 사용 가능.

## 5. 조석예보 고저조 (국립해양조사원, data.go.kr)  — 간조·만조 시각
- **엔드포인트**: `https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService`
  (주의: base `.../tideFcstHghLw` 뒤에 오퍼레이션 `/GetTideFcstHghLwApiService` 필수)
- **필수 파라미터**: `serviceKey`, `pageNo`, `numOfRows`(최대 300), `type`(json/xml), `obsCode`(예보지점 코드), `reqDate`(yyyyMMdd)
- **선택**: `include`/`exclude`(예: lot,lat)
- **응답 구조**(M1 실측): 이 엔드포인트는 `response` 래퍼 없이 **최상위가 `{ header, body }`**.
  (기상특보(§2)는 `response.body`, 조석은 `body` — 소스별 파싱 분리 필요.)
- **응답 항목**: `body.items.item[]` — `obsvtrNm`(관측소명), `predcDt`(예측시각 "YYYY-MM-DD HH:mm"), `predcTdlvVl`(조위 cm), `extrSe`(고/저 구분 **코드**), `lot`/`lat`
- **`extrSe` 코드 해석**(M1 실측 확정): 문자열이 아니라 숫자 코드. **홀수(1,3)=고조(만조), 짝수(2,4)=저조(간조)**.
  (군산 실측: 731cm→1, 42cm→2, 651cm→3, 98cm→4. 문서 초안의 "값 크기로 구분"은 부정확.)
- 검증: obsCode=DT_0018(군산), 오늘 → 05:54 고조 731cm / 12:38 저조 98cm / 18:06 고조 651cm
- **obsCode 매핑 확정**(M2, DT_0001~0094 실측 스캔):
  · 인천=**DT_0001** · 부산=**DT_0005**(129.03527, 35.09638) · 안산=**DT_0008**(126.64722, 37.19222) · 평택=DT_0002
  · 가덕도=DT_0063 · 울산=DT_0020 · 통영=DT_0014 등.
  · **제부도(37.146, 126.607)는 전용 관측소 없음** → 최근접 **안산 DT_0008**(~6km)를 프록시로 사용.
  · **마시안**은 인천 `DT_0001`, **선감**은 안산 `DT_0008`, **월하성**은 서천마량 `DT_0051`, **병술만**은 보령 `DT_0025` 프록시로 실호출 검증.

---

## 해수욕지수 · 갯벌체험지수 · 이안류 실시간 값 — 발급 경로 확정 (2026-07-18)
> KHOA 바다누리 자체 키가 **아니라**, 이미 보유한 **data.go.kr 통합키(`DATA_GO_KR_SERVICE_KEY`)로 해당 API를
> "활용신청"** 하는 것이 정답. (KHOA 활용가이드라인이 data.go.kr 발급 절차를 공식 안내.)

### 확정된 data.go.kr 오픈API (엔드포인트·인증 = DATA_GO_KR 키)
| 지수 | data.go.kr 데이터셋 | 엔드포인트 (apis.data.go.kr/1192136/…) |
|------|--------------------|------------------------------------------|
| **해수욕지수**(물놀이) | [15142484](https://www.data.go.kr/data/15142484/openapi.do) | `fcstBeachv2/GetFcstBeachApiServicev2` |
| **갯벌체험지수** | [15142489](https://www.data.go.kr/data/15142489/openapi.do) | `fcstMudflatv2/GetFcstMudflatApiServicev2` |
| 바다갈라짐 체험지수 | [15142485](https://www.data.go.kr/data/15142485/openapi.do) | `fcstSeaSplitv2/GetFcstSeaSplitApiServicev2` |
| **이안류 지수** | [15156028](https://www.data.go.kr/data/15156028/openapi.do) | `ripCurrent/GetRipCurrentApiService` |

- 공통 파라미터: `serviceKey`(=DATA_GO_KR 키), `reqDate`(yyyyMMdd), `type=json`, `numOfRows`, `pageNo` (+ 지수별 `placeCode`/`beachCode`)
- **응답 스키마(실측)**: `{ header:{ resultCode, resultMsg }, body:{ items:{ item:[…] } } }`
  · 갯벌 item: `mdftExpcnVlgNm`(체험마을), **`totalIndex`("체험가능/체험불가")**, `mdftExprnBgngTm`/`EndTm`(체험 시간대), `min/maxArtmp`, `min/maxWspd`, `weather`, lat/lot, `predcYmd`
  · KHOA 내부 `.do`에 `isSample=Y`로 호출 시 `resultCode:00`+실데이터 반환 확인 → 스키마·필드 검증됨

### 연동 상태 (2026-07-18 활용신청 후 실호출 검증)
| 지수 | 상태 | 비고 |
|------|------|------|
| **갯벌체험지수** | ✅ **연동 완료** (`resultCode 00`) | `lib/sources/oceanIndex.ts` · 좌표 최근접 마을(제부도→백미리마을, 마시안→마시안마을, 선감→선감마을, 월하성→월하성마을, 병술만→병술만마을) |
| **이안류지수** | ✅ **연동 완료** (`resultCode 00`) | 해운대 `beachCode=HAE` · `lastScrCn`(안전/관심/주의/경계/위험) |
| **해수욕지수** | ✅ **연동 완료** (`resultCode 00`) | 좌표 최근접 해수욕장 · `predcNoonSeCd`(오전/오후) 회차 · 총 500행 페이지네이션 |

- 갯벌 필드: `mdftExpcnVlgNm`→village, `totalIndex`(좋음/보통/나쁨/매우나쁨→가능/주의/불가), `mdftExprnBgngTm/EndTm`(체험 시간대)
- 이안류 필드: `obsvtrNm`→beachName, `lastScrCn`(안전·관심→가능/주의·경계→주의/위험→불가), `obsrvnDt`(5분 관측), `wvhgt/wtem`
- 해수욕 필드: `bbchNm`→beach, `totalIndex`(→가능/주의/불가), `predcNoonSeCd`(오전/오후), `opnStat`(폐장 시 최소 주의), `maxWvhgt/avgWtem`
- 이안류 제공 10개소: 경포(`GYEONGPO`)·고래불·낙산·대천(`DAECHON`)·망상·속초(`SOKCHO`)·송정(`SONGJUNG`)·임랑(`IMRANG`)·중문(`JUNGMUN`)·해운대(`HAE`).
  해양수산부/국립해양조사원 공개 자료도 부산 해운대·송정·임랑, 강원 경포·낙산·속초·망상, 충남 대천, 제주 중문, 경북 고래불 10개소를 대상으로 안내한다.
- 그 외 지점(예: 다대포)은 해수욕지수가 있어도 이안류 실데이터가 없으면 물놀이 화이트리스트에서 제외한다.
- 검증: `npm run verify:sources` (**8/8**, 갯벌·해수욕·이안류 실호출 포함), `npm run verify:verdict` (화이트리스트 전체 12/12, `데이터없음`/`점검중` 신호 없음).

## 판정 엔진에서의 데이터 매핑(초안)
| 활동 | 사용 데이터 |
|------|-------------|
| 물놀이·수영 | open-meteo 파고·수온 + 기상특보 + 생활해양예보지수(해수욕) + 이안류(10개소 중 검증 완료 지점) |
| 갯벌체험 | 조석예보 고저조(간조/만조 시각) + 생활해양예보지수(갯벌체험) + 기상특보 |
