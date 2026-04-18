"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchMe, type AuthedUser } from "@/lib/auth";
import { api } from "@/lib/api";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

type ModuleItem = {
  title: string;
  href: string;
  desc: string;
  icon: string;
  accent?: string;
  category: "Academic" | "Administration" | "Communication" | "Operations";
  priority?: boolean;
  adminOnly?: boolean;
};

type DashboardStats = {
  studentCount: number;
  attendanceTodayCount: number;
  presentTodayCount: number;
  absentTodayCount: number;
  totalOutstanding: number;
  recentAnnouncements: Array<{ id: string; title: string; audience?: string; created_at?: string }>;
  recentTasks: Array<{ id: string; title: string; status?: string; due_date?: string }>;
  upcomingEvents: Array<{ id: string; title: string; date?: string; location?: string }>;
};

const modules: ModuleItem[] = [
  {
    title: "Announcements",
    href: "/dashboard/announcements",
    desc: "Post updates for teachers, parents, and students.",
    icon: "📢",
    accent: "linear-gradient(135deg, #2563eb, #60a5fa)",
    category: "Communication",
    priority: true,
  },
  {
    title: "Students",
    href: "/dashboard/students",
    desc: "View student profiles, attendance, finance, and academic records.",
    icon: "🎓",
    accent: "linear-gradient(135deg, #0f766e, #2dd4bf)",
    category: "Academic",
    priority: true,
  },
  {
    title: "Attendance",
    href: "/dashboard/attendance",
    desc: "Track and review student attendance records.",
    icon: "🕘",
    accent: "linear-gradient(135deg, #0f766e, #34d399)",
    category: "Operations",
    priority: true,
  },
  
  {
    title: "Events",
    href: "/dashboard/events",
    desc: "Manage school events and schedules.",
    icon: "📅",
    accent: "linear-gradient(135deg, #7c3aed, #a78bfa)",
    category: "Operations",
  },
  {
    title: "Finance",
    href: "/dashboard/finance",
    desc: "Handle tuition, receipts, and finance reporting.",
    icon: "💳",
    accent: "linear-gradient(135deg, #b45309, #f59e0b)",
    category: "Administration",
    priority: true,
  },
  {
    title: "Report Cards",
    href: "/dashboard/report-cards",
    desc: "Generate and manage student report cards.",
    icon: "🧾",
    accent: "linear-gradient(135deg, #be123c, #fb7185)",
    category: "Academic",
  },
  {
    title: "Resources",
    href: "/dashboard/resources",
    desc: "Upload and organize learning materials.",
    icon: "📚",
    accent: "linear-gradient(135deg, #1d4ed8, #38bdf8)",
    category: "Academic",
  },
  {
    title: "Scores",
    href: "/dashboard/scores",
    desc: "Manage tests, assessments, and exam scores.",
    icon: "📊",
    accent: "linear-gradient(135deg, #4338ca, #818cf8)",
    category: "Academic",
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    desc: "Configure school identity and platform settings.",
    icon: "⚙️",
    accent: "linear-gradient(135deg, #334155, #64748b)",
    category: "Administration",
  },
  {
    title: "Activity",
    href: "/dashboard/activity",
    desc: "Review audit logs across students, finance, resources, and settings.",
    icon: "🧭",
    accent: "linear-gradient(135deg, #0f172a, #475569)",
    category: "Administration",
    priority: true,
    adminOnly: true,
  },
  {
    title: "Admin Users",
    href: "/dashboard/admin/users",
    desc: "Create users, manage roles, activate accounts, and reset passwords.",
    icon: "👥",
    accent: "linear-gradient(135deg, #475569, #94a3b8)",
    category: "Administration",
    priority: true,
    adminOnly: true,
  },
  {
    title: "Tasks",
    href: "/dashboard/tasks",
    desc: "Track assignments, workflows, and admin tasks.",
    icon: "✅",
    accent: "linear-gradient(135deg, #166534, #4ade80)",
    category: "Operations",
  },
];

const emptyStats: DashboardStats = {
  studentCount: 0,
  attendanceTodayCount: 0,
  presentTodayCount: 0,
  absentTodayCount: 0,
  totalOutstanding: 0,
  recentAnnouncements: [],
  recentTasks: [],
  upcomingEvents: [],
};

