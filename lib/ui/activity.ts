import type { Activity } from "../engine/types";

export const ACTIVITY_LABEL: Record<Activity, string> = {
  swim: "물놀이·수영",
  mudflat: "갯벌체험",
};

export const ACTIVITY_EMOJI: Record<Activity, string> = {
  swim: "🏊",
  mudflat: "🦀",
};
