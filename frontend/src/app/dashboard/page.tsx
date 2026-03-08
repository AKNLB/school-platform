"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMe, type AuthedUser } from "@/lib/auth";

const modules = [
  {
    title: "Announcements",
    href: "/dashboard/announcements",
    desc: "Post updates for teachers, parents, and students.",
    icon: "📢",
    accent: "linear-gradient(135deg, #2563eb, #60a5fa)",
  },
  {
    title: "Attendance",
    href: "/dashboard/attendance",
    desc: "Track and review student attendance records.",
    icon: "🕘",
    accent: "linear-gradient(135deg, #0f766e, #34d399)",
  },
  {
    title: "Events",
    href: "/dashboard/events",
    desc: "Manage school events and schedules.",
    icon: "📅",
    accent: "linear-gradient(135deg, #7c3aed, #a78bfa)",
  },
  {
    title: "Finance",
    href: "/dashboard/finance",
    desc: "Handle tuition, receipts, and finance reporting.",
    icon: "💳",
    accent: "linear-gradient(135deg, #b45309, #f59e0b)",
  },
  {
    title: "Report Cards",
    href: "/dashboard/report-cards",
    desc: "Generate and manage student report cards.",
    icon: "🧾",
    accent: "linear-gradient(135deg, #be123c, #fb7185)",
  },
  {
    title: "Resources",
    href: "/dashboard/resources",
    desc: "Upload and organize learning materials.",
    icon: "📚",
    accent: "linear-gradient(135deg, #1d4ed8, #38bdf8)",
  },
  {
    title: "Scores",
    href: "/dashboard/scores",
    desc: "Manage tests, assessments, and exam scores.",
    icon: "📊",
    accent: "linear-gradient(135deg, #4338ca, #818cf8)",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    desc: "Configure school identity and platform settings.",
    icon: "⚙️",
    accent: "linear-gradient(135deg, #334155, #64748b)",
  },
  {
    title: "Tasks",
    href: "/dashboard/tasks",
    desc: "Track assignments, workflows, and admin tasks.",
    icon: "✅",
    accent: "linear-gradient(135deg, #166534, #4ade80)",
  },
];

const quickLinks = [
  { label: "Create announcement", href: "/dashboard/announcements" },
  { label: "Open finance", href: "/dashboard/finance" },
  { label: "Manage report cards", href: "/dashboard/report-cards" },
  { label: "Update settings", href: "/dashboard/settings" },
];

