"use client";

/**
 * 장소 상세 (데모 장면 3) — 판정 카드 + 시간대별 위험 타임라인 + 물때 곡선.
 * /place/[id] : 지점의 모든 활동(swim/mudflat)에 대해 verdict 를 불러와 렌더.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import ChatThread from "@/components/ChatThread";
import VerdictCard from "@/components/VerdictCard";
import RiskTimeline from "@/components/RiskTimeline";
import TideStrip from "@/components/TideStrip";
import { getStation } from "@/data/stations";
import type { Verdict } from "@/lib/engine/types";

export default function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const station = getStation(id);

  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [chatVerdict, setChatVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!station) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChatVerdict(null);

    Promise.all(
      station.activities.map(async (activity) => {
        const res = await fetch(
          `/api/verdict?station=${station.id}&activity=${activity}`,
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `요청 실패 (${res.status})`);
        }
        return (await res.json()) as Verdict;
      }),
    )
      .then((results) => {
        if (!cancelled) setVerdicts(results);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "판정을 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [station]);

  if (!station) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-5 py-10">
        <BackLink />
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-white/5">
          지원하지 않는 지점입니다: <b>{id}</b>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-12 sm:py-14">
      <BackLink />

      <header className="flex flex-col gap-2.5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-700 dark:text-teal-300">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 sea-now-glow" aria-hidden />
          시간대별 안전 타임라인
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">
          {station.name}
        </h1>
        <p className="text-[15px] leading-relaxed opacity-65">
          공식 해양 데이터로 오늘 하루의 위험도와 물때를 시간대별로 보여드려요.
        </p>
      </header>

      {loading && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-black/5 bg-black/[0.03] motion-reduce:animate-none dark:border-white/10 dark:bg-white/5"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {!loading &&
        verdicts.map((v, i) => (
          <section
            key={`${v.stationId}-${v.activity}`}
            className="flex flex-col gap-3.5"
          >
            <VerdictCard
              verdict={v}
              onAskChat={setChatVerdict}
              enterDelay={i * 70}
            />
            {chatVerdict?.stationId === v.stationId &&
              chatVerdict.activity === v.activity && (
                <ChatThread
                  key={`${chatVerdict.stationId}-${chatVerdict.activity}`}
                  verdict={chatVerdict}
                  onClose={() => setChatVerdict(null)}
                />
              )}
            {v.timeline && v.timeline.length > 0 && (
              <RiskTimeline
                bands={v.timeline}
                activity={v.activity}
                asOf={v.asOf}
              />
            )}
            {v.activity === "mudflat" &&
              v.tideExtremes &&
              v.tideExtremes.length >= 2 && (
                <TideStrip points={v.tideExtremes} asOf={v.asOf} />
              )}
          </section>
        ))}
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="group sea-focus sea-press -ml-1 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-sm opacity-60 hover:opacity-100"
    >
      <span
        aria-hidden
        className="transition-transform duration-200 group-hover:-translate-x-0.5"
      >
        ←
      </span>{" "}
      홈으로
    </Link>
  );
}
