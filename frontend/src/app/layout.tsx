"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, type AuthedUser } from "@/lib/auth";

type Role = NonNullable<AuthedUser>["role"];
type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: "Core" | "Academics" | "Communication" | "Operations" | "Admin";
  roles?: Role[];
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthedUser>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.replace("/login");
    }
  }

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/dashboard", label: "Overview", icon: "🏠", group: "Core" },
      { href: "/dashboard/announcements", label: "Announcements", icon: "📢", group: "Communication" },
      { href: "/dashboard/students", label: "Students", icon: "🎓", group: "Core", roles: ["admin", "teacher"] },
      { href: "/dashboard/attendance", label: "Attendance", icon: "🕘", group: "Academics", roles: ["admin", "teacher"] },
      { href: "/dashboard/scores", label: "Scores", icon: "📊", group: "Academics", roles: ["admin", "teacher"] },
      {
        href: "/dashboard/report-cards",
        label: "Report Cards",
        icon: "🧾",
        group: "Academics",
        roles: ["admin", "teacher", "parent", "student"],
      },
      { href: "/dashboard/tasks", label: "Tasks", icon: "✅", group: "Operations" },
      { href: "/dashboard/events", label: "Events", icon: "📅", group: "Communication" },
      { href: "/dashboard/resources", label: "Resources", icon: "📚", group: "Academics" },
      { href: "/dashboard/finance", label: "Finance", icon: "💳", group: "Operations", roles: ["admin"] },
      { href: "/dashboard/settings", label: "Settings", icon: "⚙️", group: "Operations", roles: ["admin"] },
      { href: "/admin/users", label: "Users (Admin)", icon: "👥", group: "Admin", roles: ["admin"] },
    ],
    []
  );

  const visibleNav = useMemo(() => {
    return navItems.filter((it) => {
      if (!it.roles) return true;
      return !!user?.role && it.roles.includes(user.role);
    });
  }, [navItems, user?.role]);

  const activeItem = useMemo(() => {
    return (
      visibleNav.find((item) => pathname === item.href || pathname.startsWith(item.href + "/")) ||
      visibleNav[0] ||
      null
    );
  }, [visibleNav, pathname]);

  const groupedNav = useMemo(() => {
    const groups = new Map<NavItem["group"], NavItem[]>();

    for (const item of visibleNav) {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group)!.push(item);
    }

    return Array.from(groups.entries());
  }, [visibleNav]);

  const userLabel = user?.email || user?.username || "User";
  const roleLabel = user?.role ? capitalize(user.role) : "Member";

  if (loading) {
    return (
      <main style={loadingPage}>
        <div style={loadingCard}>
          <div style={loadingBadge}>School Platform</div>
          <div style={loadingTitle}>Loading dashboard...</div>
          <div style={loadingText}>Preparing your workspace, access, and navigation.</div>
        </div>
      </main>
    );
  }

  return (
    <div style={appShell}>
      <div style={bgGlowOne} />
      <div style={bgGlowTwo} />

      <aside
        style={{
          ...sidebar,
          width: collapsed ? 96 : 292,
        }}
      >
        <div>
          <div style={sidebarTopRow}>
            <div
              style={{
                ...brandWrap,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <div style={brandBadge}>S</div>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={brandTitle}>School Platform</div>
                  <div style={brandSub}>Premium Admin Workspace</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed((v) => !v)}
              style={collapseBtn}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>

          {!collapsed && (
            <div style={userCard}>
              <div style={userCardTop}>
                <div style={userAvatar}>{initials(userLabel)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={userName}>{userLabel}</div>
                  <div style={userRole}>{roleLabel}</div>
                </div>
              </div>

              <div style={userMetaRow}>
                <span style={metaPill}>Signed in</span>
                <span style={metaPill}>{activeItem?.label || "Workspace"}</span>
              </div>
            </div>
          )}

          <nav style={nav}>
            {groupedNav.map(([group, items]) => (
              <div key={group} style={navSection}>
                {!collapsed && <div style={navGroupTitle}>{group}</div>}

                <div style={navList}>
                  {items.map((it) => {
                    const active = pathname === it.href || pathname.startsWith(it.href + "/");

                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        style={{
                          ...navItem,
                          ...(active ? navItemActive : {}),
                          justifyContent: collapsed ? "center" : "flex-start",
                          padding: collapsed ? "14px 10px" : "12px 14px",
                        }}
                        title={collapsed ? it.label : undefined}
                      >
                        <span style={navIcon}>{it.icon}</span>
                        {!collapsed && <span>{it.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div style={sidebarBottom}>
          {!collapsed && (
            <div style={footerCard}>
              <div style={footerCardLabel}>Workspace Status</div>
              <div style={footerCardValue}>Ready</div>
              <div style={footerCardSub}>Navigation and access loaded for your role.</div>
            </div>
          )}

          <button onClick={logout} style={logoutBtn} disabled={loggingOut} title="Logout">
            <span style={navIcon}>↪</span>
            {!collapsed && <span>{loggingOut ? "Logging out..." : "Logout"}</span>}
          </button>
        </div>
      </aside>

      <section style={mainArea}>
        <header style={topbar}>
          <div>
            <div style={breadcrumb}>School Administration System</div>
            <div style={topbarTitle}>{activeItem?.label || "Dashboard"}</div>
            <div style={topbarSub}>
              Manage operations, communication, records, reporting, and academic workflows.
            </div>
          </div>

          <div style={topbarRight}>
            <div style={quickBadge}>Live Workspace</div>
            <div style={quickBadgeMuted}>{roleLabel}</div>
          </div>
        </header>

        <main style={pageContent}>{children}</main>
      </section>
    </div>
  );
}

function initials(value: string) {
  return String(value || "")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const loadingPage: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(180deg, #020617 0%, #0f172a 42%, #111827 100%)",
  padding: 24,
};

const loadingCard: CSSProperties = {
  width: "min(460px, 100%)",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.80)",
  backdropFilter: "blur(14px)",
  padding: 24,
  color: "#fff",
  textAlign: "center",
};

const loadingBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.14)",
  border: "1px solid rgba(96,165,250,0.24)",
  color: "#dbeafe",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const loadingTitle: CSSProperties = {
  marginTop: 16,
  fontSize: 28,
  fontWeight: 950,
};

const loadingText: CSSProperties = {
  marginTop: 8,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const appShell: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  background: "linear-gradient(180deg, #020617 0%, #0f172a 38%, #111827 100%)",
  position: "relative",
  overflow: "hidden",
};

const bgGlowOne: CSSProperties = {
  position: "fixed",
  top: -120,
  left: -120,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
  pointerEvents: "none",
};

const bgGlowTwo: CSSProperties = {
  position: "fixed",
  bottom: -160,
  right: -120,
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)",
  pointerEvents: "none",
};

const sidebar: CSSProperties = {
  background: "rgba(15,23,42,0.88)",
  color: "#fff",
  padding: 18,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(16px)",
  position: "sticky",
  top: 0,
  height: "100vh",
  zIndex: 10,
  transition: "width 0.22s ease",
};

const sidebarTopRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 16,
};

const brandWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandBadge: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  background: "linear-gradient(135deg, #60a5fa, #2563eb)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 20,
  boxShadow: "0 10px 30px rgba(37,99,235,0.28)",
  flexShrink: 0,
};

const brandTitle: CSSProperties = {
  fontWeight: 800,
  fontSize: 16,
  color: "#f8fafc",
};

const brandSub: CSSProperties = {
  fontSize: 12,
  opacity: 0.76,
  marginTop: 2,
  color: "#cbd5e1",
};

const collapseBtn: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  flexShrink: 0,
};

const userCard: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(168,85,247,0.10))",
  padding: 14,
  marginBottom: 18,
};

const userCardTop: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const userAvatar: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 900,
  flexShrink: 0,
};

const userName: CSSProperties = {
  fontWeight: 900,
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const userRole: CSSProperties = {
  marginTop: 4,
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 700,
};

const userMetaRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const metaPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#e2e8f0",
  fontWeight: 800,
  fontSize: 12,
};

const nav: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const navSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const navGroupTitle: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#94a3b8",
  fontWeight: 800,
  padding: "0 6px",
};

