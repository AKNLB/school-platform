"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug: "abc-learning-centre",
          username, // or email
          password,
        }),
      });

      if (!res.ok) throw new Error("Login failed");

      router.push("/dashboard");
    } catch {
      setError("Invalid username or password");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 420 }}>
      <h1>Sign in</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div style={{ color: "red" }}>{error}</div>}

        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}