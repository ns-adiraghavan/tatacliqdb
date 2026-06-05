import { useState, useMemo, useEffect, useRef } from "react";
import KpiCard from "./KpiCard";
import DataTable, { Column } from "./DataTable";

const STATUS_COLORS: Record<string, string> = {
  "CLOSED": "#22C55E",
  "CLOSED Due to Inactive/Insufficient Information": "#94A3B8",
  "Ticket Raised": "#0EA5E9",
  "Brand to Resolve Queries": "#F59E0B",
  "FAILED": "#EF4444",
  "Uploaded/Retriggered": "#8B5CF6",
  "Tech Error": "#F97316",
};

function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function formatLong(dateStr: string) {
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function CalendarPicker({
  available,
  selected,
  onSelect,
}: {
  available: Set<string>;
  selected: string;
  onSelect: (d: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel = new Date(selected);
  const [view, setView] = useState({
    y: sel.getUTCFullYear(),
    m: sel.getUTCMonth(),
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const sortedAvail = useMemo(
    () => Array.from(available).sort(),
    [available]
  );
  const minDate = sortedAvail[0];
  const maxDate = sortedAvail[sortedAvail.length - 1];

  const firstOfMonth = new Date(Date.UTC(view.y, view.m, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();

  const canPrev = minDate && ymd(view.y, view.m, 1) > minDate.slice(0, 8) + "01";
  const canNext =
    maxDate && ymd(view.y, view.m + 1, 1) <= maxDate;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
          background: "#fff",
          color: "#1A3C5E",
          border: "1px solid #E2E8F0",
          fontFamily: "inherit",
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        📅 {formatLong(selected)}
        <span style={{ color: "#94A3B8", fontSize: 11 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
            padding: 14,
            width: 280,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <button
              onClick={() =>
                canPrev &&
                setView((v) =>
                  v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }
                )
              }
              disabled={!canPrev}
              style={{
                border: "none",
                background: "transparent",
                cursor: canPrev ? "pointer" : "not-allowed",
                color: canPrev ? "#1A3C5E" : "#CBD5E1",
                fontSize: 16,
                padding: "2px 8px",
              }}
            >
              ‹
            </button>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1A3C5E" }}>
              {new Date(Date.UTC(view.y, view.m, 1)).toLocaleString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>
            <button
              onClick={() =>
                canNext &&
                setView((v) =>
                  v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }
                )
              }
              disabled={!canNext}
              style={{
                border: "none",
                background: "transparent",
                cursor: canNext ? "pointer" : "not-allowed",
                color: canNext ? "#1A3C5E" : "#CBD5E1",
                fontSize: 16,
                padding: "2px 8px",
              }}
            >
              ›
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
              fontSize: 11,
              color: "#94A3B8",
              marginBottom: 4,
            }}
          >
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} style={{ textAlign: "center", padding: 4 }}>
                {d}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
            }}
          >
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dateStr = ymd(view.y, view.m, d);
              const isAvail = available.has(dateStr);
              const isSel = dateStr === selected;
              return (
                <button
                  key={i}
                  disabled={!isAvail}
                  onClick={() => {
                    onSelect(dateStr);
                    setOpen(false);
                  }}
                  style={{
                    aspectRatio: "1",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "inherit",
                    cursor: isAvail ? "pointer" : "not-allowed",
                    background: isSel ? "#1e3a5f" : isAvail ? "#F1F5F9" : "transparent",
                    color: isSel
                      ? "#fff"
                      : isAvail
                      ? "#1A3C5E"
                      : "#CBD5E1",
                    fontWeight: isSel ? 700 : isAvail ? 500 : 400,
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A3C5E", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function EodTab({ data }: { data: any }) {
  const dates: string[] = data.dates;
  const [selected, setSelected] = useState<string>(dates[dates.length - 1]);

  const day = useMemo(
    () => data.days.find((d: any) => d.date === selected) || data.days[data.days.length - 1],
    [data, selected]
  );

  const categoryCols: Column<any>[] = [
    { header: "Category", render: (r) => r.category },
    { header: "Tickets", align: "right", render: (r) => fmtNum(r.tickets) },
    { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
    { header: "Avg TAT", align: "right", render: (r) => r.avg_tat.toFixed(2) },
  ];

  const platformCols: Column<any>[] = [
    { header: "Platform", render: (r) => r.platform.replace(";", " & ") },
    { header: "Tickets", align: "right", render: (r) => fmtNum(r.tickets) },
    { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
    { header: "Avg TAT", align: "right", render: (r) => r.avg_tat.toFixed(2) },
  ];

  const listingCols: Column<any>[] = [
    { header: "Type", render: (r) => r.listing_type },
    { header: "Tickets", align: "right", render: (r) => fmtNum(r.tickets) },
    { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
    { header: "Avg TAT", align: "right", render: (r) => r.avg_tat.toFixed(2) },
  ];

  const brandCols: Column<any>[] = [
    { header: "Brand", render: (r) => r.brand_name },
    { header: "Tickets", align: "right", render: (r) => fmtNum(r.tickets) },
    { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
    { header: "Avg TAT", align: "right", render: (r) => r.avg_tat.toFixed(2) },
  ];

  const ticketCols: Column<any>[] = [
    {
      header: "Ticket Key",
      render: (r) => (
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{r.key}</span>
      ),
    },
    { header: "Status", render: (r) => r.status },
    { header: "Assignee", render: (r) => r.assignee },
    { header: "Category", render: (r) => r.category },
    { header: "Platform", render: (r) => (r.platform ?? "").replace(";", " & ") },
    { header: "Type", render: (r) => r.listing_type },
    { header: "Brand", render: (r) => r.brand },
    { header: "Ad-hoc SKUs", align: "right", render: (r) => fmtNum(r.adhoc_skus) },
    { header: "E2E Options", align: "right", render: (r) => fmtNum(r.e2e_options) },
    { header: "TAT", align: "right", render: (r) => (r.tat ?? 0).toFixed?.(2) ?? r.tat },
  ];

  const statusRows = (day.status || []).filter((s: any) => s.count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Date picker */}
      <div>
        <CalendarPicker
          available={new Set(dates)}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Total Tickets" value={fmtNum(day.total_tickets)} />
        <KpiCard label="Ad-hoc SKUs" value={fmtNum(day.adhoc_skus)} />
        <KpiCard label="E2E Options" value={fmtNum(day.e2e_options)} />
        <KpiCard label="Avg TAT" value={`${day.avg_tat} days`} />
        <KpiCard label="Open Tickets" value={fmtNum(day.open_tickets)} />
        <KpiCard label="Closure Rate" value={`${day.closure_rate}%`} />
      </div>

      {/* Row 1: Category | Platform */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Category Breakdown">
          <DataTable columns={categoryCols} rows={day.category || []} />
        </SectionCard>
        <SectionCard title="Platform">
          <DataTable columns={platformCols} rows={day.platform || []} />
        </SectionCard>
      </div>

      {/* Row 2: Listing Type | Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SectionCard title="Listing Type">
          <DataTable columns={listingCols} rows={day.listing_type || []} />
        </SectionCard>
        <SectionCard title="Status">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {statusRows.map((s: any) => (
              <div
                key={s.status}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: "#F8FAFC",
                  borderRadius: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: STATUS_COLORS[s.status] || "#64748B",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#1E293B" }}>{s.status}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1A3C5E" }}>
                  {fmtNum(s.count)}
                </span>
              </div>
            ))}
            {statusRows.length === 0 && (
              <div style={{ fontSize: 12, color: "#64748B" }}>No status data.</div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Brands */}
      <SectionCard title="Brands Worked On">
        <DataTable columns={brandCols} rows={day.brands || []} />
      </SectionCard>

      {/* Tickets */}
      <SectionCard title="Ticket Detail">
        <DataTable columns={ticketCols} rows={day.tickets || []} />
      </SectionCard>
    </div>
  );
}
