"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type FinanceSummary = {
  term: string;
  grade: number | null;
  total_due: number;
  total_paid: number;
  total_balance: number;
  students_count: number;
  outstanding_count: number;
  outstanding_top: OutstandingStudent[];
};

type OutstandingStudent = {
  student_id: number;
  name: string;
  grade: number;
  total_due: number;
  paid: number;
  balance: number;
  status: string;
};

type PaymentRow = {
  id: number;
  student_id: number;
  tuition_id: number;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  timestamp: string | null;
};

type TuitionRecord = {
  id: number;
  student_id: number;
  term: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  balance_due: number;
  payment_plan: string | null;
  status: string | null;
  payments: {
    id: number;
    amount: number;
    method: string | null;
    reference: string | null;
    timestamp: string | null;
    note: string | null;
  }[];
};

type StudentLite = {
  id: number;
  name: string;
  grade: number;
};

type AlertState = {
  type: "error" | "success";
  message: string;
} | null;

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];
const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "Mobile Money", "Cheque"];
const PAYMENT_PLANS = ["Full", "Monthly", "Installment", "Weekly"];
const STATUS_OPTIONS = ["Unpaid", "Partial", "Paid"];

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [term, setTerm] = useState("Term 1");
  const [grade, setGrade] = useState<string>("");

  const [summary, setSummary] = useState<FinanceSummary | null>(null);

  const [studentId, setStudentId] = useState("");
  const [statementTerm, setStatementTerm] = useState("Term 1");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [tuition, setTuition] = useState<TuitionRecord | null>(null);

  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<StudentLite[]>([]);

  const [tuitionForm, setTuitionForm] = useState({
    student_id: "",
    term: "Term 1",
    total_amount: "",
    amount_paid: "",
    payment_plan: "Full",
    status: "Unpaid",
  });

  const [paymentForm, setPaymentForm] = useState({
    tuition_id: "",
    amount: "",
    method: "Cash",
    reference: "",
    note: "",
  });

  useEffect(() => {
    void Promise.all([loadSummary(), loadStudents()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, grade]);

  async function loadSummary() {
    setLoading(true);
    try {
      const params: Record<string, string> = { term };
      if (grade) params.grade = grade;
      const res = await api.get("/finance/dashboard", { params });
      setSummary(res.data as FinanceSummary);
    } catch (e: unknown) {
      setAlertState({ type: "error", message: extractErr(e, "Failed to load finance summary.") });
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents() {
    try {
      const res = await api.get("/students");
      const rows = Array.isArray(res.data) ? res.data : [];
      setStudents(
        rows.map((s: Record<string, unknown>) => ({
          id: Number(s.id),
          name: String(s.name || ""),
          grade: Number(s.grade || 0),
        }))
      );
    } catch {
      setStudents([]);
    }
  }

  async function loadStudentFinance() {
    if (!studentId || !statementTerm) {
      setAlertState({ type: "error", message: "Select a student and term first." });
      return;
    }

    setBusy(true);
    setAlertState(null);

    try {
      const [tuitionRes, paymentRes] = await Promise.all([
        api.get(`/tuition/${studentId}`, { params: { term: statementTerm } }),
        api.get(`/payments/${studentId}`, { params: { term: statementTerm } }),
      ]);

      setTuition(tuitionRes.data as TuitionRecord);
      setPayments(Array.isArray(paymentRes.data) ? (paymentRes.data as PaymentRow[]) : []);

      setPaymentForm((prev) => ({
        ...prev,
        tuition_id: String((tuitionRes.data as TuitionRecord).id || ""),
      }));
    } catch (e: unknown) {
      setTuition(null);
      setPayments([]);
      setAlertState({ type: "error", message: extractErr(e, "Failed to load student finance details.") });
    } finally {
      setBusy(false);
    }
  }

  async function saveTuition() {
    if (!tuitionForm.student_id || !tuitionForm.term || !tuitionForm.total_amount) {
      setAlertState({ type: "error", message: "Student, term, and total amount are required." });
      return;
    }

    setBusy(true);
    setAlertState(null);

    try {
      await api.post("/tuition", {
        student_id: Number(tuitionForm.student_id),
        term: tuitionForm.term,
        total_amount: Number(tuitionForm.total_amount),
        amount_paid: tuitionForm.amount_paid ? Number(tuitionForm.amount_paid) : 0,
        payment_plan: tuitionForm.payment_plan,
        status: tuitionForm.status,
      });

      setAlertState({ type: "success", message: "Tuition record saved successfully." });
      await loadSummary();

      if (
        studentId &&
        Number(studentId) === Number(tuitionForm.student_id) &&
        statementTerm === tuitionForm.term
      ) {
        await loadStudentFinance();
      }
    } catch (e: unknown) {
      setAlertState({ type: "error", message: extractErr(e, "Failed to save tuition record.") });
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    if (!paymentForm.tuition_id || !paymentForm.amount) {
      setAlertState({ type: "error", message: "Choose a tuition record and enter a payment amount." });
      return;
    }

    setBusy(true);
    setAlertState(null);

    try {
      await api.post(`/tuition/${paymentForm.tuition_id}/payment`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference,
        note: paymentForm.note,
      });

      setAlertState({ type: "success", message: "Payment added successfully." });

      setPaymentForm((prev) => ({
        ...prev,
        amount: "",
        reference: "",
        note: "",
      }));

      await loadSummary();
      await loadStudentFinance();
    } catch (e: unknown) {
      setAlertState({ type: "error", message: extractErr(e, "Failed to add payment.") });
    } finally {
      setBusy(false);
    }
  }

  function openStatementPdf() {
    if (!studentId || !statementTerm) {
      setAlertState({ type: "error", message: "Choose a student and term first." });
      return;
    }
    const url = `/api/finance/statement?student_id=${encodeURIComponent(studentId)}&term=${encodeURIComponent(
      statementTerm
    )}&format=pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openStatementCsv() {
    if (!studentId || !statementTerm) {
      setAlertState({ type: "error", message: "Choose a student and term first." });
      return;
    }
    const url = `/api/finance/statement?student_id=${encodeURIComponent(studentId)}&term=${encodeURIComponent(
      statementTerm
    )}&format=csv`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openReceipt(paymentId: number) {
    const url = `/api/payments/${paymentId}/receipt.pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students.slice(0, 12);
    return students
      .filter((s) => `${s.name} ${s.id} ${s.grade}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [students, studentSearch]);

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>School Platform</div>
            <h1 style={heroTitle}>Finance Dashboard</h1>
            <p style={subtitle}>
              Track tuition, record payments, monitor balances, and generate finance documents
              from one premium control center.
            </p>
          </div>

          <div style={heroActions}>
            <select value={term} onChange={(e) => setTerm(e.target.value)} style={fieldInput}>
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              style={{ ...fieldInput, width: 120 }}
              placeholder="Grade"
            />

            <button onClick={() => void loadSummary()} style={btnSecondary} disabled={loading || busy}>
              Refresh
            </button>
          </div>
        </section>

        {alertState && (
          <div
            style={{
              ...alert,
              borderColor:
                alertState.type === "success"
                  ? "rgba(74, 222, 128, 0.35)"
                  : "rgba(248, 113, 113, 0.35)",
              background:
                alertState.type === "success"
                  ? "rgba(74, 222, 128, 0.10)"
                  : "rgba(248, 113, 113, 0.10)",
            }}
          >
            <strong style={{ marginRight: 8 }}>
              {alertState.type === "success" ? "Success:" : "Error:"}
            </strong>
            {alertState.message}
          </div>
        )}

        <section style={statsGrid}>
          <StatCard
            label="Total Due"
            value={money(summary?.total_due ?? 0)}
            subtitle="Expected tuition for selected term"
            accent="blue"
          />
          <StatCard
            label="Total Paid"
            value={money(summary?.total_paid ?? 0)}
            subtitle="Payments already received"
            accent="green"
          />
          <StatCard
            label="Outstanding"
            value={money(summary?.total_balance ?? 0)}
            subtitle="Remaining tuition balance"
            accent="amber"
          />
          <StatCard
            label="Students"
            value={String(summary?.students_count ?? 0)}
            subtitle="Students in current finance scope"
            accent="purple"
          />
          <StatCard
            label="Outstanding Cases"
            value={String(summary?.outstanding_count ?? 0)}
            subtitle="Students with unpaid balances"
            accent="red"
          />
        </section>

        <section style={twoCol}>
          <Panel
            title="Outstanding Balances"
            subtitle="Top unpaid student balances for the selected term."
            right={
              <span style={pill}>
                {summary?.term || term}
                {grade ? ` • Grade ${grade}` : ""}
              </span>
            }
          >
            {loading ? (
              <EmptyState text="Loading finance summary..." />
            ) : !summary?.outstanding_top?.length ? (
              <EmptyState text="No outstanding balances found." />
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {summary.outstanding_top.map((row) => (
                  <div key={`${row.student_id}-${row.grade}`} style={outstandingCard}>
                    <div>
                      <div style={outstandingName}>{row.name}</div>
                      <div style={outstandingMeta}>
                        Student ID #{row.student_id} • Grade {row.grade} • {row.status || "Partial"}
                      </div>
                    </div>

                    <div style={outstandingStats}>
                      <InfoPill label="Due" value={money(row.total_due)} />
                      <InfoPill label="Paid" value={money(row.paid)} />
                      <InfoPill label="Balance" value={money(row.balance)} danger />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Student Finance Lookup"
            subtitle="Load a student statement, review payments, and print documents."
          >
            <div style={lookupGrid}>
              <Field label="Search students" full>
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={fieldInput}
                  placeholder="Search by name, ID, or grade"
                />
              </Field>

              <Field label="Choose student" full>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  style={fieldInput}
                >
                  <option value="">Select a student</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} • {s.name} • Grade {s.grade}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Term">
                <select
                  value={statementTerm}
                  onChange={(e) => setStatementTerm(e.target.value)}
                  style={fieldInput}
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Actions">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={btnPrimary} onClick={() => void loadStudentFinance()} disabled={busy}>
                    Load finance
                  </button>
                  <button style={btnSecondary} onClick={openStatementPdf} disabled={busy}>
                    Statement PDF
                  </button>
                  <button style={btnSecondary} onClick={openStatementCsv} disabled={busy}>
                    Statement CSV
                  </button>
                </div>
              </Field>
            </div>

            {tuition ? (
              <div style={studentFinanceCard}>
                <div style={studentFinanceTop}>
                  <div>
                    <div style={studentFinanceTitle}>Tuition Summary</div>
                    <div style={studentFinanceMeta}>
                      Student #{tuition.student_id} • {tuition.term}
                    </div>
                  </div>

                  <span style={pill}>{tuition.status || "Partial"}</span>
                </div>

                <div style={financeStatGrid}>
                  <InfoTile label="Total Due" value={money(tuition.total_amount)} />
                  <InfoTile label="Paid" value={money(tuition.amount_paid)} />
                  <InfoTile label="Balance" value={money(tuition.balance_due ?? tuition.balance)} />
                  <InfoTile label="Plan" value={tuition.payment_plan || "—"} />
                </div>
              </div>
            ) : (
              <EmptyState text="Choose a student and term, then click Load finance." compact />
            )}
          </Panel>
        </section>

        <section style={twoCol}>
          <Panel title="Create or Update Tuition" subtitle="Save a tuition record for a student and term.">
            <div style={formGrid}>
              <Field label="Student">
                <select
                  value={tuitionForm.student_id}
                  onChange={(e) => setTuitionForm((p) => ({ ...p, student_id: e.target.value }))}
                  style={fieldInput}
                >
                  <option value="">Select student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} • {s.name} • Grade {s.grade}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Term">
                <select
                  value={tuitionForm.term}
                  onChange={(e) => setTuitionForm((p) => ({ ...p, term: e.target.value }))}
                  style={fieldInput}
                >
                  {TERM_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Total amount">
                <input
                  value={tuitionForm.total_amount}
                  onChange={(e) => setTuitionForm((p) => ({ ...p, total_amount: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. 3500"
                />
              </Field>

              <Field label="Amount paid">
                <input
                  value={tuitionForm.amount_paid}
                  onChange={(e) => setTuitionForm((p) => ({ ...p, amount_paid: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. 1000"
                />
              </Field>

              <Field label="Payment plan">
                <select
                  value={tuitionForm.payment_plan}
                  onChange={(e) => setTuitionForm((p) => ({ ...p, payment_plan: e.target.value }))}
                  style={fieldInput}
                >
                  {PAYMENT_PLANS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select
                  value={tuitionForm.status}
                  onChange={(e) => setTuitionForm((p) => ({ ...p, status: e.target.value }))}
                  style={fieldInput}
                >
                  {STATUS_OPTIONS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={actionsRow}>
              <button style={btnPrimary} onClick={() => void saveTuition()} disabled={busy}>
                {busy ? "Saving..." : "Save Tuition"}
              </button>
            </div>
          </Panel>

          <Panel title="Record Payment" subtitle="Add a payment against the currently loaded tuition record.">
            <div style={formGrid}>
              <Field label="Tuition ID">
                <input
                  value={paymentForm.tuition_id}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, tuition_id: e.target.value }))}
                  style={fieldInput}
                  placeholder="Load finance or enter tuition ID"
                />
              </Field>

              <Field label="Amount">
                <input
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. 500"
                />
              </Field>

              <Field label="Method">
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value }))}
                  style={fieldInput}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reference">
                <input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                  style={fieldInput}
                  placeholder="Reference / receipt note"
                />
              </Field>

              <Field label="Note" full>
                <textarea
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
                  style={{ ...fieldInput, minHeight: 110, resize: "vertical" }}
                  placeholder="Optional payment note"
                />
              </Field>
            </div>

            <div style={actionsRow}>
              <button style={btnPrimary} onClick={() => void addPayment()} disabled={busy}>
                {busy ? "Saving..." : "Add Payment"}
              </button>
            </div>
          </Panel>
        </section>

        <section style={{ marginTop: 20 }}>
          <Panel
            title="Payment History"
            subtitle="Review recorded payments and open printable receipts."
            right={<span style={pill}>{payments.length} payment(s)</span>}
          >
            {!payments.length ? (
              <EmptyState text="No payments loaded yet." compact />
            ) : (
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Receipt</th>
                      <th style={th}>Date</th>
                      <th style={th}>Method</th>
                      <th style={th}>Reference</th>
                      <th style={{ ...th, textAlign: "right" }}>Amount</th>
                      <th style={{ ...th, textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td style={td}>PAY-{p.id}</td>
                        <td style={td}>{p.timestamp ? formatDate(p.timestamp) : "—"}</td>
                        <td style={td}>{p.method || "—"}</td>
                        <td style={td}>{p.reference || "—"}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 900 }}>
                          {money(p.amount)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button
                            style={miniBtn}
                            onClick={() => openReceipt(p.id)}
                            type="button"
                          >
                            Open receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section style={panel}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>{title}</div>
          {subtitle ? <div style={panelSubtitle}>{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div style={panelBody}>{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return <div style={{ ...emptyState, padding: compact ? 12 : 22 }}>{text}</div>;
}

function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  accent: "blue" | "green" | "amber" | "purple" | "red";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.35)",
    green: "rgba(74,222,128,0.35)",
    amber: "rgba(251,191,36,0.35)",
    purple: "rgba(192,132,252,0.35)",
    red: "rgba(248,113,113,0.35)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
      <div style={statSub}>{subtitle}</div>
    </div>
  );
}

function InfoPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 999,
        padding: "8px 12px",
        border: `1px solid ${danger ? "rgba(248,113,113,0.28)" : "rgba(255,255,255,0.10)"}`,
        background: danger ? "rgba(248,113,113,0.10)" : "rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 900, color: "#fff" }}>{value}</div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoTile}>
      <div style={infoTileLabel}>{label}</div>
      <div style={infoTileValue}>{value}</div>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function extractErr(
  e: unknown,
  fallback: string
) {
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

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
};

const page: CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
};

const hero: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 18,
};

const eyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: "#93c5fd",
  marginBottom: 6,
};

const heroTitle: CSSProperties = {
  fontSize: 32,
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const statCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
  backdropFilter: "blur(6px)",
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

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.15fr 1fr",
  gap: 18,
  marginTop: 18,
};

const panel: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(8px)",
};

const panelHeader: CSSProperties = {
  padding: 18,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const panelBody: CSSProperties = {
  padding: 18,
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

const outstandingCard: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const outstandingName: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#fff",
};

const outstandingMeta: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#94a3b8",
};

const outstandingStats: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const lookupGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const actionsRow: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 14,
};

const studentFinanceCard: CSSProperties = {
  marginTop: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
};

const studentFinanceTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const studentFinanceTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 17,
  color: "#fff",
};

const studentFinanceMeta: CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 13,
};

const financeStatGrid: CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const infoTile: CSSProperties = {
  borderRadius: 14,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(2,6,23,0.35)",
};

const infoTileLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
};

const infoTileValue: CSSProperties = {
  marginTop: 8,
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
  fontWeight: 800,
  color: "#cbd5e1",
};

const fieldInput: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
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

const alert: CSSProperties = {
  marginTop: 14,
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
};

const emptyState: CSSProperties = {
  padding: 22,
  color: "#cbd5e1",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.03)",
};

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontWeight: 800,
  fontSize: 12,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  padding: "12px 10px",
  fontSize: 12,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.7,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const td: CSSProperties = {
  padding: "14px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: "#e5e7eb",
  fontSize: 14,
};

const miniBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};