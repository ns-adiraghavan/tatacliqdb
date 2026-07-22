// ------------------------------------------------------------------
// Demo auth — hardcoded, client-side only.
//
// NOTE: this is intentionally simple for a client-facing prototype.
// Credentials are visible in the shipped bundle and the check is
// bypassable by anyone technical. It gates the two demo views (client
// vs admin); it is NOT real security. To harden, move this to a
// backend session (see SETUP.md "Hardening").
// ------------------------------------------------------------------

export type Role = "admin" | "client";

interface Account {
  email: string;
  password: string;
  role: Role;
}

const ACCOUNTS: Account[] = [
  // Admin — can upload data + toggle client visibility
  { email: "tatacliq@netscribes.com", password: "Tatacliq@2026", role: "admin" },
  // Client — read-only, sees only what the admin has left visible
  { email: "client@netscribes.com", password: "TataCliq@2026", role: "client" },
];

/** Returns the role for valid credentials, or null. Email is case-insensitive. */
export function authenticate(email: string, password: string): Role | null {
  const e = email.trim().toLowerCase();
  const match = ACCOUNTS.find(
    (a) => a.email.toLowerCase() === e && a.password === password
  );
  return match ? match.role : null;
}
