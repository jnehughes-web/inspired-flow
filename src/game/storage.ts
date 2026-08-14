import type { FormId, SaveData } from "./types";
import { FORM_ORDER } from "./types";

export type { SaveData };

const KEY = "drift-save-v3";

function migrateFormId(raw: unknown): FormId | null {
  // Jellyfish removed; Noticord merged into Worm
  if (raw === "seaslug" || raw === "noticord" || raw === "manta" || raw === "jellyfish") {
    return "worm";
  }
  if (typeof raw === "string" && (FORM_ORDER as string[]).includes(raw)) {
    return raw as FormId;
  }
  return null;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    unlocked: ["worm"],
    lastForm: "worm",
    mute: false,
    bestDepth: 0,
    seenTip: false,
  };
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw =
      localStorage.getItem(KEY) ??
      localStorage.getItem("drift-save-v2") ??
      localStorage.getItem("drift-save-v1");
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData> & { unlocked?: unknown[] };
    const unlocked: FormId[] = ["worm"];
    if (Array.isArray(parsed.unlocked)) {
      for (const u of parsed.unlocked) {
        const m = migrateFormId(u);
        if (m && !unlocked.includes(m)) unlocked.push(m);
      }
    }
    return {
      version: 1,
      unlocked: ["worm"],
      lastForm: "worm",
      mute: Boolean(parsed.mute),
      bestDepth: Math.max(0, Math.min(7, Number(parsed.bestDepth) || 0)),
      seenTip: Boolean(parsed.seenTip),
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function nextForm(_current: FormId): FormId | null {
  // Single form — egg still completes the dive
  return null;
}
