# TataCliq Dashboard — Login, Upload & Visibility

This build adds three things to the dashboard:

1. **Two logins** — a read-only **client** account and an **admin** account.
2. **Self-serve data refresh** — the team uploads the Jira Excel from the admin
   panel; a GitHub Action runs your `generate_json.py` and publishes the result to
   the EC2. No more manual re-run + rebuild + redeploy.
3. **Client visibility toggles** — the admin controls which tabs and KPI strips the
   client sees.

---

## 1. How it works (architecture)

The single most important change: **data is no longer baked into the build.** The app
now **fetches** its JSON at runtime from `/data/*.json`. That means new data appears on
the next page load — no rebuild required.

```
Admin (browser)                 GitHub                         EC2
──────────────                  ──────                         ───
 pick .xlsx ─────► commit ─────► data/incoming/latest.xlsx
 (paste PAT)                        │
                                    ▼
                            GitHub Action "refresh"
                              • pip install pandas
                              • python scripts/generate_json.py
                                (your exact logic)
                              • produces wow/summary/…​.json
                                    │  rsync over SSH
                                    ▼
                                                        /data/*.json  ◄── nginx serves
                                                              ▲
 Client / Admin browser  ── fetch /data/*.json ───────────────┘
```

Each upload **replaces** the current dataset (your Excel is cumulative, so no history is
kept). Until the first upload, the dashboard shows a friendly "No data loaded yet" state.

---

## 2. Credentials

| Role   | Email                     | Password        | Can do                                  |
|--------|---------------------------|-----------------|-----------------------------------------|
| Admin  | `tatacliq@netscribes.com` | `Tatacliq@2026` | Everything + upload + visibility toggles |
| Client | `client@netscribes.com`   | `TataCliq@2026` | View only what admin left visible        |

These live in `src/auth.ts`. This is demo-grade auth (client-side, visible in the
bundle) — see **Hardening** below.

---

## 3. One-time setup

### 3a. Point the app at your repo
Edit **`src/config.ts`**:

```ts
export const GITHUB = {
  owner: "your-org-or-username",   // <-- change
  repo:  "tatacliqdb",             // <-- change if different
  branch: "main",
  ...
};
```

> **Temporary token is already baked in.** `src/config.ts` ships with a `DEFAULT_PAT`
> that pre-fills the admin token field so uploads work immediately. It is in the built
> bundle and therefore **not secret** — rotate it (and clear `DEFAULT_PAT`, or replace it)
> before any real client use. An admin can also paste a different token to override it.

### 3b. Create a fine-grained Personal Access Token (PAT)
GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token:
- **Resource owner:** the org/user that owns the repo
- **Repository access:** *Only select repositories* → this repo only
- **Permissions:** *Contents* → **Read and write**
- Copy the token (`github_pat_…`). The admin pastes it into the admin panel when
  uploading — it is **not** stored in the app.

> Anyone with this PAT can write to the repo. Scope it to the single repo, and only
> share it with people who run refreshes.

### 3c. Add the EC2 deploy secrets (repo → Settings → Secrets and variables → Actions)
| Secret            | Value                                                        |
|-------------------|--------------------------------------------------------------|
| `EC2_SSH_KEY`     | Private SSH key that can log into the EC2 (full contents)     |
| `EC2_HOST`        | EC2 public DNS or IP, e.g. `ec2-1-2-3-4.compute.amazonaws.com`|
| `EC2_USER`        | SSH user, e.g. `ubuntu`                                       |
| `EC2_TARGET_DIR`  | **Dedicated** folder the site serves at `/data`, e.g. `/var/www/tatacliq/data` |

> `EC2_TARGET_DIR` must be a data-only folder — the deploy uses `rsync --delete` to keep
> it in sync with the six JSON files. Don't point it at your whole web root.

### 3d. Serve `/data` on the EC2
Make the folder from `EC2_TARGET_DIR` reachable at the URL path `/data`. If nginx serves
the built site from `/var/www/tatacliq/dist`, either:
- put the data folder at `/var/www/tatacliq/dist/data` (simplest — set
  `EC2_TARGET_DIR` to that), **or**
- add an alias:
  ```nginx
  location /data/ {
      alias /var/www/tatacliq/data/;
      add_header Cache-Control "no-store";
  }
  ```
