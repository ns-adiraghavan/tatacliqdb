import { useMemo, useState } from "react";
import DataTable, { Column } from "./DataTable";

interface Row {
  tat_bucket: string;
  bucket_order: number;
  tickets: number;
  e2e_options: number;
  avg_tat: number | null;
  pct: number;
}

const BUCKET_COLOR: Record<string, string> = {
  "0-3 Days": "#22C55E",
  "4-7 Days": "#0EA5E9",
  "8-11 Days": "#F59E0B",
  "12-16 Days": "#F59E0B",
  "16+ Days": "#EF4444",
};

export default function BifurcationTab({ data }: { data: any }) {
  const [selected, setSelected] = useState<string>("All Categories");

  const rows: Row[] = useMemo(() => {
    const src = selected === "All Categories" ? data.overall : data.by_category[selected] ?? [];
    return [...src].sort((a, b) => a.bucket_order - b.bucket_order);
  }, [selected, data]);

  const columns: Column<Row>[] = [
    { header: "TAT Bucket", render: (r) => r.tat_bucket },
    { header: "No. of Tickets", align: "right", render: (r) => r.tickets.toLocaleString() },
    { header: "E2E Options", align: "right", render: (r) => r.e2e_options.toLocaleString() },
    {
      header: "Avg TAT (Days)",
      align: "right",
      title: "Weighted avg: sum(TAT × ticket volume) / sum(ticket volume)",
      render: (r) => (r.avg_tat === null ? "—" : r.avg_tat.toFixed(2)),
    },
    {
      header: "% Distribution",
      width: "30%",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 10,
              background: "#F1F5F9",
              borderRadius: 4,
              overflow: "hidden",
              minWidth: 120,
            }}
          >
            <div
              style={{
                width: `${r.pct}%`,
                height: "100%",
                background: BUCKET_COLOR[r.tat_bucket] ?? "#0EA5E9",
                transition: "width 0.3s",
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "#64748B", minWidth: 50, textAlign: "right" }}>
            {r.pct.toFixed(2)}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, color: "#1A3C5E" }}>
          Filter by Category
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #E2E8F0",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "inherit",
            background: "#fff",
            color: "#1E293B",
            minWidth: 240,
          }}
        >
          <option>All Categories</option>
          {data.categories.map((c: string) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} rows={rows} />

      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1A3C5E", marginBottom: 12 }}>
          Distribution
        </div>
        <div
          style={{
            display: "flex",
            height: 90,
            width: "100%",
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid #E2E8F0",
          }}
        >
          {rows.map((r) =>
            r.pct > 0 ? (
              <div
                key={r.tat_bucket}
                title={`${r.tat_bucket}: ${r.pct.toFixed(2)}%`}
                style={{
                  width: `${r.pct}%`,
                  background: BUCKET_COLOR[r.tat_bucket] ?? "#0EA5E9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {r.pct >= 5 ? `${r.pct.toFixed(1)}%` : ""}
              </div>
            ) : null
          )}
        </div>

        {/* Donut chart */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, marginTop: 24 }}>
          <svg width={180} height={180} viewBox="0 0 42 42">
            <circle cx="21" cy="21" r="15.915" fill="#fff" stroke="#F1F5F9" strokeWidth="6" />
            {(() => {
              let offset = 25;
              return rows.map((r) => {
                if (r.pct <= 0) return null;
                const dash = `${r.pct} ${100 - r.pct}`;
                const el = (
                  <circle
                    key={r.tat_bucket}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke={BUCKET_COLOR[r.tat_bucket] ?? "#0EA5E9"}
                    strokeWidth="6"
                    strokeDasharray={dash}
                    strokeDashoffset={offset}
                    transform="rotate(-90 21 21)"
                  >
                    <title>{`${r.tat_bucket}: ${r.pct.toFixed(2)}%`}</title>
                  </circle>
                );
                offset = (offset - r.pct + 100) % 100;
                return el;
              });
            })()}
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#64748B" }}>
            {rows.map((r) => (
              <div key={r.tat_bucket} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    background: BUCKET_COLOR[r.tat_bucket] ?? "#0EA5E9",
                    borderRadius: 3,
                  }}
                />
                <span style={{ minWidth: 90 }}>{r.tat_bucket}</span>
                <span style={{ fontWeight: 600, color: "#1E293B" }}>{r.pct.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 12,
            fontSize: 12,
            color: "#64748B",
          }}
        >
          {Object.entries(BUCKET_COLOR).map(([k, color]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  background: color,
                  borderRadius: 3,
                }}
              />
              {k}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
