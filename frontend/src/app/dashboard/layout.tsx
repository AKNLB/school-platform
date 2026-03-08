"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    router.replace("/login");
  }

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>SchoolOS</h2>

        <nav style={styles.nav}>
          <NavItem label="Dashboard" path="/dashboard" />
          <NavItem label="Announcements" path="/dashboard/announcements" />
          <NavItem label="Resources" path="/dashboard/resources" />
          <NavItem label="Attendance" path="/dashboard/attendance" />
          <NavItem label="Events" path="/dashboard/events" />
          <NavItem label="Tasks" path="/dashboard/tasks" />
          <NavItem label="Finance" path="/dashboard/finance" />
        </nav>

        <button onClick={logout} style={styles.logout}>
          Logout
        </button>
      </aside>

      {/* Content */}
      <main style={styles.main}>{children}</main>
    </div>
  );
}

function NavItem({ label, path }: { label: string; path: string }) {
  const router = useRouter();

  return (
    <button style={styles.navItem} onClick={() => router.push(path)}>
      {label}
    </button>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
  },

  sidebar: {
    width: 240,
    background: "#111827",
    color: "white",
    padding: 20,
    display: "flex",
    flexDirection: "column",
  },

  logo: {
    marginBottom: 20,
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    flex: 1,
  },

  navItem: {
    background: "transparent",
    border: "none",
    color: "white",
    textAlign: "left",
    padding: "10px 12px",
    cursor: "pointer",
    borderRadius: 6,
  },

  logout: {
    marginTop: 20,
    padding: "10px",
    cursor: "pointer",
  },

  main: {
    flex: 1,
    padding: 30,
    background: "#f4f6f9",
  },
};