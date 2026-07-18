/**
 * 판정 엔진 공용 타입.
 * 원칙(§9): 데이터가 없으면 조작하지 않고 "unknown"으로 표기하고,
 * 판정에서 제외한다. API 일시 장애만 "점검 중(maintenance)"으로 처리.
 */

export type Activity = "swim" | "mudflat";

/** 신호등 상태 + 데이터 부재/점검 상태. */
export type Status = "가능" | "주의" | "불가" | "데이터없음" | "점검중";

/** 판정에 실제 반영되는 상태(신호등 3색)만. */
export const RANKED: Status[] = ["가능", "주의", "불가"];

/** 개별 근거 신호(파고·수온·특보·이안류·지수·조석 등). */
export interface Signal {
  /** 안정적 식별자(예: "wave", "warning"). */
  key: string;
  /** 사용자 표시 라벨(예: "파고"). */
  label: string;
  status: Status;
  /** 근거 문장(초보자 눈높이). */
  detail: string;
  /** 원시 수치(있으면). 예: 0.36 / "05:54". */
  value?: string | number;
  /** 단위(있으면). 예: "m", "°C". */
  unit?: string;
  /** 출처(예: "open-meteo", "기상청", "국립해양조사원"). */
  source: string;
}

/** 타임라인 한 구간(시간대별 위험 밴드) — M4. */
export interface TimelineBand {
  /** 시각(ISO 로컬 "YYYY-MM-DDTHH:mm", Asia/Seoul). */
  time: string;
  status: Status;
  /** 해당 시각의 파고(swim 타임라인). */
  waveHeight?: number | null;
  /** 해당 시간대 등급을 끌어올린 주된 사유(예: 해수욕지수, 이안류). */
  reason?: string;
}

/** 조석 곡선 마커(간조/만조) — TideStrip 렌더용. */
export interface TidePoint {
  /** 원문 예측시각(예: "2026-07-18 05:54"). */
  time: string;
  /** 조위(cm). */
  levelCm: number;
  /** 고조(만조) / 저조(간조). */
  type: "high" | "low";
}

export interface Verdict {
  activity: Activity;
  stationId: string;
  stationName: string;
  /** 종합 판정: 반영 가능한 신호 중 가장 위험한 등급(보수적). */
  status: Status;
  /** 한 줄 요약(배지 옆 문구). */
  summary: string;
  /** 근거 신호 목록. */
  signals: Signal[];
  /** 판정 기준 시각(ISO, Asia/Seoul). */
  asOf: string;
  /** 시간대별 밴드(선택, M4). */
  timeline?: TimelineBand[];
  /** 갯벌 전용: 오늘의 간조/만조 마커(TideStrip 렌더용, M4). */
  tideExtremes?: TidePoint[];
  /** 갯벌 전용: "○○시까지 복귀" 등 안전 창 안내. */
  advisory?: string;
}

const SEVERITY: Record<Status, number> = {
  가능: 0,
  주의: 1,
  불가: 2,
  데이터없음: -1,
  점검중: -1,
};

/**
 * 반영 가능한(신호등 3색) 신호들 중 가장 위험한 등급을 종합 판정으로.
 * 3색 신호가 하나도 없으면 데이터없음/점검중 상태를 그대로 승계.
 */
export function combineStatus(signals: Signal[]): Status {
  const ranked = signals.filter((s) => RANKED.includes(s.status));
  if (ranked.length === 0) {
    // 점검중이 하나라도 있으면 점검중, 아니면 데이터없음.
    return signals.some((s) => s.status === "점검중") ? "점검중" : "데이터없음";
  }
  return ranked.reduce(
    (worst, s) => (SEVERITY[s.status] > SEVERITY[worst] ? s.status : worst),
    "가능" as Status,
  );
}

export function nowSeoulISO(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
}
