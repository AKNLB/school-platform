"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type OutstandingItem = {
  student_id: number;
  name: string;
  grade: number;
  total_due: number;
  paid: number;
  balance: number;
  status: string;
};

type FinanceSummary = {
  term: string;
  grade: number | null;
  total_due: number;
  total_paid: number;
  total_balance: number;
  students_count: number;
  outstanding_count: number;
  outstanding_top: OutstandingItem[];
};

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [term, setTerm] = useState("Term 1");
  const [grade, setGrade] = useState<string>("");

  const [data, setData] = useState<FinanceSummary | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        term,
      };

      if (grade.trim()) params.grade = grade.trim();

      const res = await api.get("/finance/dashboard", { params });
      setData(res.data);
    } catch (e: unknown) {
      setError(extractErr(e, "Failed to load finance dashboard"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [term, grade]);

  const outstanding = useMemo(() => {
    const rows = data?.outstanding_top || [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((row) => {
      return (
        row.name.toLowerCase().includes(needle) ||
        String(row.student_id).includes(needle) ||
        String(row.grade).includes(needle) ||
        (row.status || "").toLowerCase().includes(needle)
      );
    });
  }, [data, search]);

  const collectionRate = useMemo(() => {
    const due = Number(data?.total_due || 0);
    const paid = Number(data?.total_paid || 0);
    if (!due) return 0;
    return Math.round((paid / due) * 100);
  }, [data]);

  const averageBalance = useMemo(() => {
    const count = Number(data?.outstanding_count || 0);
    const balance = Number(data?.total_balance || 0);
    if (!count) return 0;
    return balance / count;
  }, [data]);

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={heroCard}>
          <div style={heroGlowA} />
          <div style={heroGlowB} />

          <div style={heroContent}>
            <div>
              <div style={eyebrow}>School Platform</div>
              <h1 style={heroTitle}>Finance</h1>
              <p style={subtitle}>
                Monitor tuition performance, outstanding balances, student payment status,
                and finance reporting from one clean control center.
              </p>
            </div>

            <div style={heroActions}>
              <button
                onClick={() => void load()}
                style={btnSecondary}
                disabled={loading || busy}
              >
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section style={toolbar}>
          <div style={toolbarLeft}>
            <div style={fieldBlock}>
              <label style={fieldLabel}>Term</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                style={fieldInput}
              >
                {TERM_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldBlock}>
              <label style={fieldLabel}>Grade</label>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="All grades"
                style={fieldInput}
              />
            </div>

            <div style={fieldBlock}>
              <label style={fieldLabel}>Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, ID, status..."
                style={fieldInputWide}
              />
            </div>
          </div>

          <div style={toolbarRight}>
            <button
              onClick={() => {
                setGrade("");
                setSearch("");
              }}
              style={btnSecondary}
            >
              Reset
            </button>
          </div>
        </section>

        {error && (
          <div style={alertBox}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {error}
          </div>
        )}

        <section style={statsGrid}>
          <StatCard
            label="Total Due"
            value={money(data?.total_due || 0)}
            sub="Expected tuition revenue"
            accent="blue"
          />
          <StatCard
            label="Total Paid"
            value={money(data?.total_paid || 0)}
            sub="Collected payments"
            accent="green"
          />
          <StatCard
            label="Outstanding"
            value={money(data?.total_balance || 0)}
            sub="Remaining balance"
            accent="red"
          />
          <StatCard
            label="Collection Rate"
            value={`${collectionRate}%`}
            sub="Paid vs expected"
            accent="violet"
          />
          <StatCard
            label="Students"
            value={String(data?.students_count || 0)}
            sub="Included in summary"
            accent="amber"
          />
          <StatCard
            label="Avg Balance"
            value={money(averageBalance)}
            sub="Per outstanding student"
            accent="slate"
          />
        </section>

        <section style={twoColGrid}>
          <div style={panel}>
            <div style={panelHeader}>
              <div style={panelTitle}>Finance Snapshot</div>
              <div style={panelSubtitle}>
                Summary for {data?.term || term}
                {grade ? ` • Grade ${grade}` : " • All grades"}
              </div>
            </div>

            <div style={snapshotGrid}>
              <SnapshotRow label="Students Count" value={String(data?.students_count || 0)} />
              <SnapshotRow label="Outstanding Count" value={String(data?.outstanding_count || 0)} />
              <SnapshotRow label="Total Due" value={money(data?.total_due || 0)} />
              <SnapshotRow label="Total Paid" value={money(data?.total_paid || 0)} />
              <SnapshotRow label="Total Balance" value={money(data?.total_balance || 0)} />
              <SnapshotRow label="Collection Rate" value={`${collectionRate}%`} />
            </div>
          </div>

          <div style={panel}>
            <div style={panelHeader}>
              <div style={panelTitle}>Quick Actions</div>
              <div style={panelSubtitle}>Finance workflows you can expand next</div>
            </div>

            <div style={quickActions}>
              <QuickActionCard
                title="Student Statements"
                description="Generate term statements and review payment history by student."
              />
              <QuickActionCard
                title="Receipts"
                description="Open receipt workflows for payments and downloadable proof."
              />
              <QuickActionCard
                title="Payment Tracking"
                description="Track unpaid balances, partial payments, and collection progress."
              />
              <QuickActionCard
                title="Reports"
                description="Export tuition summaries and finance performance by term or grade."
              />
            </div>
          </div>
        </section>

        <section style={panel}>
          <div style={panelHeaderRow}>
            <div>
              <div style={panelTitle}>Outstanding Balances</div>
              <div style={panelSubtitle}>
                {loading
                  ? "Loading balances..."
                  : `${outstanding.length} student(s) shown`}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>Loading finance data...</div>
              <div style={emptyStateText}>Please wait while balances are prepared.</div>
            </div>
          ) : outstanding.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>No outstanding balances found</div>
              <div style={emptyStateText}>
                Everything looks clear for the selected filters.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Student</th>
                    <th style={th}>Student ID</th>
                    <th style={th}>Grade</th>
                    <th style={thRight}>Total Due</th>
                    <th style={thRight}>Paid</th>
                    <th style={thRight}>Balance</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((row) => (
                    <tr key={row.student_id} style={tr}>
                      <td style={tdStrong}>{row.name}</td>
                      <td style={td}>#{row.student_id}</td>
                      <td style={td}>Grade {row.grade}</td>
                      <td style={tdRight}>{money(row.total_due)}</td>
                      <td style={tdRight}>{money(row.paid)}</td>
                      <td style={{ ...tdRight, color: "#fca5a5", fontWeight: 900 }}>
                        {money(row.balance)}
                      </td>
                      <td style={td}>
                        <span style={statusPill(row.status)}>{row.status || "Partial"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "green" | "red" | "violet" | "amber" | "slate";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(59,130,246,0.22)",
    green: "rgba(34,197,94,0.22)",
    red: "rgba(239,68,68,0.22)",
    violet: "rgba(139,92,246,0.22)",
    amber: "rgba(245,158,11,0.22)",
    slate: "rgba(148,163,184,0.18)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
      <div style={statSub}>{sub}</div>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={snapshotRow}>
      <span style={snapshotLabel}>{label}</span>
      <span style={snapshotValue}>{value}</span>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={quickCard}>
      <div style={quickCardTitle}>{title}</div>
      <div style={quickCardText}>{description}</div>
    </div>
  );
}

function extractErr(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } | string };
    message?: string;
  };

  const msg =
    err?.response?.data &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    ("message" in err.response.data || "error" in err.response.data)
      ? (err.response.data as { message?: string; error?: string }).message ||
        (err.response.data as { message?: string; error?: string }).error
      : typeof err?.response?.data === "string"
        ? err.response.data
        : err?.message;

  return msg || fallback;
}

