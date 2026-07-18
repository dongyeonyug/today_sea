"use client";

/**
 * 시간대별 위험 밴드(데모 장면 3).
 * 오늘 하루를 시간 단위로 나눠 가능(초록)/주의(노랑)/불가(빨강)를 한눈에.
 * - swim: 파고·특보·이안류·해수욕지수 종합 밴드
 * - mudflat: 간조 안전 창 기반 밴드
 * '지금' 위치를 세로선으로 표시.
 */
import type { CSSProperties } from "react";
import type { Activity, Status, TimelineBand } from "@/lib/engine/types";

interface RiskTimelineProps {
  bands: TimelineBand[];
  activity: Activity;
  /** 판정 기준 시각(ISO 로컬 "YYYY-MM-DD HH:mm:ss"). '지금' 마커용. */
  asOf: string;
}

/** 밴드 채움 색(신호등). 판정 3색만 진하게, 그 외는 회색. */
const BAND_FILL: Record<Status, string> = {
  가능: "bg-emerald-400 dark:bg-emerald-500/80",
  주의: "bg-amber-400 dark:bg-amber-500/80",
  불가: "bg-rose-400 dark:bg-rose-500/80",
  데이터없음: "bg-slate-200 dark:bg-slate-700",
  점검중: "bg-slate-200 dark:bg-slate-700",
};

const LEGEND: { status: Status; label: string }[] = [
  { status: "가능", label: "가능" },
  { status: "주의", label: "주의" },
  { status: "불가", label: "불가" },
];

/** "…THH:mm" 또는 "… HH:mm" → 시(hour) 숫자. */
function hourOf(time: string): number {
  const m = time.match(/[T ](\d{2}):/);
  return m ? Number(m[1]) : 0;
}

/** asOf → 자정 기준 분(0~1439). '지금' 위치 계산. */
function nowMinutes(asOf: string): number {
  const m = asOf.match(/[T ](\d{2}):(\d{2})/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export default function RiskTimeline({
  bands,
  activity,
  asOf,
}: RiskTimelineProps) {
  if (bands.length === 0) return null;

  const nowLeft = Math.min(100, Math.max(0, (nowMinutes(asOf) / 1440) * 100));
  const nowHour = Math.floor(nowMinutes(asOf) / 60);
  const current = bands.find((b) => hourOf(b.time) === nowHour) ?? bands[0];
  const timelineSummary = bands
    .map((b) => {
      const wave =
        b.waveHeight != null ? `, 파고 ${b.waveHeight}미터` : "";
      const reason = b.reason ? `, 주된 사유 ${b.reason}` : "";
      return `${hourOf(b.time)}시 ${b.status}${wave}${reason}`;
    })
    .join(", ");
  const title =
    activity === "swim" ? "시간대별 종합 위험도" : "시간대별 위험도";
  const srActivity = activity === "swim" ? "물놀이" : "갯벌체험";

  return (
    <section
      className="sea-panel-enter relative overflow-hidden rounded-2xl border p-5"
      style={
        {
          background: "var(--surface)",
          borderColor: "var(--surface-border)",
          boxShadow: "var(--shadow-card)",
        } as CSSProperties
      }
    >
      <header className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold tracking-tight">
          <span aria-hidden>⏱</span> {title}{" "}
          <span className="font-normal opacity-50">(오늘)</span>
        </h4>
        <ul className="flex items-center gap-3 text-xs opacity-70">
          {LEGEND.map((l) => (
            <li key={l.status} className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${BAND_FILL[l.status]}`}
                aria-hidden
              />
              {l.label}
            </li>
          ))}
        </ul>
      </header>

      {/* 위험 밴드 스트립 */}
      <div className="relative mt-4">
        <div
          className="sea-wipe flex h-10 overflow-hidden rounded-xl shadow-inner ring-1 ring-black/5 dark:ring-white/10"
          role="img"
          aria-label={`${srActivity} ${title}: ${timelineSummary}`}
        >
          {bands.map((b) => (
            <div
              key={b.time}
              className={`flex-1 ${BAND_FILL[b.status]} border-r border-white/40 transition-opacity duration-150 hover:opacity-80 last:border-r-0 motion-reduce:transition-none dark:border-black/20`}
              title={`${hourOf(b.time)}시 · ${b.status}${
                b.waveHeight != null ? ` · 파고 ${b.waveHeight}m` : ""
              }${b.reason ? ` · 주된 사유 ${b.reason}` : ""}`}
            />
          ))}
        </div>

        {/* '지금' 세로 마커 */}
        <div
          className="sea-now-glow pointer-events-none absolute -top-1.5 bottom-0 z-10 flex flex-col items-center"
          style={{ left: `${nowLeft}%`, transform: "translateX(-50%)" }}
        >
          <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md dark:bg-white dark:text-neutral-900">
            지금
          </span>
          <span className="mt-0.5 w-0.5 flex-1 rounded-full bg-gradient-to-b from-neutral-900/80 to-neutral-900/30 dark:from-white/80 dark:to-white/30" />
        </div>
      </div>

      {/* 시각 눈금(3시간 간격) */}
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums opacity-45">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <span key={h}>{h}시</span>
        ))}
      </div>

      {/* 현재 시각 요약 */}
      <p className="mt-3 text-[13px] opacity-70">
        지금 {nowHour}시는{" "}
        <b
          className={
            current.status === "가능"
              ? "text-emerald-600 dark:text-emerald-400"
              : current.status === "주의"
                ? "text-amber-600 dark:text-amber-400"
                : current.status === "불가"
                  ? "text-rose-600 dark:text-rose-400"
                  : "opacity-70"
          }
        >
          {current.status}
        </b>
        {current.waveHeight != null && ` · 파고 ${current.waveHeight}m`}
        {current.reason && current.reason !== "파고" && ` · 주된 사유 ${current.reason}`}
        입니다.
      </p>
      {activity === "swim" && (
        <p className="mt-1 text-xs opacity-50">
          파고에 더해 기상특보·이안류·해수욕지수의 현재 위험 신호를 함께 반영합니다.
        </p>
      )}
    </section>
  );
}