const navList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const navItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  textDecoration: "none",
  color: "#cbd5e1",
  borderRadius: 14,
  transition: "all 0.2s ease",
  border: "1px solid rgba(255,255,255,0.04)",
  background: "rgba(255,255,255,0.02)",
  fontWeight: 700,
};

const navItemActive: CSSProperties = {
  background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(168,85,247,0.12))",
  color: "#fff",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  border: "1px solid rgba(96,165,250,0.18)",
};

const navIcon: CSSProperties = {
  width: 22,
  textAlign: "center",
  flexShrink: 0,
};

const sidebarBottom: CSSProperties = {
  display: "grid",
  gap: 12,
};

const footerCard: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const footerCardLabel: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  color: "#94a3b8",
  fontWeight: 800,
};

const footerCardValue: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const footerCardSub: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.55,
  color: "#cbd5e1",
};

const logoutBtn: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  padding: "13px 14px",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const mainArea: CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  position: "relative",
  zIndex: 1,
};

const topbar: CSSProperties = {
  padding: "22px 28px",
  background: "rgba(255,255,255,0.72)",
  borderBottom: "1px solid rgba(255,255,255,0.45)",
  backdropFilter: "blur(14px)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const breadcrumb: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const topbarTitle: CSSProperties = {
  marginTop: 6,
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const topbarSub: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.6,
};

const topbarRight: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const quickBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.12)",
  color: "#1d4ed8",
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid rgba(59,130,246,0.14)",
};

const quickBadgeMuted: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(15,23,42,0.05)",
  color: "#475569",
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid rgba(15,23,42,0.08)",
};

const pageContent: CSSProperties = {
  padding: 28,
};