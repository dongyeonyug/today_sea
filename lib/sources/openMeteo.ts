/**
 * open-meteo Marine API — 파고·수온(키 불필요).
 * 문서: https://open-meteo.com/en/docs/marine-weather-api
 * 시간대별 위험 타임라인의 파고 곡선 + 수온 소스.
 */
import { fetchJson, type FetchOptions } from "./http";

const BASE = "https://marine-api.open-meteo.com/v1/marine";

export interface MarineParams {
  latitude: number;
  longitude: number;
  /** 예보 일수(1~16). 기본 1일. */
  forecastDays?: number;
}

/** 시간별 배열(같은 인덱스끼리 대응). 값이 없는 시각은 null. */
export interface MarineHourly {
  time: string[];
  waveHeight: (number | null)[];
  seaSurfaceTemperature: (number | null)[];
  /** 조위(MSL 기준, m). 조석예보 미지원 지역의 폴백. */
  seaLevelHeightMsl: (number | null)[];
}

interface RawMarineResponse {
  hourly?: {
    time?: string[];
    wave_height?: (number | null)[];
    sea_surface_temperature?: (number | null)[];
    sea_level_height_msl?: (number | null)[];
  };
}

export async function fetchMarine(
  params: MarineParams,
  opts?: FetchOptions,
): Promise<MarineHourly> {
  const qs = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    hourly: "wave_height,sea_surface_temperature,sea_level_height_msl",
    timezone: "Asia/Seoul",
    forecast_days: String(params.forecastDays ?? 1),
  });

  const raw = await fetchJson<RawMarineResponse>(`${BASE}?${qs}`, opts);
  const h = raw.hourly ?? {};

  return {
    time: h.time ?? [],
    waveHeight: h.wave_height ?? [],
    seaSurfaceTemperature: h.sea_surface_temperature ?? [],
    seaLevelHeightMsl: h.sea_level_height_msl ?? [],
  };
}