The SPA fallback you already use stays as-is (serve `index.html` for app routes).

---

## 4. Repo layout (what's new)

```
src/config.ts                 <- set your GitHub owner/repo here
src/auth.ts                   <- the two accounts
src/data/store.ts             <- runtime data loader (replaces build-time imports)
src/lib/github.ts             <- browser GitHub Contents API client
src/components/AdminPanel.tsx  <- upload + visibility UI
scripts/generate_json.py      <- your generator, env-driven (EXCEL_PATH / OUTPUT_DIR)
scripts/requirements.txt
.github/workflows/refresh.yml  <- the pipeline
public/data/*.json             <- blank starting data (served at /data locally)
public/data/visibility.json    <- client visibility config
data/incoming/                 <- uploaded Excel lands here as latest.xlsx
sample-data/*.json             <- your current real JSON, for local testing (optional)
```

---

## 5. The weekly/daily refresh (for the team)

1. Sign in as **admin**.
2. Click **Admin panel** (top right).
3. Paste the **PAT** (once per session).
4. Under **Refresh data**, choose the Jira `.xlsx` and click **Publish refresh**.
5. Wait ~1–2 minutes (the Action runs), then reload the dashboard.

The Excel must contain the sheets your generator expects: **`Your Jira Issues`** and
**`Esclations`** (the existing spelling), with the same columns as today.

---

## 6. Visibility toggles & client date range

In the admin panel under **Client visibility**, toggle **Show tab** and **Show KPIs**
per tab. Changes preview instantly for you; click **Publish visibility** to push them to
the client (takes effect on the next deploy, ~1–2 min). The admin always sees everything.

**Limit client to a date range** (hard clamp): turn on the toggle and set From/To. The
client is then locked to that window on the **WoW Dashboard** and **Day View** tabs —
weeks/days outside it are removed and they can't widen the view. It's stored in the same
`visibility.json` and published with the **Publish visibility** button. The clamp applies
to the date-granular tabs; Monthly Summary and Escalations are pre-aggregated over the
whole dataset, so they aren't sliced by the range. Admin is never clamped.

## 6b. Upload safety

- **Validation before commit:** when you pick an Excel, it's parsed in your browser and
  checked for the required sheets (`Your Jira Issues`, `Esclations`) and key columns
  *before* anything is committed. A bad file is rejected instantly with the exact missing
  sheet/column — nothing reaches GitHub, so the Action never runs on a broken file.
- **Revert last upload:** each upload first snapshots the current Excel to
  `data/incoming/previous.xlsx`. The **Revert last upload** button restores that snapshot
  and rebuilds from it — a one-click undo of the most recent refresh.

---

## 7. Local testing

```bash
npm install
npm run dev
```
Sign in with either account. By default `public/data/*.json` is blank, so you'll see the
empty state. To preview with real data locally, copy the samples in:

```bash
cp sample-data/*.json public/data/
```
(Don't commit those over the blank ones unless you want the deployed default populated.)

Build check:
```bash
npm run build
```

---

## 8. Security notes & hardening

This is a **prototype-grade** setup, appropriate for a controlled demo:
- Login is client-side; credentials are in the bundle and the check is bypassable.
- The PAT is entered at runtime (not shipped in the bundle) and kept in memory only —
  but a determined admin-session user could read it while it's in memory. Scope it to the
  one repo.

To harden later (post-demo), the clean upgrade is a small backend on the EC2 that:
holds the GitHub token / does the commit server-side, runs real session-based auth, and
serves `/data`. That removes the browser token entirely. The frontend already fetches
`/data` at runtime, so that change is localized to auth + the upload call.

---

## 9. Troubleshooting

- **"Setup needed" banner in admin panel** → `src/config.ts` still has the placeholder
  owner. Set your real `owner`/`repo`.
- **Upload returns 401/403** → PAT missing *Contents: Read and write*, or not scoped to
  this repo.
- **Upload succeeds but dashboard doesn't change** → check the Action run in the repo's
  **Actions** tab. Common causes: missing EC2 secret, wrong `EC2_TARGET_DIR`, or the
  Excel missing a required sheet/column (the Action log prints column warnings).
- **Dashboard shows blank after a good upload** → `/data` on the EC2 isn't the folder the
  Action deploys to. Confirm `EC2_TARGET_DIR` is what nginx serves at `/data`.
