/**
 * M5 검증 스크립트 — 챗봇 안전 프롬프트 가드 확인.
 * 실행: `npm run verify:chat`
 */
import { buildSystemPrompt, isValidVerdict } from "../lib/chat/prompt";
import { POST } from "../app/api/chat/route";
import type { Verdict } from "../lib/engine/types";

const blockedVerdict: Verdict = {
  activity: "mudflat",
  stationId: "jebudo",
  stationName: "제부도",
  status: "불가",
  summary: "공식 갯벌 지수가 매우나쁨이라 갯벌체험은 불가합니다.",
  asOf: "2026-07-18 12:00:00",
  advisory: "현장 안전요원 안내를 우선 확인하세요.",
  signals: [
    {
      key: "mudflat-index",
      label: "갯벌체험지수",
      status: "불가",
      detail: "매우나쁨 단계라 초보자는 들어가지 않는 것이 안전합니다.",
      value: "매우나쁨",
      source: "국립해양조사원",
    },
    {
      key: "tide-window",
      label: "물때",
      status: "주의",
      detail: "복귀 시간을 넉넉히 잡아야 합니다.",
      value: "13:20",
      unit: " 간조",
      source: "국립해양조사원",
    },
  ],
  timeline: [
    { time: "2026-07-18T12:00", status: "불가" },
    { time: "2026-07-18T13:00", status: "주의" },
  ],
  tideExtremes: [
    { time: "2026-07-18 13:20", levelCm: 84, type: "low" },
    { time: "2026-07-18 19:30", levelCm: 812, type: "high" },
  ],
};

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const prompt = buildSystemPrompt(blockedVerdict);

  assert(isValidVerdict(blockedVerdict), "샘플 Verdict 검증 실패");
  assert(
    !isValidVerdict({ ...blockedVerdict, signals: [null] }),
    "깨진 signal 을 거부하지 못함",
  );
  assert(prompt.includes("종합 판정: 불가"), "불가 판정이 프롬프트에 없음");
  assert(
    prompt.includes("어떤 경우에도 안전하다거나 가능하다고 답하지 말 것"),
    "불가 hard-stop 문구가 없음",
  );
  assert(prompt.includes("갯벌체험지수"), "근거 신호가 프롬프트에 없음");
  assert(prompt.includes("시간대별 판정 요약"), "타임라인 요약이 없음");
  assert(prompt.includes("물때 마커"), "물때 요약이 없음");
  assert(prompt.includes("출처: 국립해양조사원"), "출처가 프롬프트에 없음");

  const badResponse = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict: { ...blockedVerdict, signals: [null] },
        messages: [{ role: "user", content: "그냥 들어가도 돼?" }],
      }),
    }),
  );
  assert(badResponse.status === 400, "깨진 verdict 요청이 400을 반환하지 않음");

  console.log("✅ M5 chat prompt guard 검증 통과");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
