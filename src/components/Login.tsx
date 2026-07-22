import { useState } from "react";
import { authenticate, type Role } from "../auth";

export default function Login({ onSignIn }: { onSignIn: (role: Role) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const role = authenticate(email, password);
    if (role) {
      setError("");
      onSignIn(role);
    } else {
      setError("Invalid email or password.");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #d0d8e8",
    borderRadius: 6,
    fontFamily: "inherit",
    color: "#1e3a5f",
    background: "#fff",
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        minHeight: "100vh",
        background: "#f0f4f8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          border: "1px solid #d0d8e8",
          borderRadius: 10,
          padding: 32,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <img src="/netscribes-logo.png" alt="Netscribes" style={{ maxHeight: 36 }} />
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "#1e3a5f",
            textAlign: "center",
          }}
        >
          UCW Ticket Quality &amp; TAT Dashboard
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#64748B",
            textAlign: "center",
            marginTop: 4,
            marginBottom: 32,
          }}
        >
          Netscribes × TataCliq
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            required
            style={inputStyle}
          />
          {error && (
            <div
              style={{
                fontSize: 13,
                color: "#c0392b",
                background: "#fdf0f0",
                border: "1px solid #f5c6c6",
                borderRadius: 6,
                padding: "8px 12px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "#185FA5",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              marginTop: 8,
            }}
          >
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}
