/**
 * 생활해양예보지수 (국립해양조사원, odcloud 자동변환) — 지점목록.
 * 갯벌체험("바다갈라짐체험")·해수욕 지점 목록 + 좌표 확보.
 * ⚠️ 실시간 지수값(5단계)은 별개 데이터셋 — §10 TODO. 여기선 지점목록만.
 */
import { fetchJson, requireDataGoKrKey, type FetchOptions } from "./http";

const BASE =
  "https://api.odcloud.kr/api/15145389/v1/uddi:f993d3df-732d-4aee-bf1a-d08d681652eb";

export interface LifeIndexParams {
  page?: number;
  perPage?: number;
}

export interface LifeIndexStation {
  /** 지역명(예: 실미도, 제부도). */
  regionName: string;
  /** 지수 코드명(예: 바다갈라짐체험). */
  codeName: string;
  /** 지수 세부코드(예: SD4 제부도, SD8 웅도). */
  codeDetail: string;
  /** 권역. */
  area: string;
  address: string;
  lat: number;
  lon: number;
}

interface RawLifeIndexResponse {
  data?: RawLifeIndexRow[];
  currentCount?: number;
  totalCount?: number;
}

interface RawLifeIndexRow {
  지역명?: string;
  "지수 코드명"?: string;
  "지수 코드명(세부)"?: string;
  권역?: string;
  주소?: string;
  위도?: string | number;
  경도?: string | number;
}

export async function fetchLifeIndexStations(
  params: LifeIndexParams = {},
  opts?: FetchOptions,
): Promise<LifeIndexStation[]> {
  const qs = new URLSearchParams({
    serviceKey: requireDataGoKrKey(),
    page: String(params.page ?? 1),
    perPage: String(params.perPage ?? 100),
  });

  const raw = await fetchJson<RawLifeIndexResponse>(`${BASE}?${qs}`, opts);
  const rows = raw.data ?? [];

  return rows.map((r) => ({
    regionName: r.지역명 ?? "",
    codeName: r["지수 코드명"] ?? "",
    codeDetail: r["지수 코드명(세부)"] ?? "",
    area: r.권역 ?? "",
    address: r.주소 ?? "",
    lat: Number(r.위도 ?? 0),
    lon: Number(r.경도 ?? 0),
  }));
}
