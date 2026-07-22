import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ------------------------------------------------------------------ types
interface EscalationRecord {
  ticket_id: string | null;
  assigned_on: string | null;
  processed_on: string | null;
  closed_on: string | null;
  subject: string | null;
  error_by: string | null;
  actions_taken: string | null;
  affected_options: number;
  error_type: string | null;
  resolution_days: number | null;
  process_days: number | null;
  month: string | null;
}

interface ByType {
  error_type: string;
  count: number;
  pct: number | null;
  avg_resolution_days: number | null;
  total_affected: number;
}

interface ByMonth {
  month: string;
  count: number;
  critical_count: number;
  noncritical_count: number;
  total_affected: number;
  avg_resolution_days: number | null;
}

interface ResolutionBucket {
  bucket: string;
  count: number;
  pct: number | null;
  critical: number;
}

interface EscalationsData {
  generated_at: string;
  kpis: {
    total_escalations: number;
    critical_count: number;
    noncritical_count: number;
    total_affected_options: number;
    avg_resolution_days: number | null;
    max_resolution_days: number | null;
    min_resolution_days: number | null;
    pct_critical: number | null;
  };
  records: EscalationRecord[];
  by_error_type: ByType[];
  by_month: ByMonth[];
  resolution_buckets: ResolutionBucket[];
}

// ------------------------------------------------------------------ helpers
const CRITICAL_COLOR = "#EF4444";
const NONCRITICAL_COLOR = "#F59E0B";
const RESOLUTION_COLOR = "#0EA5E9";

function fmt(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined) return "—";
  return val.toFixed(decimals);
}

function errorTypeBadge(type: string | null) {
  if (!type) return null;
  const isCritical = type === "Critical";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: isCritical ? "#FEE2E2" : "#FEF3C7",
        color: isCritical ? "#B91C1C" : "#92400E",
        whiteSpace: "nowrap",
      }}
    >
      {type}
    </span>
  );
}

function resolutionColor(days: number | null): string {
  if (days === null) return "#94A3B8";
  if (days <= 3) return "#10B981";
  if (days <= 7) return "#F59E0B";
  return "#EF4444";
}

// ------------------------------------------------------------------ KpiCard
function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: "16px 20px",
        minWidth: 140,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: accent || "#1E293B",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ main component
