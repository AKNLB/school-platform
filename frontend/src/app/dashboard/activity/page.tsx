"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import LoadingState from "@/components/ui/LoadingState";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";

type AuditRow = {
  id: number;
  school_id: number;
  user_id?: number | null;
  user_email?: string | null;
  module: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  entity_label?: string | null;
  details?: Record<string, unknown>;
  ip_address?: string | null;
  created_at?: string | null;
};

type AuditSummary = {
  count: number;
  by_module: {
    students: number;
    finance: number;
    resources: number;
    settings: number;
    announcements: number;
    tasks: number;
  };
  by_action: Record<string, number>;
  latest: AuditRow[];
};

type AuditPagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_prev: boolean;
  has_next: boolean;
};

const EMPTY_SUMMARY: AuditSummary = {
  count: 0,
  by_module: {
    students: 0,
    finance: 0,
    resources: 0,
    settings: 0,
    announcements: 0,
    tasks: 0,
  },
  by_action: {},
  latest: [],
};

const EMPTY_PAGINATION: AuditPagination = {
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 1,
  has_prev: false,
  has_next: false,
};

const MODULE_OPTIONS = ["", "students", "finance", "resources", "settings", "announcements", "tasks"];
const ACTION_OPTIONS = [
  "",
  "create",
  "update",
  "delete",
  "upload",
  "upload_asset",
  "upload_photo",
  "upload_version",
  "save_tuition",
  "add_payment",
  "export_statement",
  "open_receipt_pdf",
  "download",
  "pin_toggle",
  "upload_attachment",
  "delete_attachment",
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function ActivityPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [summary, setSummary] = useState<AuditSummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<AuditPagination>(EMPTY_PAGINATION);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null);

  async function loadAudit(targetPage = page, targetPageSize = pageSize) {
    setBusy(true);
    setErr(null);

    try {
      const params: Record<string, string | number> = {
        page: targetPage,
        page_size: targetPageSize,
      };

      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      if (search.trim()) params.q = search.trim();
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [logsRes, summaryRes] = await Promise.all([
        api.get("/audit-logs", { params }),
        api.get("/audit-logs/summary"),
      ]);

      const logsData = logsRes.data || {};
      const nextRows: AuditRow[] = Array.isArray(logsData.items) ? logsData.items : [];

      setRows(nextRows);
      setPagination(normalizePagination(logsData.pagination));
      setSummary(normalizeSummary(summaryRes.data));

      setSelectedRow((prev) => {
        if (!prev) return nextRows[0] || null;
        return nextRows.find((r: AuditRow) => r.id === prev.id) || nextRows[0] || null;
      });
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load activity log."));
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setPagination(EMPTY_PAGINATION);
      setSelectedRow(null);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAudit(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topActions = useMemo(() => {
    return Object.entries(summary.by_action || {})
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [summary]);

  const recentByModule = useMemo(() => {
    return [
      { label: "Students", value: summary.by_module.students, accent: "blue" as const },
      { label: "Finance", value: summary.by_module.finance, accent: "amber" as const },
      { label: "Resources", value: summary.by_module.resources, accent: "purple" as const },
      { label: "Settings", value: summary.by_module.settings, accent: "green" as const },
      { label: "Announcements", value: summary.by_module.announcements, accent: "rose" as const },
      { label: "Tasks", value: summary.by_module.tasks, accent: "cyan" as const },
    ];
  }, [summary]);

  function applyFilters() {
    setPage(1);
    void loadAudit(1, pageSize);
  }

  function clearFilters() {
    setModuleFilter("");
    setActionFilter("");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    void loadAudit(1, pageSize);
  }

  function goToPrevPage() {
    if (!pagination.has_prev) return;
    const nextPage = page - 1;
    setPage(nextPage);
    void loadAudit(nextPage, pageSize);
  }

  function goToNextPage() {
    if (!pagination.has_next) return;
    const nextPage = page + 1;
    setPage(nextPage);
    void loadAudit(nextPage, pageSize);
  }

  function changePageSize(nextSize: number) {
    setPageSize(nextSize);
    setPage(1);
    void loadAudit(1, nextSize);
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.bgGlowOne} />
        <div style={styles.bgGlowTwo} />
        <div style={styles.container}>
          <LoadingState text="Loading activity log..." />
        </div>
      </div>
    );
  }

  if (err && rows.length === 0) {
    return (
      <div style={styles.page}>
        <div style={styles.bgGlowOne} />
        <div style={styles.bgGlowTwo} />
        <div style={styles.container}>
          <ErrorState text={err} onRetry={() => void loadAudit(page, pageSize)} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgGlowOne} />
      <div style={styles.bgGlowTwo} />

      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={styles.eyebrow}>Admin Visibility</div>
            <h1 style={styles.heroTitle}>Activity Log</h1>
            <p style={styles.heroText}>
              Track important changes across students, finance, resources, settings, announcements, and tasks.
              This gives administrators a clean audit trail of who did what and when.
            </p>

            <div style={styles.heroPills}>
              <HeroPill label="Total Events" value={String(summary.count)} />
              <HeroPill label="Visible Rows" value={String(rows.length)} />
              <HeroPill label="Page" value={`${pagination.page}/${pagination.total_pages}`} />
              <HeroPill label="Status" value={busy ? "Refreshing" : "Live"} />
            </div>
          </div>

          <div style={styles.heroSide}>
            <button onClick={() => void loadAudit(page, pageSize)} style={styles.primaryBtn} disabled={busy}>
              {busy ? "Refreshing..." : "Refresh Activity"}
            </button>
          </div>
        </section>

        <section style={styles.statsGrid}>
          {recentByModule.map((item) => (
            <StatCard key={item.label} label={item.label} value={String(item.value)} accent={item.accent} />
          ))}
        </section>

        <section style={styles.contentGrid}>
          <div style={styles.mainColumn}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Filter Activity</div>
                  <div style={styles.panelSub}>
                    Narrow logs by module, action, keyword, and date range.
                  </div>
                </div>
              </div>

              <div style={styles.filterGrid}>
                <div style={styles.fieldWrap}>
                  <div style={styles.fieldLabel}>Module</div>
                  <select
                    value={moduleFilter}
                    onChange={(e) => setModuleFilter(e.target.value)}
                    style={styles.fieldInput}
                  >
                    <option value="">All modules</option>
                    {MODULE_OPTIONS.filter(Boolean).map((m) => (
                      <option key={m} value={m}>
                        {titleize(m)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.fieldWrap}>
                  <div style={styles.fieldLabel}>Action</div>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    style={styles.fieldInput}
                  >
                    <option value="">All actions</option>
                    {ACTION_OPTIONS.filter(Boolean).map((a) => (
                      <option key={a} value={a}>
                        {titleize(a)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ ...styles.fieldWrap, gridColumn: "1 / -1" }}>
                  <div style={styles.fieldLabel}>Search</div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user, action, entity, or details..."
                    style={styles.fieldInput}
                  />
                </div>

                <div style={styles.fieldWrap}>
                  <div style={styles.fieldLabel}>Start Date</div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={styles.fieldInput}
                  />
                </div>

                <div style={styles.fieldWrap}>
                  <div style={styles.fieldLabel}>End Date</div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={styles.fieldInput}
                  />
                </div>

                <div style={styles.fieldWrap}>
                  <div style={styles.fieldLabel}>Page Size</div>
                  <select
                    value={pageSize}
                    onChange={(e) => changePageSize(Number(e.target.value))}
                    style={styles.fieldInput}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size} per page
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.filterActions}>
                  <button onClick={applyFilters} style={styles.primaryBtn} disabled={busy}>
                    Apply
                  </button>
                  <button onClick={clearFilters} style={styles.secondaryBtn} disabled={busy}>
                    Clear
                  </button>
                </div>
              </div>
            </section>

            <section style={{ ...styles.panel, marginTop: 18 }}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Recent Activity</div>
                  <div style={styles.panelSub}>
                    Latest audit trail entries across key modules.
                  </div>
                </div>

                <div style={styles.paginationInfo}>
                  {pagination.total} total • page {pagination.page} of {pagination.total_pages}
                </div>
              </div>

              {rows.length === 0 ? (
                <div style={{ padding: 18 }}>
                  <EmptyState
                    title="No activity found"
                    text="Try changing filters or perform an action in students, finance, resources, settings, announcements, or tasks."
                  />
                </div>
              ) : (
                <>
                  <div style={styles.timelineWrap}>
                    {rows.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        style={styles.timelineRow}
                        onClick={() => setSelectedRow(row)}
                      >
                        <div style={styles.timelineDot}>{iconForModule(row.module)}</div>

                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={styles.timelineTop}>
                            <span style={moduleBadgeStyle(row.module)}>{titleize(row.module)}</span>
                            <span style={styles.actionBadge}>{titleize(row.action)}</span>
                          </div>

                          <div style={styles.timelineTitle}>
                            {row.entity_label || `${titleize(row.entity_type)} #${row.entity_id || "--"}`}
                          </div>

                          <div style={styles.timelineMeta}>
                            {row.user_email || "Unknown user"} • {formatDateTime(row.created_at)}
                          </div>
                        </div>

                        <div style={styles.timelineArrow}>→</div>
                      </button>
                    ))}
                  </div>

                  <div style={styles.paginationBar}>
                    <button
                      onClick={goToPrevPage}
                      style={styles.secondaryBtn}
                      disabled={busy || !pagination.has_prev}
                    >
                      Previous
                    </button>

                    <div style={styles.paginationCenter}>
                      Page {pagination.page} of {pagination.total_pages}
                    </div>

                    <button
                      onClick={goToNextPage}
                      style={styles.secondaryBtn}
                      disabled={busy || !pagination.has_next}
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          <aside style={styles.sideColumn}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Top Actions</div>
                  <div style={styles.panelSub}>Most frequent activity types.</div>
                </div>
              </div>

              {topActions.length === 0 ? (
                <div style={{ padding: 18 }}>
                  <EmptyState title="No action stats" text="Action counts will appear after activity is logged." />
                </div>
              ) : (
                <div style={styles.sideList}>
                  {topActions.map((item) => (
                    <div key={item.action} style={styles.sideRow}>
                      <div>
                        <div style={styles.sideLabel}>{titleize(item.action)}</div>
                        <div style={styles.sideMeta}>Tracked in audit summary</div>
                      </div>
                      <div style={styles.sideValue}>{item.count}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ ...styles.panel, marginTop: 18 }}>
              <div style={styles.panelHeader}>
                <div>
                  <div style={styles.panelTitle}>Activity Details</div>
                  <div style={styles.panelSub}>Inspect the selected audit record.</div>
                </div>
              </div>

              {!selectedRow ? (
                <div style={{ padding: 18 }}>
                  <EmptyState title="Nothing selected" text="Click an activity row to inspect details." />
                </div>
              ) : (
                <div style={styles.detailWrap}>
                  <DetailRow label="Module" value={titleize(selectedRow.module)} />
                  <DetailRow label="Action" value={titleize(selectedRow.action)} />
                  <DetailRow label="Entity Type" value={titleize(selectedRow.entity_type)} />
                  <DetailRow label="Entity" value={selectedRow.entity_label || "--"} />
                  <DetailRow label="Entity ID" value={selectedRow.entity_id || "--"} />
                  <DetailRow label="User" value={selectedRow.user_email || "--"} />
                  <DetailRow label="IP Address" value={selectedRow.ip_address || "--"} />
                  <DetailRow label="Time" value={formatDateTime(selectedRow.created_at)} />

                  <div style={{ marginTop: 14 }}>
                    <div style={styles.detailLabel}>Details JSON</div>
                    <pre style={styles.codeBlock}>
                      {JSON.stringify(selectedRow.details || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function normalizeSummary(data: any): AuditSummary {
  return {
    count: Number(data?.count || 0),
    by_module: {
      students: Number(data?.by_module?.students || 0),
      finance: Number(data?.by_module?.finance || 0),
      resources: Number(data?.by_module?.resources || 0),
      settings: Number(data?.by_module?.settings || 0),
      announcements: Number(data?.by_module?.announcements || 0),
      tasks: Number(data?.by_module?.tasks || 0),
    },
    by_action: data?.by_action && typeof data.by_action === "object" ? data.by_action : {},
    latest: Array.isArray(data?.latest) ? data.latest : [],
  };
}

function normalizePagination(data: any): AuditPagination {
  return {
    page: Number(data?.page || 1),
    page_size: Number(data?.page_size || 25),
    total: Number(data?.total || 0),
    total_pages: Number(data?.total_pages || 1),
    has_prev: Boolean(data?.has_prev),
    has_next: Boolean(data?.has_next),
  };
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

function titleize(value?: string | null) {
  return String(value || "")
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function iconForModule(module: string) {
  const map: Record<string, string> = {
    students: "🎓",
    finance: "💳",
    resources: "📚",
    settings: "⚙️",
    announcements: "📢",
    tasks: "✅",
  };
  return map[module] || "🧭";
}

function moduleBadgeStyle(module: string): CSSProperties {
  return {
    padding: "5px 8px",
    borderRadius: 999,
    background:
      module === "students"
        ? "rgba(45,212,191,0.14)"
        : module === "finance"
          ? "rgba(245,158,11,0.14)"
          : module === "resources"
            ? "rgba(56,189,248,0.14)"
            : module === "settings"
              ? "rgba(34,197,94,0.14)"
              : module === "announcements"
                ? "rgba(251,113,133,0.14)"
                : module === "tasks"
                  ? "rgba(34,211,238,0.14)"
                  : "rgba(148,163,184,0.14)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
}

function HeroPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.heroPill}>
      <div style={styles.heroPillLabel}>{label}</div>
      <div style={styles.heroPillValue}>{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "amber" | "purple" | "green" | "rose" | "cyan";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.30)",
    amber: "rgba(245,158,11,0.30)",
    purple: "rgba(168,85,247,0.30)",
    green: "rgba(34,197,94,0.30)",
    rose: "rgba(251,113,133,0.30)",
    cyan: "rgba(34,211,238,0.30)",
  };

  return (
    <div style={{ ...styles.statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailRow}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #020617 0%, #0f172a 42%, #111827 100%)",
    color: "#f8fafc",
    padding: 24,
    position: "relative",
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
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    padding: 28,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,41,59,0.82))",
    boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
    backdropFilter: "blur(12px)",
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
  heroSide: {
    display: "flex",
    alignItems: "flex-start",
  },
  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.18)",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: "pointer",
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
  statLabel: {
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
  contentGrid: {
    marginTop: 28,
    display: "grid",
    gridTemplateColumns: "1.35fr 0.8fr",
    gap: 20,
    alignItems: "start",
  },
  mainColumn: {
    minWidth: 0,
  },
  sideColumn: {
    display: "flex",
    flexDirection: "column",
  },
  panel: {
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
    overflow: "hidden",
  },
  panelHeader: {
    padding: 18,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#fff",
  },
  panelSub: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.5,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    padding: 18,
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  fieldLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  fieldInput: {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(2,6,23,0.42)",
    color: "#fff",
    outline: "none",
    fontSize: 14,
  },
  filterActions: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    gridColumn: "1 / -1",
  },
  paginationInfo: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 700,
  },
  timelineWrap: {
    display: "grid",
    gap: 12,
    padding: 18,
  },
  timelineRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "14px 16px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "inherit",
    cursor: "pointer",
  },
  timelineDot: {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(96,165,250,0.16)",
    color: "#dbeafe",
    fontWeight: 900,
    flexShrink: 0,
  },
  timelineTop: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  actionBadge: {
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  timelineTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: 900,
    color: "#fff",
  },
  timelineMeta: {
    marginTop: 6,
    color: "#94a3b8",
    fontSize: 13,
  },
  timelineArrow: {
    color: "#94a3b8",
    fontWeight: 900,
  },
  paginationBar: {
    padding: "0 18px 18px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  paginationCenter: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: 700,
  },
  sideList: {
    display: "grid",
    gap: 12,
    padding: 18,
  },
  sideRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  sideLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 800,
  },
  sideMeta: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 12,
  },
  sideValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 900,
  },
  detailWrap: {
    padding: 18,
  },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  detailLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  codeBlock: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    background: "rgba(2,6,23,0.52)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#dbeafe",
    fontSize: 12,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};