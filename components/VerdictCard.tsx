"use client";

import type { CSSProperties } from "react";
import type { Verdict } from "@/lib/engine/types";
import { statusUi } from "@/lib/ui/status";
import { ACTIVITY_EMOJI, ACTIVITY_LABEL } from "@/lib/ui/activity";

interface VerdictCardProps {
  verdict: Verdict;
  onAskChat?: (verdict: Verdict) => void;
  /** stagger 진입 지연(ms). */
  enterDelay?: number;
}

export default function VerdictCard({
  verdict,
  onAskChat,
  enterDelay = 0,
}: VerdictCardProps) {
  const ui = statusUi(verdict.status);
  const asOfTime = verdict.asOf.slice(11, 16); // HH:mm
  const sources = [...new Set(verdict.signals.map((s) => s.source))];

  return (
    <article
      className="sea-panel-enter sea-lift relative overflow-hidden rounded-2xl border p-5 pl-6"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--surface-border)",
          boxShadow: "var(--shadow-card)",
          "--enter-delay": `${enterDelay}ms`,
        } as CSSProperties
      }
    >
      {/* 상태 스파인 */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: ui.solid }}
      />
      {/* 상태 워시(상단 은은한 색) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{
          background: `radial-gradient(120% 100% at 100% 0%, ${ui.glow}, transparent 70%)`,
        }}
      />

      <header className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-medium opacity-55">
            <span aria-hidden>{ACTIVITY_EMOJI[verdict.activity]}</span>
            <span>{ACTIVITY_LABEL[verdict.activity]}</span>
          </div>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">
            {verdict.stationName}
          </h3>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${ui.chip}`}
        >
          <span className={`h-2 w-2 rounded-full ${ui.dot}`} aria-hidden />
          {ui.label}
        </span>
      </header>

      <p className="relative mt-3 text-[15px] leading-relaxed opacity-90">
        {verdict.summary}
      </p>

      {verdict.advisory && (
        <p className="relative mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <span aria-hidden className="mt-px">⏱</span>
          <span>{verdict.advisory}</span>
        </p>
      )}

      <ul className="relative mt-4 flex flex-col divide-y divide-black/[0.04] overflow-hidden rounded-xl border border-black/[0.05] bg-black/[0.015] dark:divide-white/5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        {verdict.signals.map((s) => {
          const sui = statusUi(s.status);
          return (
            <li
              key={s.key}
              className="flex items-start gap-2.5 px-3.5 py-2.5 text-sm"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sui.dot}`}
                aria-hidden
              />
              <span className="flex-1">
                <span className="font-medium">{s.label}</span>
                {s.value != null && (
                  <span className="tabular-nums opacity-70">
                    {" "}
                    {s.value}
                    {s.unit ?? ""}
                  </span>
                )}
                <span className="opacity-60"> — {s.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <footer className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3.5 text-xs dark:border-white/10">
        <span className="opacity-55">
          <span className="tabular-nums">{asOfTime}</span> 기준 · 출처{" "}
          {sources.join(", ")}
        </span>
        {onAskChat && (
          <button
            type="button"
            onClick={() => onAskChat(verdict)}
            className="sea-focus sea-press inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 font-medium text-white shadow-sm shadow-teal-600/20 hover:bg-teal-500"
          >
            <span aria-hidden>💬</span> 챗봇에게 묻기
          </button>
        )}
      </footer>
    </article>
  );
}