export default function EscalationsTab({ data, hideKpis }: { data: EscalationsData; hideKpis?: boolean }) {
  const { kpis, records, by_error_type, by_month, resolution_buckets } = data;

  const [filter, setFilter] = useState<"All" | "Critical" | "Non - critical">("All");

  const filtered = filter === "All" ? records : records.filter((r) => r.error_type === filter);

  // Month chart data — ensure human-readable label
  const monthChartData = by_month.map((m) => {
    const [year, month] = m.month.split("-");
    const label = new Date(`${year}-${month}-01`).toLocaleString("default", {
      month: "short",
      year: "2-digit",
    });
    return { ...m, label };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ---- KPI row ---- */}
      {!hideKpis && (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Total Escalations" value={kpis.total_escalations} />
        <KpiCard
          label="Critical"
          value={kpis.critical_count}
          sub={`${fmt(kpis.pct_critical, 0)}% of total`}
          accent={CRITICAL_COLOR}
        />
        <KpiCard
          label="Non-Critical"
          value={kpis.noncritical_count}
          accent={NONCRITICAL_COLOR}
        />
        <KpiCard
          label="Total Affected Options"
          value={kpis.total_affected_options.toLocaleString()}
          sub="across all tickets"
        />
        <KpiCard
          label="Avg Resolution"
          value={`${fmt(kpis.avg_resolution_days)} days`}
          sub={`Min ${fmt(kpis.min_resolution_days, 0)} · Max ${fmt(kpis.max_resolution_days, 0)}`}
          accent={RESOLUTION_COLOR}
        />
      </div>
      )}

      {/* ---- Charts row ---- */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Resolution bucket bar chart */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: 16,
            flex: "1 1 300px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 12 }}>
            Resolution Time Distribution
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={resolution_buckets}
              margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
              <Tooltip
                formatter={(val: number, name: string) =>
                  name === "count" ? [`${val} tickets`, "Tickets"] : [val, name]
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {resolution_buckets.map((b, i) => (
                  <Cell
                    key={i}
                    fill={
                      b.bucket === "Same day" || b.bucket === "1-3 days"
                        ? "#10B981"
                        : b.bucket === "4-7 days"
                        ? "#F59E0B"
                        : "#EF4444"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#64748B" }}>
            <span style={{ color: "#10B981" }}>■ ≤3 days</span>
            <span style={{ color: "#F59E0B" }}>■ 4–7 days</span>
            <span style={{ color: "#EF4444" }}>■ 8+ days</span>
          </div>
        </div>

        {/* By month stacked */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: 16,
            flex: "1 1 300px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 12 }}>
            Escalations by Month
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={monthChartData}
              margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
            >
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="critical_count" name="Critical" stackId="a" fill={CRITICAL_COLOR} radius={[0, 0, 0, 0]} />
              <Bar dataKey="noncritical_count" name="Non-Critical" stackId="a" fill={NONCRITICAL_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "#64748B" }}>
            <span style={{ color: CRITICAL_COLOR }}>■ Critical</span>
            <span style={{ color: NONCRITICAL_COLOR }}>■ Non-Critical</span>
          </div>
        </div>

        {/* By error type summary */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: 16,
            flex: "1 1 220px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", marginBottom: 12 }}>
            By Error Type
          </div>
          {by_error_type.map((t) => (
            <div
              key={t.error_type}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <div>
                {errorTypeBadge(t.error_type)}
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>
                  {t.total_affected} options affected
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B" }}>{t.count}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>
                  avg {fmt(t.avg_resolution_days)} days
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Detail table ---- */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 10,
          padding: 16,
        }}
      >
        {/* Table header row with filter */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
            Escalation Log
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 400,
                color: "#94A3B8",
              }}
            >
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["All", "Critical", "Non - critical"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "1px solid",
                  borderColor: filter === f ? "#0EA5E9" : "#E2E8F0",
                  background: filter === f ? "#EFF6FF" : "#fff",
                  color: filter === f ? "#0369A1" : "#64748B",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f === "Non - critical" ? "Non-Critical" : f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {[
                  "Ticket",
                  "Assigned",
                  "Closed",
                  "Error Type",
                  "Affected Options",
                  "Resolution (days)",
                  "Actions Taken",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "#64748B",
                      fontWeight: 600,
                      borderBottom: "1px solid #E2E8F0",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.ticket_id ?? i}
                  style={{
                    background: i % 2 === 0 ? "#fff" : "#F8FAFC",
                    borderBottom: "1px solid #F1F5F9",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 10px",
                      fontWeight: 600,
                      color: "#1E293B",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.ticket_id ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#475569", whiteSpace: "nowrap" }}>
                    {r.assigned_on ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#475569", whiteSpace: "nowrap" }}>
                    {r.closed_on ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>{errorTypeBadge(r.error_type)}</td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      color: "#1E293B",
                      fontWeight: 500,
                    }}
                  >
                    {r.affected_options ?? 0}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontWeight: 600,
                        fontSize: 11,
                        background:
                          r.resolution_days === null
                            ? "#F1F5F9"
                            : r.resolution_days <= 3
                            ? "#D1FAE5"
                            : r.resolution_days <= 7
                            ? "#FEF3C7"
                            : "#FEE2E2",
                        color: resolutionColor(r.resolution_days),
                      }}
                    >
                      {r.resolution_days !== null ? r.resolution_days : "—"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: "#475569",
                      maxWidth: 320,
                    }}
                  >
                    {r.actions_taken ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
