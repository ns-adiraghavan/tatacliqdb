import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import DataTable, { Column } from "./DataTable";
import KpiCard from "./KpiCard";
import wowData from "../data/wow";
import bifurcationData from "../data/bifurcation";

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
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

export default function SummaryTab({ data }: { data: any }) {
  const b = data.banner;
  const insights = data.tat_insights;
  const [selectedCat, setSelectedCat] = useState<string>("All Categories");
  const [dim, setDim] = useState<DimKey>("priority");

  const bifData: any = bifurcationData;
  const wow: any = wowData;

  const e2eTickets = (data.listing_type || [])
    .filter((r: any) => String(r.listing_type_group).startsWith("E2E"))
    .reduce((s: number, r: any) => s + (r.tickets || 0), 0);
  const adhocTickets = (data.listing_type || [])
    .filter((r: any) => String(r.listing_type_group) === "Ad-hoc")
    .reduce((s: number, r: any) => s + (r.tickets || 0), 0);

  const bifRows =
    selectedCat === "All Categories"
      ? bifData.overall
      : (bifData.by_category?.[selectedCat] ?? bifData.overall);

  const sortedBifRows = [...bifRows].sort(
    (a: any, b: any) => BUCKET_ORDER.indexOf(a.tat_bucket) - BUCKET_ORDER.indexOf(b.tat_bucket),
  );

  const weeklyChartData = (wow.weeks || []).map((w: any) => ({
    week: `W${w.week_number}`,
    tickets: w.tickets,
    avg_tat: w.avg_tat,
  }));

  // KPI cards
  const kpis = [
    { label: "Total Tickets", value: fmtNum(b.total_tickets) },
    { label: "Ad-hoc SKUs", value: fmtNum(b.total_skus) },
    { label: "E2E Tickets", value: fmtNum(e2eTickets) },
    { label: "Ad-hoc Tickets", value: fmtNum(adhocTickets) },
    { label: "Avg TAT", value: `${b.avg_tat} days` },
    { label: "Closure Rate", value: `${b.closure_rate}%` },
    { label: "Peak Week", value: `W${b.peak_week}`, subValue: `${b.peak_week_tickets} tickets` },
  ];

  // Dimension table configs
  const totalAll = data.banner.total_tickets;
  const dimConfigs: Record<
    DimKey,
    { label: string; rows: any[]; nameKey: string; flagRow?: (r: any) => boolean }
  > = {
    priority: { label: "Priority", rows: data.priority, nameKey: "priority" },
    status: { label: "Status", rows: data.status, nameKey: "status" },
    listing_type: { label: "Listing Type", rows: data.listing_type, nameKey: "listing_type_group" },
    category: {
      label: "Category L1",
      rows: data.category,
      nameKey: "l1_category",
      flagRow: (r) => r.l1_category === "Health & Wellness",
    },
    platform: { label: "Platform", rows: data.platform, nameKey: "platform" },
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
    {
      header: "Tickets",
      align: "right",
      render: (r) => fmtNum(r.tickets ?? r.count),
    },
    {
      header: "Avg TAT",
      align: "right",
      render: (r) => (r.avg_tat != null ? r.avg_tat.toFixed(2) : "—"),
    },
    {
      header: "% of Total",
      align: "right",
      render: (r) => {
        const t = r.tickets ?? r.count ?? 0;
        const pct = r.pct_of_total ?? (totalAll > 0 ? (t / totalAll) * 100 : 0);
        return `${pct.toFixed(2)}%`;
      },
    },
  ];

  const dimFooter = (
    <tr style={{ borderTop: "2px solid #CBD5E1", fontWeight: 500, background: "#F8FAFC" }}>
      <td style={{ padding: "10px 12px", color: "#1E293B" }}>Total</td>
      <td style={{ padding: "10px 12px", color: "#1E293B", textAlign: "right" }}>
        {fmtNum(dimTotalTickets)}
      </td>
      <td style={{ padding: "10px 12px", color: "#1E293B", textAlign: "right" }}>
        {dimAvgTat.toFixed(2)}
      </td>
      <td style={{ padding: "10px 12px", color: "#1E293B", textAlign: "right" }}>100.00%</td>
    </tr>
  );

  const brandMaxTickets = Math.max(
    1,
    ...((data.top_brands || []) as any[]).map((r) => r.tickets || 0),
  );
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
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "rgba(24, 95, 165, 0.4)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      },
    },
    { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
    {
      header: "Avg TAT",
      align: "right",
      title: "Weighted avg: sum(TAT × ticket volume) / sum(ticket volume)",
      render: (r) => r.avg_tat.toFixed(2),
    },
    { header: "Closure %", align: "right", render: (r) => `${r.closure_rate.toFixed(2)}%` },
  ];

  function StatItem({
    label,
    value,
    valueColor,
  }: {
    label: string;
    value: string | number;
    valueColor?: string;
  }) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: valueColor || "#1A3C5E" }}>{value}</div>
      </div>
    );
  }

  function HealthBand({
    bg,
    labelColor,
    label,
    count,
    fillColor,
    fillWidth,
    percentage,
    tooltip,
  }: {
    bg: string;
    labelColor: string;
    label: string;
    count: string;
    fillColor: string;
    fillWidth: number;
    percentage: string;
    tooltip: string;
  }) {
    const [showTip, setShowTip] = useState(false);
    return (
      <div
        style={{
          background: bg,
          borderRadius: 6,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          cursor: "default",
        }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: labelColor, marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 11, color: "#64748B" }}>{count}</div>
            <div
              style={{
                width: 120,
                height: 6,
                background: "rgba(0,0,0,0.08)",
                borderRadius: 3,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: `${fillWidth}%`,
                  height: "100%",
                  background: fillColor,
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: labelColor, whiteSpace: "nowrap" }}>
          {percentage}
        </div>
        {showTip && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: 0,
              background: "#1A3C5E",
              color: "#fff",
              fontSize: 11,
              padding: "4px 8px",
              borderRadius: 4,
              whiteSpace: "nowrap",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            {tooltip}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* SECTION 1 — KPI STRIP */}
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 12,
        }}
        className="ucw-kpi-grid"
      >
        {kpis.map((k: any) => (
          <KpiCard key={k.label} label={k.label} value={k.value} subValue={k.subValue} />
        ))}
      </div>

      {/* SECTION 2 — TAT INSIGHTS */}
      <div>
        <SectionHeader>TAT Insights</SectionHeader>
        <div
          style={{
            background: "#F8FAFC",
            borderRadius: 8,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <StatItem label="Overall Avg" value={insights.overall_avg} valueColor="#185FA5" />
            <StatItem label="Min" value={insights.min_tat} />
            <StatItem label="Max" value={insights.max_tat} />
            <StatItem label="Median" value={insights.median_tat} />
          </div>

          <div style={{ height: 1, background: "#E2E8F0" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <HealthBand
              bg="#EAF3DE"
              labelColor="#27500A"
              label="On track — 0 to 5 days"
              count="171 tickets"
              fillColor="#639922"
              fillWidth={61}
              percentage="61.1%"
              tooltip="tat_adjusted ≤ 5 days"
            />
            <HealthBand
              bg="#FAEEDA"
              labelColor="#633806"
              label="At risk — 5 to 15 days"
              count="102 tickets"
              fillColor="#EF9F27"
              fillWidth={36}
              percentage="36.4%"
              tooltip="5 < tat_adjusted ≤ 15 days"
            />
            <HealthBand
              bg="#FCEBEB"
              labelColor="#791F1F"
              label="Breached — 15+ days"
              count="7 tickets"
              fillColor="#E24B4A"
              fillWidth={3}
              percentage="2.5%"
              tooltip="tat_adjusted > 15 days"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3 — WEEKLY CHART */}
      <div>
        <SectionHeader>Weekly Ticket Volume &amp; Avg TAT</SectionHeader>
        <div
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={weeklyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748B" }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: "#64748B" }}
                label={{ value: "Tickets", angle: -90, position: "insideLeft", fontSize: 12, fill: "#64748B" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 8]}
                tick={{ fontSize: 12, fill: "#64748B" }}
                label={{ value: "Avg TAT (days)", angle: 90, position: "insideRight", fontSize: 12, fill: "#64748B" }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="tickets"
                name="Tickets"
                stroke="#185FA5"
                fill="#185FA5"
                fillOpacity={0.7}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avg_tat"
                name="Avg TAT"
                stroke="#E57373"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 4 — TAT BIFURCATION */}
      <div>
        <SectionHeader>TAT Bifurcation by Category</SectionHeader>
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
              style={{
                padding: "6px 10px",
                fontSize: 13,
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                background: "#fff",
                color: "#1E293B",
                fontFamily: "inherit",
              }}
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

      {/* SECTION 5 — DIMENSION SLICER + TABLE */}
      <div>
        <SectionHeader>Breakdown</SectionHeader>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {(Object.keys(dimConfigs) as DimKey[]).map((k) => {
            const active = dim === k;
            return (
              <button
                key={k}
                onClick={() => setDim(k)}
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
                {dimConfigs[k].label}
              </button>
            );
          })}
        </div>
        <DataTable columns={dimCols} rows={activeDim.rows} footer={dimFooter} />
      </div>

      {/* SECTION 6 — TOP BRANDS */}
      <div>
        <SectionHeader>Top Brands by Ticket Volume</SectionHeader>
        <DataTable columns={brandCols} rows={data.top_brands} />
      </div>
    </div>
  );
}
