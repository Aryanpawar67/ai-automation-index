"use client";

import { useState }     from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense }     from "react";

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
    <form onSubmit={handleSubmit} className="card p-8 w-full max-w-sm space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#FD5A0F" }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
              <path d="M8 1a3 3 0 0 1 3 3v1h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1V4a3 3 0 0 1 3-3zm0 1.5A1.5 1.5 0 0 0 6.5 4v1h3V4A1.5 1.5 0 0 0 8 2.5z" fill="white"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-none" style={{ color: "#220133" }}>iMocha Admin</p>
            <p className="text-xs" style={{ color: "#9988AA" }}>AI Automation Index</p>
          </div>
        </div>
        <h1 className="text-xl font-bold mb-1" style={{ color: "#220133" }}>Sign in</h1>
        <p className="text-sm" style={{ color: "#9988AA" }}>Enter your admin password to continue.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#9988AA" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoFocus
          className="w-full rounded-xl px-4 py-3 text-sm transition-colors"
          style={{ border: "1px solid #EAE4EF", background: "#FAFAFA", color: "#220133", outline: "none" }}
          onFocus={e => (e.currentTarget.style.borderColor = "#FD5A0F")}
          onBlur={e  => (e.currentTarget.style.borderColor = "#EAE4EF")}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 px-3 py-2 rounded-lg" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !password}
        className="w-full gradient-btn font-semibold py-3 rounded-xl text-sm disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #FFF8F5 0%, #FFFFFF 50%, #F9F7FB 100%)" }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
