"use client";

import { useMemo, useState } from "react";

type Role = "ADMIN" | "FRANCHISE_OWNER" | "PLAYER";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("signup");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("PLAYER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitLabel = useMemo(() => {
    return mode === "signup" ? "Create account" : "Login";
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            mode === "signup"
              ? JSON.stringify({ name, email, password, role })
              : JSON.stringify({ email, password }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Request failed");
        return;
      }

      const userRole: Role | undefined = data?.user?.role;
      if (userRole === "ADMIN") window.location.href = "/admin";
      else if (userRole === "FRANCHISE_OWNER") window.location.href = "/franchise";
      else window.location.href = "/player";
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold">
          {mode === "signup" ? "Create account" : "Login"}
        </h1>

        {mode === "signup" ? (
          <>
            <label className="text-sm text-zinc-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
              required
            />

            <label className="text-sm text-zinc-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="border border-zinc-300 rounded-lg px-3 py-2"
            >
              <option value="PLAYER">PLAYER</option>
              <option value="FRANCHISE_OWNER">FRANCHISE_OWNER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </>
        ) : null}

        <label className="text-sm text-zinc-700">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="border border-zinc-300 rounded-lg px-3 py-2"
          required
        />

        <label className="text-sm text-zinc-700">Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="border border-zinc-300 rounded-lg px-3 py-2"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          disabled={loading}
          className="mt-2 rounded-xl bg-black text-white py-2 px-4 disabled:opacity-50"
        >
          {submitLabel}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode((m) => (m === "signup" ? "login" : "signup"));
          }}
          className="text-sm text-zinc-700 underline"
        >
          {mode === "signup" ? "Already have an account? Login" : "New here? Sign up"}
        </button>
      </form>
    </div>
  );
}

