"use client";

/**
 * 조석 곡선(간조/만조) — 갯벌체험 상세용(데모 장면 3).
 * 고저조 마커를 코사인 보간으로 이어 하루 물때 곡선을 그린다.
 * 간조(저점)에서 갯벌이 드러나고, '지금' 위치를 세로선으로 표시.
 */
import type { CSSProperties } from "react";
import type { TidePoint } from "@/lib/engine/types";

interface TideStripProps {
  points: TidePoint[];
  /** 판정 기준 시각(ISO 로컬). '지금' 마커용. */
  asOf: string;
}

const W = 720;
const H = 170;
const PAD_X = 24;
const PAD_TOP = 34;
const PAD_BOTTOM = 30;

/** "…THH:mm" / "… HH:mm" → 자정 기준 분(0~1439). 실패 시 NaN. */
function toMinutes(time: string): number {
  const m = time.match(/[T ](\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

function hhmm(time: string): string {
  const m = time.match(/[T ](\d{2}:\d{2})/);
  return m ? m[1] : "";
}

interface Node {
  min: number;
  levelCm: number;
  type: "high" | "low";
  time: string;
}

/** 코사인 보간: 두 극점 사이를 부드럽게(극점에서 기울기 0 — 물때 곡선). */
function interpLevel(x: number, nodes: Node[]): number {
  if (x <= nodes[0].min) return nodes[0].levelCm;
  const last = nodes[nodes.length - 1];
  if (x >= last.min) return last.levelCm;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (x >= a.min && x <= b.min) {
      const phase = ((x - a.min) / (b.min - a.min)) * Math.PI;
      return a.levelCm + (b.levelCm - a.levelCm) * (1 - Math.cos(phase)) / 2;
    }
  }
  return last.levelCm;
}

export default function TideStrip({ points, asOf }: TideStripProps) {
  const nodes: Node[] = points
    .map((p) => ({
      min: toMinutes(p.time),
      levelCm: p.levelCm,
      type: p.type,
      time: p.time,
    }))
    .filter((n) => Number.isFinite(n.min))
    .sort((a, b) => a.min - b.min);

  if (nodes.length < 2) return null;

  const levels = nodes.map((n) => n.levelCm);
  const lvMin = Math.min(...levels);
  const lvMax = Math.max(...levels);
  const span = lvMax - lvMin || 1;

  const xOf = (min: number) => PAD_X + (min / 1440) * (W - 2 * PAD_X);
  const yOf = (lv: number) =>
    H - PAD_BOTTOM - ((lv - lvMin) / span) * (H - PAD_TOP - PAD_BOTTOM);

  // 곡선 샘플(20분 간격).
  const samples: string[] = [];
  for (let x = 0; x <= 1440; x += 20) {
    const lv = interpLevel(x, nodes);
    samples.push(`${xOf(x).toFixed(1)},${yOf(lv).toFixed(1)}`);
  }
  const linePath = `M ${samples.join(" L ")}`;
  const areaPath = `${linePath} L ${xOf(1440).toFixed(1)},${H - PAD_BOTTOM} L ${xOf(0).toFixed(1)},${H - PAD_BOTTOM} Z`;

  const nowMin = toMinutes(asOf.replace(" ", "T"));
  const nowX = Number.isFinite(nowMin) ? xOf(nowMin) : null;

  return (
    <section
      className="sea-panel-enter rounded-2xl border p-5"
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
          <span aria-hidden>🌊</span> 오늘의 물때{" "}
          <span className="font-normal opacity-50">(조석 곡선)</span>
        </h4>
        <span className="text-xs opacity-60">저점(간조)에 갯벌이 드러나요</span>
      </header>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[420px]"
          role="img"
          aria-label="오늘의 조석 곡선. 간조와 만조 시각을 보여줍니다."
        >
          <defs>
            <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(20 184 166)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="rgb(20 184 166)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* 3시간 간격 세로 눈금 */}
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => {
            const x = xOf(h * 60);
            return (
              <g key={h}>
                <line
                  x1={x}
                  y1={PAD_TOP - 6}
                  x2={x}
                  y2={H - PAD_BOTTOM}
                  className="stroke-black/5 dark:stroke-white/10"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={H - 10}
                  textAnchor="middle"
                  className="fill-current text-[11px] opacity-40"
                >
                  {h}시
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#tideFill)" className="sea-fade-in" />
          <path
            d={linePath}
            fill="none"
            pathLength={1}
            className="stroke-teal-500 sea-draw"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* 간조/만조 마커 */}
          <g className="sea-fade-in">
          {nodes.map((n, i) => {
            const x = xOf(n.min);
            const y = yOf(n.levelCm);
            const isLow = n.type === "low";
            const labelY = isLow ? y + 20 : y - 12;
            return (
              <g key={`${n.min}-${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={4.5}
                  className={
                    isLow
                      ? "fill-teal-600 dark:fill-teal-400"
                      : "fill-white stroke-teal-500 dark:fill-neutral-900"
                  }
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  className="fill-current text-[11px] font-medium"
                >
                  <tspan className={isLow ? "font-semibold" : "opacity-60"}>
                    {isLow ? "간조" : "만조"}
                  </tspan>
                </text>
                <text
                  x={x}
                  y={labelY + (isLow ? 12 : -12)}
                  textAnchor="middle"
                  className="fill-current text-[10px] tabular-nums opacity-55"
                >
                  {hhmm(n.time)}
                </text>
              </g>
            );
          })}
          </g>

          {/* '지금' 세로선 */}
          {nowX != null && (
            <g>
              <line
                x1={nowX}
                y1={PAD_TOP - 10}
                x2={nowX}
                y2={H - PAD_BOTTOM}
                className="stroke-neutral-900/70 dark:stroke-white/70"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
              <rect
                x={nowX - 15}
                y={PAD_TOP - 24}
                width={30}
                height={15}
                rx={7.5}
                className="fill-neutral-900 dark:fill-white"
              />
              <text
                x={nowX}
                y={PAD_TOP - 13}
                textAnchor="middle"
                className="fill-white text-[10px] font-semibold dark:fill-neutral-900"
              >
                지금
              </text>
            </g>
          )}
        </svg>
      </div>
    </section>
  );
}
