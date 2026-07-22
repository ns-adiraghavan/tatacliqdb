// ------------------------------------------------------------------
// Runtime data store.
//
// Previously each dataset was imported from public/*.json at BUILD time,
// which inlined the data into the JS bundle — so refreshing the data
// required a full rebuild + redeploy.
//
// Now the five datasets (plus visibility config) are fetched at RUNTIME
// from DATA_BASE. Dropping new JSON into the served /data folder — which
// is exactly what the GitHub Action does on each upload — refreshes the
// dashboard on the next page load, no rebuild needed.
//
// `store` is a live singleton object. Components read `store.wow` etc.
// after loadAllData() has resolved (App gates rendering on that).
// ------------------------------------------------------------------

import { DATA_BASE, DATA_FILES } from "../config";

export interface ClientRange {
  // When enabled, the CLIENT is clamped to [start, end] on the
  // date-granular tabs (WoW weeks, Day View days). Admin always sees all.
  enabled: boolean;
  start: string | null; // ISO date "YYYY-MM-DD"
  end: string | null;   // ISO date "YYYY-MM-DD"
}

export interface Visibility {
  tabs: { wow: boolean; summary: boolean; eod: boolean; escalations: boolean };
  kpis: { wow: boolean; summary: boolean; eod: boolean; escalations: boolean };
  clientRange: ClientRange;
}

export const DEFAULT_VISIBILITY: Visibility = {
  tabs: { wow: true, summary: true, eod: true, escalations: true },
  kpis: { wow: true, summary: true, eod: true, escalations: true },
  clientRange: { enabled: false, start: null, end: null },
};

interface Store {
  wow: any;
  summary: any;
  bifurcation: any;
  eod: any;
  escalations: any;
  visibility: Visibility;
  loadedAt: string | null;
}

export const store: Store = {
  wow: null,
  summary: null,
  bifurcation: null,
  eod: null,
  escalations: null,
  visibility: DEFAULT_VISIBILITY,
  loadedAt: null,
};

async function fetchJson(file: string): Promise<any | null> {
  try {
    // cache-bust so a fresh deploy is picked up immediately
    const res = await fetch(`${DATA_BASE}/${file}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** True when there is no real dashboard data yet (fresh / blank state). */
export function isEmpty(): boolean {
  return !store.wow || !Array.isArray(store.wow.weeks) || store.wow.weeks.length === 0;
}

/** Fetch all datasets. Missing/blank files leave sensible defaults in place. */
export async function loadAllData(): Promise<void> {
  const [wow, summary, bifurcation, eod, escalations, visibility] = await Promise.all([
    fetchJson(DATA_FILES.wow),
    fetchJson(DATA_FILES.summary),
    fetchJson(DATA_FILES.bifurcation),
    fetchJson(DATA_FILES.eod),
    fetchJson(DATA_FILES.escalations),
    fetchJson(DATA_FILES.visibility),
  ]);

  store.wow = wow;
  store.summary = summary;
  store.bifurcation = bifurcation;
  store.eod = eod;
  store.escalations = escalations;

  // Merge fetched visibility over defaults so a partial/old file never
  // breaks the toggles.
  store.visibility = {
    tabs: { ...DEFAULT_VISIBILITY.tabs, ...(visibility?.tabs ?? {}) },
    kpis: { ...DEFAULT_VISIBILITY.kpis, ...(visibility?.kpis ?? {}) },
    clientRange: { ...DEFAULT_VISIBILITY.clientRange, ...(visibility?.clientRange ?? {}) },
  };

  store.loadedAt = new Date().toISOString();
}
