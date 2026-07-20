import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.x는 아직 flat config를 직접 내보내지 않아 FlatCompat으로 변환한다.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    // 빌드 산출물과 vendoring된 스킬/세션 디렉터리는 검사 대상이 아니다.
    ignores: [
      ".next/**",
      "node_modules/**",
      ".vendor/**",
      ".vercel/**",
      ".omc/**",
      ".agents/**",
      ".claude/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
