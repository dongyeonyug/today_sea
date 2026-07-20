/**
 * 문서 링크 검증 스크립트 — 마크다운의 로컬 경로가 실제로 존재하는지 확인.
 * 실행: `npm run verify:links` (외부 API·시크릿 불필요 → CI 게이트로 사용)
 *
 * 문서가 코드보다 먼저 낡는 것을 막는 자동 게이트. CLAUDE.md 계열이
 * 없는 파일을 가리키기 시작하면 에이전트가 조용히 헛짚는다.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/** 검사 대상: 루트 마크다운 + docs/ 이하 전체 마크다운. */
function targetFiles(): string[] {
  const rootDocs = ["CLAUDE.md", "CLAUDE.ko.md", "README.md"]
    .map((f) => join(ROOT, f))
    .filter(existsSync);
  return [...rootDocs, ...walkMarkdown(join(ROOT, "docs"))];
}

function walkMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMarkdown(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

/**
 * 링크 대상이 검사 대상인지 판단.
 * 외부 URL·앵커·mailto 는 이 스크립트의 책임 밖이다.
 */
function isLocalPath(target: string): boolean {
  if (!target) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false; // http:, https:, mailto: 등
  if (target.startsWith("#")) return false;
  return true;
}

type Broken = { file: string; line: number; text: string; target: string };

/**
 * [text](target) 링크.
 * 링크 텍스트 자체에 대괄호가 들어가는 경우(`[app/place/[id]/page.tsx](...)`)가
 * 실제로 있으므로 한 단계 중첩까지 허용한다. 이걸 놓치면 링크가 조용히
 * 검사 대상에서 빠져 게이트가 통과하는 것처럼 보인다.
 */
const LINK_RE = /\[(?:[^[\]]|\[[^[\]]*\])*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

let checked = 0;

function checkFile(file: string): Broken[] {
  const broken: Broken[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  const base = dirname(file);
  let inFence = false;

  lines.forEach((line, i) => {
    // 코드 펜스 안의 예시 경로는 링크가 아니므로 건너뛴다.
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    // `app/place/[id]/page.tsx` 같은 경로가 오탐 나지 않도록
    // glob 해석은 하지 않고 링크 URL을 그대로 fs 경로로 취급한다.
    for (const m of line.matchAll(LINK_RE)) {
      const raw = m[1];
      if (!isLocalPath(raw)) continue;
      checked++;

      const target = raw.split("#")[0]; // 파일 뒤 앵커 제거
      if (!target) continue;

      const abs = normalize(join(base, decodeURIComponent(target)));
      // 디렉터리 링크(`lib/sources/`)도 유효로 인정한다.
      if (!existsSync(abs)) {
        broken.push({ file, line: i + 1, text: m[0], target: raw });
      } else if (target.endsWith("/") && !statSync(abs).isDirectory()) {
        broken.push({ file, line: i + 1, text: m[0], target: raw });
      }
    }
  });

  return broken;
}

const files = targetFiles();
const broken = files.flatMap(checkFile);
const rel = (p: string) => p.replace(`${ROOT}/`, "");

if (broken.length > 0) {
  console.error(`❌ 존재하지 않는 경로를 가리키는 링크 ${broken.length}건:\n`);
  for (const b of broken) {
    console.error(`  ${rel(b.file)}:${b.line}  ${b.text}`);
    console.error(`    → ${b.target} 를 찾을 수 없음`);
  }
  console.error("\n파일을 옮겼다면 문서의 링크도 함께 고치세요.");
  process.exit(1);
}

// 검사한 링크 수를 함께 출력한다. 이 숫자가 갑자기 줄면 파서가 링크를
// 놓치고 있다는 뜻이므로, 통과 여부만큼이나 볼 만한 값이다.
console.log(
  `✅ 문서 링크 검증 통과 — 문서 ${files.length}개, 로컬 링크 ${checked}개 확인, 깨진 경로 0건`,
);
