/**
 * 조석예보 고저조 (국립해양조사원, data.go.kr) — 간조·만조 시각.
 * base `.../tideFcstHghLw` 뒤에 오퍼레이션 `/GetTideFcstHghLwApiService` 필수.
 * 갯벌체험 안전 창(간조 전후) 계산의 핵심 소스.
 */
import { fetchJson, requireDataGoKrKey, type FetchOptions } from "./http";

const BASE =
  "https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService";

export interface TideParams {
  /** 예보지점 코드(예: DT_0018 군산). */
  obsCode: string;
  /** yyyyMMdd. 기본 오늘(Asia/Seoul). */
  date?: string;
}

export interface TideExtreme {
  /** 예측시각(원문 predcDt). */
  time: string;
  /** 조위(cm). */
  levelCm: number;
  /** 고조(만조) / 저조(간조). */
  type: "high" | "low";
  /** 관측소명. */
  obsName: string;
}

// 이 엔드포인트는 `response` 래퍼 없이 최상위가 { header, body } 구조.
interface RawTideResponse {
  body?: {
    items?: {
      item?: RawTideItem[] | RawTideItem;
    };
  };
}

interface RawTideItem {
  obsvtrNm?: string;
  predcDt?: string;
  predcTdlvVl?: string | number;
  /** 고/저 구분 코드: 홀수(1,3)=고조(만조), 짝수(2,4)=저조(간조). */
  extrSe?: string | number;
}

function todaySeoul(): string {
  // Asia/Seoul 기준 yyyyMMdd
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts.replace(/-/g, "");
}

function isHighTide(marker: string | number | undefined): boolean {
  const s = String(marker ?? "");
  if (/고|H/i.test(s)) return true; // "고조"/"고"/"H"
  if (/저|L/i.test(s)) return false; // "저조"/"저"/"L"
  const n = Number(s);
  // KHOA 코드: 홀수(1,3)=고조, 짝수(2,4)=저조.
  if (Number.isFinite(n)) return n % 2 === 1;
  return false;
}

function toExtreme(item: RawTideItem): TideExtreme {
  const isHigh = isHighTide(item.extrSe);
  return {
    time: item.predcDt ?? "",
    levelCm: Number(item.predcTdlvVl ?? 0),
    type: isHigh ? "high" : "low",
    obsName: item.obsvtrNm ?? "",
  };
}

export async function fetchTideExtremes(
  params: TideParams,
  opts?: FetchOptions,
): Promise<TideExtreme[]> {
  const qs = new URLSearchParams({
    serviceKey: requireDataGoKrKey(),
    pageNo: "1",
    numOfRows: "300",
    type: "json",
    obsCode: params.obsCode,
    reqDate: params.date ?? todaySeoul(),
  });

  const raw = await fetchJson<RawTideResponse>(`${BASE}?${qs}`, opts);
  const item = raw.body?.items?.item;
  if (!item) return [];

  const list = Array.isArray(item) ? item : [item];
  return list.map(toExtreme);
}
