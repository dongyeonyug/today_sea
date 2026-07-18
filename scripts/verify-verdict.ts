/**
 * M2 검증 스크립트 — 판정 엔진을 실데이터로 end-to-end 실행.
 * 실행: `npm run verify:verdict`
 * 검증 기준(계획 §9): 화이트리스트의 모든 활동이 실데이터 신호를 빠짐없이 산출.
 */
import { STATIONS } from "../data/stations";
import { evaluate } from "../lib/engine";
import type { Activity, Status, Verdict } from "../lib/engine/types";

const STATUS_MARK: Record<Status, string> = {
  가능: "🟢",
  주의: "🟡",
  불가: "🔴",
  데이터없음: "⚪",
  점검중: "⚪",
};

function printVerdict(v: Verdict) {
  console.log(`\n■ ${v.stationName} (${v.activity}) — [${v.status}] ${v.summary}`);
  console.log(`  기준시각: ${v.asOf}`);
  if (v.advisory) console.log(`  안내: ${v.advisory}`);
  for (const s of v.signals) {
    const val = s.value != null ? ` (${s.value}${s.unit ?? ""})` : "";
    console.log(`   · ${s.label}: [${s.status}]${val} ${s.detail}  — ${s.source}`);
  }
  // M4: 타임라인/조석 곡선 데이터 확인.
  if (v.timeline && v.timeline.length > 0) {
    const strip = v.timeline
      .map((b) => STATUS_MARK[b.status])
      .join("");
    console.log(`  타임라인(${v.timeline.length}구간): ${strip}`);
  } else {
    console.log(`  ⚠ 타임라인 없음`);
  }
  if (v.tideExtremes && v.tideExtremes.length > 0) {
    const marks = v.tideExtremes
      .map((t) => `${t.type === "low" ? "간조" : "만조"} ${t.time.slice(11, 16)}(${t.levelCm}cm)`)
      .join(", ");
    console.log(`  조석: ${marks}`);
  }
}

async function main() {
  console.log("\n=== M2 판정 엔진 실데이터 검증 ===");
  let failed = 0;

  const cases: Array<[string, Activity]> = STATIONS.flatMap((station) =>
    station.activities.map((activity) => [station.id, activity] as [string, Activity]),
  );

  for (const [id, activity] of cases) {
    try {
      const v = await evaluate(id, activity);
      printVerdict(v);
      // 산출 성공 기준: 화이트리스트 지점은 필요한 신호가 모두 실데이터여야 한다.
      if (v.signals.length === 0) throw new Error("신호가 비었습니다.");
      const missing = v.signals.filter((s) =>
        s.status === "데이터없음" || s.status === "점검중",
      );
      if (missing.length > 0) {
        throw new Error(
          `실데이터 미완비 신호: ${missing.map((s) => s.label).join(", ")}`,
        );
      }
      if (!v.timeline || v.timeline.length === 0) {
        throw new Error("타임라인이 비었습니다.");
      }
      if (activity === "mudflat" && (!v.tideExtremes || v.tideExtremes.length === 0)) {
        throw new Error("갯벌 조석 마커가 비었습니다.");
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n❌ ${id}/${activity}: ${msg}`);
    }
  }

  console.log(`\n=== 결과: ${cases.length - failed}/${cases.length} verdict 산출 ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
