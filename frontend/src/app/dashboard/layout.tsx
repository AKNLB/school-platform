"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠", group: "Core" },
  { label: "Announcements", href: "/dashboard/announcements", icon: "📢", group: "Communication" },
  { label: "Attendance", href: "/dashboard/attendance", icon: "🕘", group: "Academics" },
  { label: "Events", href: "/dashboard/events", icon: "📅", group: "Communication" },
  { label: "Finance", href: "/dashboard/finance", icon: "💳", group: "Operations" },
  { label: "Report Cards", href: "/dashboard/report-cards", icon: "🧾", group: "Academics" },
  { label: "Resources", href: "/dashboard/resources", icon: "📚", group: "Academics" },
  { label: "Scores", href: "/dashboard/scores", icon: "📊", group: "Academics" },
  { label: "Students", href: "/dashboard/students", icon: "🎓", group: "Core" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️", group: "Operations" },
  { label: "Tasks", href: "/dashboard/tasks", icon: "✅", group: "Operations" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const activeItem = useMemo(() => {
    return (
      navItems.find(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      ) || navItems[0]
    );
  }, [pathname]);

  const groupedNav = useMemo(() => {
    const groups = new Map<string, typeof navItems>();

    for (const item of navItems) {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group)!.push(item);
    }

    return Array.from(groups.entries());
  }, []);

  async function logout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div style={styles.appShell}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <aside
        style={{
          ...styles.sidebar,
          width: collapsed ? 96 : 292,
        }}
      >
        <div>
          <div style={styles.sidebarTopRow}>
            <div
              style={{
                ...styles.brandWrap,
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <div style={styles.brandBadge}>S</div>
              {!collapsed && (
                <div>
                  <div style={styles.brandTitle}>School Platform</div>
                  <div style={styles.brandSub}>Premium Admin Workspace</div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed((v) => !v)}
              style={styles.collapseBtn}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>

          {!collapsed && (
            <div style={styles.workspaceCard}>
              <div style={styles.workspaceLabel}>Active Page</div>
              <div style={styles.workspaceValue}>{activeItem.label}</div>
              <div style={styles.workspaceSub}>
                Manage records, operations, and communication from one place.
              </div>
            </div>
          )}

          <nav style={styles.nav}>
            {groupedNav.map(([group, items]) => (
              <div key={group} style={styles.navSection}>
                {!collapsed && <div style={styles.navGroupTitle}>{group}</div>}

                <div style={styles.navList}>
                  {items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(item.href + "/");

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          ...styles.navItem,
                          ...(active ? styles.navItemActive : {}),
                          justifyContent: collapsed ? "center" : "flex-start",
                          padding: collapsed ? "14px 10px" : "12px 14px",
                        }}
                        title={collapsed ? item.label : undefined}
                      >
                        <span style={styles.navIcon}>{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div style={styles.sidebarBottom}>
          {!collapsed && (
            <div style={styles.footerCard}>
              <div style={styles.footerCardLabel}>Workspace Status</div>
              <div style={styles.footerCardValue}>Ready</div>
              <div style={styles.footerCardSub}>
                Navigation, pages, and school tools connected.
              </div>
            </div>
          )}

          <button
            onClick={logout}
            style={styles.logoutBtn}
            disabled={loggingOut}
            title="Logout"
          >
            <span style={styles.navIcon}>↪</span>
            {!collapsed && <span>{loggingOut ? "Logging out..." : "Logout"}</span>}
          </button>
        </div>
      </aside>

      <section style={styles.mainArea}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.breadcrumb}>School Administration System</div>
            <div style={styles.topbarTitle}>{activeItem.label}</div>
            <div style={styles.topbarSub}>
              Manage operations, communication, records, reporting, and academic workflows.
            </div>
          </div>

          <div style={styles.topbarRight}>
            <div style={styles.quickBadge}>Live Workspace</div>
            <div style={styles.quickBadgeMuted}>Secure Session</div>
          </div>
        </header>

        <div style={styles.pageContent}>{children}</div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appShell: {
    display: "flex",
    minHeight: "100vh",
    background: "linear-gradient(180deg, #020617 0%, #0f172a 38%, #111827 100%)",
    position: "relative",
    overflow: "hidden",
  },

  bgGlowOne: {
    position: "fixed",
    top: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
    pointerEvents: "none",
  },

  bgGlowTwo: {
    position: "fixed",
    bottom: -160,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)",
    pointerEvents: "none",
  },

  sidebar: {
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
  },

  sidebarTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },

  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  brandBadge: {
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
  },

  brandTitle: {
    fontWeight: 800,
    fontSize: 16,
    color: "#f8fafc",
  },

  brandSub: {
    fontSize: 12,
    opacity: 0.76,
    marginTop: 2,
    color: "#cbd5e1",
  },

  collapseBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    flexShrink: 0,
  },

  workspaceCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(168,85,247,0.10))",
    padding: 14,
    marginBottom: 18,
  },

  workspaceLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#bfdbfe",
    fontWeight: 800,
  },

  workspaceValue: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: 900,
    color: "#fff",
  },

  workspaceSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.55,
    color: "#cbd5e1",
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  navSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  navGroupTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#94a3b8",
    fontWeight: 800,
    padding: "0 6px",
  },

  navList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  navItem: {
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
  },

  navItemActive: {
    background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(168,85,247,0.12))",
    color: "#fff",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
    border: "1px solid rgba(96,165,250,0.18)",
  },

  navIcon: {
    width: 22,
    textAlign: "center",
    flexShrink: 0,
  },

  sidebarBottom: {
    display: "grid",
    gap: 12,
  },

  footerCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
  },

  footerCardLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#94a3b8",
    fontWeight: 800,
  },

  footerCardValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
  },

  footerCardSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.55,
    color: "#cbd5e1",
  },

  logoutBtn: {
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
  },

  mainArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    position: "relative",
    zIndex: 1,
  },

  topbar: {
    padding: "22px 28px",
    background: "rgba(255,255,255,0.72)",
    borderBottom: "1px solid rgba(255,255,255,0.45)",
    backdropFilter: "blur(14px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  breadcrumb: {
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  topbarTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
  },

  topbarSub: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
  },

  topbarRight: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  quickBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.12)",
    color: "#1d4ed8",
    fontWeight: 800,
    fontSize: 12,
    border: "1px solid rgba(59,130,246,0.14)",
  },

  quickBadgeMuted: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.05)",
    color: "#475569",
    fontWeight: 800,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
  },

  pageContent: {
    padding: 28,
  },
};