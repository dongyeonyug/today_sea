/**
 * 생활해양예보지수 실시간 값 (국립해양조사원, data.go.kr 게이트웨이).
 * 인증 = DATA_GO_KR_SERVICE_KEY (해당 API 활용신청 필요).
 * 엔드포인트·스키마는 실호출 검증(docs/verified-apis.md).
 *   · 갯벌체험지수: fcstMudflatv2/GetFcstMudflatApiServicev2  (활용신청 완료✓)
 *   · 이안류지수:   ripCurrent/GetRipCurrentApiService        (활용신청 완료✓)
 *   · 해수욕지수:   fcstBeachv2/GetFcstBeachApiServicev2       (활용신청 완료✓)
 */
import { fetchJson, requireDataGoKrKey, SourceError, type FetchOptions } from "./http";

const BASE = "https://apis.data.go.kr/1192136";

/** yyyyMMdd (Asia/Seoul 오늘). */
function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
}

interface KhoaEnvelope<T> {
  header?: { resultCode?: string; resultMsg?: string };
  body?: { items?: { item?: T[] | T } };
}

/** resultCode "00"이 아니면 SourceError. 그 외 items 배열 정규화. */
async function callIndex<T>(
  path: string,
  params: Record<string, string>,
  opts?: FetchOptions,
): Promise<T[]> {
  const qs = new URLSearchParams({
    serviceKey: requireDataGoKrKey(),
    type: "json",
    numOfRows: "300",
    pageNo: "1",
    ...params,
  });
  const raw = await fetchJson<KhoaEnvelope<T>>(`${BASE}/${path}?${qs}`, opts);
  const code = raw.header?.resultCode;
  if (code !== "00") {
    throw new SourceError(
      `지수 API 비정상 응답 (${code ?? "?"}: ${raw.header?.resultMsg ?? ""})`,
      undefined,
      code,
    );
  }
  const item = raw.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// ── 갯벌체험지수 ─────────────────────────────────────────────
export interface MudflatIndexRow {
  village: string;
  lat: number;
  lon: number;
  date: string;
  /** 체험 가능 시간대. */
  beginTime: string;
  endTime: string;
  /** 종합 지수 등급(예: 매우좋음/좋음/보통/나쁨/매우나쁨/체험불가). */
  totalIndex: string;
  weather: string;
}

interface RawMudflat {
  mdftExpcnVlgNm?: string;
  lat?: string | number;
  lot?: string | number;
  predcYmd?: string;
  mdftExprnBgngTm?: string;
  mdftExprnEndTm?: string;
  totalIndex?: string;
  weather?: string;
}

export async function fetchMudflatIndex(
  reqDate?: string,
  opts?: FetchOptions,
): Promise<MudflatIndexRow[]> {
  const rows = await callIndex<RawMudflat>(
    "fcstMudflatv2/GetFcstMudflatApiServicev2",
    { reqDate: reqDate ?? todaySeoul() },
    opts,
  );
  return rows.map((r) => ({
    village: r.mdftExpcnVlgNm ?? "",
    lat: Number(r.lat ?? 0),
    lon: Number(r.lot ?? 0),
    date: r.predcYmd ?? "",
    beginTime: r.mdftExprnBgngTm ?? "",
    endTime: r.mdftExprnEndTm ?? "",
    totalIndex: r.totalIndex ?? "",
    weather: r.weather ?? "",
  }));
}

// ── 해수욕지수 ───────────────────────────────────────────────
export interface BeachIndexRow {
  beach: string;
  lat: number;
  lon: number;
  date: string;
  /** 오전 / 오후. */
  noon: string;
  /** 해수욕지수 등급(매우좋음/좋음/보통/나쁨/매우나쁨). */
  totalIndex: string;
  /** 개장 상태(개장/폐장). */
  openStatus: string;
  maxWaveHeight: number;
  avgWaterTemp: number;
}

interface RawBeach {
  bbchNm?: string;
  lat?: string | number;
  lot?: string | number;
  predcYmd?: string;
  predcNoonSeCd?: string;
  totalIndex?: string;
  opnStat?: string;
  maxWvhgt?: string | number;
  avgWtem?: string | number;
}

/** 전국 해수욕장(총 ~500행)을 페이지네이션으로 모두 수집. */
export async function fetchBeachIndex(
  reqDate?: string,
  opts?: FetchOptions,
): Promise<BeachIndexRow[]> {
  const date = reqDate ?? todaySeoul();
  const out: RawBeach[] = [];
  for (let page = 1; page <= 3; page++) {
    const rows = await callIndex<RawBeach>(
      "fcstBeachv2/GetFcstBeachApiServicev2",
      { reqDate: date, pageNo: String(page) },
      opts,
    );
    out.push(...rows);
    if (rows.length < 300) break; // 마지막 페이지
  }
  return out.map((r) => ({
    beach: r.bbchNm ?? "",
    lat: Number(r.lat ?? 0),
    lon: Number(r.lot ?? 0),
    date: r.predcYmd ?? "",
    noon: r.predcNoonSeCd ?? "",
    totalIndex: r.totalIndex ?? "",
    openStatus: r.opnStat ?? "",
    maxWaveHeight: Number(r.maxWvhgt ?? 0),
    avgWaterTemp: Number(r.avgWtem ?? 0),
  }));
}

// ── 이안류지수 ───────────────────────────────────────────────
export interface RipCurrentRow {
  beachCode: string;
  beachName: string;
  /** 관측일시 "YYYY-MM-DD HH:mm". */
  observedAt: string;
  /** 이안류 점수. */
  score: number;
  /** 단계(안전/관심/주의/위험). */
  level: string;
  waveHeight: number;
  waterTemp: number;
}

interface RawRip {
  obsvtrId?: string;
  obsvtrNm?: string;
  obsrvnDt?: string;
  lastScr?: string | number;
  lastScrCn?: string;
  wvhgt?: string | number;
  wtem?: string | number;
}

export async function fetchRipCurrent(
  beachCode: string,
  reqDate?: string,
  opts?: FetchOptions,
): Promise<RipCurrentRow[]> {
  const rows = await callIndex<RawRip>(
    "ripCurrent/GetRipCurrentApiService",
    { beachCode, reqDate: reqDate ?? todaySeoul() },
    opts,
  );
  return rows.map((r) => ({
    beachCode: r.obsvtrId ?? beachCode,
    beachName: r.obsvtrNm ?? "",
    observedAt: r.obsrvnDt ?? "",
    score: Number(r.lastScr ?? 0),
    level: r.lastScrCn ?? "",
    waveHeight: Number(r.wvhgt ?? 0),
    waterTemp: Number(r.wtem ?? 0),
  }));
}

// ── 공용 헬퍼 ────────────────────────────────────────────────
/** 좌표상 가장 가까운 지점(마을) 선택. */
export function nearestByCoord<T extends { lat: number; lon: number }>(
  rows: T[],
  lat: number,
  lon: number,
): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const r of rows) {
    const d = Math.hypot(r.lat - lat, r.lon - lon);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
