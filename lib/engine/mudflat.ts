/**
 * 갯벌체험 판정 규칙(§5).
 * 조석 고저조로 오늘의 간조/만조를 산출 → 안전 창(간조 전후) + 복귀 경고.
 * 신호: 조석(안전 창) · 기상특보 · 갯벌체험지수(지수값 API 미연동 시 데이터없음).
 *
 * ⚠️ 시간폭은 초안(§10): 간조 ±3시간을 도보 가능 창으로 보고,
 *    창 종료 60분 전부터 복귀 경고. 해수부 갯벌 가이드로 검증 필요.
 */
import type { Signal, TidePoint, TimelineBand, Verdict } from "./types";
import { combineStatus, nowSeoulISO } from "./types";
import { classifyWarnings, MUDFLAT_WARNING_TYPES } from "./warnings";
import type { Station } from "../../data/stations";
import { fetchTideExtremes, type TideExtreme } from "../sources/tide";
import { fetchWeatherWarnings } from "../sources/weatherWarning";
import {
  fetchMudflatIndex,
  nearestByCoord,
  type MudflatIndexRow,
} from "../sources/oceanIndex";

const SAFETY_HALF_WINDOW_MIN = 180; // 간조 ±3시간
const RETURN_MARGIN_MIN = 60; // 창 종료 60분 전부터 복귀 경고

