/**
 * 기상특보 텍스트 → 판정 신호 변환.
 * getWthrWrnList 는 발표 내역(발효·해제 혼재)을 주므로,
 * 특보종류별 "가장 최근 상태"만 남겨 현재 발효 중인 것만 판정에 반영한다.
 */
import type { Signal, Status } from "./types";
import type { WeatherWarning } from "../sources/weatherWarning";

/** 활동별 관련 특보 종류. */
export const SWIM_WARNING_TYPES = [
  "풍랑",
  "강풍",
  "호우",
  "태풍",
  "폭풍해일",
  "해일",
] as const;

export const MUDFLAT_WARNING_TYPES = [
  "호우",
  "강풍",
  "태풍",
  "폭풍해일",
  "해일",
  "대설",
] as const;

const ALL_TYPES = [
  "풍랑",
  "강풍",
  "호우",
  "태풍",
  "폭풍해일",
  "해일",
  "대설",
  "건조",
  "폭염",
  "한파",
];

interface ParsedWarning {
  type: string;
  level: "경보" | "주의보" | null;
  resolved: boolean;
  announcedAt: string;
}

function parse(w: WeatherWarning): ParsedWarning | null {
  const t = w.title ?? "";
  const type = ALL_TYPES.find((x) => t.includes(x));
  if (!type) return null;
  const resolved = t.includes("해제");
  const level = /경보/.test(t) ? "경보" : /주의보/.test(t) ? "주의보" : null;
  return { type, level, resolved, announcedAt: w.announcedAt ?? "" };
}

/**
 * 현재 발효 중인 관련 특보를 종합해 하나의 신호로.
 * 경보 발효 → 불가, 주의보 발효 → 주의, 없음 → 가능.
 */
export function classifyWarnings(
  warnings: WeatherWarning[],
  relevantTypes: readonly string[],
): Signal {
  const parsed = warnings
    .map(parse)
    .filter((p): p is ParsedWarning => p !== null && relevantTypes.includes(p.type));

  // 종류별 최신 상태만 유지(announcedAt 문자열 내림차순).
  const latestByType = new Map<string, ParsedWarning>();
  for (const p of parsed) {
    const prev = latestByType.get(p.type);
    if (!prev || p.announcedAt > prev.announcedAt) latestByType.set(p.type, p);
  }

  const active = [...latestByType.values()].filter((p) => !p.resolved && p.level);

  let status: Status = "가능";
  let detail = "발효 중인 관련 기상특보가 없습니다.";

  if (active.length > 0) {
    const hasAlert = active.some((p) => p.level === "경보");
    status = hasAlert ? "불가" : "주의";
    const names = active.map((p) => `${p.type}${p.level}`).join(", ");
    detail = hasAlert
      ? `기상특보 발효 중: ${names}. 해상 활동을 삼가세요.`
      : `기상특보 발효 중: ${names}. 주의가 필요합니다.`;
  }

  return {
    key: "warning",
    label: "기상특보",
    status,
    detail,
    source: "기상청",
  };
}