function money(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function statusPill(status: string): CSSProperties {
  const normalized = (status || "").toLowerCase();

  let bg = "rgba(148,163,184,0.18)";
  let color = "#e2e8f0";
  let border = "1px solid rgba(148,163,184,0.22)";

  if (normalized.includes("paid")) {
    bg = "rgba(34,197,94,0.16)";
    color = "#bbf7d0";
    border = "1px solid rgba(34,197,94,0.28)";
  } else if (normalized.includes("partial")) {
    bg = "rgba(245,158,11,0.16)";
    color = "#fde68a";
    border = "1px solid rgba(245,158,11,0.28)";
  } else if (normalized.includes("overdue") || normalized.includes("unpaid")) {
    bg = "rgba(239,68,68,0.16)";
    color = "#fecaca";
    border = "1px solid rgba(239,68,68,0.28)";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: bg,
    color,
    border,
  };
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(34,197,94,0.12), transparent 35%), radial-gradient(circle at top left, rgba(59,130,246,0.12), transparent 30%), linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
};

const page: CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
};

const heroCard: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.88))",
  boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
  marginBottom: 18,
};

const heroContent: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  padding: 24,
};

const heroGlowA: CSSProperties = {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(34,197,94,0.18)",
  filter: "blur(44px)",
  top: -70,
  right: -20,
};

const heroGlowB: CSSProperties = {
  position: "absolute",
  width: 240,
  height: 240,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.14)",
  filter: "blur(44px)",
  bottom: -70,
  left: -40,
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#86efac",
  marginBottom: 6,
};

const heroTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 950,
  margin: 0,
};

const subtitle: CSSProperties = {
  marginTop: 8,
  maxWidth: 760,
  opacity: 0.88,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
};

const toolbarLeft: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const toolbarRight: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const fieldBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#cbd5e1",
};

const fieldInput: CSSProperties = {
  minWidth: 160,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};

const fieldInputWide: CSSProperties = {
  ...fieldInput,
  minWidth: 260,
};

const btnPrimary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const alertBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "#fee2e2",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const statCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  marginTop: 8,
  color: "#ffffff",
};

const statSub: CSSProperties = {
  marginTop: 8,
  color: "#94a3b8",
  fontSize: 13,
};

const twoColGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const panel: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(8px)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.2)",
};

const panelHeader: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const panelHeaderRow: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const panelTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
};

const panelSubtitle: CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 13,
};

const snapshotGrid: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 16,
};

const snapshotRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const snapshotLabel: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14,
};

const snapshotValue: CSSProperties = {
  color: "#ffffff",
  fontWeight: 900,
};

const quickActions: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
};

const quickCard: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const quickCardTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  color: "#ffffff",
};

const quickCardText: CSSProperties = {
  marginTop: 6,
  color: "#cbd5e1",
  fontSize: 13,
  lineHeight: 1.5,
};

const emptyState: CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#cbd5e1",
};

const emptyStateTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#ffffff",
};

const emptyStateText: CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  opacity: 0.82,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "#94a3b8",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const thRight: CSSProperties = {
  ...th,
  textAlign: "right",
};

const tr: CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const td: CSSProperties = {
  padding: "14px 16px",
  color: "#e5e7eb",
  fontSize: 14,
};

const tdStrong: CSSProperties = {
  ...td,
  color: "#ffffff",
  fontWeight: 800,
};

const tdRight: CSSProperties = {
  ...td,
  textAlign: "right",
};