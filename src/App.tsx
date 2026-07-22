import { useEffect, useState } from "react";
import WowTab from "./components/WowTab";
import SummaryTab from "./components/SummaryTab";
import EodTab from "./components/EodTab";
import EscalationsTab from "./components/EscalationsTab";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import type { Role } from "./auth";
import { DEFAULT_PAT } from "./config";
import {
  store,
  loadAllData,
  isEmpty,
  DEFAULT_VISIBILITY,
  type Visibility,
} from "./data/store";

type TabKey = "wow" | "summary" | "eod" | "escalations";

const TABS: { key: TabKey; label: string }[] = [
  { key: "wow", label: "WoW Dashboard" },
  { key: "summary", label: "Monthly Summary" },
  { key: "eod", label: "Day View" },
  { key: "escalations", label: "Escalations" },
];

function deriveMonthLabel(weeks: { week_start: string; week_end: string }[]): string {
  if (!weeks || weeks.length === 0) return "";
  const starts = weeks.map((w) => new Date(w.week_start));
  const ends = weeks.map((w) => new Date(w.week_end));
  const earliest = new Date(Math.min(...starts.map((d) => d.getTime())));
  const latest = new Date(Math.max(...ends.map((d) => d.getTime())));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startLabel = `${MONTHS[earliest.getUTCMonth()]} ${earliest.getUTCFullYear()}`;
  const endLabel = `${MONTHS[latest.getUTCMonth()]} ${latest.getUTCFullYear()}`;
  return startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`;
}

function CenterMessage({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        color: "#64748B",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: "#1e3a5f" }}>{title}</div>
      {sub && <div style={{ fontSize: 13, marginTop: 8, maxWidth: 460 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>("wow");

  // Admin-only state.
  // Token persists in this browser (localStorage) so a page reload — e.g.
  // after an upload, to see the new data — doesn't wipe a pasted token and
  // fall back to the (possibly stale) baked-in default.
  const [adminView, setAdminView] = useState(false);
  const [token, setToken] = useState<string>(() => {
    try {
      // A stored value (even empty, from an explicit Clear) wins over the
      // baked default; only fall back to DEFAULT_PAT when nothing is stored.
      const stored = localStorage.getItem("ucw_pat");
      return stored !== null ? stored : DEFAULT_PAT;
    } catch {
      return DEFAULT_PAT;
    }
  });
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);

  useEffect(() => {
    try {
      localStorage.setItem("ucw_pat", token);
    } catch {
      /* storage unavailable — token stays in memory only */
    }
  }, [token]);

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    loadAllData().then(() => {
      setVisibility(store.visibility);
      setReady(true);
      setLoading(false);
    });
  }, [role]);

  if (!role) {
    return <Login onSignIn={setRole} />;
  }

  const isAdmin = role === "admin";
  // Client sees only tabs the admin left visible; admin sees all.
  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => visibility.tabs[t.key]);

  // Keep the active tab valid for the client.
  const activeTab = visibleTabs.some((t) => t.key === tab)
    ? tab
    : visibleTabs[0]?.key ?? "wow";

  const empty = ready && isEmpty();

  // KPI visibility: admin always sees KPIs; client follows the flag.
  const hideKpis = (key: TabKey) => !isAdmin && !visibility.kpis[key];

  // Client date-range clamp (hard clamp): restrict the client to the
  // admin's window on the date-granular tabs. Admin sees everything.
  const range = visibility.clientRange;
  const clampActive = !isAdmin && !!range?.enabled && !!range.start && !!range.end;
  function clampWow(w: any) {
    if (!clampActive || !w?.weeks) return w;
    const weeks = w.weeks.filter(
      (wk: any) => wk.week_end >= range.start! && wk.week_start <= range.end!
    );
    return weeks.length ? { ...w, weeks } : w; // ignore clamp if it empties the set
  }
  function clampEod(e: any) {
    if (!clampActive || !e?.days) return e;
    const days = e.days.filter((d: any) => d.date >= range.start! && d.date <= range.end!);
    return days.length ? { ...e, days, dates: days.map((d: any) => d.date) } : e;
  }
  const wowData = ready && !empty ? clampWow(store.wow) : store.wow;
  const eodData = ready && !empty ? clampEod(store.eod) : store.eod;

  const chip = ready && !empty ? deriveMonthLabel(wowData.weeks) : "";

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#F8FAFC",
        minHeight: "100vh",
        color: "#1E293B",
      }}
    >
      <header
        style={{
          height: 56,
          background: "#1e3a5f",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img src="/netscribes-logo-white.png" alt="Netscribes" style={{ maxHeight: 28 }} />
          <h1 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "#fff" }}>
            TataCliq Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {chip && (
            <span
              style={{
                background: "#e8f0fb",
                color: "#1e3a5f",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {chip}
            </span>
          )}
          {isAdmin && (
            <span
              style={{
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              ADMIN
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setAdminView((v) => !v)}
              style={{
                background: adminView ? "#0EA5E9" : "rgba(255,255,255,0.16)",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {adminView ? "View dashboard" : "Admin panel"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setRole(null);
              setReady(false);
              setAdminView(false);
              // token intentionally left in place (persisted) so admins
              // don't have to re-paste after signing back in.
            }}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Admin panel view */}
      {isAdmin && adminView ? (
        <main style={{ padding: 24 }}>
          <AdminPanel
            token={token}
            setToken={setToken}
            visibility={visibility}
            setVisibility={setVisibility}
          />
        </main>
      ) : (
        <>
          {!empty && ready && (
            <nav
              style={{
                background: "#fff",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                padding: "0 24px",
              }}
            >
              {visibleTabs.map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      padding: "14px 20px",
                      background: "transparent",
                      border: "none",
                      borderBottom: active ? "2px solid #0EA5E9" : "2px solid transparent",
                      color: active ? "#1A3C5E" : "#64748B",
                      fontWeight: active ? 600 : 500,
                      fontSize: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          )}

          <main style={{ padding: 24 }}>
            {loading || !ready ? (
              <CenterMessage title="Loading dashboard…" />
            ) : empty ? (
              <CenterMessage
                title="No data loaded yet"
                sub={
                  isAdmin
                    ? "Open the Admin panel (top right) and upload the first Jira Excel to populate the dashboard."
                    : "The dashboard hasn't been populated yet. Please check back shortly."
                }
              />
            ) : visibleTabs.length === 0 ? (
              <CenterMessage
                title="Nothing to display"
                sub="No tabs are currently shared with your account."
              />
            ) : (
              <>
                {activeTab === "wow" && <WowTab data={wowData} hideKpis={hideKpis("wow")} />}
                {activeTab === "summary" && (
                  <SummaryTab data={store.summary} hideKpis={hideKpis("summary")} />
                )}
                {activeTab === "eod" && <EodTab data={eodData} hideKpis={hideKpis("eod")} />}
                {activeTab === "escalations" && (
                  <EscalationsTab data={store.escalations} hideKpis={hideKpis("escalations")} />
                )}
              </>
            )}
          </main>
        </>
      )}
    </div>
  );
}