/** "YYYY-MM-DD HH:mm" → 자정 기준 분. 파싱 실패 시 NaN. */
function minutesOfDay(dt: string): number {
  const m = dt.match(/(\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmtHM(min: number): string {
  const h = Math.floor(((min % 1440) + 1440) % 1440 / 60);
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function nowMinutesSeoul(): number {
  const hm = nowSeoulISO().slice(11, 16); // "HH:mm"
  return minutesOfDay(hm);
}

interface TidePlan {
  status: Signal["status"];
  detail: string;
  advisory?: string;
}

interface LowTide {
  min: number;
  levelCm: number;
}

/** 오늘 저조(간조) 목록을 자정 기준 분으로 변환·정렬. */
function sortedLows(extremes: TideExtreme[]): LowTide[] {
  return extremes
    .filter((e) => e.type === "low")
    .map((e) => ({ min: minutesOfDay(e.time), levelCm: e.levelCm }))
    .filter((e) => Number.isFinite(e.min))
    .sort((a, b) => a.min - b.min);
}

/** 특정 시각(분)이 어떤 간조 안전 창에 속하는지 → 밴드 등급. */
function tideBandStatus(atMin: number, lows: LowTide[]): Signal["status"] {
  const active = lows.find(
    (l) =>
      atMin >= l.min - SAFETY_HALF_WINDOW_MIN &&
      atMin <= l.min + SAFETY_HALF_WINDOW_MIN,
  );
  if (!active) return "불가"; // 물이 차 갯벌이 잠긴 시간대
  const windowEnd = active.min + SAFETY_HALF_WINDOW_MIN;
  return atMin <= windowEnd - RETURN_MARGIN_MIN ? "가능" : "주의";
}

function planTide(extremes: TideExtreme[]): TidePlan {
  if (extremes.length === 0) {
    return { status: "점검중", detail: "조석 데이터를 불러오지 못했습니다." };
  }

  const now = nowMinutesSeoul();
  const lows = sortedLows(extremes);

  if (lows.length === 0) {
    return {
      status: "불가",
      detail: "오늘은 갯벌이 드러나는 간조가 확인되지 않습니다.",
    };
  }

  // 현재가 어떤 간조의 안전 창 안에 있는지.
  const activeLow = lows.find(
    (l) =>
      now >= l.min - SAFETY_HALF_WINDOW_MIN &&
      now <= l.min + SAFETY_HALF_WINDOW_MIN,
  );

  if (activeLow) {
    const windowEnd = activeLow.min + SAFETY_HALF_WINDOW_MIN;
    const returnBy = fmtHM(windowEnd);
    const lowAt = fmtHM(activeLow.min);
    if (now <= windowEnd - RETURN_MARGIN_MIN) {
      return {
        status: "가능",
        detail: `간조 ${lowAt}(조위 ${activeLow.levelCm}cm) 전후로 갯벌이 드러나 있습니다.`,
        advisory: `${returnBy}까지 물가에서 나오세요 — 이후 물이 차오릅니다.`,
      };
    }
    return {
      status: "주의",
      detail: `간조 ${lowAt} 이후 물이 곧 차오릅니다. 복귀를 시작하세요.`,
      advisory: `${returnBy}까지 반드시 복귀 완료.`,
    };
  }

  // 안전 창 밖: 다음 간조 안내.
  const nextLow = lows.find((l) => l.min > now);
  if (nextLow) {
    return {
      status: "불가",
      detail: `지금은 물이 들어와 갯벌이 잠겨 있습니다. 다음 간조 ${fmtHM(
        nextLow.min,
      )} 전후에 가능합니다.`,
    };
  }
  return {
    status: "불가",
    detail: "오늘 남은 시간에는 갯벌 진입 안전 창이 없습니다.",
  };
}

/**
 * 시간대별 갯벌 진입 위험 밴드(오늘 24시간).
 * 간조 안전 창 안(복귀 여유 전)=가능, 창 끝 60분=주의, 창 밖(물 참)=불가.
 * 조석 데이터가 없으면 빈 배열(타임라인 미표시).
 */
export function buildMudflatTimeline(extremes: TideExtreme[]): TimelineBand[] {
  const lows = sortedLows(extremes);
  if (lows.length === 0) return [];
  const dateStr = nowSeoulISO().slice(0, 10); // "YYYY-MM-DD"
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${dateStr}T${String(h).padStart(2, "0")}:00`,
    status: tideBandStatus(h * 60, lows),
  }));
}

/** 조석 고저조 → TideStrip 마커. 원문 시각·조위·고저 구분 그대로 전달. */
function toTidePoints(extremes: TideExtreme[]): TidePoint[] {
  return extremes
    .filter((e) => Number.isFinite(minutesOfDay(e.time)))
    .map((e) => ({ time: e.time, levelCm: e.levelCm, type: e.type }))
    .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time));
}

/** 갯벌체험지수 등급 → 판정(보수적). */
function indexStatus(totalIndex: string): Signal["status"] {
  if (/매우나쁨|체험불가|불가/.test(totalIndex)) return "불가";
  if (/나쁨/.test(totalIndex)) return "주의";
  if (/좋음|보통/.test(totalIndex)) return "가능";
  return "데이터없음";
}

/** 지수 등급 심각도(불가>주의>가능). 보수적 종합용. */
const INDEX_SEVERITY: Record<string, number> = {
  불가: 3,
  주의: 2,
  가능: 1,
  데이터없음: 0,
  점검중: 0,
};

function mudflatIndexSignal(
  rows: MudflatIndexRow[] | null,
  station: Station,
): Signal {
  const base = {
    key: "lifeIndex",
    label: "갯벌체험지수",
    source: "국립해양조사원",
  } as const;

  if (rows === null) {
    return { ...base, status: "점검중", detail: "갯벌체험지수 데이터를 불러오지 못했습니다." };
  }
  const nearest = nearestByCoord(rows, station.lat, station.lon);
  if (!nearest) {
    return { ...base, status: "데이터없음", detail: "인근 갯벌체험 지점 데이터가 없습니다." };
  }
  // 최근접 마을의 회차 중 '현재 시각이 포함된 체험 시간대'를 우선(없으면 전체).
  const now = nowSeoulISO().slice(11, 16); // "HH:mm"
  const villageRows = rows.filter((r) => r.village === nearest.village);
  const nowRows = villageRows.filter(
    (r) => r.beginTime && r.endTime && r.beginTime <= now && now <= r.endTime,
  );
  const pool = nowRows.length > 0 ? nowRows : villageRows;
  // 대상 회차 중 가장 위험한 등급(보수적) 채택.
  const worst = pool.reduce((w, r) => {
    const s = indexStatus(r.totalIndex);
    return INDEX_SEVERITY[s] > INDEX_SEVERITY[indexStatus(w.totalIndex)] ? r : w;
  }, pool[0]);

  const status = indexStatus(worst.totalIndex);
  return {
    ...base,
    status,
    detail: `${nearest.village} 갯벌체험지수 '${worst.totalIndex}' (${worst.weather}).`,
    value: worst.totalIndex,
  };
}

export async function evaluateMudflat(station: Station): Promise<Verdict> {
  if (!station.tideObsCode) {
    throw new Error(`${station.name}: 갯벌 판정에 필요한 tideObsCode 가 없습니다.`);
  }

  const [extremes, warnings, mudIndex] = await Promise.all([
    fetchTideExtremes({ obsCode: station.tideObsCode }).catch(
      () => [] as TideExtreme[],
    ),
    fetchWeatherWarnings({ stnId: station.warningStnId }).catch(() => null),
    fetchMudflatIndex().catch(() => null),
  ]);

  const tidePlan = planTide(extremes);
  const signals: Signal[] = [
    {
      key: "tide",
      label: "물때(간조/만조)",
      status: tidePlan.status,
      detail:
        tidePlan.detail +
        (station.tideProxyNote ? ` (${station.tideProxyNote})` : ""),
      source: "국립해양조사원",
    },
  ];

  if (warnings) {
    signals.push(classifyWarnings(warnings, MUDFLAT_WARNING_TYPES));
  } else {
    signals.push({
      key: "warning",
      label: "기상특보",
      status: "점검중",
      detail: "기상특보 데이터를 불러오지 못했습니다.",
      source: "기상청",
    });
  }

  // 갯벌체험지수: data.go.kr 실연동(좌표 최근접 마을).
  signals.push(mudflatIndexSignal(mudIndex, station));

  const status = combineStatus(signals);

  return {
    activity: "mudflat",
    stationId: station.id,
    stationName: station.name,
    status,
    summary: summarize(status),
    signals,
    asOf: nowSeoulISO(),
    timeline:
      extremes.length > 0 ? buildMudflatTimeline(extremes) : undefined,
    tideExtremes: extremes.length > 0 ? toTidePoints(extremes) : undefined,
    advisory: tidePlan.advisory,
  };
}

function summarize(status: string): string {
  switch (status) {
    case "가능":
      return "지금 갯벌체험하기 좋은 물때입니다.";
    case "주의":
      return "곧 물이 들어옵니다. 복귀를 준비하세요.";
    case "불가":
      return "지금은 갯벌이 잠겨 있어 위험합니다.";
    case "점검중":
      return "일부 데이터 점검 중입니다.";
    default:
      return "판정에 필요한 데이터가 부족합니다.";
  }
}
