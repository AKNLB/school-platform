// frontend/src/app/dashboard/layout.tsx
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      {/* Sidebar (placeholder) */}
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #e5e7eb",
          padding: 16,
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16 }}>Dashboard</div>

        <nav style={{ marginTop: 14, display: "grid", gap: 8 }}>
          <a href="/dashboard" style={linkStyle}>Overview</a>
          <a href="/dashboard/announcements" style={linkStyle}>Announcements</a>
          <a href="/dashboard/students" style={linkStyle}>Students</a>
          <a href="/dashboard/attendance" style={linkStyle}>Attendance</a>
          <a href="/dashboard/scores" style={linkStyle}>Scores</a>
          <a href="/dashboard/report-cards" style={linkStyle}>Report Cards</a>
          <a href="/dashboard/tasks" style={linkStyle}>Tasks</a>
          <a href="/dashboard/events" style={linkStyle}>Events</a>
          <a href="/dashboard/resources" style={linkStyle}>Resources</a>
          <a href="/dashboard/settings" style={linkStyle}>Settings</a>
          <a href="/dashboard/finance" style={linkStyle}>Finance</a>
        </nav>

        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
          Placeholder layout. Next step: add auth guard + active link styling.
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 18 }}>{children}</main>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#111827",
  border: "1px solid #e5e7eb",
  background: "#fff",
};