export default function DashboardPage() {
  const [user, setUser] = useState<AuthedUser>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  async function loadMe() {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const who = await fetchMe();
      setUser(who);
    } catch (e: unknown) {
      setAuthError(extractErr(e, "Failed to load dashboard access."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);

    const today = new Date().toISOString().slice(0, 10);

    try {
      const [
        studentsRes,
        attendanceRes,
        financeRes,
        announcementsRes,
        tasksRes,
        eventsRes,
      ] = await Promise.allSettled([
        api.get("/students"),
        api.get("/attendance", { params: { date: today } }),
        api.get("/finance/summary"),
        api.get("/announcements"),
        api.get("/tasks"),
        api.get("/events"),
      ]);

      const students = settledData(studentsRes);
      const attendance = settledData(attendanceRes);
      const finance = settledData(financeRes);
      const announcements = settledData(announcementsRes);
      const tasks = settledData(tasksRes);
      const events = settledData(eventsRes);

      const studentRows = normalizeArray(students);
      const attendanceRows = normalizeArray(attendance);
      const announcementRows = normalizeArray(announcements).slice(0, 5);
      const taskRows = normalizeArray(tasks).slice(0, 5);
      const eventRows = normalizeArray(events).slice(0, 5);

      const presentTodayCount = attendanceRows.filter((row) =>
        String(row?.status || "").toLowerCase() === "present"
      ).length;

      const absentTodayCount = attendanceRows.filter((row) =>
        String(row?.status || "").toLowerCase() === "absent"
      ).length;

      setStats({
        studentCount: studentRows.length,
        attendanceTodayCount: attendanceRows.length,
        presentTodayCount,
        absentTodayCount,
        totalOutstanding: extractOutstanding(finance),
        recentAnnouncements: announcementRows.map((row, i) => ({
          id: String(row?.id ?? i),
          title: String(row?.title || "Untitled announcement"),
          audience: row?.audience ? String(row.audience) : undefined,
          created_at: row?.created_at ? String(row.created_at) : undefined,
        })),
        recentTasks: taskRows.map((row, i) => ({
          id: String(row?.id ?? i),
          title: String(row?.title || "Untitled task"),
          status: row?.status ? String(row.status) : undefined,
          due_date: row?.due_date ? String(row.due_date) : undefined,
        })),
        upcomingEvents: eventRows.map((row, i) => ({
          id: String(row?.id ?? i),
          title: String(row?.title || "Untitled event"),
          date: row?.date ? String(row.date) : undefined,
          location: row?.location ? String(row.location) : undefined,
        })),
      });
    } catch (e: unknown) {
      setStatsError(extractErr(e, "Failed to load live dashboard metrics."));
      setStats(emptyStats);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    void loadMe();
    void loadStats();
  }, []);

  const isAdmin = user?.role === "admin";

  const visibleModules = useMemo(() => {
    return modules.filter((m) => !m.adminOnly || isAdmin);
  }, [isAdmin]);

  const greetingName = useMemo(() => {
    if (user?.email) return user.email.split("@")[0];
    return "User";
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "Not assigned";
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  }, [user]);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(visibleModules.map((m) => m.category)))];
  }, [visibleModules]);

  const filteredModules = useMemo(() => {
    return visibleModules.filter((module) => {
      const matchesSearch =
        module.title.toLowerCase().includes(search.toLowerCase()) ||
        module.desc.toLowerCase().includes(search.toLowerCase()) ||
        module.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = categoryFilter === "All" || module.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [search, categoryFilter, visibleModules]);

  const featuredModules = useMemo(() => {
    return visibleModules.filter((m) => m.priority).slice(0, 4);
  }, [visibleModules]);

  const quickLinks = useMemo(() => {
    const base = [
      { label: "Create announcement", href: "/dashboard/announcements", icon: "📢" },
      { label: "Take attendance", href: "/dashboard/attendance", icon: "🕘" },
      { label: "Add score", href: "/dashboard/scores", icon: "📊" },
      { label: "Open finance", href: "/dashboard/finance", icon: "💳" },
    ];

    if (isAdmin) {
      base.unshift({ label: "Manage users", href: "/dashboard/admin/users", icon: "👥" });
    }

    return base;
  }, [isAdmin]);

  const alerts = useMemo(() => {
    const items: string[] = [];

    if (stats.studentCount === 0) items.push("No students have been added yet.");
    if (stats.attendanceTodayCount === 0) items.push("No attendance has been submitted today.");
    if (stats.totalOutstanding > 0) items.push("Outstanding balances need attention.");
    if (!stats.recentAnnouncements.length) items.push("No announcements are currently posted.");

    return items;
  }, [stats]);

  if (authLoading) {
    return (
      <main style={styles.page}>
        <div style={styles.bgGlowOne} />
        <div style={styles.bgGlowTwo} />
        <div style={styles.container}>
          <LoadingState text="Loading dashboard..." />
        </div>
      </main>
    );
  }

  if (authError) {
    return (
      <main style={styles.page}>
        <div style={styles.bgGlowOne} />
        <div style={styles.bgGlowTwo} />
        <div style={styles.container}>
          <ErrorState text={authError} onRetry={() => void loadMe()} />
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.eyebrow}>School Platform</div>
            <h1 style={styles.heroTitle}>Dashboard</h1>
            <p style={styles.heroText}>
              Welcome back <b style={{ color: "#fff" }}>{greetingName}</b>. This is now your live
              school command center for students, attendance, finance, communication, and daily operations.
            </p>

            <div style={styles.heroActions}>
              <Link href="/dashboard/students" style={styles.primaryAction}>
                Open Students
              </Link>
              <Link href="/dashboard/attendance" style={styles.secondaryAction}>
                Take Attendance
              </Link>
              <Link href="/dashboard/finance" style={styles.secondaryAction}>
                Open Finance
              </Link>
              <Link href="/dashboard/settings" style={styles.secondaryAction}>
                Open Settings
              </Link>
            </div>

            <div style={styles.heroPills}>
              <HeroPill label="Role" value={roleLabel} />
              <HeroPill label="Students" value={String(stats.studentCount)} />
              <HeroPill label="Attendance Today" value={String(stats.attendanceTodayCount)} />
            </div>
          </div>

          <div style={styles.heroRight}>
            <div style={styles.heroPanel}>
              <div style={styles.heroPanelTop}>
                <div>
                  <div style={styles.heroPanelLabel}>Outstanding Balance</div>
                  <div style={styles.heroPanelValue}>{formatMoney(stats.totalOutstanding)}</div>
                </div>
                <div style={styles.onlineBadge}>{statsLoading ? "Syncing" : "Live"}</div>
              </div>

              <div style={styles.heroPanelSub}>
                Present today: {stats.presentTodayCount} • Absent today: {stats.absentTodayCount}
              </div>

              <div style={styles.heroMiniGrid}>
                <MiniInfoCard label="Announcements" value={String(stats.recentAnnouncements.length)} />
                <MiniInfoCard label="Tasks" value={String(stats.recentTasks.length)} />
                <MiniInfoCard label="Events" value={String(stats.upcomingEvents.length)} />
                <MiniInfoCard label="Modules" value={String(visibleModules.length)} />
              </div>
            </div>
          </div>
        </section>

        {statsError ? (
          <div style={{ marginTop: 18 }}>
            <ErrorState text={statsError} onRetry={() => void loadStats()} />
          </div>
        ) : null}

        <section style={styles.statsGrid}>
          <StatCard
            title="Students"
            value={String(stats.studentCount)}
            subtitle="Current number of student profiles in the system"
          />
          <StatCard
            title="Attendance Today"
            value={String(stats.attendanceTodayCount)}
            subtitle="Attendance rows submitted for today"
          />
          <StatCard
            title="Present Today"
            value={String(stats.presentTodayCount)}
            subtitle="Students marked present today"
          />
          <StatCard
            title="Outstanding"
            value={formatMoney(stats.totalOutstanding)}
            subtitle="Current outstanding balance across finance"
          />
        </section>

        <section style={styles.controlStrip}>
          <div style={styles.searchWrap}>
            <div style={styles.searchLabel}>Find a module</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by module, category, or purpose..."
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterWrap}>
            <div style={styles.searchLabel}>Category</div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={styles.selectInput}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.summaryChip}>
            {filteredModules.length} {filteredModules.length === 1 ? "module" : "modules"} visible
          </div>
        </section>

        <section style={styles.insightGrid}>
          <div style={styles.insightPanel}>
            <div style={styles.insightHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Attention Needed</h2>
                <p style={styles.sectionSub}>
                  Surface the things that need action first.
                </p>
              </div>
            </div>

            {alerts.length === 0 ? (
              <EmptyState
                title="No urgent alerts"
                text="Everything looks stable right now."
              />
            ) : (
              <div style={styles.focusList}>
                {alerts.map((item, index) => (
                  <div key={index} style={styles.focusRow}>
                    <div style={styles.focusIndex}>!</div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.focusRowTitle}>Action Required</div>
                      <div style={styles.focusRowText}>{item}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.insightPanel}>
            <div style={styles.insightHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Workspace Overview</h2>
                <p style={styles.sectionSub}>
                  A quick look at the shape of your platform.
                </p>
              </div>
            </div>

            <div style={styles.overviewGrid}>
              <OverviewCard
                label="Academic"
                value={String(visibleModules.filter((m) => m.category === "Academic").length)}
                sub="Students, scores, resources, report cards"
              />
              <OverviewCard
                label="Administration"
                value={String(visibleModules.filter((m) => m.category === "Administration").length)}
                sub="Finance, settings, access control"
              />
              <OverviewCard
                label="Operations"
                value={String(visibleModules.filter((m) => m.category === "Operations").length)}
                sub="Attendance, tasks, events"
              />
              <OverviewCard
                label="Communication"
                value={String(visibleModules.filter((m) => m.category === "Communication").length)}
                sub="Announcements and school updates"
              />
            </div>
          </div>
        </section>

        <section style={styles.contentGrid}>
          <div style={styles.mainColumn}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Featured Modules</h2>
                <p style={styles.sectionSub}>
                  High-impact areas for daily school operations.
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
                  <div style={styles.featuredCategory}>{module.category}</div>
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
                    Every section available in your current school workspace.
                  </p>
                </div>
              </div>

              {filteredModules.length === 0 ? (
                <EmptyState
                  title="No modules found"
                  text="Try another search term or switch to a different category."
                />
              ) : (
                <div style={styles.moduleGrid}>
                  {filteredModules.map((module) => (
                    <Link key={module.href} href={module.href} style={styles.moduleCard}>
                      <div
                        style={{
                          ...styles.moduleIconWrap,
                          background: module.accent,
                        }}
                      >
                        <div style={styles.moduleIcon}>{module.icon}</div>
                      </div>

                      <div style={styles.moduleMetaRow}>
                        <span style={styles.moduleCategory}>{module.category}</span>
                        {module.priority ? <span style={styles.modulePriority}>Priority</span> : null}
                      </div>

                      <div style={styles.moduleTitle}>{module.title}</div>
                      <div style={styles.moduleDesc}>{module.desc}</div>
                      <div style={styles.moduleAction}>Open module →</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside style={styles.sideColumn}>
            <div style={styles.sidePanel}>
              <h3 style={styles.sideTitle}>Quick Actions</h3>
              <p style={styles.sideSub}>Jump into the next most common tasks.</p>

              <div style={styles.quickList}>
                {quickLinks.map((item) => (
                  <Link key={item.href} href={item.href} style={styles.quickLink}>
                    <span>
                      {item.icon} {item.label}
                    </span>
                    <span style={{ opacity: 0.7 }}>→</span>
                  </Link>
                ))}
              </div>
            </div>

            <div style={styles.sidePanel}>
              <h3 style={styles.sideTitle}>Recent Announcements</h3>
              {!stats.recentAnnouncements.length ? (
                <EmptyState title="No announcements yet" text="Post your first update from the announcements module." />
              ) : (
                <div style={styles.snapshotList}>
                  {stats.recentAnnouncements.map((item) => (
                    <div key={item.id} style={styles.snapshotRow}>
                      <div>
                        <div style={styles.snapshotLabel}>{item.title}</div>
                        <div style={{ ...styles.sectionSub, marginTop: 4 }}>
                          {item.audience || "General"} {item.created_at ? `• ${formatDate(item.created_at)}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.sidePanel}>
              <h3 style={styles.sideTitle}>Tasks & Events</h3>
              <div style={styles.snapshotList}>
                {stats.recentTasks.slice(0, 3).map((item) => (
                  <div key={item.id} style={styles.snapshotRow}>
                    <div>
                      <div style={styles.snapshotLabel}>✅ {item.title}</div>
                      <div style={{ ...styles.sectionSub, marginTop: 4 }}>
                        {item.status || "Open"} {item.due_date ? `• ${formatDate(item.due_date)}` : ""}
                      </div>
                    </div>
                  </div>
                ))}

                {stats.upcomingEvents.slice(0, 3).map((item) => (
                  <div key={item.id} style={styles.snapshotRow}>
                    <div>
                      <div style={styles.snapshotLabel}>📅 {item.title}</div>
                      <div style={{ ...styles.sectionSub, marginTop: 4 }}>
                        {item.date ? formatDate(item.date) : "Date not set"}
                        {item.location ? ` • ${item.location}` : ""}
                      </div>
                    </div>
                  </div>
                ))}

                {!stats.recentTasks.length && !stats.upcomingEvents.length ? (
                  <EmptyState
                    title="No tasks or events"
                    text="Create tasks and events to keep operations visible."
                  />
                ) : null}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function settledData(result: PromiseSettledResult<any>) {
  if (result.status === "fulfilled") return result.value?.data;
  return null;
}

function normalizeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function extractOutstanding(finance: any): number {
  if (!finance) return 0;

  const candidates = [
    finance?.total_outstanding,
    finance?.outstanding_total,
    finance?.balance_due_total,
    finance?.total_balance_due,
    finance?.totalOutstanding,
  ];

  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }

  if (Array.isArray(finance)) {
    return finance.reduce((sum, row) => sum + (Number(row?.balance_due) || Number(row?.balance) || 0), 0);
  }

  return 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
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

function HeroPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.heroPill}>
      <div style={styles.heroPillLabel}>{label}</div>
      <div style={styles.heroPillValue}>{value}</div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div style={styles.overviewCard}>
      <div style={styles.overviewLabel}>{label}</div>
      <div style={styles.overviewValue}>{value}</div>
      <div style={styles.overviewSub}>{sub}</div>
    </div>
  );
}

function extractErr(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } | string };
    message?: string;
  };

  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const msg =
      (data as { message?: string; error?: string }).message ||
      (data as { error?: string }).error;
    if (msg) return msg;
  }
  return err?.message || fallback;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: 24,
    background: "linear-gradient(180deg, #020617 0%, #0f172a 42%, #111827 100%)",
    overflow: "hidden",
  },
  container: {
    maxWidth: 1440,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
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
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: 20,
    padding: 28,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.82))",
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
  heroPills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  heroPill: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
  },
  heroPillLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroPillValue: {
    marginTop: 4,
    fontSize: 14,
    color: "#fff",
    fontWeight: 900,
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
  heroPanelTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
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
  onlineBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.16)",
    border: "1px solid rgba(34,197,94,0.25)",
    color: "#bbf7d0",
    fontSize: 12,
    fontWeight: 800,
  },
  heroMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 16,
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
  controlStrip: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "1.5fr 0.8fr auto",
    gap: 14,
    alignItems: "end",
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(15,23,42,0.72)",
  },
  searchWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  filterWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  searchLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  searchInput: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.42)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
  },
  selectInput: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.42)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
  },
  summaryChip: {
    padding: "12px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#e2e8f0",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  insightGrid: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },
  insightPanel: {
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
  },
  insightHeader: {
    marginBottom: 14,
  },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  overviewCard: {
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  overviewLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  overviewValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: 900,
    color: "#fff",
  },
  overviewSub: {
    marginTop: 8,
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  focusList: {
    display: "grid",
    gap: 10,
  },
  focusRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  focusIndex: {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(96,165,250,0.16)",
    color: "#dbeafe",
    fontWeight: 900,
    flexShrink: 0,
  },
  focusRowTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#fff",
  },
  focusRowText: {
    marginTop: 4,
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 1.5,
  },
  contentGrid: {
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
    minHeight: 210,
    boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
  },
  featuredIcon: {
    fontSize: 32,
  },
  featuredCategory: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.88)",
  },
  featuredTitle: {
    marginTop: 10,
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
  moduleMetaRow: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  moduleCategory: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(96,165,250,0.14)",
    border: "1px solid rgba(96,165,250,0.20)",
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modulePriority: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.14)",
    border: "1px solid rgba(34,197,94,0.20)",
    color: "#bbf7d0",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
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
  snapshotList: {
    display: "grid",
    gap: 12,
    marginTop: 16,
  },
  snapshotRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  snapshotLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
  },
  snapshotValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
  },
};