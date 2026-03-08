// frontend/src/app/dashboard/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMe, type AuthedUser } from "@/lib/auth";

const modules = [
  {
    title: "Announcements",
    href: "/dashboard/announcements",
    desc: "Post updates for teachers, parents, and students.",
    icon: "📢",
  },
  {
    title: "Attendance",
    href: "/dashboard/attendance",
    desc: "Track and review student attendance records.",
    icon: "🕘",
  },
  {
    title: "Events",
    href: "/dashboard/events",
    desc: "Manage school events and schedules.",
    icon: "📅",
  },
  {
    title: "Finance",
    href: "/dashboard/finance",
    desc: "Handle tuition, receipts, and finance reporting.",
    icon: "💳",
  },
  {
    title: "Report Cards",
    href: "/dashboard/report-cards",
    desc: "Generate and manage student report cards.",
    icon: "🧾",
  },
  {
    title: "Resources",
    href: "/dashboard/resources",
    desc: "Upload and organize learning materials.",
    icon: "📚",
  },
  {
    title: "Scores",
    href: "/dashboard/scores",
    desc: "Manage tests, assessments, and exam scores.",
    icon: "📊",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    desc: "Configure school identity and platform settings.",
    icon: "⚙️",
  },
  {
    title: "Tasks",
    href: "/dashboard/tasks",
    desc: "Track assignments, workflows, and admin tasks.",
    icon: "✅",
  },
];

export default function DashboardPage() {
  const [user, setUser] = useState<AuthedUser>(null);

  useEffect(() => {
    fetchMe().then(setUser);
  }, []);

  return (
    <div>
      <section style={styles.hero}>
        <div>
          <h1 style={styles.heroTitle}>Dashboard</h1>
          <p style={styles.heroText}>
            Welcome back{" "}
            <b>{user?.email || "User"}</b>. Here’s your school
            control center.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard title="Modules" value="9" subtitle="Core dashboard sections" />
        <StatCard title="Session" value="Active" subtitle="Authentication is working" />
        <StatCard title="API" value="Online" subtitle="Backend connection healthy" />
        <StatCard title="Role" value={user?.role || "--"} subtitle="Current access level" />
      </section>

      <section style={{ marginTop: 28 }}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Workspace Modules</h2>
          <p style={styles.sectionSub}>
            Open a page below to continue building your platform.
          </p>
        </div>

        <div style={styles.moduleGrid}>
          {modules.map((module) => (
            <Link key={module.href} href={module.href} style={styles.moduleCard}>
              <div style={styles.moduleIcon}>{module.icon}</div>
              <div style={styles.moduleTitle}>{module.title}</div>
              <div style={styles.moduleDesc}>{module.desc}</div>
              <div style={styles.moduleAction}>Open module →</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
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

const styles: Record<string, React.CSSProperties> = {
  hero: {
    background: "linear-gradient(135deg, #ffffff, #eef4ff)",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 24,
  },
  heroTitle: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    color: "#0f172a",
  },
  heroText: {
    marginTop: 10,
    color: "#475569",
    fontSize: 15,
  },
  statsGrid: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 20,
  },
  statTitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
  statValue: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },
  statSub: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
  },
  sectionSub: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 14,
  },
  moduleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  },
  moduleCard: {
    display: "block",
    textDecoration: "none",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 20,
    color: "inherit",
  },
  moduleIcon: {
    fontSize: 26,
  },
  moduleTitle: {
    marginTop: 12,
    fontWeight: 800,
    fontSize: 18,
    color: "#0f172a",
  },
  moduleDesc: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
    minHeight: 42,
  },
  moduleAction: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: 700,
    color: "#2563eb",
  },
};