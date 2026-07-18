/**
 * M1 검증 스크립트 — 각 소스 클라이언트를 실제 호출로 검증한다.
 * 실행: `npm run verify:sources`  (node --env-file=.env --import tsx)
 * 검증 파라미터는 docs/verified-apis.md 에서 200 확인된 값 사용.
 */
import { fetchMarine } from "../lib/sources/openMeteo";
import { fetchTideExtremes } from "../lib/sources/tide";
import { fetchWeatherWarnings } from "../lib/sources/weatherWarning";
import { fetchLifeIndexStations } from "../lib/sources/lifeIndex";
import {
  fetchMudflatIndex,
  fetchRipCurrent,
  fetchBeachIndex,
} from "../lib/sources/oceanIndex";
import { askClaude } from "../lib/claude";

type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: "open-meteo Marine (해운대 파고·수온)",
    run: async () => {
      const m = await fetchMarine({ latitude: 35.158, longitude: 129.16 });
      const n = m.time.length;
      if (n === 0) throw new Error("시간 배열이 비었습니다.");
      const firstWave = m.waveHeight[0];
      const firstTemp = m.seaSurfaceTemperature[0];
      return `${n}시간 · 파고[0]=${firstWave}m · 수온[0]=${firstTemp}°C`;
    },
  },
  {
    name: "조석예보 고저조 (DT_0018 군산)",
    run: async () => {
      const ex = await fetchTideExtremes({ obsCode: "DT_0018" });
      if (ex.length === 0) throw new Error("고저조 항목이 없습니다.");
      const highs = ex.filter((e) => e.type === "high").length;
      const lows = ex.filter((e) => e.type === "low").length;
      return `${ex.length}건 (고조 ${highs} / 저조 ${lows}) · 예: ${ex[0].time} ${ex[0].levelCm}cm ${ex[0].type}`;
    },
  },
  {
    name: "기상특보 (stnId=108 서울)",
    run: async () => {
      const w = await fetchWeatherWarnings({ stnId: 108 });
      // 특보가 없을 수도 있음(정상). 200 응답 + 파싱 성공이면 통과.
      return w.length === 0
        ? "현재 발효 특보 없음 (정상 응답)"
        : `${w.length}건 · 최근: ${w[0].title}`;
    },
  },
  {
    name: "생활해양예보지수 지점목록 (odcloud)",
    run: async () => {
      const s = await fetchLifeIndexStations({ perPage: 20 });
      if (s.length === 0) throw new Error("지점 목록이 비었습니다.");
      const sample = s[0];
      return `${s.length}개 지점 · 예: ${sample.regionName}(${sample.codeDetail}) ${sample.codeName}`;
    },
  },
  {
    name: "갯벌체험지수 (data.go.kr, 실시간 값)",
    run: async () => {
      const rows = await fetchMudflatIndex();
      if (rows.length === 0) throw new Error("지수 데이터가 없습니다.");
      const villages = new Set(rows.map((r) => r.village)).size;
      return `${rows.length}행 · ${villages}개 마을 · 예: ${rows[0].village} '${rows[0].totalIndex}'`;
    },
  },
  {
    name: "해수욕지수 (data.go.kr, 실시간 값)",
    run: async () => {
      const rows = await fetchBeachIndex();
      if (rows.length === 0) throw new Error("해수욕지수 데이터가 없습니다.");
      const beaches = new Set(rows.map((r) => r.beach)).size;
      const hae = rows.find((r) => r.beach.includes("해운대"));
      return `${rows.length}행 · ${beaches}개 해수욕장 · 해운대 '${hae?.totalIndex ?? "?"}'`;
    },
  },
  {
    name: "이안류지수 (data.go.kr, 해운대 HAE)",
    run: async () => {
      const rows = await fetchRipCurrent("HAE");
      if (rows.length === 0) throw new Error("이안류 데이터가 없습니다.");
      const last = rows[rows.length - 1];
      return `${rows.length}행 · ${last.beachName} · 최근 '${last.level}' (${last.observedAt.slice(11)})`;
    },
  },
  {
    name: "Claude API (haiku 응답)",
    run: async () => {
      const text = await askClaude('한 단어로만 답하세요: "바다"의 영어 단어는?', {
        maxTokens: 32,
      });
      if (!text.trim()) throw new Error("빈 응답");
      return `응답: ${text.trim().slice(0, 40)}`;
    },
  },
];

async function main() {
  console.log("\n=== M1 소스 클라이언트 실호출 검증 ===\n");
  let failed = 0;

  for (const c of checks) {
    try {
      const detail = await c.run();
      console.log(`✅ ${c.name}\n   ${detail}\n`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${c.name}\n   ${msg}\n`);
    }
  }

  const total = checks.length;
  console.log(`=== 결과: ${total - failed}/${total} 통과 ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
