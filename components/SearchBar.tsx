"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  useId,
  useMemo,
  useState,
} from "react";
import { STATIONS, type Station } from "@/data/stations";
import { ACTIVITY_LABEL } from "@/lib/ui/activity";

interface SearchBarProps {
  onSelect: (station: Station) => void;
  selectedId?: string;
}

export default function SearchBar({ onSelect, selectedId }: SearchBarProps) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return STATIONS;
    return STATIONS.filter((s) => s.name.includes(q));
  }, [query]);

  const showList = focused && results.length > 0;
  const activeStation = showList ? results[activeIndex] : undefined;

  function selectStation(station: Station) {
    onSelect(station);
    setQuery(station.name);
    setFocused(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocused(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocused(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && activeStation) {
      event.preventDefault();
      selectStation(activeStation);
      return;
    }
    if (event.key === "Escape") {
      setFocused(false);
    }
  }

  return (
    <div className="relative w-full">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 opacity-40"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={
          activeStation ? `${listboxId}-${activeStation.id}` : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder="해수욕장·갯벌 이름으로 검색 (예: 해운대, 제부도)"
        className="sea-focus w-full rounded-2xl border py-3.5 pl-11 pr-4 text-[15px] transition-[border-color,box-shadow] duration-150 placeholder:opacity-45 focus:border-teal-500"
        style={
          {
            background: "var(--surface)",
            borderColor: "var(--surface-border)",
            boxShadow: "var(--shadow-card)",
          } as CSSProperties
        }
        aria-label="지점 검색"
      />

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="sea-popover-enter absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border p-1"
          style={
            {
              background: "var(--surface)",
              borderColor: "var(--surface-border)",
              boxShadow: "var(--shadow-card)",
              backdropFilter: "saturate(1.1)",
            } as CSSProperties
          }
        >
          {results.map((s, index) => {
            const active = selectedId === s.id || activeIndex === index;
            return (
              <li key={s.id} role="presentation">
                <button
                  id={`${listboxId}-${s.id}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectStation(s)}
                  className={`sea-focus flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-colors duration-150 ${
                    active
                      ? "bg-teal-500/10 text-teal-800 dark:text-teal-200"
                      : "hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`text-xs transition-opacity duration-150 ${
                        active ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      →
                    </span>
                    <span className="font-medium">{s.name}</span>
                  </span>
                  <span className="text-xs opacity-55">
                    {s.activities.map((a) => ACTIVITY_LABEL[a]).join(" · ")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
