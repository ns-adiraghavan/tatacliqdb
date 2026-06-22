import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import KpiCard from "./KpiCard";
import DataTable, { Column } from "./DataTable";
import bifurcationData from "../data/bifurcation";
import summaryData from "../data/summary";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}`;
}

interface Week {
  week_number: number;
  week_start: string;
  week_end: string;
  abridged?: boolean;
  tickets: number;
  adhoc_skus: number;
  e2e_options: number;
  avg_tat: number;
  e2e_tickets: number;
  adhoc_tickets: number;
  closed_tickets: number;
  open_tickets: number;
  wow_pct: number | null;
  cumulative_tickets: number;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function fmtWow(v: number | null) {
  if (v === null || v === undefined) return <span style={{ color: "#94A3B8" }}>—</span>;
  const sign = v > 0 ? "+" : "";
  return (
    <span style={{ color: v >= 0 ? "#22C55E" : "#EF4444", fontWeight: 600 }}>
      {sign}
      {v.toFixed(1)}%
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A3C5E", marginBottom: 10 }}>
      {children}
    </div>
  );
}

const BUCKET_COLORS: Record<string, string> = {
  "0-3 Days": "#4CAF50",
  "4-7 Days": "#8BC34A",
  "8-11 Days": "#FFC107",
  "12-16 Days": "#FF9800",
  "16+ Days": "#F44336",
};
const BUCKET_ORDER = ["0-3 Days", "4-7 Days", "8-11 Days", "12-16 Days", "16+ Days"];

type DimKey = "priority" | "status" | "listing_type" | "category" | "platform";

export default function WowTab({ data }: { data: any }) {
  const k = data.kpis;
  const weeks: Week[] = data.weeks;
  const bifData: any = bifurcationData;
  const summary: any = summaryData;

  const defaultFrom = weeks[0]?.week_start ?? "";
  const defaultTo = weeks[weeks.length - 1]?.week_end ?? "";
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);
  const [selectedCat, setSelectedCat] = useState<string>("All Categories");
  const [dim, setDim] = useState<DimKey>("priority");

  const filteredWeeks = useMemo(
    () => weeks.filter((w) => w.week_start >= fromDate && w.week_end <= toDate),
    [weeks, fromDate, toDate],
  );

  const isFullRange = fromDate === defaultFrom && toDate === defaultTo;

  // Recompute WoW% within the filtered list
  const tableWeeks = filteredWeeks.map((w, i) => {
    let wowPct: number | null = null;
    if (filteredWeeks.length >= 2 && i > 0) {
      const prev = filteredWeeks[i - 1].tickets;
      if (prev > 0) wowPct = ((w.tickets - prev) / prev) * 100;
    }
    return { ...w, wow_pct: wowPct };
  });

  // Totals from filtered range
  const tot = filteredWeeks.reduce(
    (acc, w) => {
      acc.tickets += w.tickets;
      acc.adhoc_skus += w.adhoc_skus;
      acc.e2e_options += w.e2e_options;
      acc.e2e_tickets += w.e2e_tickets;
      acc.adhoc_tickets += w.adhoc_tickets;
      acc.closed_tickets += w.closed_tickets;
      acc.open_tickets += w.open_tickets;
      return acc;
    },
    { tickets: 0, adhoc_skus: 0, e2e_options: 0, e2e_tickets: 0, adhoc_tickets: 0, closed_tickets: 0, open_tickets: 0 },
  );

  // KPI strip badge: last week vs monthly average across all weeks
  const vsAvg = (key: keyof Week): number | null => {
    if (!weeks.length) return null;
    const last = weeks[weeks.length - 1];
    if (!last) return null;
    const a = Number(last[key]);
    const sum = weeks.reduce((s, w) => s + Number(w[key] ?? 0), 0);
    const avg = sum / weeks.length;
    if (!isFinite(a) || !isFinite(avg) || avg === 0) return null;
    return ((a - avg) / avg) * 100;
  };

  // Filtered KPI totals (reactive to date range)
  const filteredTotalTickets = filteredWeeks.reduce((s, w) => s + (w.tickets || 0), 0);
  const filteredAdhocSkus = filteredWeeks.reduce((s, w) => s + (w.adhoc_skus || 0), 0);
  const filteredE2eOptions = filteredWeeks.reduce((s, w) => s + (w.e2e_options || 0), 0);
  const filteredE2eTickets = filteredWeeks.reduce((s, w) => s + (w.e2e_tickets || 0), 0);
  const filteredAdhocTickets = filteredWeeks.reduce((s, w) => s + (w.adhoc_tickets || 0), 0);
  const filteredTatNum = filteredWeeks.reduce((s, w) => s + (w.avg_tat || 0) * (w.tickets || 0), 0);
  const filteredAvgTat = filteredTotalTickets > 0 ? filteredTatNum / filteredTotalTickets : 0;

  const chartData = filteredWeeks.map((w) => ({
    name: `W${w.week_number} ${fmtDate(w.week_start)}–${fmtDate(w.week_end).replace(/^\d{2}-/, "")}`,
    Tickets: w.tickets,
    "Avg TAT": w.avg_tat,
    Cumulative: w.cumulative_tickets,
  }));

  const abridgedWeek = filteredWeeks.find((w) => w.abridged);
  const includesAbridged = !!abridgedWeek;

  const columns: Column<Week>[] = [
    { header: "Week", render: (w) => `W${w.week_number}` },
    { header: "Week Start", render: (w) => fmtDate(w.week_start) },
    { header: "Week End", render: (w) => fmtDate(w.week_end) },
    { header: "Tickets", align: "right", render: (w) => fmtNum(w.tickets) },
    { header: "Ad-hoc SKUs", align: "right", render: (w) => fmtNum(w.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (w) => fmtNum(w.e2e_options) },
    { header: "Avg TAT", align: "right", title: "Weighted avg: sum(TAT × ticket volume) / sum(ticket volume)", render: (w) => w.avg_tat.toFixed(2) },
    { header: "E2E", align: "right", render: (w) => fmtNum(w.e2e_tickets) },
    { header: "Ad-hoc", align: "right", render: (w) => fmtNum(w.adhoc_tickets) },
    { header: "Closed", align: "right", render: (w) => fmtNum(w.closed_tickets) },
    { header: "Open", align: "right", render: (w) => fmtNum(w.open_tickets) },
    { header: "WoW%", align: "right", render: (w) => fmtWow(w.wow_pct) },
    { header: "Cumulative", align: "right", render: (w) => fmtNum(w.cumulative_tickets) },
  ];

  const footer = (
    <tr style={{ background: "#f0f4f8", fontWeight: 500 }}>
      <td style={tdFoot} colSpan={3}>Total</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.tickets)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.adhoc_skus)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.e2e_options)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>—</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.e2e_tickets)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.adhoc_tickets)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.closed_tickets)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.open_tickets)}</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>—</td>
      <td style={{ ...tdFoot, textAlign: "right" }}>{fmtNum(tot.tickets)}</td>
    </tr>
  );

  // TAT Bifurcation rows — aggregate across filteredWeeks using by_week / by_week_category
  const bifRows = useMemo(() => {
    const weekNums = filteredWeeks.map((w) => String(w.week_number));
    const isFiltered = !isFullRange;

    // If full range and no by_week data, fall back to pre-aggregated overall/by_category
    const hasByWeek = !!bifData.by_week;

    if (!isFiltered || !hasByWeek) {
      // Original behaviour
      return selectedCat === "All Categories"
        ? bifData.overall
        : (bifData.by_category?.[selectedCat] ?? bifData.overall);
    }

    // Aggregate across filtered weeks
    const bucketMap: Record<string, { tickets: number; e2e_options: number; tat_sum: number; tat_weight: number; bucket_order: number }> = {};

    weekNums.forEach((wn) => {
      let source: any[];
      if (selectedCat === "All Categories") {
        source = bifData.by_week?.[wn] ?? [];
      } else {
        source = bifData.by_week_category?.[`${wn}__${selectedCat}`] ?? [];
      }
      source.forEach((r: any) => {
        if (!bucketMap[r.tat_bucket]) {
          bucketMap[r.tat_bucket] = { tickets: 0, e2e_options: 0, tat_sum: 0, tat_weight: 0, bucket_order: r.bucket_order };
        }
        const entry = bucketMap[r.tat_bucket];
        entry.tickets += r.tickets;
        entry.e2e_options += r.e2e_options;
        if (r.avg_tat != null && r.tickets > 0) {
          entry.tat_sum += r.avg_tat * r.tickets;
          entry.tat_weight += r.tickets;
        }
      });
    });

    const totalTickets = Object.values(bucketMap).reduce((s, e) => s + e.tickets, 0);
    return Object.entries(bucketMap).map(([label, e]) => ({
      tat_bucket:   label,
      bucket_order: e.bucket_order,
      tickets:      e.tickets,
      e2e_options:  e.e2e_options,
      avg_tat:      e.tat_weight > 0 ? Math.round((e.tat_sum / e.tat_weight) * 100) / 100 : null,
      pct:          totalTickets > 0 ? Math.round((e.tickets / totalTickets) * 10000) / 100 : 0,
    }));
  }, [filteredWeeks, isFullRange, selectedCat, bifData]);
  const sortedBifRows = [...bifRows].sort(
    (a: any, b: any) => BUCKET_ORDER.indexOf(a.tat_bucket) - BUCKET_ORDER.indexOf(b.tat_bucket),
  );

  // Breakdown — aggregate across filteredWeeks using breakdown_by_week when filtered,
  // fall back to full-month summary arrays when at full range or data unavailable.
  const breakdownRows = useMemo(() => {
    const hasByWeek = !!summary.breakdown_by_week;
    const weekNums = filteredWeeks.map((w) => String(w.week_number));

    if (isFullRange || !hasByWeek) {
      return {
        priority:     summary.priority     || [],
        status:       summary.status       || [],
        listing_type: summary.listing_type || [],
        category:     summary.category     || [],
        platform:     summary.platform     || [],
      };
    }

    // Aggregate each dimension across the filtered week slice
    function aggregateDim(dimKey: string, nameKey: string): any[] {
      const map: Record<string, { tickets: number; tat_sum: number; tat_weight: number; [k: string]: any }> = {};
      weekNums.forEach((wn) => {
        const wRows: any[] = summary.breakdown_by_week[wn]?.[dimKey] ?? [];
        wRows.forEach((r: any) => {
          const key = r[nameKey] ?? "Unknown";
          if (!map[key]) map[key] = { tickets: 0, tat_sum: 0, tat_weight: 0, [nameKey]: key };
          const entry = map[key];
          const t = r.tickets ?? r.count ?? 0;
          entry.tickets += t;
          // carry through extra numeric fields
          if (r.adhoc_skus  != null) entry.adhoc_skus  = (entry.adhoc_skus  ?? 0) + r.adhoc_skus;
          if (r.e2e_options != null) entry.e2e_options = (entry.e2e_options ?? 0) + r.e2e_options;
          if (r.avg_tat != null && t > 0) {
            entry.tat_sum    += r.avg_tat * t;
            entry.tat_weight += t;
          }
        });
      });
      const totalTickets = Object.values(map).reduce((s, e) => s + e.tickets, 0);
      return Object.values(map).map((e) => ({
        ...e,
        count:        e.tickets,
        avg_tat:      e.tat_weight > 0 ? Math.round((e.tat_sum / e.tat_weight) * 100) / 100 : null,
        pct_of_total: totalTickets > 0 ? Math.round((e.tickets / totalTickets) * 10000) / 100 : 0,
      })).sort((a, b) => b.tickets - a.tickets);
    }

    return {
      priority:     aggregateDim("priority",     "priority"),
      status:       aggregateDim("status",        "status"),
      listing_type: aggregateDim("listing_type",  "listing_type_group"),
      category:     aggregateDim("category",      "l1_category"),
      platform:     aggregateDim("platform",      "platform"),
    };
  }, [filteredWeeks, isFullRange, summary]);

  const dimConfigs: Record<
    DimKey,
    { label: string; rows: any[]; nameKey: string; flagRow?: (r: any) => boolean }
  > = {
    priority:     { label: "Priority",     rows: breakdownRows.priority,     nameKey: "priority" },
    status:       { label: "Status",       rows: breakdownRows.status,       nameKey: "status" },
    listing_type: { label: "Listing Type", rows: breakdownRows.listing_type, nameKey: "listing_type_group" },
    category: {
      label: "Category L1",
      rows: breakdownRows.category,
      nameKey: "l1_category",
      flagRow: (r) => r.l1_category === "Health & Wellness",
    },
    platform: { label: "Platform", rows: breakdownRows.platform, nameKey: "platform" },
  };
  const activeDim = dimConfigs[dim];
  const dimTotalTickets = activeDim.rows.reduce((s, r) => s + (r.tickets ?? r.count ?? 0), 0);
  const dimTotalTatNum = activeDim.rows.reduce(
    (s, r) => s + (r.avg_tat ?? 0) * (r.tickets ?? r.count ?? 0),
    0,
  );
  const dimAvgTat = dimTotalTickets > 0 ? dimTotalTatNum / dimTotalTickets : 0;

  const dimCols: Column<any>[] = [
    {
      header: activeDim.label,
      render: (r) => {
        const name = r[activeDim.nameKey];
        const displayed = dim === "platform" ? String(name).replace(";", " & ") : name;
        if (activeDim.flagRow?.(r)) {
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#DC2626",
                  display: "inline-block",
                }}
                title="Highest TAT"
              />
              {displayed}
            </span>
          );
        }
        return displayed;
      },
    },
    { header: "Tickets", align: "right", render: (r) => fmtNum(r.tickets ?? r.count) },
    { header: "Avg TAT", align: "right", render: (r) => (r.avg_tat != null ? r.avg_tat.toFixed(2) : "—") },
    {
      header: "% of Total",
      align: "right",
      render: (r) => {
        const t = r.tickets ?? r.count ?? 0;
        const pct = r.pct_of_total ?? (dimTotalTickets > 0 ? (t / dimTotalTickets) * 100 : 0);
        return `${pct.toFixed(2)}%`;
      },
    },
  ];

  const dimFooter = (
    <tr style={{ borderTop: "2px solid #CBD5E1", fontWeight: 500, background: "#F8FAFC" }}>
      <td style={{ padding: "10px 12px", color: "#1E293B" }}>Total</td>
      <td style={{ padding: "10px 12px", color: "#1E293B", textAlign: "right" }}>{fmtNum(dimTotalTickets)}</td>
      <td style={{ padding: "10px 12px", color: "#1E293B", textAlign: "right" }}>{dimAvgTat.toFixed(2)}</td>
      <td style={{ padding: "10px 12px", color: "#1E293B", textAlign: "right" }}>100.00%</td>
    </tr>
  );

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: 13,
    border: "1px solid #CBD5E1",
    borderRadius: 6,
    background: "#fff",
    color: "#1E293B",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* SECTION 1 — KPI STRIP */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        <KpiCard label="Total Tickets" value={fmtNum(filteredTotalTickets)} wowPct={vsAvg("tickets")} badgeLabel="vs month avg" badgeTooltip="Last week vs monthly average" />
        <KpiCard label="Ad-hoc SKUs" value={fmtNum(filteredAdhocSkus)} wowPct={vsAvg("adhoc_skus")} badgeLabel="vs month avg" badgeTooltip="Last week vs monthly average" />
        <KpiCard label="E2E Options" value={fmtNum(filteredE2eOptions)} wowPct={vsAvg("e2e_options")} badgeLabel="vs month avg" badgeTooltip="Last week vs monthly average" />
        <KpiCard label="Avg TAT (weighted)" value={`${filteredAvgTat.toFixed(2)} days`} wowPct={vsAvg("avg_tat")} badgeLabel="vs month avg" badgeTooltip="Last week vs monthly average" invertColor />
        <KpiCard label="E2E Tickets" value={fmtNum(filteredE2eTickets)} wowPct={vsAvg("e2e_tickets")} badgeLabel="vs month avg" badgeTooltip="Last week vs monthly average" />
        <KpiCard label="Ad-hoc Tickets" value={fmtNum(filteredAdhocTickets)} wowPct={vsAvg("adhoc_tickets")} badgeLabel="vs month avg" badgeTooltip="Last week vs monthly average" />

      </div>

      {/* SECTION 2 — DATE RANGE PICKER */}
      <div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 6 }}>Filter by date range</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "#64748B", display: "inline-flex", alignItems: "center", gap: 6 }}>
            From
            <input
              type="date"
              value={fromDate}
              min={defaultFrom}
              max={defaultTo}
              onChange={(e) => setFromDate(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 12, color: "#64748B", display: "inline-flex", alignItems: "center", gap: 6 }}>
            To
            <input
              type="date"
              value={toDate}
              min={defaultFrom}
              max={defaultTo}
              onChange={(e) => setToDate(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button
            onClick={() => {
              setFromDate(defaultFrom);
              setToDate(defaultTo);
            }}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              background: "#fff",
              color: "#1E293B",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* SECTION 3 — CHART */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1A3C5E", marginBottom: 12 }}>
          Tickets &amp; Avg TAT by Week
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 8]} tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="Tickets" fill="#185FA5" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Cumulative" position="top" style={{ fontSize: 10, fill: "#8B5CF6" }} formatter={(v: number) => `∑${v}`} />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="Avg TAT"
                stroke="#E57373"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 4 — WoW TABLE */}
      <DataTable columns={columns} rows={tableWeeks} footer={footer} />
      {includesAbridged && (
        <div style={{ fontSize: 12, color: "#94A3B8", marginTop: -8 }}>
          * W{abridgedWeek!.week_number} week start shown as {abridgedWeek!.week_start} — April data not included in this dataset.
        </div>
      )}

      {/* SECTION 5 — TAT BIFURCATION */}
      <div>
        <SectionHeader>
          TAT Bifurcation by Category
          {!isFullRange && (
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginLeft: 8 }}>(filtered)</span>
          )}
        </SectionHeader>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 12, color: "#64748B" }}>Category:</label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              style={inputStyle}
            >
              <option>All Categories</option>
              {(bifData.categories || []).map((c: string) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", width: "100%", height: 90, borderRadius: 6, overflow: "hidden" }}>
            {sortedBifRows.map((r: any) => {
              const w = r.pct || 0;
              if (w === 0) return null;
              return (
                <div
                  key={r.tat_bucket}
                  style={{
                    width: `${w}%`,
                    background: BUCKET_COLORS[r.tat_bucket],
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexDirection: "column",
                    padding: "0 4px",
                    textAlign: "center",
                  }}
                  title={`${r.tat_bucket}: ${r.tickets} tickets (${r.pct.toFixed(1)}%)`}
                >
                  {w >= 5 && (
                    <>
                      <div style={{ fontSize: 11, opacity: 0.9 }}>{r.tat_bucket}</div>
                      <div style={{ fontSize: 14 }}>{r.tickets}</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <DataTable
            columns={[
              {
                header: "TAT Bucket",
                render: (r) => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: BUCKET_COLORS[r.tat_bucket],
                        display: "inline-block",
                      }}
                    />
                    {r.tat_bucket}
                  </span>
                ),
              },
              { header: "Tickets", align: "right", render: (r) => fmtNum(r.tickets) },
              { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
              {
                header: "Avg TAT",
                align: "right",
                render: (r) => (r.avg_tat != null ? r.avg_tat.toFixed(2) : "—"),
              },
              { header: "% Distribution", align: "right", render: (r) => `${(r.pct || 0).toFixed(2)}%` },
            ]}
            rows={sortedBifRows}
          />
        </div>
      </div>

      {/* SECTION 6 — BREAKDOWN SLICER */}
      <div>
        <SectionHeader>
          Breakdown
          <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginLeft: 8 }}>
            {isFullRange ? "(full month)" : "(filtered range)"}
          </span>
        </SectionHeader>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {(Object.keys(dimConfigs) as DimKey[]).map((dk) => {
            const active = dim === dk;
            return (
              <button
                key={dk}
                onClick={() => setDim(dk)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  background: active ? "#1e3a5f" : "#fff",
                  color: active ? "#fff" : "#1e3a5f",
                  border: "1px solid #CBD5E1",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {dimConfigs[dk].label}
              </button>
            );
          })}
        </div>
        <DataTable columns={dimCols} rows={activeDim.rows} footer={dimFooter} />
      </div>

      {/* SECTION 7 — TOP BRANDS */}
      <div>
        <SectionHeader>
          Top Brands by Ticket Volume
          <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginLeft: 8 }}>
            {isFullRange ? "(full month)" : "(filtered range)"}
          </span>
        </SectionHeader>
        {(() => {
          // Aggregate brands_by_week across filteredWeeks.
          // filteredWeeks = all weeks when full-range, subset when date filter is active.
          // brands_by_week is always present in wow.json (generated by generate_json.py).
          const brandsByWeek: Record<string, any[]> = data.brands_by_week || {};
          const brandMap: Record<string, { tickets: number; adhoc_skus: number; e2e_options: number; tat_sum: number; tat_weight: number; closed: number }> = {};
          filteredWeeks.forEach((w) => {
            const weekBrands: any[] = brandsByWeek[String(w.week_number)] || [];
            weekBrands.forEach((b) => {
              if (!brandMap[b.brand_name]) {
                brandMap[b.brand_name] = { tickets: 0, adhoc_skus: 0, e2e_options: 0, tat_sum: 0, tat_weight: 0, closed: 0 };
              }
              const entry = brandMap[b.brand_name];
              entry.tickets     += b.tickets;
              entry.adhoc_skus  += b.adhoc_skus;
              entry.e2e_options += b.e2e_options;
              if (b.avg_tat != null) {
                entry.tat_sum    += b.avg_tat * b.tickets;
                entry.tat_weight += b.tickets;
              }
              entry.closed += Math.round((b.closure_rate / 100) * b.tickets);
            });
          });
          const brands = Object.entries(brandMap)
            .map(([name, v]) => ({
              brand_name:   name,
              tickets:      v.tickets,
              adhoc_skus:   v.adhoc_skus,
              e2e_options:  v.e2e_options,
              avg_tat:      v.tat_weight > 0 ? v.tat_sum / v.tat_weight : null,
              closure_rate: v.tickets > 0 ? (v.closed / v.tickets) * 100 : null,
            }))
            .sort((a, b) => b.tickets - a.tickets)
            .slice(0, 20);

          const brandMaxTickets = Math.max(1, ...brands.map((r) => r.tickets));
          const brandCols: Column<any>[] = [
            { header: "Brand", render: (r) => r.brand_name },
            {
              header: "Tickets",
              align: "right",
              render: (r) => {
                const pct = (r.tickets / brandMaxTickets) * 100;
                return (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, minWidth: 90 }}>
                    <div style={{ textAlign: "right" }}>{fmtNum(r.tickets)}</div>
                    <div style={{ width: "100%", height: 4, background: "transparent", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "rgba(24, 95, 165, 0.4)", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              },
            },
            { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
            { header: "E2E Options",  align: "right", render: (r) => fmtNum(r.e2e_options) },
            { header: "Avg TAT",      align: "right", render: (r) => r.avg_tat != null ? r.avg_tat.toFixed(2) : "—" },
            { header: "Closure %",    align: "right", render: (r) => r.closure_rate != null ? `${r.closure_rate.toFixed(2)}%` : "—" },
          ];
          return <DataTable columns={brandCols} rows={brands} />;
        })()}
      </div>
    </div>
  );
}

const tdFoot: React.CSSProperties = {
  padding: "10px 12px",
  color: "#1e3a5f",
  borderTop: "1px solid #d0d8e8",
  fontSize: 13,
  fontWeight: 500,
};