export default function DashboardPage() {
  const [user, setUser] = useState<AuthedUser>(null);

  useEffect(() => {
    fetchMe().then(setUser);
  }, []);

  const greetingName = useMemo(() => {
    return user?.email || "User";
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "--";
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  }, [user]);

  const featuredModules = modules.slice(0, 3);

  return (
    <main style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <section style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.eyebrow}>School Platform</div>
          <h1 style={styles.heroTitle}>Dashboard</h1>
          <p style={styles.heroText}>
            Welcome back <b style={{ color: "#fff" }}>{greetingName}</b>. Your
            school control center is ready with tools for operations, records,
            reporting, and communication.
          </p>

          <div style={styles.heroActions}>
            <Link href="/dashboard/announcements" style={styles.primaryAction}>
              Go to Announcements
            </Link>
            <Link href="/dashboard/settings" style={styles.secondaryAction}>
              Open Settings
            </Link>
          </div>
        </div>

        <div style={styles.heroRight}>
          <div style={styles.heroPanel}>
            <div style={styles.heroPanelLabel}>Current Access</div>
            <div style={styles.heroPanelValue}>{roleLabel}</div>
            <div style={styles.heroPanelSub}>Signed in and ready to build</div>
          </div>

          <div style={styles.heroMiniGrid}>
            <MiniInfoCard label="Modules" value="9" />
            <MiniInfoCard label="Session" value="Active" />
            <MiniInfoCard label="API" value="Online" />
            <MiniInfoCard label="Status" value="Stable" />
          </div>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard
          title="Workspace Modules"
          value="9"
          subtitle="Core dashboard sections ready to expand"
        />
        <StatCard
          title="Authentication"
          value="Live"
          subtitle="Protected routes and session handling enabled"
        />
        <StatCard
          title="Backend"
          value="Connected"
          subtitle="Frontend and API are now talking properly"
        />
        <StatCard
          title="Role"
          value={roleLabel}
          subtitle="Current access level for this account"
        />
      </section>

      <section style={styles.contentGrid}>
        <div style={styles.mainColumn}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Featured Modules</h2>
              <p style={styles.sectionSub}>
                Your most important areas to keep building next.
              </p>
            </div>
          </div>

          <div style={styles.featuredGrid}>
            {featuredModules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                style={{
                  ...styles.featuredCard,
                  background: module.accent,
                }}
              >
                <div style={styles.featuredIcon}>{module.icon}</div>
                <div style={styles.featuredTitle}>{module.title}</div>
                <div style={styles.featuredDesc}>{module.desc}</div>
                <div style={styles.featuredAction}>Open module →</div>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>All Workspace Modules</h2>
                <p style={styles.sectionSub}>
                  Open any section below and continue building the platform.
                </p>
              </div>
            </div>

            <div style={styles.moduleGrid}>
              {modules.map((module) => (
                <Link key={module.href} href={module.href} style={styles.moduleCard}>
                  <div
                    style={{
                      ...styles.moduleIconWrap,
                      background: module.accent,
                    }}
                  >
                    <div style={styles.moduleIcon}>{module.icon}</div>
                  </div>
                  <div style={styles.moduleTitle}>{module.title}</div>
                  <div style={styles.moduleDesc}>{module.desc}</div>
                  <div style={styles.moduleAction}>Open module →</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <aside style={styles.sideColumn}>
          <div style={styles.sidePanel}>
            <h3 style={styles.sideTitle}>Quick Actions</h3>
            <p style={styles.sideSub}>
              Jump straight into the next key pages.
            </p>

            <div style={styles.quickList}>
              {quickLinks.map((item) => (
                <Link key={item.href} href={item.href} style={styles.quickLink}>
                  <span>{item.label}</span>
                  <span style={{ opacity: 0.7 }}>→</span>
                </Link>
              ))}
            </div>
          </div>

          <div style={styles.sidePanel}>
            <h3 style={styles.sideTitle}>Platform Status</h3>
            <div style={styles.statusList}>
              <StatusRow label="Login" value="Working" good />
              <StatusRow label="Routing" value="Working" good />
              <StatusRow label="Backend API" value="Connected" good />
              <StatusRow label="Dashboard UI" value="Enhanced" good />
            </div>
          </div>

          <div style={styles.sidePanel}>
            <h3 style={styles.sideTitle}>Build Focus</h3>
            <p style={styles.sideSub}>
              Best next step is finishing page structure and giving each module a
              polished admin experience.
            </p>

            <div style={styles.focusBox}>
              <div style={styles.focusBadge}>Next Level</div>
              <div style={styles.focusText}>
                Keep the dashboard as the premium control center, then make every
                module visually consistent with it.
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSub}>{subtitle}</div>
    </div>
  );
}

function MiniInfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.miniCard}>
      <div style={styles.miniLabel}>{label}</div>
      <div style={styles.miniValue}>{value}</div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div style={styles.statusRow}>
      <span style={styles.statusLabel}>{label}</span>
      <span
        style={{
          ...styles.statusValue,
          color: good ? "#86efac" : "#fca5a5",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: 24,
    background:
      "linear-gradient(180deg, #020617 0%, #0f172a 42%, #111827 100%)",
    overflow: "hidden",
  },

  bgGlowOne: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: "50%",
    background: "rgba(59,130,246,0.18)",
    filter: "blur(70px)",
    pointerEvents: "none",
  },

  bgGlowTwo: {
    position: "absolute",
    bottom: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: "50%",
    background: "rgba(168,85,247,0.16)",
    filter: "blur(80px)",
    pointerEvents: "none",
  },

  hero: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: 20,
    padding: 28,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.82))",
    boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
    backdropFilter: "blur(12px)",
  },

  heroLeft: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  eyebrow: {
    display: "inline-block",
    marginBottom: 10,
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: 0,
    fontSize: 40,
    fontWeight: 900,
    color: "#f8fafc",
    lineHeight: 1.05,
  },

  heroText: {
    marginTop: 14,
    color: "#cbd5e1",
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 760,
  },

  heroActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 22,
  },

  primaryAction: {
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.18)",
  },

  secondaryAction: {
    textDecoration: "none",
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
  },

  heroRight: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  heroPanel: {
    padding: 18,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  heroPanelLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  heroPanelValue: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 900,
  },

  heroPanelSub: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
  },

  heroMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  miniCard: {
    padding: 14,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  miniLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  miniValue: {
    marginTop: 8,
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: 800,
  },

  statsGrid: {
    position: "relative",
    zIndex: 1,
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },

  statCard: {
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  },

  statTitle: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  statValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 900,
    color: "#f8fafc",
  },

  statSub: {
    marginTop: 8,
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },

  contentGrid: {
    position: "relative",
    zIndex: 1,
    marginTop: 28,
    display: "grid",
    gridTemplateColumns: "1.5fr 0.8fr",
    gap: 20,
    alignItems: "start",
  },

  mainColumn: {
    minWidth: 0,
  },

  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  sectionHeader: {
    marginBottom: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#f8fafc",
    fontWeight: 900,
  },

  sectionSub: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.5,
  },

  featuredGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },

  featuredCard: {
    display: "block",
    textDecoration: "none",
    borderRadius: 22,
    padding: 22,
    color: "#ffffff",
    minHeight: 190,
    boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
  },

  featuredIcon: {
    fontSize: 32,
  },

  featuredTitle: {
    marginTop: 18,
    fontWeight: 900,
    fontSize: 20,
  },

  featuredDesc: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.94)",
    minHeight: 64,
  },

  featuredAction: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: 800,
    color: "#ffffff",
  },

  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },

  moduleCard: {
    display: "block",
    textDecoration: "none",
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: 20,
    color: "inherit",
    boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
  },

  moduleIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.2)",
  },

  moduleIcon: {
    fontSize: 24,
  },

  moduleTitle: {
    marginTop: 14,
    fontWeight: 900,
    fontSize: 18,
    color: "#f8fafc",
  },

  moduleDesc: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.6,
    minHeight: 44,
  },

  moduleAction: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: 800,
    color: "#93c5fd",
  },

  sidePanel: {
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
  },

  sideTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#f8fafc",
  },

  sideSub: {
    marginTop: 8,
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.6,
  },

  quickList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 16,
  },

  quickLink: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    textDecoration: "none",
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    fontWeight: 700,
  },

  statusList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 16,
  },

  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  statusLabel: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 600,
  },

  statusValue: {
    fontSize: 14,
    fontWeight: 800,
  },

  focusBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.20), rgba(168,85,247,0.18))",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  focusBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  focusText: {
    marginTop: 12,
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.6,
  },
};