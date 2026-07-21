/**
 * 물놀이·수영 판정 규칙(§5).
 * 신호: 파고(open-meteo) · 수온(open-meteo) · 기상특보 · 이안류(미연동 시 데이터없음).
 * 파고 0.5/1.0m는 공식 표준 유래가 아니라 의도적 보수 선택(공식 풍랑주의보 3m보다
 * 훨씬 엄격). 이안류 매핑은 공식 4단계 지수와 정렬됨 — 근거·대조 결과·한계는
 * docs/adr/0001-swim-wave-thresholds.md (Accepted). 임계값을 바꾸면 ADR도 함께 갱신.
 */
import type { Signal, Status, TimelineBand, Verdict } from "./types";
import { RANKED, combineStatus, nowSeoulISO } from "./types";
import type { MarineHourly } from "../sources/openMeteo";
import { classifyWarnings, SWIM_WARNING_TYPES } from "./warnings";
import type { Station } from "../../data/stations";
import { fetchMarine } from "../sources/openMeteo";
import { fetchWeatherWarnings } from "../sources/weatherWarning";
import {
  fetchRipCurrent,
  fetchBeachIndex,
  nearestByCoord,
  type RipCurrentRow,
  type BeachIndexRow,
} from "../sources/oceanIndex";

/** open-meteo hourly 배열에서 현재 시각(Asia/Seoul)에 가장 가까운 인덱스. */
export function currentHourIndex(times: string[]): number {
  if (times.length === 0) return -1;
  // open-meteo time 은 "YYYY-MM-DDTHH:mm" (timezone=Asia/Seoul 기준 로컬).
  const nowHour = nowSeoulISO().slice(0, 13); // "YYYY-MM-DD HH"
  const nowKey = nowHour.replace(" ", "T");
  const exact = times.findIndex((t) => t.slice(0, 13) === nowKey);
  if (exact >= 0) return exact;
  // 정확히 못 찾으면 첫 항목.
  return 0;
}

/** 파고(m) → 판정 등급. 임계값은 초안(§10). null 이면 점검중. */
export function waveStatus(waveHeight: number | null): Status {
  if (waveHeight == null) return "점검중";
  return waveHeight < 0.5 ? "가능" : waveHeight <= 1.0 ? "주의" : "불가";
}

const TIMELINE_SEVERITY: Record<Status, number> = {
  가능: 0,
  주의: 1,
  불가: 2,
  데이터없음: -1,
  점검중: -1,
};

function worstTimelineCause(
  current: { status: Status; reason: string },
  next: { status: Status; reason: string },
) {
  return TIMELINE_SEVERITY[next.status] > TIMELINE_SEVERITY[current.status]
    ? next
    : current;
}

/**
 * 시간대별 종합 위험 밴드(오늘 24시간).
 * 파고는 시간별 값을 쓰고, 특보·이안류·해수욕지수는 현재 확인된 위험 신호를
 * 오늘 타임라인 전체에 보수적으로 반영한다.
 */
export function buildSwimTimeline(
  marine: MarineHourly,
  signals: Signal[] = [],
): TimelineBand[] {
  const overlayKeys = new Set(["warning", "rip", "beach"]);
  const overlaySignals = signals.filter(
    (s) => overlayKeys.has(s.key) && RANKED.includes(s.status),
  );

  return marine.time.map((time, i) => {
    const wh = marine.waveHeight[i] ?? null;
    const wave = {
      status: waveStatus(wh),
      reason: "파고",
    };
    const cause = overlaySignals.reduce(
      (worst, signal) =>
        worstTimelineCause(worst, {
          status: signal.status,
          reason: signal.label,
        }),
      wave,
    );

    return {
      time,
      status: cause.status,
      waveHeight: wh,
      reason: cause.reason,
    };
  });
}

function waveSignal(waveHeight: number | null): Signal {
  if (waveHeight == null) {
    return {
      key: "wave",
      label: "파고",
      status: "점검중",
      detail: "파고 데이터를 불러오지 못했습니다.",
      source: "open-meteo",
    };
  }
  const status = waveStatus(waveHeight);
  const detail =
    status === "가능"
      ? `파고 ${waveHeight}m — 잔잔합니다.`
      : status === "주의"
        ? `파고 ${waveHeight}m — 다소 높습니다. 얕은 곳에서만.`
        : `파고 ${waveHeight}m — 높습니다. 입수 위험.`;
  return {
    key: "wave",
    label: "파고",
    status,
    detail,
    value: waveHeight,
    unit: "m",
    source: "open-meteo",
  };
}

function tempSignal(temp: number | null): Signal {
  if (temp == null) {
    return {
      key: "temp",
      label: "수온",
      status: "데이터없음",
      detail: "수온 데이터가 없습니다.",
      source: "open-meteo",
    };
  }
  // 20°C 미만이면 저체온 주의. 그 이상은 판정 상향 요인 아님(가능).
  const status = temp < 20 ? "주의" : "가능";
  const detail =
    status === "주의"
      ? `수온 ${temp}°C — 다소 차갑습니다. 저체온에 유의하세요.`
      : `수온 ${temp}°C — 물놀이에 적당합니다.`;
  return {
    key: "temp",
    label: "수온",
    status,
    detail,
    value: temp,
    unit: "°C",
    source: "open-meteo",
  };
}

