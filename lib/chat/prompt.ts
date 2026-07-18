/**
 * M5 챗봇 시스템 프롬프트 — Verdict 를 유일한 근거로 답하게 고정한다.
 */
import type { Status, Verdict } from "@/lib/engine/types";
import { ACTIVITY_LABEL } from "@/lib/ui/activity";

const VALID_STATUSES: Status[] = ["가능", "주의", "불가", "데이터없음", "점검중"];

export function isValidVerdict(value: unknown): value is Verdict {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Verdict>;
  return (
    (v.activity === "swim" || v.activity === "mudflat") &&
    typeof v.stationId === "string" &&
    typeof v.stationName === "string" &&
    typeof v.summary === "string" &&
    typeof v.asOf === "string" &&
    typeof v.status === "string" &&
    VALID_STATUSES.includes(v.status as Status) &&
    Array.isArray(v.signals) &&
    v.signals.every(isValidSignal) &&
    (v.timeline === undefined ||
      (Array.isArray(v.timeline) && v.timeline.every(isValidTimelineBand))) &&
    (v.tideExtremes === undefined ||
      (Array.isArray(v.tideExtremes) && v.tideExtremes.every(isValidTidePoint))) &&
    (v.advisory === undefined || typeof v.advisory === "string")
  );
}

export function buildSystemPrompt(v: Verdict): string {
  const signalLines = v.signals.length
    ? v.signals.map(formatSignal).join("\n")
    : "- 제공된 근거 신호가 없음. 단정하지 말고 확인 불가로 안내.";
  const timeline = summarizeTimeline(v);
  const tide = summarizeTides(v);
  const hardStop =
    v.status === "불가"
      ? "\n\n[중요] 종합 판정이 '불가'다. 어떤 경우에도 안전하다거나 가능하다고 답하지 말 것. 위험을 축소하지 말 것."
      : "";

  return [
    "너는 '오늘의 바다'의 해양안전 어시스턴트다. 아래 실데이터 판정을 근거로만 답한다.",
    "규칙: (1) 판정을 뒤집지 말 것. (2) 데이터없음/점검중 항목은 단정하지 말 것. (3) 초보자 눈높이로 짧고 실천적으로 답할 것. (4) 대응법과 현장 확인사항을 포함할 것. (5) 답에 출처를 밝힐 것. (6) 한국어로 답할 것.",
    `장소: ${v.stationName} / 활동: ${ACTIVITY_LABEL[v.activity]} / 기준시각: ${v.asOf}`,
    `종합 판정: ${v.status} — ${v.summary}`,
    v.advisory ? `안내: ${v.advisory}` : "",
    "근거 신호:",
    signalLines,
    timeline,
    tide,
    hardStop,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSignal(signal: Verdict["signals"][number]) {
  const value = signal.value != null ? ` ${signal.value}${signal.unit ?? ""}` : "";
  return `- ${signal.label}: [${signal.status}]${value} - ${signal.detail} (출처: ${signal.source})`;
}

function isValidSignal(value: unknown): value is Verdict["signals"][number] {
  if (!value || typeof value !== "object") return false;
  const signal = value as Partial<Verdict["signals"][number]>;
  return (
    typeof signal.key === "string" &&
    typeof signal.label === "string" &&
    typeof signal.status === "string" &&
    VALID_STATUSES.includes(signal.status as Status) &&
    typeof signal.detail === "string" &&
    typeof signal.source === "string" &&
    (signal.value === undefined ||
      typeof signal.value === "string" ||
      typeof signal.value === "number") &&
    (signal.unit === undefined || typeof signal.unit === "string")
  );
}

function isValidTimelineBand(
  value: unknown,
): value is NonNullable<Verdict["timeline"]>[number] {
  if (!value || typeof value !== "object") return false;
  const band = value as Partial<NonNullable<Verdict["timeline"]>[number]>;
  return (
    typeof band.time === "string" &&
    typeof band.status === "string" &&
    VALID_STATUSES.includes(band.status as Status) &&
    (band.waveHeight === undefined ||
      band.waveHeight === null ||
      typeof band.waveHeight === "number") &&
    (band.reason === undefined || typeof band.reason === "string")
  );
}

function isValidTidePoint(
  value: unknown,
): value is NonNullable<Verdict["tideExtremes"]>[number] {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<NonNullable<Verdict["tideExtremes"]>[number]>;
  return (
    typeof point.time === "string" &&
    typeof point.levelCm === "number" &&
    (point.type === "high" || point.type === "low")
  );
}

function summarizeTimeline(v: Verdict) {
  if (!v.timeline || v.timeline.length === 0) return "";

  const counts = v.timeline.reduce(
    (acc, band) => {
      acc[band.status] = (acc[band.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<Status, number>>,
  );
  const firstBands = v.timeline
    .slice(0, 8)
    .map((band) => {
      const wave =
        band.waveHeight != null ? `, 파고 ${band.waveHeight.toFixed(2)}m` : "";
      const reason = band.reason ? `, 사유 ${band.reason}` : "";
      return `${band.time.slice(11, 16)} [${band.status}]${wave}${reason}`;
    })
    .join(" / ");

  return [
    "시간대별 판정 요약:",
    `- 구간 수: ${v.timeline.length}개 (가능 ${counts["가능"] ?? 0}, 주의 ${counts["주의"] ?? 0}, 불가 ${counts["불가"] ?? 0}, 확인불가 ${(counts["데이터없음"] ?? 0) + (counts["점검중"] ?? 0)})`,
    `- 앞 구간: ${firstBands}`,
  ].join("\n");
}

function summarizeTides(v: Verdict) {
  if (!v.tideExtremes || v.tideExtremes.length === 0) return "";

  const tideLines = v.tideExtremes
    .map((point) => {
      const type = point.type === "low" ? "간조" : "만조";
      return `${type} ${point.time.slice(11, 16)} (${point.levelCm}cm)`;
    })
    .join(" / ");

  return ["물때 마커:", `- ${tideLines}`].join("\n");
}
