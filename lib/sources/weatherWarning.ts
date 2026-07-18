/**
 * 기상청 기상특보 조회서비스 (data.go.kr).
 * 풍랑·강풍·호우 등 12종 특보. 활동 판정의 "불가" 트리거.
 */
import { fetchJson, requireDataGoKrKey, type FetchOptions } from "./http";

const BASE =
  "https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList";

export interface WeatherWarningParams {
  /** 지점번호(서울=108, 부산=159 등). */
  stnId: string | number;
  pageNo?: number;
  numOfRows?: number;
}

export interface WeatherWarning {
  /** 특보 내용(원문 title). */
  title: string;
  /** 발표시각(원문 tmFc). */
  announcedAt: string;
}

interface RawWarningResponse {
  response?: {
    body?: {
      items?: {
        item?: RawWarningItem[] | RawWarningItem;
      };
    };
  };
}

interface RawWarningItem {
  title?: string;
  tmFc?: string | number;
}

export async function fetchWeatherWarnings(
  params: WeatherWarningParams,
  opts?: FetchOptions,
): Promise<WeatherWarning[]> {
  const qs = new URLSearchParams({
    serviceKey: requireDataGoKrKey(),
    pageNo: String(params.pageNo ?? 1),
    numOfRows: String(params.numOfRows ?? 10),
    dataType: "JSON",
    stnId: String(params.stnId),
  });

  const raw = await fetchJson<RawWarningResponse>(`${BASE}?${qs}`, opts);
  const item = raw.response?.body?.items?.item;
  if (!item) return [];

  const list = Array.isArray(item) ? item : [item];
  return list.map((it) => ({
    title: it.title ?? "",
    announcedAt: String(it.tmFc ?? ""),
  }));
}
