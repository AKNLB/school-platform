"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type StudentLite = {
  id: number;
  name: string;
  grade: number;
};

type UserLite = {
  id: number;
  username: string;
  email?: string | null;
  role: string;
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

type AlertState = {
  type: "error" | "success";
  message: string;
} | null;

type ScoreForm = {
  student_id: string;
  subject: string;
  cont_ass_score: string;
  exam_score: string;
  teacher_id: string;
  date: string;
  term: string;
  grade: string;
};

const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"];

const emptyForm: ScoreForm = {
  student_id: "",
  subject: "",
  cont_ass_score: "",
  exam_score: "",
  teacher_id: "",
  date: new Date().toISOString().slice(0, 10),
  term: "Term 1",
  grade: "",
};

export default function ScoresPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(null);

  const [students, setStudents] = useState<StudentLite[]>([]);
  const [teachers, setTeachers] = useState<UserLite[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);

  const [studentFilter, setStudentFilter] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [query, setQuery] = useState("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ScoreRow | null>(null);
  const [form, setForm] = useState<ScoreForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (!form.student_id) return;
    const student = students.find((s) => String(s.id) === String(form.student_id));
    if (student && String(student.grade) !== form.grade) {
      setForm((prev) => ({ ...prev, grade: String(student.grade) }));
    }
  }, [form.student_id, students, form.grade]);

  async function initialize() {
    setLoading(true);
    setAlertState(null);

    try {
      const [studentsRes, usersRes, scoresRes] = await Promise.all([
        api.get("/students"),
        api.get("/admin/users").catch(() => ({ data: [] })),
        api.get("/scores"),
      ]);

      const studentRows = Array.isArray(studentsRes.data) ? studentsRes.data : [];
      const userRows = Array.isArray(usersRes.data) ? usersRes.data : [];
      const scoreRows = Array.isArray(scoresRes.data) ? scoresRes.data : [];

      setStudents(
        studentRows.map((s: Record<string, unknown>) => ({
          id: Number(s.id),
          name: String(s.name || ""),
          grade: Number(s.grade || 0),
        }))
      );

      setTeachers(
        userRows
          .map((u: Record<string, unknown>) => ({
            id: Number(u.id),
            username: String(u.username || ""),
            email: typeof u.email === "string" ? u.email : null,
            role: String(u.role || ""),
          }))
          .filter((u: UserLite) => u.role === "teacher" || u.role === "admin")
      );

      setScores(scoreRows as ScoreRow[]);
    } catch (e: unknown) {
      setAlertState({
        type: "error",
        message: extractErr(e, "Failed to load scores page data."),
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: ScoreRow) {
    setMode("edit");
    setEditing(row);
    setForm({
      student_id: String(row.student_id),
      subject: row.subject,
      cont_ass_score: String(row.cont_ass_score),
      exam_score: String(row.exam_score),
      teacher_id: String(row.teacher_id),
      date: row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      term: row.term,
      grade: String(row.grade),
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  function validateForm(data: ScoreForm): string | null {
    if (!data.student_id) return "Student is required.";
    if (!data.subject.trim()) return "Subject is required.";
    if (!data.cont_ass_score.trim()) return "CA score is required.";
    if (!data.exam_score.trim()) return "Exam score is required.";
    if (!data.teacher_id) return "Teacher is required.";
    if (!data.term) return "Term is required.";
    if (!data.grade) return "Grade is required.";

    const ca = Number(data.cont_ass_score);
    const exam = Number(data.exam_score);

    if (Number.isNaN(ca) || ca < 0 || ca > 40) {
      return "CA score must be between 0 and 40.";
    }
    if (Number.isNaN(exam) || exam < 0 || exam > 100) {
      return "Exam score must be between 0 and 100.";
    }

    return null;
  }

  async function submit() {
    setFormError(null);
    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    const payload = {
      student_id: Number(form.student_id),
      subject: form.subject.trim(),
      cont_ass_score: Number(form.cont_ass_score),
      exam_score: Number(form.exam_score),
      teacher_id: Number(form.teacher_id),
      date: form.date,
      term: form.term,
      grade: Number(form.grade),
    };

    setBusy(true);
    try {
      if (mode === "create") {
        const res = await api.post("/scores", payload);
        const created = isScore(res?.data) ? (res.data as ScoreRow) : null;

        if (created) {
          setScores((prev) => [created, ...prev]);
          setAlertState({ type: "success", message: "Score added successfully." });
        } else {
          await initialize();
          setAlertState({ type: "success", message: "Score added successfully." });
        }
      } else {
        if (!editing?.id) throw new Error("No score selected.");

        const res = await api.put(`/scores/${editing.id}`, payload);
        const updated = isScore(res?.data) ? (res.data as ScoreRow) : null;

        if (updated) {
          setScores((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          setAlertState({ type: "success", message: "Score updated successfully." });
        } else {
          await initialize();
          setAlertState({ type: "success", message: "Score updated successfully." });
        }
      }

      setOpen(false);
    } catch (e: unknown) {
      setFormError(extractErr(e, "Failed to save score."));
    } finally {
      setBusy(false);
    }
  }

  async function removeScore(row: ScoreRow) {
    const ok = window.confirm(`Delete ${row.subject} score for this student?`);
    if (!ok) return;

    const previous = scores;
    setBusy(true);
    setScores((prev) => prev.filter((s) => s.id !== row.id));

    try {
      await api.delete(`/scores/${row.id}`);
      setAlertState({ type: "success", message: "Score deleted successfully." });
    } catch (e: unknown) {
      setScores(previous);
      setAlertState({
        type: "error",
        message: extractErr(e, "Failed to delete score."),
      });
    } finally {
      setBusy(false);
    }
  }

  const studentMap = useMemo(() => {
    const map = new Map<number, StudentLite>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const teacherMap = useMemo(() => {
    const map = new Map<number, UserLite>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  const filteredScores = useMemo(() => {
    return scores.filter((row) => {
      if (studentFilter && String(row.student_id) !== studentFilter) return false;
      if (termFilter && row.term !== termFilter) return false;
      if (gradeFilter && String(row.grade) !== gradeFilter) return false;
      if (subjectFilter && row.subject.toLowerCase() !== subjectFilter.toLowerCase()) return false;

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const student = studentMap.get(row.student_id);
        const teacher = teacherMap.get(row.teacher_id);

        const haystack = [
          row.subject,
          row.term,
          String(row.grade),
          student?.name || "",
          teacher?.username || "",
          teacher?.email || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [scores, studentFilter, termFilter, gradeFilter, subjectFilter, query, studentMap, teacherMap]);

  const stats = useMemo(() => {
    const total = scores.length;
    const filtered = filteredScores.length;

    const average =
      filteredScores.length > 0
        ? (
            filteredScores.reduce(
              (sum, row) => sum + Number(row.cont_ass_score || 0) + Number(row.exam_score || 0),
              0
            ) / filteredScores.length
          ).toFixed(1)
        : "--";

    const topSubject = (() => {
      if (!filteredScores.length) return "--";

      const grouped = new Map<string, number[]>();
      filteredScores.forEach((row) => {
        const totalScore = Number(row.cont_ass_score || 0) + Number(row.exam_score || 0);
        const arr = grouped.get(row.subject) || [];
        arr.push(totalScore);
        grouped.set(row.subject, arr);
      });

      let best = { subject: "--", avg: -1 };
      grouped.forEach((values, subject) => {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        if (avg > best.avg) best = { subject, avg };
      });

      return best.subject;
    })();

    return { total, filtered, average, topSubject };
  }, [scores, filteredScores]);

  const uniqueSubjects = useMemo(() => {
    return Array.from(new Set(scores.map((s) => s.subject))).sort((a, b) => a.localeCompare(b));
  }, [scores]);

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>School Platform</div>
            <h1 style={heroTitle}>Scores</h1>
            <p style={subtitle}>
              Manage continuous assessment, exam marks, term performance, and the score
              records that drive report cards across your platform.
            </p>
          </div>

          <div style={heroActions}>
            <button style={btnSecondary} onClick={() => void initialize()} disabled={loading || busy}>
              Refresh
            </button>
            <button style={btnPrimary} onClick={openCreate} disabled={busy}>
              + New Score
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
          <StatCard label="All Scores" value={String(stats.total)} subtitle="Total records stored" accent="blue" />
          <StatCard label="Filtered" value={String(stats.filtered)} subtitle="Visible after filters" accent="green" />
          <StatCard label="Average Total" value={String(stats.average)} subtitle="CA + Exam average" accent="purple" />
          <StatCard label="Top Subject" value={String(stats.topSubject)} subtitle="Best average subject" accent="amber" />
        </section>

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Filters</div>
              <div style={panelSubtitle}>Narrow score records by student, term, grade, or subject.</div>
            </div>
          </div>

          <div style={panelBody}>
            <div style={filterGrid}>
              <Field label="Search">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={fieldInput}
                  placeholder="Search subject, student, teacher..."
                />
              </Field>

              <Field label="Student">
                <select
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  style={fieldInput}
                >
                  <option value="">All students</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      #{student.id} • {student.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Term">
                <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} style={fieldInput}>
                  <option value="">All terms</option>
                  {TERM_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Grade">
                <input
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  style={fieldInput}
                  placeholder="All grades"
                />
              </Field>

              <Field label="Subject">
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  style={fieldInput}
                >
                  <option value="">All subjects</option>
                  {uniqueSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Actions">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    style={btnSecondary}
                    onClick={() => {
                      setQuery("");
                      setStudentFilter("");
                      setTermFilter("");
                      setGradeFilter("");
                      setSubjectFilter("");
                    }}
                  >
                    Clear filters
                  </button>
                  <button style={btnPrimary} onClick={openCreate}>
                    Add score
                  </button>
                </div>
              </Field>
            </div>
          </div>
        </section>

        <section style={{ ...panel, marginTop: 18 }}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Score Register</div>
              <div style={panelSubtitle}>
                {loading ? "Loading..." : `${filteredScores.length} score row(s) shown`}
              </div>
            </div>
          </div>

          <div style={panelBody}>
            {loading ? (
              <EmptyState text="Loading score records..." />
            ) : filteredScores.length === 0 ? (
              <EmptyState text="No score records found for the current filters." />
            ) : (
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Student</th>
                      <th style={th}>Subject</th>
                      <th style={{ ...th, textAlign: "right" }}>CA</th>
                      <th style={{ ...th, textAlign: "right" }}>Exam</th>
                      <th style={{ ...th, textAlign: "right" }}>Total</th>
                      <th style={th}>Term</th>
                      <th style={th}>Grade</th>
                      <th style={th}>Teacher</th>
                      <th style={th}>Date</th>
                      <th style={{ ...th, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScores.map((row) => {
                      const student = studentMap.get(row.student_id);
                      const teacher = teacherMap.get(row.teacher_id);
                      const total = Number(row.cont_ass_score || 0) + Number(row.exam_score || 0);

                      return (
                        <tr key={row.id}>
                          <td style={tdStrong}>
                            <div>{student?.name || `Student #${row.student_id}`}</div>
                            <div style={subCell}>#{row.student_id}</div>
                          </td>
                          <td style={td}>{row.subject}</td>
                          <td style={{ ...td, textAlign: "right" }}>{row.cont_ass_score}</td>
                          <td style={{ ...td, textAlign: "right" }}>{row.exam_score}</td>
                          <td style={{ ...tdStrong, textAlign: "right" }}>{total}</td>
                          <td style={td}>{row.term}</td>
                          <td style={td}>{row.grade}</td>
                          <td style={td}>
                            <div>{teacher?.username || `#${row.teacher_id}`}</div>
                            <div style={subCell}>{teacher?.email || ""}</div>
                          </td>
                          <td style={td}>{formatDate(row.date)}</td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <div style={rowActions}>
                              <button style={btnSecondarySmall} onClick={() => openEdit(row)} disabled={busy}>
                                Edit
                              </button>
                              <button style={btnDangerSmall} onClick={() => void removeScore(row)} disabled={busy}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {open && (
          <Modal title={mode === "create" ? "Add Score" : "Edit Score"} onClose={closeModal}>
            {formError && (
              <div style={{ ...alert, marginTop: 0, marginBottom: 14, borderColor: "rgba(248,113,113,0.35)" }}>
                {formError}
              </div>
            )}

            <div style={formGrid}>
              <Field label="Student" full>
                <select
                  value={form.student_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, student_id: e.target.value }))}
                  style={fieldInput}
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      #{student.id} • {student.name} • Grade {student.grade}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Subject">
                <input
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. Mathematics"
                />
              </Field>

              <Field label="Term">
                <select
                  value={form.term}
                  onChange={(e) => setForm((prev) => ({ ...prev, term: e.target.value }))}
                  style={fieldInput}
                >
                  {TERM_OPTIONS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="CA Score">
                <input
                  value={form.cont_ass_score}
                  onChange={(e) => setForm((prev) => ({ ...prev, cont_ass_score: e.target.value }))}
                  style={fieldInput}
                  type="number"
                  min={0}
                  max={40}
                  placeholder="0 - 40"
                />
              </Field>

              <Field label="Exam Score">
                <input
                  value={form.exam_score}
                  onChange={(e) => setForm((prev) => ({ ...prev, exam_score: e.target.value }))}
                  style={fieldInput}
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0 - 100"
                />
              </Field>

              <Field label="Teacher">
                <select
                  value={form.teacher_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, teacher_id: e.target.value }))}
                  style={fieldInput}
                >
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.username} {teacher.role === "admin" ? "(Admin)" : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Grade">
                <input
                  value={form.grade}
                  onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                  style={fieldInput}
                  placeholder="Grade"
                />
              </Field>

              <Field label="Date" full>
                <input
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                  style={fieldInput}
                  type="date"
                />
              </Field>
            </div>

            <div style={modalActions}>
              <button style={btnSecondary} onClick={closeModal} disabled={busy}>
                Cancel
              </button>
              <button style={btnPrimary} onClick={() => void submit()} disabled={busy}>
                {busy ? "Saving..." : mode === "create" ? "Save Score" : "Update Score"}
              </button>
            </div>
          </Modal>
        )}
      </div>
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
  accent: "blue" | "green" | "amber" | "purple";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.35)",
    green: "rgba(74,222,128,0.35)",
    amber: "rgba(251,191,36,0.35)",
    purple: "rgba(192,132,252,0.35)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
      <div style={statSub}>{subtitle}</div>
    </div>
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
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.72)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(900px, 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#0f172a",
          boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, color: "#f8fafc" }}>{title}</div>
          <button onClick={onClose} style={iconBtn}>
            ✕
          </button>
        </div>

        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyState}>{text}</div>;
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

function isScore(value: unknown): value is ScoreRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && typeof row.subject === "string";
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

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
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

const alert: CSSProperties = {
  marginTop: 14,
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
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
  verticalAlign: "top",
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 900,
  color: "#fff",
};

const subCell: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 500,
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  flexWrap: "wrap",
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

const btnSecondarySmall: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnDangerSmall: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 800,
  cursor: "pointer",
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

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 14,
};

const emptyState: CSSProperties = {
  padding: 22,
  color: "#cbd5e1",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.03)",
};