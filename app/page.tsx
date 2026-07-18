"use client";

import { useState } from "react";
import Link from "next/link";
import ChatThread from "@/components/ChatThread";
import SearchBar from "@/components/SearchBar";
import VerdictCard from "@/components/VerdictCard";
import type { Station } from "@/data/stations";
import type { Verdict } from "@/lib/engine/types";

export default function Home() {
  const [station, setStation] = useState<Station | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [chatVerdict, setChatVerdict] = useState<Verdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(s: Station) {
    setStation(s);
    setLoading(true);
    setError(null);
    setVerdicts([]);
    setChatVerdict(null);
    try {
      const results = await Promise.all(
        s.activities.map(async (activity) => {
          const res = await fetch(
            `/api/verdict?station=${s.id}&activity=${activity}`,
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `요청 실패 (${res.status})`);
          }
          return (await res.json()) as Verdict;
        }),
      );
      setVerdicts(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "판정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-12 sm:py-14">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-700 dark:text-teal-300">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500 sea-now-glow" aria-hidden />
          공식 해양 데이터 기반
        </span>
        <h1 className="flex items-center gap-2.5 text-4xl font-semibold tracking-tight">
          <span aria-hidden className="text-3xl">🌊</span>
          오늘의 바다
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed opacity-65">
          지금 물놀이·갯벌체험이{" "}
          <b className="font-semibold text-teal-600 dark:text-teal-400">가능한지</b>{" "}
          한눈에 판정해 드려요.
        </p>
      </header>

      <SearchBar onSelect={handleSelect} selectedId={station?.id} />

      {loading && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-black/5 bg-black/[0.03] motion-reduce:animate-none dark:border-white/10 dark:bg-white/5"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {!loading && verdicts.length > 0 && station && (
        <section className="flex flex-col gap-3.5">
          {verdicts.map((v, i) => (
            <VerdictCard
              key={`${v.stationId}-${v.activity}`}
              verdict={v}
              onAskChat={setChatVerdict}
              enterDelay={i * 70}
            />
          ))}
          {chatVerdict && (
            <ChatThread
              key={`${chatVerdict.stationId}-${chatVerdict.activity}`}
              verdict={chatVerdict}
              onClose={() => setChatVerdict(null)}
            />
          )}
          <Link
            href={`/place/${station.id}`}
            className="group sea-focus sea-press inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 hover:bg-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20"
          >
            <span aria-hidden>⏱</span> {station.name} 시간대별 타임라인 보기
            <span
              aria-hidden
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>
        </section>
      )}

      {!loading && !station && (
        <p className="mt-4 max-w-md text-center text-[13px] leading-relaxed opacity-45 sm:mx-auto">
          지원 지점 · 해운대 · 송정 · 임랑 · 대천 · 중문 · 경포 · 속초
          <span className="opacity-60"> (물놀이)</span>
          {" · "}제부도 · 마시안 · 선감 · 월하성 · 병술만
          <span className="opacity-60"> (갯벌)</span>
        </p>
      )}
    </main>
  );
}
