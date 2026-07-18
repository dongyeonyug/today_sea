/**
 * 판정 엔진 API — 장소·활동 → Verdict(서버 전용).
 * 모든 외부 호출(공공API·키)은 이 서버 라우트 안에서만 일어난다(§4 키 보호).
 * GET /api/verdict?station=haeundae&activity=swim
 */
import { NextResponse } from "next/server";
import { evaluate } from "@/lib/engine";
import type { Activity } from "@/lib/engine/types";

const ACTIVITIES: Activity[] = ["swim", "mudflat"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const station = searchParams.get("station");
  const activity = searchParams.get("activity");

  if (!station || !activity) {
    return NextResponse.json(
      { error: "station 과 activity 파라미터가 필요합니다." },
      { status: 400 },
    );
  }
  if (!ACTIVITIES.includes(activity as Activity)) {
    return NextResponse.json(
      { error: `지원하지 않는 활동입니다: ${activity}` },
      { status: 400 },
    );
  }

  try {
    const verdict = await evaluate(station, activity as Activity);
    return NextResponse.json(verdict);
  } catch (err) {
    const message = err instanceof Error ? err.message : "판정 중 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
