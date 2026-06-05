interface Props {
  label: string;
  value: string | number;
  subValue?: string;
  wowPct?: number | null;
  badgeLabel?: string;
  badgeTooltip?: string;
  invertColor?: boolean;
}

export default function KpiCard({ label, value, subValue, wowPct, badgeLabel, badgeTooltip, invertColor }: Props) {
  const hasWow = wowPct !== undefined && wowPct !== null && isFinite(wowPct);
  const positive = hasWow && (wowPct as number) >= 0;
  const good = invertColor ? !positive : positive;
  const color = good ? "#16A34A" : "#DC2626";
  const bg = good ? "#DCFCE7" : "#FEE2E2";
  const arrow = positive ? "▲" : "▼";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderLeft: "3px solid #185FA5",
        borderRadius: 8,
        padding: "14px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748B",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: "#1e3a5f",
          marginTop: 6,
        }}
      >
        {value}
      </div>
      {subValue && (
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            marginTop: 2,
          }}
        >
          {subValue}
        </div>
      )}
      {hasWow && (
        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: bg,
            color,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
          }}
          title={badgeTooltip ?? "Week-over-week change (W22 vs W21)"}
        >
          <span>{arrow}</span>
          <span>
            {positive ? "+" : ""}
            {(wowPct as number).toFixed(1)}%
          </span>
          {badgeLabel && <span style={{ fontWeight: 500, opacity: 0.8 }}>{badgeLabel}</span>}
        </div>
      )}
    </div>
  );
}
