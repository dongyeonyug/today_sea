/**
 * 판정 상태 → 시각 토큰. 신호등 semantic 색(가능/주의/불가)과
 * 브랜드 액센트(틸)를 분리(§7). 다크/라이트 모두 대응.
 */
import type { Status } from "../engine/types";

export interface StatusUi {
  label: string;
  /** 배지 배경/텍스트(라이트+다크). */
  chip: string;
  /** 신호등 점 색. */
  dot: string;
  /** 신호등 점 색(solid, 인라인 배경/스파인용 raw 값). */
  solid: string;
  /** 카드 좌측 강조선/링. */
  accent: string;
  /** 카드 상단 은은한 상태 워시(인라인 gradient color). */
  glow: string;
  emoji: string;
}

export const STATUS_UI: Record<Status, StatusUi> = {
  가능: {
    label: "가능",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    solid: "rgb(16 185 129)",
    accent: "border-emerald-500",
    glow: "rgba(16, 185, 129, 0.13)",
    emoji: "🟢",
  },
  주의: {
    label: "주의",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    solid: "rgb(245 158 11)",
    accent: "border-amber-500",
    glow: "rgba(245, 158, 11, 0.14)",
    emoji: "🟡",
  },
  불가: {
    label: "불가",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    solid: "rgb(244 63 94)",
    accent: "border-rose-500",
    glow: "rgba(244, 63, 94, 0.14)",
    emoji: "🔴",
  },
  데이터없음: {
    label: "데이터 없음",
    chip: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    dot: "bg-slate-400",
    solid: "rgb(148 163 184)",
    accent: "border-slate-300 dark:border-slate-700",
    glow: "rgba(148, 163, 184, 0.08)",
    emoji: "⚪",
  },
  점검중: {
    label: "점검 중",
    chip: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    dot: "bg-slate-400",
    solid: "rgb(148 163 184)",
    accent: "border-slate-300 dark:border-slate-700",
    glow: "rgba(148, 163, 184, 0.08)",
    emoji: "🛠️",
  },
};

export function statusUi(status: Status): StatusUi {
  return STATUS_UI[status] ?? STATUS_UI["데이터없음"];
}
