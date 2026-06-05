import { useState } from "react";
import WowTab from "./components/WowTab";
import SummaryTab from "./components/SummaryTab";
import EodTab from "./components/EodTab";
import Login from "./components/Login";

import wowData from "./data/wow";
import summaryData from "./data/summary";
import eodData from "./data/eod";

type TabKey = "wow" | "summary" | "eod";

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [tab, setTab] = useState<TabKey>("wow");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "wow", label: "WoW Dashboard" },
    { key: "summary", label: "Monthly Summary" },
    { key: "eod", label: "Day View" },
  ];

  if (!signedIn) {
    return <Login onSignIn={() => setSignedIn(true)} />;
  }

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
          <img
            src="/netscribes-logo-white.png"
            alt="Netscribes"
            style={{ maxHeight: 28 }}
          />
          <h1 style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "#fff" }}>
            TataCliq Dashboard
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            May 2026
          </span>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            {"\n"}
          </div>
        </div>
      </header>

      <nav
        style={{
          background: "#fff",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          padding: "0 24px",
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.key;
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

      <main style={{ padding: 24 }}>
        {tab === "wow" && <WowTab data={wowData} />}
        {tab === "summary" && <SummaryTab data={summaryData} />}
        {tab === "eod" && <EodTab data={eodData} />}
      </main>
    </div>
  );
}
