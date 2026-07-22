import { useState } from "react";
import * as XLSX from "xlsx";
import { GITHUB } from "../config";
import type { Visibility } from "../data/store";
import {
  putFile,
  base64FromFile,
  base64FromString,
  getFileContent,
} from "../lib/github";

// Sheets + key columns the generator relies on. Validated before commit
// so a malformed file fails instantly here, not silently in the Action.
const REQUIRED_SHEETS = ["Your Jira Issues", "Esclations"];
const REQUIRED_COLUMNS = [
  "Key",
  "Status",
  "Created",
  "Updated",
  "Total SKU Count",
  "Total Option Count",
  "Listing Type - Sorted",
  "L1 for UCW",
  "Platform.",
  "TAT (Days)",
];

async function validateExcel(file: File): Promise<string[]> {
  const problems: string[] = [];
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array" });
  } catch {
    return ["Could not read the file as an Excel workbook (.xlsx)."];
  }
  for (const s of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(s)) problems.push(`Missing sheet: "${s}"`);
  }
  const ws = wb.Sheets["Your Jira Issues"];
  if (ws) {
    const header: string[] = (
      XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 })[0] as any[] | undefined
    )?.map((h) => String(h).trim()) ?? [];
    for (const c of REQUIRED_COLUMNS) {
      if (!header.includes(c)) problems.push(`Missing column in "Your Jira Issues": "${c}"`);
    }
  }
  return problems;
}

const TAB_META: { key: keyof Visibility["tabs"]; label: string }[] = [
  { key: "wow", label: "WoW Dashboard" },
  { key: "summary", label: "Monthly Summary" },
  { key: "eod", label: "Day View" },
  { key: "escalations", label: "Escalations" },
];

type Status = { kind: "idle" | "working" | "ok" | "error"; msg: string };

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        background: checked ? "#185FA5" : "#cbd5e1",
        position: "relative",
        transition: "background 0.15s",
        opacity: disabled ? 0.5 : 1,
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

