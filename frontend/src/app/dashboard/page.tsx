"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, type AuthedUser } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthedUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const me = await fetchMe();
      if (!alive) return;

      if (!me) {
        router.replace("/login");
        return;
      }

      setUser(me);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.replace("/login");
  }

  if (loading) {
    return (
      <main style={{ padding: "2rem" }}>
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 1000 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Signed in as <b>{user?.email}</b>
          </p>
        </div>

        <button onClick={logout} style={{ padding: "10px 14px" }}>
          Logout
        </button>
      </header>

      {/* Quick actions */}
      <section style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {user?.role === "admin" && (
          <ActionCard
            title="Manage users"
            description="Create teachers/parents/students, reset passwords, deactivate accounts."
            onClick={() => router.push("/admin/users")}
          />
        )}

        <ActionCard
          title="Announcements"
          description="Post updates for teachers, parents, and students."
          onClick={() => router.push("/announcements")}
        />

        <ActionCard
          title="Resources"
          description="Upload and organize learning resources and documents."
          onClick={() => router.push("/resources")}
        />
      </section>

      {/* Simple status panel */}
      <section style={{ marginTop: 18, padding: 16, border: "1px solid #ddd" }}>
        <h2 style={{ marginTop: 0 }}>Status</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Auth session active ✅</li>
          <li>API reachable via /api ✅</li>
          <li>Role-based access enabled ✅</li>
        </ul>
      </section>
    </main>
  );
}

function ActionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 14,
        border: "1px solid #ddd",
        background: "white",
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 6, opacity: 0.8 }}>{description}</div>
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Open →</div>
    </button>
  );
}
