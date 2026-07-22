// ------------------------------------------------------------------
// Central config — EDIT the GITHUB block once for your repo.
// ------------------------------------------------------------------
//
// The admin panel commits to this repo via the GitHub Contents API:
//   1. the raw Excel   -> <excelPath>          (triggers the Action)
//   2. previous Excel  -> <excelPrevPath>      (snapshot, for revert)
//   3. visibility.json -> <visibilityRepoPath> (client tabs/KPIs/range)
//
// A GitHub Action then runs generate_json.py and deploys the produced
// JSON to the EC2. See SETUP.md.

export const GITHUB = {
  // TODO: confirm these two — best guess based on your other repo.
  owner: "ns-adiraghavan",
  repo: "tatacliqdb",
  // branch the Action watches
  branch: "main",
  // where the admin uploads the raw Excel (Action input)
  excelPath: "data/incoming/latest.xlsx",
  // snapshot of the prior Excel — enables "revert last upload"
  excelPrevPath: "data/incoming/previous.xlsx",
  // where visibility config is stored in the repo (served from /data)
  visibilityRepoPath: "public/data/visibility.json",
};

// -----------------------------------------------------------------
// TEMPORARY convenience token.
// This fine-grained PAT pre-fills the admin token field so uploads work
// out of the box. It IS shipped in the built bundle and is therefore
// readable by anyone who can open the app — treat it as non-secret and
// ROTATE it before any real client use. Set to "" to force manual paste.
// -----------------------------------------------------------------
export const DEFAULT_PAT =
  "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";

// Base URL the app fetches runtime JSON from.
// Locally (vite) this resolves to public/data/*.json.
// On EC2, point nginx so this path serves the deployed data folder.
export const DATA_BASE = "/data";

// Files fetched at runtime.
export const DATA_FILES = {
  wow: "wow.json",
  summary: "summary.json",
  bifurcation: "bifurcation.json",
  eod: "eod.json",
  escalations: "escalations.json",
  visibility: "visibility.json",
} as const;