export default function AdminPanel({
  token,
  setToken,
  visibility,
  setVisibility,
}: {
  token: string;
  setToken: (t: string) => void;
  visibility: Visibility;
  setVisibility: (v: Visibility) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Status>({ kind: "idle", msg: "" });
  const [visStatus, setVisStatus] = useState<Status>({ kind: "idle", msg: "" });
  const [revertStatus, setRevertStatus] = useState<Status>({ kind: "idle", msg: "" });

  // Token editing uses an explicit Save (draft -> committed token).
  const [tokenDraft, setTokenDraft] = useState(token);
  const [tokenStatus, setTokenStatus] = useState<Status>({ kind: "idle", msg: "" });

  function saveToken() {
    const t = tokenDraft.trim();
    setToken(t); // App persists this to localStorage
    setTokenDraft(t);
    setTokenStatus(
      t
        ? { kind: "ok", msg: "Token saved to this browser." }
        : { kind: "error", msg: "Token cleared." }
    );
  }
  function clearToken() {
    setTokenDraft("");
    setToken(""); // App persists the empty value so it stays cleared on reload
    setTokenStatus({ kind: "ok", msg: "Token cleared from this browser." });
  }

  const configPlaceholder = GITHUB.owner === "YOUR_GITHUB_ORG_OR_USER";

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: 24,
    marginBottom: 20,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #d0d8e8",
    borderRadius: 6,
    fontFamily: "inherit",
    color: "#1e3a5f",
    background: "#fff",
    boxSizing: "border-box",
    outline: "none",
  };
  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    padding: "9px 18px",
    background: enabled ? "#185FA5" : "#94a3b8",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: enabled ? "pointer" : "default",
    fontFamily: "inherit",
  });
  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    marginBottom: 6,
    display: "block",
  };

  function statusColor(s: Status) {
    if (s.kind === "ok") return "#15803d";
    if (s.kind === "error") return "#c0392b";
    if (s.kind === "working") return "#185FA5";
    return "#64748B";
  }

  async function handleUpload() {
    if (!token || !file) return;

    // 1. Validate the workbook in-browser before committing anything.
    setUploadStatus({ kind: "working", msg: "Checking the file…" });
    const problems = await validateExcel(file);
    if (problems.length) {
      setUploadStatus({
        kind: "error",
        msg: "This file doesn't match the expected format:\n• " + problems.join("\n• "),
      });
      return;
    }

    try {
      // 2. Snapshot the current Excel to previous.xlsx (for revert).
      setUploadStatus({ kind: "working", msg: "Snapshotting current data…" });
      const current = await getFileContent(GITHUB.excelPath, token);
      if (current) {
        await putFile(
          GITHUB.excelPrevPath,
          current.base64,
          `snapshot previous before refresh @ ${new Date().toISOString()}`,
          token
        );
      }

      // 3. Commit the new Excel — this triggers the refresh Action.
      setUploadStatus({ kind: "working", msg: "Uploading Excel to GitHub…" });
      const b64 = await base64FromFile(file);
      await putFile(
        GITHUB.excelPath,
        b64,
        `data refresh: ${file.name} @ ${new Date().toISOString()}`,
        token
      );
      setUploadStatus({
        kind: "ok",
        msg: "Uploaded and validated. The refresh pipeline is running — the dashboard updates in ~1–2 minutes. Reload then to see new data.",
      });
      setFile(null);
    } catch (e: any) {
      setUploadStatus({ kind: "error", msg: `Failed: ${e?.message ?? e}` });
    }
  }

  async function handleRevert() {
    if (!token) return;
    setRevertStatus({ kind: "working", msg: "Reverting to previous upload…" });
    try {
      const prev = await getFileContent(GITHUB.excelPrevPath, token);
      if (!prev) {
        setRevertStatus({
          kind: "error",
          msg: "No previous upload found to revert to.",
        });
        return;
      }
      await putFile(
        GITHUB.excelPath,
        prev.base64,
        `revert to previous upload @ ${new Date().toISOString()}`,
        token
      );
      setRevertStatus({
        kind: "ok",
        msg: "Reverted. The pipeline is rebuilding from the previous file (~1–2 min). Reload after.",
      });
    } catch (e: any) {
      setRevertStatus({ kind: "error", msg: `Failed: ${e?.message ?? e}` });
    }
  }

  async function handlePublishVisibility() {
    if (!token) return;
    setVisStatus({ kind: "working", msg: "Publishing visibility…" });
    try {
      const json = JSON.stringify(visibility, null, 2);
      await putFile(
        GITHUB.visibilityRepoPath,
        base64FromString(json),
        `visibility update @ ${new Date().toISOString()}`,
        token
      );
      setVisStatus({
        kind: "ok",
        msg: "Published. Client visibility updates on next deploy (~1–2 min).",
      });
    } catch (e: any) {
      setVisStatus({ kind: "error", msg: `Failed: ${e?.message ?? e}` });
    }
  }

  function setTabVis(key: keyof Visibility["tabs"], val: boolean) {
    setVisibility({ ...visibility, tabs: { ...visibility.tabs, [key]: val } });
  }
  function setKpiVis(key: keyof Visibility["kpis"], val: boolean) {
    setVisibility({ ...visibility, kpis: { ...visibility.kpis, [key]: val } });
  }
  function setRange(patch: Partial<Visibility["clientRange"]>) {
    setVisibility({ ...visibility, clientRange: { ...visibility.clientRange, ...patch } });
  }
  const cr = visibility.clientRange;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1e3a5f", margin: "0 0 4px" }}>
        Admin
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 20px" }}>
        Upload the latest Jira Excel to refresh the dashboard, and control what the
        client sees. Repo:{" "}
        <code style={{ background: "#eef2f7", padding: "1px 6px", borderRadius: 4 }}>
          {GITHUB.owner}/{GITHUB.repo}
        </code>
      </p>

      {configPlaceholder && (
        <div
          style={{
            ...card,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontSize: 13,
          }}
        >
          <strong>Confirm repo:</strong> <code>src/config.ts</code> has a best-guess
          GitHub <code>owner</code> / <code>repo</code> (<code>{GITHUB.owner}/{GITHUB.repo}</code>).
          Verify it matches your repository — uploads 404 if it's wrong.
        </div>
      )}

      {/* GitHub token */}
      <div style={card}>
        <label style={label}>GitHub access token (fine-grained PAT)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            placeholder="github_pat_…  (Contents: Read and write on this repo)"
            value={tokenDraft}
            onChange={(e) => {
              setTokenDraft(e.target.value);
              if (tokenStatus.kind !== "idle") setTokenStatus({ kind: "idle", msg: "" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveToken();
            }}
            style={{ ...inputStyle, flex: 1 }}
            autoComplete="off"
          />
          <button
            type="button"
            onClick={saveToken}
            disabled={tokenDraft === token}
            style={btnStyle(tokenDraft !== token)}
          >
            Save
          </button>
          <button
            type="button"
            onClick={clearToken}
            style={{
              background: "transparent",
              border: "1px solid #e2e8f0",
              color: "#64748B",
              borderRadius: 6,
              padding: "0 14px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Clear
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
          Paste a token and press <strong>Save</strong> — it's stored in this browser and
          survives reloads. If uploads fail with “Bad credentials” (401), the token is
          expired or revoked; paste a fresh one and Save.
        </p>
        {tokenStatus.msg && (
          <p style={{ fontSize: 13, color: statusColor(tokenStatus), margin: "8px 0 0" }}>
            {tokenStatus.msg}
          </p>
        )}
        {tokenDraft !== token && (
          <p style={{ fontSize: 12, color: "#b45309", margin: "6px 0 0" }}>
            Unsaved change — press Save for it to take effect.
          </p>
        )}
      </div>

      {/* Data refresh */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1e3a5f", marginBottom: 4 }}>
          Refresh data
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 14px" }}>
          Upload the monthly/weekly Jira export (.xlsx). It replaces the current
          dataset. The pipeline runs your <code>generate_json.py</code> and publishes
          the result to the dashboard.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setUploadStatus({ kind: "idle", msg: "" });
          }}
          style={{ fontSize: 13, marginBottom: 14, display: "block" }}
        />
        <button
          type="button"
          disabled={!token || !file || uploadStatus.kind === "working"}
          onClick={handleUpload}
          style={btnStyle(!!token && !!file && uploadStatus.kind !== "working")}
        >
          {uploadStatus.kind === "working" ? "Publishing…" : "Publish refresh"}
        </button>
        {uploadStatus.msg && (
          <p
            style={{
              fontSize: 13,
              color: statusColor(uploadStatus),
              margin: "12px 0 0",
              whiteSpace: "pre-line",
            }}
          >
            {uploadStatus.msg}
          </p>
        )}

        {/* Revert */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #eef2f7" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
            Undo
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 10px" }}>
            Restore the previous upload (the file from before the last refresh) and
            rebuild from it.
          </p>
          <button
            type="button"
            disabled={!token || revertStatus.kind === "working"}
            onClick={handleRevert}
            style={{
              padding: "8px 16px",
              background: "#fff",
              color: "#b45309",
              border: "1px solid #fcd34d",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: !token || revertStatus.kind === "working" ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: !token ? 0.5 : 1,
            }}
          >
            {revertStatus.kind === "working" ? "Reverting…" : "Revert last upload"}
          </button>
          {revertStatus.msg && (
            <p style={{ fontSize: 13, color: statusColor(revertStatus), margin: "10px 0 0" }}>
              {revertStatus.msg}
            </p>
          )}
        </div>
      </div>

      {/* Visibility */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1e3a5f", marginBottom: 4 }}>
          Client visibility
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 16px" }}>
          Choose which tabs and KPI strips the <strong>client</strong> account sees.
          You (admin) always see everything. Changes preview instantly here; click
          Publish to push them to the client.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            rowGap: 12,
            columnGap: 16,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>TAB</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", textAlign: "center" }}>
            SHOW TAB
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", textAlign: "center" }}>
            SHOW KPIs
          </div>
          {TAB_META.map((t) => (
            <Row
              key={t.key}
              label={t.label}
              tabOn={visibility.tabs[t.key]}
              kpiOn={visibility.kpis[t.key]}
              onTab={(v) => setTabVis(t.key, v)}
              onKpi={(v) => setKpiVis(t.key, v)}
            />
          ))}
        </div>

        {/* Client date range */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #eef2f7" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
              Limit client to a date range
            </div>
            <Toggle checked={cr.enabled} onChange={(v) => setRange({ enabled: v })} />
          </div>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px" }}>
            When on, the client is locked to this window on the WoW and Day View tabs
            (they can't see weeks/days outside it). You always see everything.
          </p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", opacity: cr.enabled ? 1 : 0.5 }}>
            <label style={{ fontSize: 12, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 }}>
              From
              <input
                type="date"
                disabled={!cr.enabled}
                value={cr.start ?? ""}
                max={cr.end ?? undefined}
                onChange={(e) => setRange({ start: e.target.value || null })}
                style={{ ...inputStyle, width: 180 }}
              />
            </label>
            <label style={{ fontSize: 12, color: "#64748B", display: "flex", flexDirection: "column", gap: 4 }}>
              To
              <input
                type="date"
                disabled={!cr.enabled}
                value={cr.end ?? ""}
                min={cr.start ?? undefined}
                onChange={(e) => setRange({ end: e.target.value || null })}
                style={{ ...inputStyle, width: 180 }}
              />
            </label>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            disabled={!token || visStatus.kind === "working"}
            onClick={handlePublishVisibility}
            style={btnStyle(!!token && visStatus.kind !== "working")}
          >
            {visStatus.kind === "working" ? "Publishing…" : "Publish visibility"}
          </button>
          {visStatus.msg && (
            <p style={{ fontSize: 13, color: statusColor(visStatus), margin: "12px 0 0" }}>
              {visStatus.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  tabOn,
  kpiOn,
  onTab,
  onKpi,
}: {
  label: string;
  tabOn: boolean;
  kpiOn: boolean;
  onTab: (v: boolean) => void;
  onKpi: (v: boolean) => void;
}) {
  return (
    <>
      <div style={{ fontSize: 14, color: "#1e3a5f" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Toggle checked={tabOn} onChange={onTab} />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Toggle checked={kpiOn} onChange={onKpi} disabled={!tabOn} />
      </div>
    </>
  );
}
