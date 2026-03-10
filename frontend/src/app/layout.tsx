"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, type AuthedUser } from "@/lib/auth";

type NavItem = { href: string; label: string; roles?: Array<NonNullable<AuthedUser>["role"]> };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

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
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
  }

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/announcements", label: "Announcements" },
      { href: "/dashboard/students", label: "Students", roles: ["admin", "teacher"] },
      { href: "/dashboard/attendance", label: "Attendance", roles: ["admin", "teacher"] },
      { href: "/dashboard/scores", label: "Scores", roles: ["admin", "teacher"] },
      { href: "/dashboard/report-cards", label: "Report Cards", roles: ["admin", "teacher", "parent", "student"] },
      { href: "/dashboard/tasks", label: "Tasks" },
      { href: "/dashboard/events", label: "Events" },
      { href: "/dashboard/resources", label: "Resources" },
      { href: "/dashboard/finance", label: "Finance", roles: ["admin"] },
      { href: "/dashboard/settings", label: "Settings", roles: ["admin"] },
      { href: "/admin/users", label: "Users (Admin)", roles: ["admin"] },
    ],
    []
  );

  const visibleNav = navItems.filter((it) => {
    if (!it.roles) return true;
    return !!user?.role && it.roles.includes(user.role);
  });

  if (loading) {
    return <main style={{ padding: "2rem" }}>Loading dashboard...</main>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #eee", padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>School Platform</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
          Signed in as <b>{user?.email || user?.username}</b>
        </div>

        <nav style={{ marginTop: 16, display: "grid", gap: 6 }}>
          {visibleNav.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                style={{
                  padding: "10px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid #eee",
                  background: active ? "#f5f5f5" : "white",
                  color: "black",
                }}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={logout}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #eee",
            borderRadius: 10,
            background: "white",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </aside>

      <main style={{ padding: 20 }}>{children}</main>
    </div>
  );
}
