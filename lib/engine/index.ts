/**
 * 판정 엔진 진입점 — 활동별 라우팅.
 * 지점은 화이트리스트(data/stations.ts)에서만 선택 가능(§9).
 */
import type { Activity, Verdict } from "./types";
import { evaluateSwim } from "./swim";
import { evaluateMudflat } from "./mudflat";
import { getStation } from "../../data/stations";

export * from "./types";

export async function evaluate(
  stationId: string,
  activity: Activity,
): Promise<Verdict> {
  const station = getStation(stationId);
  if (!station) {
    throw new Error(`지원하지 않는 지점입니다: ${stationId}`);
  }
  if (!station.activities.includes(activity)) {
    throw new Error(
      `${station.name}은(는) '${activity}' 활동을 지원하지 않습니다.`,
    );
  }

  switch (activity) {
    case "swim":
      return evaluateSwim(station);
    case "mudflat":
      return evaluateMudflat(station);
    default:
      throw new Error(`알 수 없는 활동: ${activity}`);
  }
}
