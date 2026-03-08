"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fetchMe } from "@/lib/auth";

type TermOption = "Term 1" | "Term 2" | "Term 3";

type AudienceRole = "admin" | "teacher" | "parent" | "student";

type StudentRow = {
  id: number;
  name: string;
  grade: number;
  guardian_name?: string | null;
};

type TeacherRow = {
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

type ScoreForm = {
  student_id: string;
  subject: string;
  custom_subject: string;
  cont_ass_score: string;
  exam_score: string;
  teacher_id: string;
  date: string;
  term: string;
  grade: string;
};

type AlertState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

const TERM_OPTIONS: TermOption[] = ["Term 1", "Term 2", "Term 3"];

const SUBJECTS = [
  "ENGLISH LANGUAGE",
  "MATHS",
  "INTEGRATED STUDIES",
  "VERBAL",
  "QUANTITATIVE",
  "FRENCH",
  "CREATIVE WRITING",
  "I.R.K",
  "ARTS AND CRAFTS",
  "READING",
  "SPELLING AND DICTATION",
];

const CUSTOM_SUBJECT_VALUE = "__custom__";

const emptyForm: ScoreForm = {
  student_id: "",
  subject: "",
  custom_subject: "",
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

  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);

  const [search, setSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [termFilter, setTermFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ScoreRow | null>(null);
  const [form, setForm] = useState<ScoreForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const [alertState, setAlertState] = useState<AlertState>(null);
  const [currentUser, setCurrentUser] = useState<{ id?: number; email?: string; role?: AudienceRole } | null>(null);

  async function initialize() {
    setLoading(true);

    try {
      const [meRes, studentsRes, scoresRes, usersRes] = await Promise.allSettled([
        fetchMe(),
        api.get("/students"),
        api.get("/scores"),
        api.get("/admin/users"),
      ]);

      if (meRes.status === "fulfilled") {
        const me = meRes.value;
        setCurrentUser(me ? { id: Number((me as { id?: number }).id), email: me.email, role: me.role as AudienceRole } : null);
      }

      if (studentsRes.status === "fulfilled") {
        const data = Array.isArray(studentsRes.value.data) ? studentsRes.value.data : [];
        setStudents(
          data.map((item) => ({
            id: Number(item.id),
            name: String(item.name ?? ""),
            grade: Number(item.grade ?? 0),
            guardian_name: item.guardian_name ?? null,
          }))
        );
      } else {
        setStudents([]);
      }

      if (scoresRes.status === "fulfilled") {
        const data = Array.isArray(scoresRes.value.data) ? scoresRes.value.data : [];
        setScores(
          data.map((item) => ({
            id: Number(item.id),
            student_id: Number(item.student_id),
            subject: String(item.subject ?? ""),
            cont_ass_score: Number(item.cont_ass_score ?? 0),
            exam_score: Number(item.exam_score ?? 0),
            teacher_id: Number(item.teacher_id ?? 0),
            date: String(item.date ?? ""),
            term: String(item.term ?? ""),
            grade: Number(item.grade ?? 0),
          }))
        );
      } else {
        setScores([]);
      }

      if (usersRes.status === "fulfilled") {
        const data = Array.isArray(usersRes.value.data) ? usersRes.value.data : [];
        const teacherUsers = data.filter((u) => String(u.role).toLowerCase() === "teacher" || String(u.role).toLowerCase() === "admin");
        setTeachers(
          teacherUsers.map((u) => ({
            id: Number(u.id),
            username: String(u.username ?? ""),
            email: u.email ? String(u.email) : null,
            role: String(u.role ?? ""),
          }))
        );
      } else {
        setTeachers([]);
      }
    } catch {
      setAlertState({ type: "error", message: "Failed to load scores page data." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void initialize();
  }, []);

  const studentMap = useMemo(() => {
    const map = new Map<number, StudentRow>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const teacherMap = useMemo(() => {
    const map = new Map<number, TeacherRow>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  const normalizedSubjects = useMemo(() => {
    const set = new Set<string>(SUBJECTS);
    scores.forEach((score) => {
      const subject = String(score.subject || "").trim().toUpperCase();
      if (subject) set.add(subject);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scores]);

  const filteredScores = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return scores.filter((row) => {
      const student = studentMap.get(row.student_id);
      const teacher = teacherMap.get(row.teacher_id);

      const matchesSearch =
        !needle ||
        row.subject.toLowerCase().includes(needle) ||
        String(row.term).toLowerCase().includes(needle) ||
        String(row.grade).includes(needle) ||
        String(student?.name || "").toLowerCase().includes(needle) ||
        String(teacher?.username || teacher?.email || "").toLowerCase().includes(needle);

      const matchesStudent = !studentFilter || String(row.student_id) === studentFilter;
      const matchesGrade = !gradeFilter || String(row.grade) === gradeFilter;
      const matchesTerm = !termFilter || row.term === termFilter;
      const matchesSubject = !subjectFilter || row.subject.toUpperCase() === subjectFilter.toUpperCase();
      const matchesTeacher = !teacherFilter || String(row.teacher_id) === teacherFilter;

      return matchesSearch && matchesStudent && matchesGrade && matchesTerm && matchesSubject && matchesTeacher;
    });
  }, [scores, search, studentFilter, gradeFilter, termFilter, subjectFilter, teacherFilter, studentMap, teacherMap]);

  const stats = useMemo(() => {
    const totalRows = filteredScores.length;
    const totalMarks = filteredScores.reduce((sum, row) => sum + row.cont_ass_score + row.exam_score, 0);
    const average = totalRows ? (totalMarks / totalRows).toFixed(1) : "0.0";
    const highest = totalRows
      ? Math.max(...filteredScores.map((row) => row.cont_ass_score + row.exam_score))
      : 0;
    const passing = filteredScores.filter((row) => row.cont_ass_score + row.exam_score >= 50).length;

    return { totalRows, totalMarks, average, highest, passing };
  }, [filteredScores]);

  function resetForm() {
    setForm({
      ...emptyForm,
      teacher_id:
        currentUser?.id && teachers.some((t) => t.id === currentUser.id)
          ? String(currentUser.id)
          : teachers[0]
            ? String(teachers[0].id)
            : "",
    });
  }

  function openCreate() {
    setMode("create");
    setEditing(null);
    resetForm();
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: ScoreRow) {
    const subjectUpper = String(row.subject || "").trim().toUpperCase();
    const isPreset = SUBJECTS.includes(subjectUpper);

    setMode("edit");
    setEditing(row);
    setForm({
      student_id: String(row.student_id),
      subject: isPreset ? subjectUpper : CUSTOM_SUBJECT_VALUE,
      custom_subject: isPreset ? "" : subjectUpper,
      cont_ass_score: String(row.cont_ass_score),
      exam_score: String(row.exam_score),
      teacher_id: String(row.teacher_id),
      date: row.date ? row.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      term: row.term || "Term 1",
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

    const resolvedSubject =
      data.subject === CUSTOM_SUBJECT_VALUE
        ? (data.custom_subject || "").trim()
        : data.subject.trim();

    if (!resolvedSubject) return "Subject is required.";
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

    if (Number.isNaN(exam) || exam < 0 || exam > 60) {
      return "Exam score must be between 0 and 60.";
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

    const resolvedSubject =
      form.subject === CUSTOM_SUBJECT_VALUE
        ? (form.custom_subject || "").trim().toUpperCase()
        : form.subject.trim().toUpperCase();

    const payload = {
      student_id: Number(form.student_id),
      subject: resolvedSubject,
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
        } else {
          await initialize();
        }

        setAlertState({ type: "success", message: "Score added successfully." });
      } else {
        if (!editing?.id) throw new Error("No score selected.");

        const res = await api.put(`/scores/${editing.id}`, payload);
        const updated = isScore(res?.data) ? (res.data as ScoreRow) : null;

        if (updated) {
          setScores((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        } else {
          await initialize();
        }

        setAlertState({ type: "success", message: "Score updated successfully." });
      }

      setOpen(false);
    } catch (e: unknown) {
      setFormError(extractErr(e, "Failed to save score."));
    } finally {
      setBusy(false);
    }
  }

  async function removeScore(row: ScoreRow) {
    const ok = window.confirm(`Delete score for "${row.subject}"?`);
    if (!ok) return;

    setBusy(true);

    const previous = scores;
    setScores((prev) => prev.filter((item) => item.id !== row.id));

    try {
      await api.delete(`/scores/${row.id}`);
      setAlertState({ type: "success", message: "Score deleted successfully." });
    } catch (e: unknown) {
      setScores(previous);
      setAlertState({ type: "error", message: extractErr(e, "Failed to delete score.") });
    } finally {
      setBusy(false);
    }
  }

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    students.forEach((s) => {
      if (Number.isFinite(s.grade)) set.add(s.grade);
    });
    scores.forEach((s) => {
      if (Number.isFinite(s.grade)) set.add(s.grade);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [students, scores]);

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>Academic Management</div>
            <h1 style={heroTitle}>Scores</h1>
            <p style={heroText}>
              Manage continuous assessment, exams, subject performance, and result records from one place.
            </p>
          </div>

          <div style={heroActions}>
            <button style={btnSecondary} onClick={() => void initialize()} disabled={busy || loading}>
              Refresh
            </button>
            <button style={btnPrimary} onClick={openCreate} disabled={busy}>
              + Add Score
            </button>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Visible Records" value={String(stats.totalRows)} />
          <StatCard label="Average Score" value={stats.average} />
          <StatCard label="Highest Total" value={String(stats.highest)} />
          <StatCard label="Pass Count" value={String(stats.passing)} />
        </section>

        <section style={toolbar}>
          <div style={toolbarRow}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, student, teacher, term..."
              style={searchInput}
            />

            <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} style={selectInput}>
              <option value="">All students</option>
              {students
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
            </select>

            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={selectInput}>
              <option value="">All grades</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>

            <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} style={selectInput}>
              <option value="">All terms</option>
              {TERM_OPTIONS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>

            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} style={selectInput}>
              <option value="">All subjects</option>
              {normalizedSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>

            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} style={selectInput}>
              <option value="">All teachers</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.username}
                </option>
              ))}
            </select>
          </div>
        </section>

        {alertState && (
          <div
            style={{
              ...alert,
              borderColor:
                alertState.type === "success"
                  ? "rgba(34,197,94,0.35)"
                  : alertState.type === "error"
                    ? "rgba(248,113,113,0.35)"
                    : "rgba(255,255,255,0.14)",
              background:
                alertState.type === "success"
                  ? "rgba(34,197,94,0.12)"
                  : alertState.type === "error"
                    ? "rgba(248,113,113,0.12)"
                    : "rgba(255,255,255,0.06)",
            }}
          >
            {alertState.message}
          </div>
        )}

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Score Records</div>
              <div style={panelSubtitle}>
                {loading ? "Loading records..." : `${filteredScores.length} record(s) found`}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>Loading scores...</div>
          ) : filteredScores.length === 0 ? (
            <div style={emptyState}>No score records found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Student</th>
                    <th style={th}>Grade</th>
                    <th style={th}>Subject</th>
                    <th style={thCenter}>CA</th>
                    <th style={thCenter}>Exam</th>
                    <th style={thCenter}>Total</th>
                    <th style={th}>Term</th>
                    <th style={th}>Teacher</th>
                    <th style={th}>Date</th>
                    <th style={thRight}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScores
                    .slice()
                    .sort((a, b) => {
                      const studentCompare = String(studentMap.get(a.student_id)?.name || "").localeCompare(
                        String(studentMap.get(b.student_id)?.name || "")
                      );
                      if (studentCompare !== 0) return studentCompare;
                      return a.subject.localeCompare(b.subject);
                    })
                    .map((row) => {
                      const student = studentMap.get(row.student_id);
                      const teacher = teacherMap.get(row.teacher_id);
                      const total = Number(row.cont_ass_score || 0) + Number(row.exam_score || 0);

                      return (
                        <tr key={row.id} style={tr}>
                          <td style={td}>
                            <div style={{ fontWeight: 800 }}>{student?.name || `Student #${row.student_id}`}</div>
                            <div style={tdSub}>{student?.guardian_name || "—"}</div>
                          </td>
                          <td style={td}>Grade {row.grade}</td>
                          <td style={td}>{row.subject}</td>
                          <td style={tdCenter}>{row.cont_ass_score}</td>
                          <td style={tdCenter}>{row.exam_score}</td>
                          <td style={tdCenter}>
                            <span style={totalBadge(total)}>{total}</span>
                          </td>
                          <td style={td}>{row.term}</td>
                          <td style={td}>{teacher?.username || teacher?.email || `#${row.teacher_id}`}</td>
                          <td style={td}>{formatDate(row.date)}</td>
                          <td style={tdRight}>
                            <div style={actionWrap}>
                              <button style={miniButton} onClick={() => openEdit(row)} disabled={busy}>
                                Edit
                              </button>
                              <button style={miniDanger} onClick={() => void removeScore(row)} disabled={busy}>
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
        </section>

        {open && (
          <Modal title={mode === "create" ? "Add Score" : "Edit Score"} onClose={closeModal}>
            {formError && <div style={{ ...alert, marginTop: 0 }}>{formError}</div>}

            <div style={formGrid}>
              <Field label="Student">
                <select
                  value={form.student_id}
                  onChange={(e) => {
                    const nextStudentId = e.target.value;
                    const selectedStudent = students.find((s) => String(s.id) === nextStudentId);

                    setForm((prev) => ({
                      ...prev,
                      student_id: nextStudentId,
                      grade: selectedStudent ? String(selectedStudent.grade) : prev.grade,
                    }));
                  }}
                  style={fieldInput}
                >
                  <option value="">Select student</option>
                  {students
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} — Grade {student.grade}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Grade">
                <input
                  value={form.grade}
                  onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                  style={fieldInput}
                  placeholder="e.g. 5"
                  type="number"
                />
              </Field>

              <Field label="Subject">
                <select
                  value={form.subject}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      subject: e.target.value,
                      custom_subject: e.target.value === CUSTOM_SUBJECT_VALUE ? prev.custom_subject || "" : "",
                    }))
                  }
                  style={fieldInput}
                >
                  <option value="">Select subject</option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                  <option value={CUSTOM_SUBJECT_VALUE}>Other / Custom subject</option>
                </select>
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
                      {teacher.username} {teacher.role ? `(${teacher.role})` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {form.subject === CUSTOM_SUBJECT_VALUE && (
                <Field label="Custom Subject" full>
                  <input
                    value={form.custom_subject || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        custom_subject: e.target.value,
                      }))
                    }
                    style={fieldInput}
                    placeholder="Enter custom subject"
                  />
                </Field>
              )}

              <Field label="Continuous Assessment (0–40)">
                <input
                  value={form.cont_ass_score}
                  onChange={(e) => setForm((prev) => ({ ...prev, cont_ass_score: e.target.value }))}
                  style={fieldInput}
                  placeholder="0 - 40"
                  type="number"
                  min={0}
                  max={40}
                />
              </Field>

              <Field label="Exam (0–60)">
                <input
                  value={form.exam_score}
                  onChange={(e) => setForm((prev) => ({ ...prev, exam_score: e.target.value }))}
                  style={fieldInput}
                  placeholder="0 - 60"
                  type="number"
                  min={0}
                  max={60}
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

              <Field label="Date">
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
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
        zIndex: 60,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#0f172a",
          boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
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
          <div style={{ fontWeight: 900, fontSize: 18, color: "#f8fafc" }}>{title}</div>
          <button onClick={onClose} style={iconBtn}>
            ✕
          </button>
        </div>

        <div style={{ padding: 18 }}>{children}</div>
      </div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 800, color: "#cbd5e1" }}>{label}</div>
      {children}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  } catch {
    return value;
  }
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
  const v = value as Record<string, unknown>;
  return typeof v.id === "number" && typeof v.subject === "string";
}

function totalBadge(total: number): CSSProperties {
  const good = total >= 70;
  const pass = total >= 50 && total < 70;
  const weak = total < 50;

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    background: good
      ? "rgba(34,197,94,0.16)"
      : pass
        ? "rgba(245,158,11,0.16)"
        : "rgba(248,113,113,0.16)",
    color: good ? "#bbf7d0" : pass ? "#fde68a" : "#fecaca",
    border: weak
      ? "1px solid rgba(248,113,113,0.30)"
      : pass
        ? "1px solid rgba(245,158,11,0.30)"
        : "1px solid rgba(34,197,94,0.30)",
  };
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
  margin: 0,
  fontSize: 32,
  fontWeight: 950,
};

const heroText: CSSProperties = {
  marginTop: 8,
  maxWidth: 760,
  color: "#cbd5e1",
  lineHeight: 1.55,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const statCard: CSSProperties = {
  borderRadius: 16,
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
  marginTop: 8,
  fontSize: 28,
  fontWeight: 950,
  color: "#ffffff",
};

const toolbar: CSSProperties = {
  marginBottom: 16,
};

const toolbarRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1.5fr) repeat(5, minmax(150px, 1fr))",
  gap: 12,
};

const panel: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(8px)",
};

const panelHeader: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
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

const emptyState: CSSProperties = {
  padding: 20,
  color: "#cbd5e1",
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
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  whiteSpace: "nowrap",
};

const thCenter: CSSProperties = {
  ...th,
  textAlign: "center",
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
  verticalAlign: "middle",
};

const tdCenter: CSSProperties = {
  ...td,
  textAlign: "center",
};

const tdRight: CSSProperties = {
  ...td,
  textAlign: "right",
};

const tdSub: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const actionWrap: CSSProperties = {
  display: "inline-flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};

const searchInput: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};

const selectInput: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};

const fieldInput: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
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

const miniButton: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 700,
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

const alert: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
};

const miniDanger: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,80,80,0.35)",
  background: "rgba(255,80,80,0.12)",
  color: "#ffd6d6",
  fontWeight: 800,
  cursor: "pointer",
};