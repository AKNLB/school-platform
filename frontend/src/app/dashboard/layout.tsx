// frontend/src/app/dashboard/layout.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Announcements", href: "/dashboard/announcements", icon: "📢" },
  { label: "Attendance", href: "/dashboard/attendance", icon: "🕘" },
  { label: "Events", href: "/dashboard/events", icon: "📅" },
  { label: "Finance", href: "/dashboard/finance", icon: "💳" },
  { label: "Report Cards", href: "/dashboard/report-cards", icon: "🧾" },
  { label: "Resources", href: "/dashboard/resources", icon: "📚" },
  { label: "Scores", href: "/dashboard/scores", icon: "📊" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
  { label: "Tasks", href: "/dashboard/tasks", icon: "✅" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.replace("/login");
  }

  return (
    <div style={styles.appShell}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.brandWrap}>
            <div style={styles.brandBadge}>S</div>
            <div>
              <div style={styles.brandTitle}>School Platform</div>
              <div style={styles.brandSub}>Admin Workspace</div>
            </div>
          </div>

          <nav style={styles.nav}>
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    ...styles.navItem,
                    ...(active ? styles.navItemActive : {}),
                  }}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <button onClick={logout} style={styles.logoutBtn}>
          Logout
        </button>
      </aside>

      <section style={styles.mainArea}>
        <header style={styles.topbar}>
          <div>
            <div style={styles.topbarTitle}>School Administration System</div>
            <div style={styles.topbarSub}>
              Manage operations, communication, records, and reporting
            </div>
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
    background: "#f6f8fb",
  },
  sidebar: {
    width: 260,
    background: "#0f172a",
    color: "#fff",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderRight: "1px solid rgba(255,255,255,0.06)",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "linear-gradient(135deg, #60a5fa, #2563eb)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
  },
  brandTitle: {
    fontWeight: 700,
    fontSize: 16,
  },
  brandSub: {
    fontSize: 12,
    opacity: 0.72,
    marginTop: 2,
  },
  nav: {
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
    padding: "12px 14px",
    borderRadius: 12,
    transition: "all 0.2s ease",
  },
  navItemActive: {
    background: "#1e293b",
    color: "#fff",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  },
  navIcon: {
    width: 22,
    textAlign: "center",
  },
  logoutBtn: {
    border: "none",
    borderRadius: 12,
    padding: "12px 14px",
    background: "#1e293b",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  mainArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  topbar: {
    padding: "22px 28px",
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
  },
  topbarTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0f172a",
  },
  topbarSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  pageContent: {
    padding: 28,
  },
};