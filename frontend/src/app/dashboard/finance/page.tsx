"use client";

import type { CSSProperties, ReactNode } from "react";
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

type PaymentItem = {
  id: number;
  student_id: number;
  tuition_id: number;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  timestamp: string | null;
};

type TuitionInfo = {
  id: number;
  student_id: number;
  term: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  balance_due: number;
  payment_plan: string | null;
  status: string | null;
  payments: Array<{
    id: number;
    amount: number;
    method: string | null;
    reference: string | null;
    timestamp: string | null;
    note: string | null;
  }>;
};

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [term, setTerm] = useState("Term 1");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<FinanceSummary | null>(null);

  const [statementOpen, setStatementOpen] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<OutstandingItem | null>(null);
  const [tuition, setTuition] = useState<TuitionInfo | null>(null);

  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = { term };
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

  async function openStudentStatement(student: OutstandingItem) {
    setSelectedStudent(student);
    setStatementOpen(true);
    setStatementLoading(true);
    setStatementError(null);
    setTuition(null);

    try {
      const res = await api.get(`/tuition/${student.student_id}`, {
        params: { term },
      });
      setTuition(res.data);
    } catch (e: unknown) {
      setStatementError(extractErr(e, "Failed to load student statement"));
    } finally {
      setStatementLoading(false);
    }
  }

  async function openPaymentHistory(student: OutstandingItem) {
    setSelectedStudent(student);
    setPaymentsOpen(true);
    setPaymentsLoading(true);
    setPaymentsError(null);
    setPayments([]);

    try {
      const res = await api.get(`/payments/${student.student_id}`, {
        params: { term },
      });
      setPayments(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      setPaymentsError(extractErr(e, "Failed to load payment history"));
    } finally {
      setPaymentsLoading(false);
    }
  }

  function openStatementPdf(studentId: number) {
    const url = `/api/finance/statement?student_id=${studentId}&term=${encodeURIComponent(term)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openStatementCsv(studentId: number) {
    const url = `/api/finance/statement?student_id=${studentId}&term=${encodeURIComponent(term)}&format=csv`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openReceipt(paymentId: number) {
    const url = `/api/payments/${paymentId}/receipt.pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

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
                Monitor tuition performance, review student balances, inspect payment
                history, and open statements and receipts from one premium finance panel.
              </p>
            </div>

            <div style={heroActions}>
              <button onClick={() => void load()} style={btnSecondary} disabled={loading}>
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
              <div style={panelSubtitle}>Fast finance workflows</div>
            </div>

            <div style={quickActions}>
              <QuickActionCard
                title="Student Statements"
                description="Open a student statement preview and export PDF or CSV."
              />
              <QuickActionCard
                title="Payment History"
                description="Inspect payment method, date, receipt, and reference details."
              />
              <QuickActionCard
                title="Receipt Access"
                description="Open payment receipts directly from any payment record."
              />
              <QuickActionCard
                title="Collections"
                description="Focus on balances, unpaid terms, and follow-up priorities."
              />
            </div>
          </div>
        </section>

        <section style={panel}>
          <div style={panelHeaderRow}>
            <div>
              <div style={panelTitle}>Outstanding Balances</div>
              <div style={panelSubtitle}>
                {loading ? "Loading balances..." : `${outstanding.length} student(s) shown`}
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
                    <th style={th}>Actions</th>
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
                      <td style={td}>
                        <div style={actionWrap}>
                          <button
                            style={miniBtn}
                            onClick={() => void openStudentStatement(row)}
                          >
                            Statement
                          </button>
                          <button
                            style={miniBtn}
                            onClick={() => void openPaymentHistory(row)}
                          >
                            Payments
                          </button>
                          <button
                            style={miniBtnGhost}
                            onClick={() => openStatementPdf(row.student_id)}
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {statementOpen && (
          <Modal
            title={`Student Statement${selectedStudent ? ` • ${selectedStudent.name}` : ""}`}
            onClose={() => setStatementOpen(false)}
          >
            {statementLoading ? (
              <div style={modalLoading}>Loading statement...</div>
            ) : statementError ? (
              <div style={modalError}>{statementError}</div>
            ) : tuition ? (
              <div>
                <div style={statementTopGrid}>
                  <InfoCard label="Student ID" value={`#${tuition.student_id}`} />
                  <InfoCard label="Term" value={tuition.term} />
                  <InfoCard label="Total Due" value={money(tuition.total_amount)} />
                  <InfoCard label="Amount Paid" value={money(tuition.amount_paid)} />
                  <InfoCard label="Balance" value={money(tuition.balance_due ?? tuition.balance)} />
                  <InfoCard label="Status" value={tuition.status || "Partial"} />
                </div>

                <div style={statementBlock}>
                  <div style={blockTitle}>Payment Summary</div>
                  {tuition.payments?.length ? (
                    <div style={{ overflowX: "auto" }}>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={th}>Receipt</th>
                            <th style={th}>Date</th>
                            <th style={thRight}>Amount</th>
                            <th style={th}>Method</th>
                            <th style={th}>Reference</th>
                            <th style={th}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tuition.payments.map((p) => (
                            <tr key={p.id} style={tr}>
                              <td style={tdStrong}>PAY-{p.id}</td>
                              <td style={td}>{formatDateTime(p.timestamp)}</td>
                              <td style={tdRight}>{money(p.amount)}</td>
                              <td style={td}>{p.method || "—"}</td>
                              <td style={td}>{p.reference || "—"}</td>
                              <td style={td}>
                                <button style={miniBtn} onClick={() => openReceipt(p.id)}>
                                  Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={emptyInline}>No payments recorded for this term.</div>
                  )}
                </div>

                <div style={modalActions}>
                  <button
                    style={btnSecondary}
                    onClick={() => selectedStudent && openStatementCsv(selectedStudent.student_id)}
                  >
                    Export CSV
                  </button>
                  <button
                    style={btnPrimary}
                    onClick={() => selectedStudent && openStatementPdf(selectedStudent.student_id)}
                  >
                    Open PDF Statement
                  </button>
                </div>
              </div>
            ) : (
              <div style={emptyInline}>No statement data available.</div>
            )}
          </Modal>
        )}

        {paymentsOpen && (
          <Modal
            title={`Payment History${selectedStudent ? ` • ${selectedStudent.name}` : ""}`}
            onClose={() => setPaymentsOpen(false)}
          >
            {paymentsLoading ? (
              <div style={modalLoading}>Loading payment history...</div>
            ) : paymentsError ? (
              <div style={modalError}>{paymentsError}</div>
            ) : payments.length === 0 ? (
              <div style={emptyInline}>No payment history found for this term.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Receipt</th>
                      <th style={th}>Date</th>
                      <th style={thRight}>Amount</th>
                      <th style={th}>Method</th>
                      <th style={th}>Reference</th>
                      <th style={th}>Note</th>
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} style={tr}>
                        <td style={tdStrong}>PAY-{p.id}</td>
                        <td style={td}>{formatDateTime(p.timestamp)}</td>
                        <td style={tdRight}>{money(p.amount)}</td>
                        <td style={td}>{p.method || "—"}</td>
                        <td style={td}>{p.reference || "—"}</td>
                        <td style={td}>{p.note || "—"}</td>
                        <td style={td}>
                          <button style={miniBtn} onClick={() => openReceipt(p.id)}>
                            Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Modal>
        )}
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCard}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div onMouseDown={onClose} style={modalOverlay}>
      <div onMouseDown={(e) => e.stopPropagation()} style={modalCard}>
        <div style={modalHeader}>
          <div style={modalTitle}>{title}</div>
          <button onClick={onClose} style={iconBtn}>
            ✕
          </button>
        </div>
        <div style={modalBody}>{children}</div>
      </div>
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

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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

const miniBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
};

const miniBtnGhost: CSSProperties = {
  ...miniBtn,
  background: "rgba(59,130,246,0.12)",
};

const iconBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
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

const actionWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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
  verticalAlign: "top",
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

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.72)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 60,
};

const modalCard: CSSProperties = {
  width: "min(1100px, 100%)",
  maxHeight: "88vh",
  overflow: "auto",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0f172a",
  boxShadow: "0 24px 90px rgba(0,0,0,0.45)",
};

const modalHeader: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const modalTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#fff",
};

const modalBody: CSSProperties = {
  padding: 16,
};

const modalLoading: CSSProperties = {
  padding: 18,
  color: "#cbd5e1",
};

const modalError: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "#fee2e2",
};

const statementTopGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const infoCard: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};

const infoLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.7,
};

const infoValue: CSSProperties = {
  marginTop: 8,
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const statementBlock: CSSProperties = {
  marginTop: 12,
};

const blockTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#fff",
  marginBottom: 10,
};

const emptyInline: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
  flexWrap: "wrap",
};