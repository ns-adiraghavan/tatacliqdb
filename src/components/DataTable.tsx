import { ReactNode } from "react";

export interface Column<T> {
  header: string;
  render: (row: T, idx: number) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string | number;
  title?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  footer?: ReactNode;
}

export default function DataTable<T>({ columns, rows, footer }: Props<T>) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <style>{`
        .ucw-table tbody tr.ucw-row:hover { background: #e8f0fb !important; }
      `}</style>
      <div style={{ overflowX: "auto" }}>
        <table
          className="ucw-table"
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
        >
          <thead>
            <tr style={{ background: "#f0f4f8" }}>
              {columns.map((c, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: c.align ?? "left",
                    padding: "10px 12px",
                    fontWeight: 500,
                    color: "#1e3a5f",
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: "1px solid #E2E8F0",
                    whiteSpace: "nowrap",
                    width: c.width,
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className="ucw-row"
                style={{
                  background: ri % 2 === 0 ? "#FFFFFF" : "#f8f9fa",
                  transition: "background 0.15s",
                }}
              >
                {columns.map((c, ci) => (
                  <td
                    key={ci}
                    title={c.title}
                    style={{
                      padding: "9px 12px",
                      textAlign: c.align ?? "left",
                      color: "#1E293B",
                      borderBottom: "1px solid #F1F5F9",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.render(row, ri)}
                  </td>
                ))}
              </tr>
            ))}
            {footer}
          </tbody>
        </table>
      </div>
    </div>
  );
}
