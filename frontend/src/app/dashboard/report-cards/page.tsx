"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type StudentLite = {
  id: number;
  name: string;
  grade: number;
  guardian_name?: string | null;
};

type ScoreRow = {
  id: number;
  student_id: number;
  subject: string;
  cont_ass_score: number;
  exam_score: number;
  teacher_id: number;
  date: string;
  term: string;
  grade: number;
};

type ReportCardResponse = {
  student_id: number;
  name: string;
  grade: number;
  term: string;
  average: number;
  subjects: {
    subject: string;
    cont_ass: number;
    exam: number;
    total: number;
  }[];
};

type AlertState = {
  type: "error" | "success";
  message: string;
} | null;

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];

export default function ReportCardsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [students, setStudents] = useState<StudentLite[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);

  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedGrade, setSelectedGrade] = useState("");

  const [teacherRemark, setTeacherRemark] = useState("");
  const [principalRemark, setPrincipalRemark] = useState("");

  const [report, setReport] = useState<ReportCardResponse | null>(null);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (!selectedStudentId) return;
    const st = students.find((s) => String(s.id) === String(selectedStudentId));
    if (st && String(st.grade) !== selectedGrade) {
      setSelectedGrade(String(st.grade));
    }
  }, [selectedStudentId, students, selectedGrade]);

  async function initialize() {
    setLoading(true);
    setAlertState(null);

    try {
      const [studentsRes, scoresRes] = await Promise.all([
        api.get("/students"),
        api.get("/scores"),
      ]);

      const studentRows = Array.isArray(studentsRes.data) ? studentsRes.data : [];
      const scoreRows = Array.isArray(scoresRes.data) ? scoresRes.data : [];

      setStudents(
        studentRows.map((s: Record<string, unknown>) => ({
          id: Number(s.id),
          name: String(s.name || ""),
          grade: Number(s.grade || 0),
          guardian_name: typeof s.guardian_name === "string" ? s.guardian_name : null,
        }))
      );

      setScores(scoreRows as ScoreRow[]);
    } catch (e: unknown) {
      setAlertState({
        type: "error",
        message: extractErr(e, "Failed to load report card data."),
      });
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    if (!selectedStudentId || !selectedTerm || !selectedGrade) {
      setAlertState({
        type: "error",
        message: "Select a student, term, and grade first.",
      });
      return;
    }

    setBusy(true);
    setAlertState(null);

    try {
      const res = await api.get("/report_card", {
        params: {
          student_id: selectedStudentId,
          term: selectedTerm,
          grade: selectedGrade,
        },
      });

      setReport(res.data as ReportCardResponse);
      setAlertState({
        type: "success",
        message: "Report card loaded successfully.",
      });
    } catch (e: unknown) {
      setReport(null);
      setAlertState({
        type: "error",
        message: extractErr(e, "Failed to generate report card."),
      });
    } finally {
      setBusy(false);
    }
  }

  function openPdf() {
    if (!selectedStudentId || !selectedTerm || !selectedGrade) {
      setAlertState({
        type: "error",
        message: "Select a student, term, and grade first.",
      });
      return;
    }

    const params = new URLSearchParams({
      student_id: selectedStudentId,
      term: selectedTerm,
      grade: selectedGrade,
    });

    if (teacherRemark.trim()) {
      params.set("teacher_remark", teacherRemark.trim());
    }
    if (principalRemark.trim()) {
      params.set("principal_remark", principalRemark.trim());
    }

    window.open(`/api/report_card/pdf?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function clearSelection() {
    setSelectedStudentId("");
    setSelectedTerm("Term 1");
    setSelectedGrade("");
    setTeacherRemark("");
    setPrincipalRemark("");
    setReport(null);
    setAlertState(null);
  }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students.slice(0, 20);

    return students
      .filter((s) => `${s.name} ${s.id} ${s.grade} ${s.guardian_name || ""}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [students, studentSearch]);

  const selectedStudent = useMemo(
    () => students.find((s) => String(s.id) === String(selectedStudentId)) || null,
    [students, selectedStudentId]
  );

  const matchingScores = useMemo(() => {
    if (!selectedStudentId || !selectedTerm || !selectedGrade) return [];
    return scores.filter(
      (s) =>
        String(s.student_id) === String(selectedStudentId) &&
        s.term === selectedTerm &&
        String(s.grade) === String(selectedGrade)
    );
  }, [scores, selectedStudentId, selectedTerm, selectedGrade]);

  const subjectCount = report?.subjects?.length ?? 0;
  const topSubject = useMemo(() => {
    if (!report?.subjects?.length) return null;
    return [...report.subjects].sort((a, b) => b.total - a.total)[0];
  }, [report]);

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>School Platform</div>
            <h1 style={heroTitle}>Report Cards</h1>
            <p style={subtitle}>
              Generate polished student report cards, preview score breakdowns, add remarks,
              and export clean PDF copies for sharing and printing.
            </p>
          </div>

          <div style={heroActions}>
            <button style={btnSecondary} onClick={() => void initialize()} disabled={loading || busy}>
              Refresh
            </button>
            <button style={btnPrimary} onClick={() => void generateReport()} disabled={busy}>
              Generate Report
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
            label="Students"
            value={String(students.length)}
            subtitle="Available in the platform"
            accent="blue"
          />
          <StatCard
            label="Scores"
            value={String(scores.length)}
            subtitle="Assessment rows recorded"
            accent="green"
          />
          <StatCard
            label="Selected Term"
            value={selectedTerm}
            subtitle="Current report period"
            accent="purple"
          />
          <StatCard
            label="Subjects"
            value={String(subjectCount)}
            subtitle="Loaded in current report"
            accent="amber"
          />
          <StatCard
            label="Average"
            value={report ? String(report.average) : "--"}
            subtitle="Current student average"
            accent="red"
          />
        </section>

        <section style={twoCol}>
          <Panel
            title="Report Builder"
            subtitle="Select a student, term, and grade to generate the report card."
          >
            <div style={formGrid}>
              <Field label="Search students" full>
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={fieldInput}
                  placeholder="Search by student name, ID, grade, or guardian"
                />
              </Field>

              <Field label="Student" full>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  style={fieldInput}
                >
                  <option value="">Select a student</option>
                  {filteredStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      #{student.id} • {student.name} • Grade {student.grade}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Term">
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  style={fieldInput}
                >
                  {TERM_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Grade">
                <input
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  style={fieldInput}
                  placeholder="Grade"
                />
              </Field>

              <Field label="Teacher Remark" full>
                <textarea
                  value={teacherRemark}
                  onChange={(e) => setTeacherRemark(e.target.value)}
                  style={{ ...fieldInput, minHeight: 110, resize: "vertical" }}
                  placeholder="Optional teacher remark for the PDF"
                />
              </Field>

              <Field label="Principal Remark" full>
                <textarea
                  value={principalRemark}
                  onChange={(e) => setPrincipalRemark(e.target.value)}
                  style={{ ...fieldInput, minHeight: 110, resize: "vertical" }}
                  placeholder="Optional principal remark for the PDF"
                />
              </Field>
            </div>

            <div style={actionsRow}>
              <button style={btnSecondary} onClick={clearSelection} disabled={busy}>
                Clear
              </button>
              <button style={btnPrimary} onClick={() => void generateReport()} disabled={busy}>
                {busy ? "Generating..." : "Generate Report"}
              </button>
              <button style={btnSecondary} onClick={openPdf} disabled={busy}>
                Open PDF
              </button>
            </div>
          </Panel>

          <Panel
            title="Student Snapshot"
            subtitle="Quick view of the selected student and report context."
            right={selectedStudent ? <span style={pill}>Student selected</span> : <span style={pill}>No selection</span>}
          >
            {!selectedStudent ? (
              <EmptyState text="Choose a student to see the snapshot." />
            ) : (
              <div style={snapshotCard}>
                <div style={snapshotTop}>
                  <div>
                    <div style={snapshotName}>{selectedStudent.name}</div>
                    <div style={snapshotMeta}>
                      Student ID #{selectedStudent.id} • Grade {selectedStudent.grade}
                    </div>
                    <div style={snapshotMeta}>
                      Guardian: {selectedStudent.guardian_name || "Not available"}
                    </div>
                  </div>
                  <span style={pill}>{selectedTerm}</span>
                </div>

                <div style={infoGrid}>
                  <InfoTile label="Grade" value={String(selectedStudent.grade)} />
                  <InfoTile label="Scores Found" value={String(matchingScores.length)} />
                  <InfoTile label="Subjects in Report" value={String(subjectCount)} />
                  <InfoTile label="Average" value={report ? String(report.average) : "--"} />
                </div>

                {topSubject ? (
                  <div style={highlightCard}>
                    <div style={highlightLabel}>Top Subject</div>
                    <div style={highlightValue}>
                      {topSubject.subject} • {topSubject.total}
                    </div>
                  </div>
                ) : (
                  <div style={highlightCardMuted}>Generate a report to see subject highlights.</div>
                )}
              </div>
            )}
          </Panel>
        </section>

        <section style={twoCol}>
          <Panel
            title="Report Preview"
            subtitle="Current subject totals and calculated average."
            right={report ? <span style={pill}>{report.term}</span> : undefined}
          >
            {!report ? (
              <EmptyState text="Generate a report card to preview results here." />
            ) : !report.subjects.length ? (
              <EmptyState text="No scores found for this student, term, and grade." />
            ) : (
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Subject</th>
                      <th style={{ ...th, textAlign: "right" }}>CA</th>
                      <th style={{ ...th, textAlign: "right" }}>Exam</th>
                      <th style={{ ...th, textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.subjects.map((row) => (
                      <tr key={row.subject}>
                        <td style={tdStrong}>{row.subject}</td>
                        <td style={{ ...td, textAlign: "right" }}>{row.cont_ass}</td>
                        <td style={{ ...td, textAlign: "right" }}>{row.exam}</td>
                        <td style={{ ...tdStrong, textAlign: "right" }}>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={summaryBar}>
                  <div style={summaryPill}>
                    <span style={summaryPillLabel}>Student</span>
                    <span style={summaryPillValue}>{report.name}</span>
                  </div>
                  <div style={summaryPill}>
                    <span style={summaryPillLabel}>Grade</span>
                    <span style={summaryPillValue}>{report.grade}</span>
                  </div>
                  <div style={summaryPill}>
                    <span style={summaryPillLabel}>Average</span>
                    <span style={summaryPillValue}>{report.average}</span>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Raw Score Feed"
            subtitle="Underlying score entries found for the selected filters."
            right={<span style={pill}>{matchingScores.length} row(s)</span>}
          >
            {!selectedStudentId ? (
              <EmptyState text="Select a student to inspect score entries." />
            ) : !matchingScores.length ? (
              <EmptyState text="No matching score rows found for the current selection." />
            ) : (
              <div style={scoreFeed}>
                {matchingScores
                  .slice()
                  .sort((a, b) => {
                    const ad = new Date(a.date).getTime();
                    const bd = new Date(b.date).getTime();
                    return bd - ad;
                  })
                  .map((score) => (
                    <div key={score.id} style={scoreCard}>
                      <div>
                        <div style={scoreTitle}>{score.subject}</div>
                        <div style={scoreMeta}>
                          Date: {formatDate(score.date)} • Teacher ID #{score.teacher_id}
                        </div>
                      </div>

                      <div style={scoreBadges}>
                        <MiniStat label="CA" value={String(score.cont_ass_score)} />
                        <MiniStat label="Exam" value={String(score.exam_score)} />
                        <MiniStat
                          label="Total"
                          value={String(Number(score.cont_ass_score) + Number(score.exam_score))}
                          strong
                        />
                      </div>
                    </div>
                  ))}
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoTile}>
      <div style={infoTileLabel}>{label}</div>
      <div style={infoTileValue}>{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 12,
        padding: "10px 12px",
        border: strong ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.10)",
        background: strong ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        minWidth: 72,
      }}
    >
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 900, color: "#fff" }}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyState}>{text}</div>;
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

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
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

const alert: CSSProperties = {
  marginTop: 14,
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
};

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
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

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
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

const actionsRow: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
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

const snapshotCard: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 16,
};

const snapshotTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const snapshotName: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const snapshotMeta: CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 13,
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginTop: 14,
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

const highlightCard: CSSProperties = {
  marginTop: 14,
  borderRadius: 14,
  padding: 14,
  background: "rgba(96,165,250,0.12)",
  border: "1px solid rgba(96,165,250,0.24)",
};

const highlightCardMuted: CSSProperties = {
  marginTop: 14,
  borderRadius: 14,
  padding: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#94a3b8",
};

const highlightLabel: CSSProperties = {
  fontSize: 12,
  color: "#93c5fd",
  textTransform: "uppercase",
  fontWeight: 800,
};

const highlightValue: CSSProperties = {
  marginTop: 6,
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
};

const emptyState: CSSProperties = {
  padding: 22,
  color: "#cbd5e1",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.03)",
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

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 900,
  color: "#fff",
};

const summaryBar: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const summaryPill: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const summaryPillLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
};

const summaryPillValue: CSSProperties = {
  fontWeight: 900,
  color: "#fff",
};

const scoreFeed: CSSProperties = {
  display: "grid",
  gap: 12,
};

const scoreCard: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const scoreTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#fff",
};

const scoreMeta: CSSProperties = {
  marginTop: 6,
  color: "#94a3b8",
  fontSize: 13,
};

const scoreBadges: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};