/** 이안류 단계(안전/관심/주의/경계/위험) → 판정. */
function ripLevelStatus(level: string): Signal["status"] {
  if (/위험/.test(level)) return "불가";
  if (/주의|경계/.test(level)) return "주의";
  if (/안전|관심/.test(level)) return "가능";
  return "데이터없음";
}

/** 현재 시각 이전의 가장 최근 관측을 선택. */
function latestRip(rows: RipCurrentRow[]): RipCurrentRow | undefined {
  if (rows.length === 0) return undefined;
  const nowKey = nowSeoulISO().slice(0, 16); // "YYYY-MM-DD HH:mm"
  const past = rows.filter((r) => r.observedAt <= nowKey);
  const pool = past.length > 0 ? past : rows;
  return pool.reduce((a, b) => (b.observedAt > a.observedAt ? b : a));
}

function ripCurrentSignal(row: RipCurrentRow | undefined): Signal {
  if (!row || !row.level) {
    return {
      key: "rip",
      label: "이안류",
      status: "데이터없음",
      detail: "이안류 정보가 제공되지 않는 지점입니다.",
      source: "국립해양조사원",
    };
  }
  const status = ripLevelStatus(row.level);
  const time = row.observedAt.slice(11, 16);
  const detail =
    status === "불가"
      ? `이안류 '위험' (${time} 관측). 입수하지 마세요.`
    : status === "주의"
        ? `이안류 '${row.level}' (${time} 관측). 깊은 곳·이안류 표지판 유의.`
        : `이안류 '${row.level}' (${time} 관측). 양호합니다.`;
  return {
    key: "rip",
    label: "이안류",
    status,
    detail,
    value: row.level,
    source: "국립해양조사원",
  };
}

/** 해수욕지수 등급 → 판정(보수적). */
function beachLevelStatus(totalIndex: string): Signal["status"] {
  if (/매우나쁨|불가/.test(totalIndex)) return "불가";
  if (/나쁨/.test(totalIndex)) return "주의";
  if (/좋음|보통/.test(totalIndex)) return "가능";
  return "데이터없음";
}

function beachIndexSignal(
  rows: BeachIndexRow[] | null,
  station: Station,
): Signal {
  const base = { key: "beach", label: "해수욕지수", source: "국립해양조사원" } as const;
  if (rows === null) {
    return { ...base, status: "데이터없음", detail: "해수욕지수 데이터를 불러오지 못했습니다." };
  }
  const nearest = nearestByCoord(rows, station.lat, station.lon);
  if (!nearest) {
    return { ...base, status: "데이터없음", detail: "인근 해수욕장 지수 데이터가 없습니다." };
  }
  // 현재 시각의 오전/오후 회차 선택.
  const noon = Number(nowSeoulISO().slice(11, 13)) < 12 ? "오전" : "오후";
  const row =
    rows.find((r) => r.beach === nearest.beach && r.noon === noon) ?? nearest;
  const status = beachLevelStatus(row.totalIndex);
  const closed = /폐장/.test(row.openStatus);
  return {
    ...base,
    status: closed && status === "가능" ? "주의" : status,
    detail: `${row.beach} 해수욕지수 '${row.totalIndex}' (${row.noon}${
      row.openStatus ? `, ${row.openStatus}` : ""
    }).`,
    value: row.totalIndex,
  };
}

export async function evaluateSwim(station: Station): Promise<Verdict> {
  const [marine, warnings, rip, beach] = await Promise.all([
    fetchMarine({ latitude: station.lat, longitude: station.lon }).catch(
      () => null,
    ),
    fetchWeatherWarnings({ stnId: station.warningStnId }).catch(() => null),
    station.beachCode
      ? fetchRipCurrent(station.beachCode).catch(() => null)
      : Promise.resolve(null),
    fetchBeachIndex().catch(() => null),
  ]);

  const signals: Signal[] = [];

  if (marine && marine.time.length > 0) {
    const i = currentHourIndex(marine.time);
    signals.push(waveSignal(marine.waveHeight[i] ?? null));
    signals.push(tempSignal(marine.seaSurfaceTemperature[i] ?? null));
  } else {
    signals.push(waveSignal(null));
    signals.push(tempSignal(null));
  }

  if (warnings) {
    signals.push(classifyWarnings(warnings, SWIM_WARNING_TYPES));
  } else {
    signals.push({
      key: "warning",
      label: "기상특보",
      status: "점검중",
      detail: "기상특보 데이터를 불러오지 못했습니다.",
      source: "기상청",
    });
  }

  signals.push(ripCurrentSignal(rip ? latestRip(rip) : undefined));
  signals.push(beachIndexSignal(beach, station));

  const status = combineStatus(signals);
  const summary = summarize(status);

  return {
    activity: "swim",
    stationId: station.id,
    stationName: station.name,
    status,
    summary,
    signals,
    asOf: nowSeoulISO(),
    timeline:
      marine && marine.time.length > 0
        ? buildSwimTimeline(marine, signals)
        : undefined,
  };
}

function summarize(status: string): string {
  switch (status) {
    case "가능":
      return "지금 물놀이하기 좋은 조건입니다.";
    case "주의":
      return "물놀이 가능하나 주의가 필요합니다.";
    case "불가":
      return "지금은 물놀이를 피하세요.";
    case "점검중":
      return "일부 데이터 점검 중입니다.";
    default:
      return "판정에 필요한 데이터가 부족합니다.";
  }
}
