// ------------------------------------------------------------------
// Minimal GitHub Contents API client (browser).
//
// Used by the admin panel to commit two things to the repo:
//   - the raw Excel upload (triggers the refresh Action)
//   - visibility.json (client tab/KPI visibility)
//
// The PAT is supplied by the admin at runtime and passed in per call —
// it is never stored in the bundle or in localStorage.
// ------------------------------------------------------------------

import { GITHUB } from "../config";

const API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Fetch the current file SHA (needed to update an existing file). null if absent. */
async function getSha(path: string, token: string): Promise<string | null> {
  const url = `${API}/repos/${GITHUB.owner}/${GITHUB.repo}/contents/${encodeURIComponent(
    path
  ).replace(/%2F/g, "/")}?ref=${GITHUB.branch}`;
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.sha ?? null;
}

/** Get a file's base64 content (and sha). Returns null if the file is absent. */
export async function getFileContent(
  path: string,
  token: string
): Promise<{ base64: string; sha: string } | null> {
  const url = `${API}/repos/${GITHUB.owner}/${GITHUB.repo}/contents/${encodeURIComponent(
    path
  ).replace(/%2F/g, "/")}?ref=${GITHUB.branch}`;
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);
  const json = await res.json();
  // content is base64 with newlines; strip whitespace
  const base64 = (json.content ?? "").replace(/\s/g, "");
  return { base64, sha: json.sha };
}

/**
 * Create or update a file in the repo.
 * @param contentBase64 file content already base64-encoded (no data: prefix)
 */
export async function putFile(
  path: string,
  contentBase64: string,
  message: string,
  token: string
): Promise<void> {
  const sha = await getSha(path, token);
  const url = `${API}/repos/${GITHUB.owner}/${GITHUB.repo}/contents/${encodeURIComponent(
    path
  ).replace(/%2F/g, "/")}`;
  const body: Record<string, unknown> = {
    message,
    content: contentBase64,
    branch: GITHUB.branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}: ${await res.text()}`);
}

/** Base64-encode a UTF-8 string (for JSON payloads). */
export function base64FromString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/** Read a File (e.g. the .xlsx) as base64 (no data: prefix). */
export function base64FromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:...;base64,XXXX
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
