"use client";

import { useState }  from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense }  from "react";

function IMochaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 51 51" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50.085 20.368C49.736 18.111 48.861 15.855 47.812 13.772C46.762 14.466 45.538 14.813 44.139 14.813C40.29 14.813 37.142 11.689 37.142 7.871C37.142 6.308 37.667 4.92 38.541 3.705C35.743 1.969 32.769 0.754 29.446 0.06C28.046 -0.287 26.822 0.928 26.822 2.316V8.218C26.822 9.259 27.522 10.3 28.571 10.474C33.819 11.863 38.017 15.855 39.416 21.062C39.766 22.103 40.64 22.798 41.69 22.798H47.637C49.211 23.145 50.435 21.756 50.085 20.368Z" fill="white"/>
      <path d="M10.73 21.409C12.129 16.202 16.327 12.036 21.575 10.821C22.624 10.474 23.324 9.606 23.324 8.565V2.49C23.324 1.101 21.925 -0.114 20.7 0.234C10.205 2.143 1.984 10.127 0.06 20.368C-0.289 21.756 0.935 23.145 2.334 23.145H8.456C9.506 23.145 10.555 22.277 10.73 21.409Z" fill="white"/>
      <path d="M21.575 39.46C16.327 38.072 12.129 34.08 10.73 28.873C10.38 27.831 9.506 27.137 8.456 27.137H2.334C0.935 27.137 -0.289 28.525 0.06 29.914C1.984 40.154 10.205 48.139 20.525 50.048C21.925 50.395 23.149 49.18 23.149 47.792V41.89C23.324 40.502 22.624 39.634 21.575 39.46Z" fill="white"/>
      <path d="M39.591 28.699C38.192 33.906 33.994 37.898 28.746 39.287C27.697 39.634 26.997 40.502 26.997 41.543V47.444C26.997 48.833 28.396 50.048 29.621 49.701C39.941 47.792 48.162 39.807 50.086 29.567C50.436 28.178 49.211 26.79 47.812 26.79H41.69C40.64 26.963 39.766 27.658 39.591 28.699Z" fill="white"/>
    </svg>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/admin";

  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push(from);
      } else {
        const data = await res.json();
        setError(data.error ?? "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: "#fff", border: "1px solid #EAE4EF", borderRadius: 24,
      padding: "36px 32px", width: "100%", maxWidth: 380,
      boxShadow: "0 8px 40px rgba(34,1,51,0.12)",
      display: "flex", flexDirection: "column", gap: 20,
    }}>
      {/* Branding */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #220133, #FD5A0F)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(253,90,15,0.35)",
          }}>
            <IMochaIcon />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#220133", margin: 0, lineHeight: 1.2 }}>iMocha Admin</p>
            <p style={{ fontSize: 11, color: "#9988AA", margin: 0 }}>AI Automation Index</p>
          </div>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#220133", margin: "0 0 4px", letterSpacing: "-0.4px" }}>
          Sign in
        </h1>
        <p style={{ fontSize: 13, color: "#9988AA", margin: 0 }}>Enter your admin password to continue.</p>
      </div>

      {/* Password field */}
      <div>
        <label style={{
          display: "block", fontSize: 10, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#9988AA", marginBottom: 8,
        }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoFocus
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 12,
            border: "1px solid #EAE4EF", background: "#FAFAFA",
            color: "#220133", fontSize: 14, outline: "none",
            boxSizing: "border-box", transition: "border-color 0.15s",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#FD5A0F")}
          onBlur={e  => (e.currentTarget.style.borderColor = "#EAE4EF")}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "#fef2f2", border: "1px solid #fecaca",
          fontSize: 13, color: "#dc2626",
        }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !password}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 12,
          border: "none", cursor: loading || !password ? "not-allowed" : "pointer",
          background: "linear-gradient(135deg, #220133, #FD5A0F)",
          color: "#fff", fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 16px rgba(253,90,15,0.35)",
          opacity: loading || !password ? 0.6 : 1,
          transition: "opacity 0.15s, transform 0.15s",
        }}
        onMouseEnter={e => { if (!loading && password) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 16px",
      background: "linear-gradient(160deg, #1A0028 0%, #2D0050 40%, #220133 100%)",
    }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
