"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

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

type Student = {
  id: number;
  name: string;
  grade: number;
  guardian_name?: string | null;
  guardian_contact?: string | null;
};

type Teacher = {
  id: number;
  username?: string;
  email?: string | null;
  role?: string;
};

type ScoreForm = {
  student_id: string;
  subject: string;
  cont_ass_score: string;
  exam_score: string;
  teacher_id: string;
  term: string;
  grade: string;
  date: string;
};

type ViewMode = "all" | "top" | "needs-work";

const TERMS = ["Term 1", "Term 2", "Term 3"];

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

const emptyForm: ScoreForm = {
  student_id: "",
  subject: "",
  cont_ass_score: "",
  exam_score: "",
  teacher_id: "",
  term: "Term 1",
  grade: "",
  date: todayISO(),
};

export default function ScoresPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [query, setQuery] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<ScoreRow | null>(null);
  const [form, setForm] = useState<ScoreForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    setSuccess(null);

    try {
      const [scoresRes, studentsRes, usersRes] = await Promise.allSettled([
        api.get("/scores"),
        api.get("/students"),
        api.get("/admin/users"),
      ]);

      const loadedScores =
        scoresRes.status === "fulfilled" && Array.isArray(scoresRes.value.data)
          ? (scoresRes.value.data as ScoreRow[])
          : [];

      const loadedStudents =
        studentsRes.status === "fulfilled" && Array.isArray(studentsRes.value.data)
          ? (studentsRes.value.data as Student[])
          : [];

      const loadedUsers =
        usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data)
          ? (usersRes.value.data as Teacher[])
          : [];

      setScores(loadedScores);
      setStudents(loadedStudents);
      setTeachers(
        loadedUsers.filter((u) => {
          const role = (u.role || "").toLowerCase();
          return role === "teacher" || role === "admin";
        })
      );

      if (scoresRes.status === "rejected" && studentsRes.status === "rejected") {
        throw new Error("Failed to load scores and students.");
      }
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load scores."));
      setScores([]);
      setStudents([]);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const studentMap = useMemo(() => {
    const map = new Map<number, Student>();
    students.forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [students]);

  const teacherMap = useMemo(() => {
    const map = new Map<number, Teacher>();
    teachers.forEach((t) => map.set(Number(t.id), t));
    return map;
  }, [teachers]);

  const gradeOptions = useMemo(() => {
    const grades = Array.from(
      new Set(students.map((s) => Number(s.grade)).filter((g) => !Number.isNaN(g)))
    );
    grades.sort((a, b) => a - b);
    return grades;
  }, [students]);

  const subjectOptions = useMemo(() => {
    const merged = Array.from(
      new Set([...SUBJECTS, ...scores.map((s) => s.subject).filter(Boolean)])
    ).sort((a, b) => a.localeCompare(b));
    return merged;
  }, [scores]);

  const filteredScores = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return scores.filter((row) => {
      const student = studentMap.get(Number(row.student_id));
      const teacher = teacherMap.get(Number(row.teacher_id));
      const total = totalScoreFor(row);

      const matchesQuery =
        !needle ||
        row.subject.toLowerCase().includes(needle) ||
        String(row.term || "").toLowerCase().includes(needle) ||
        String(student?.name || "").toLowerCase().includes(needle) ||
        String(student?.guardian_name || "").toLowerCase().includes(needle) ||
        String(teacher?.username || teacher?.email || "").toLowerCase().includes(needle);

      const matchesTerm = !termFilter || row.term === termFilter;
      const matchesGrade = !gradeFilter || Number(row.grade) === Number(gradeFilter);
      const matchesStudent = !studentFilter || Number(row.student_id) === Number(studentFilter);
      const matchesSubject = !subjectFilter || row.subject === subjectFilter;
      const matchesView =
        viewMode === "all" ||
        (viewMode === "top" && total >= 70) ||
        (viewMode === "needs-work" && total < 50);

      return (
        matchesQuery &&
        matchesTerm &&
        matchesGrade &&
        matchesStudent &&
        matchesSubject &&
        matchesView
      );
    });
  }, [
    scores,
    query,
    termFilter,
    gradeFilter,
    studentFilter,
    subjectFilter,
    viewMode,
    studentMap,
    teacherMap,
  ]);

  const stats = useMemo(() => {
    const totalRows = filteredScores.length;
    const totalScore = filteredScores.reduce(
      (sum, row) => sum + Number(row.cont_ass_score || 0) + Number(row.exam_score || 0),
      0
    );
    const avg = totalRows ? round1(totalScore / totalRows) : 0;
    const pass = filteredScores.filter((row) => totalScoreFor(row) >= 50).length;
    const fail = totalRows - pass;
    const excellent = filteredScores.filter((row) => totalScoreFor(row) >= 90).length;
    const top = filteredScores.filter((row) => totalScoreFor(row) >= 70).length;

    return {
      totalRows,
      avg,
      pass,
      fail,
      excellent,
      top,
    };
  }, [filteredScores]);

  const topSubjects = useMemo(() => {
    const grouped = new Map<string, { total: number; count: number }>();

    for (const row of filteredScores) {
      const current = grouped.get(row.subject) || { total: 0, count: 0 };
      current.total += totalScoreFor(row);
      current.count += 1;
      grouped.set(row.subject, current);
    }

    return Array.from(grouped.entries())
      .map(([subject, data]) => ({
        subject,
        average: data.count ? round1(data.total / data.count) : 0,
        count: data.count,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 5);
  }, [filteredScores]);

  const topStudents = useMemo(() => {
    const grouped = new Map<number, { total: number; count: number }>();

    for (const row of filteredScores) {
      const current = grouped.get(row.student_id) || { total: 0, count: 0 };
      current.total += totalScoreFor(row);
      current.count += 1;
      grouped.set(row.student_id, current);
    }

    return Array.from(grouped.entries())
      .map(([studentId, data]) => ({
        studentId,
        name: studentMap.get(studentId)?.name || `Student #${studentId}`,
        average: data.count ? round1(data.total / data.count) : 0,
        count: data.count,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 5);
  }, [filteredScores, studentMap]);

  const gradeDistribution = useMemo(() => {
    const buckets = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
    };

    for (const row of filteredScores) {
      const letter = gradeLetter(totalScoreFor(row));
      buckets[letter as keyof typeof buckets] += 1;
    }

    return Object.entries(buckets).map(([letter, count]) => ({ letter, count }));
  }, [filteredScores]);

  const quickSummary = useMemo(() => {
    const caTotal = filteredScores.reduce((sum, row) => sum + Number(row.cont_ass_score || 0), 0);
    const examTotal = filteredScores.reduce((sum, row) => sum + Number(row.exam_score || 0), 0);
    return {
      avgCa: filteredScores.length ? round1(caTotal / filteredScores.length) : 0,
      avgExam: filteredScores.length ? round1(examTotal / filteredScores.length) : 0,
    };
  }, [filteredScores]);

  const hasActiveFilters = Boolean(
    query || termFilter || gradeFilter || studentFilter || subjectFilter || viewMode !== "all"
  );

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm({
      ...emptyForm,
      teacher_id: teachers[0]?.id ? String(teachers[0].id) : "",
    });
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
      term: row.term,
      grade: String(row.grade),
      date: row.date ? String(row.date).slice(0, 10) : todayISO(),
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  function validateForm(f: ScoreForm): string | null {
    if (!f.student_id) return "Please select a student.";
    if (!f.subject.trim()) return "Please enter a subject.";
    if (!f.teacher_id) return "Please select a teacher.";
    if (!f.term.trim()) return "Please select a term.";
    if (!f.grade) return "Grade is required.";

    const ca = clampInt(f.cont_ass_score, 0, 40);
    const ex = clampInt(f.exam_score, 0, 60);

    if (ca < 0 || ca > 40) return "CA score must be between 0 and 40.";
    if (ex < 0 || ex > 60) return "Exam score must be between 0 and 60.";

    return null;
  }

  async function submit() {
    setFormError(null);
    setErr(null);
    setSuccess(null);

    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    setBusy(true);

    const payload = {
      student_id: Number(form.student_id),
      subject: form.subject.trim().toUpperCase(),
      cont_ass_score: clampInt(form.cont_ass_score, 0, 40),
      exam_score: clampInt(form.exam_score, 0, 60),
      teacher_id: Number(form.teacher_id),
      term: form.term,
      grade: Number(form.grade),
      date: form.date || todayISO(),
    };

    try {
      if (mode === "create") {
        const res = await api.post("/scores", payload);
        const created = res?.data as ScoreRow | undefined;

        if (created?.id) {
          setScores((prev) => [created, ...prev]);
        } else {
          await loadAll();
        }

        setSuccess("Score saved successfully.");
      } else {
        if (!editing?.id) throw new Error("No score selected.");

        const res = await api.put(`/scores/${editing.id}`, payload);
        const updated = res?.data as ScoreRow | undefined;

        if (updated?.id) {
          setScores((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        } else {
          await loadAll();
        }

        setSuccess("Score updated successfully.");
      }

      setOpen(false);
    } catch (e: unknown) {
      setFormError(extractErr(e, "Failed to save score."));
    } finally {
      setBusy(false);
    }
  }

  async function removeScore(row: ScoreRow) {
    const ok = window.confirm(`Delete ${row.subject} for this student?`);
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    const prev = scores;
    setScores((curr) => curr.filter((x) => x.id !== row.id));

    try {
      await api.delete(`/scores/${row.id}`);
      setSuccess("Score deleted successfully.");
    } catch (e: unknown) {
      setScores(prev);
      setErr(extractErr(e, "Failed to delete score."));
    } finally {
      setBusy(false);
    }
  }

  function applyStudentToForm(studentId: string) {
    const student = students.find((s) => String(s.id) === studentId);
    setForm((prev) => ({
      ...prev,
      student_id: studentId,
      grade: student ? String(student.grade) : prev.grade,
    }));
  }

  function clearFilters() {
    setQuery("");
    setTermFilter("");
    setGradeFilter("");
    setStudentFilter("");
    setSubjectFilter("");
    setViewMode("all");
  }

  const livePreview = useMemo(() => {
    const ca = clampInt(form.cont_ass_score, 0, 40);
    const ex = clampInt(form.exam_score, 0, 60);
    const total = ca + ex;
    return {
      ca,
      ex,
      total,
      letter: gradeLetter(total),
      effort: effortLabel(total),
    };
  }, [form.cont_ass_score, form.exam_score]);

  return (
    <div style={pageShell}>
      <div style={backgroundGlowOne} />
      <div style={backgroundGlowTwo} />

      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>Academic Records</div>
            <h1 style={heroTitle}>Scores</h1>
            <p style={heroText}>
              Record continuous assessment and exam scores, track grade letters and effort labels,
              and monitor subject performance from one premium academic workspace.
            </p>

            <div style={heroMiniRow}>
              <HeroMiniBadge label="Average" value={String(stats.avg)} />
              <HeroMiniBadge label="Pass Rate" value={`${stats.totalRows ? Math.round((stats.pass / stats.totalRows) * 100) : 0}%`} />
              <HeroMiniBadge label="Visible Rows" value={String(stats.totalRows)} />
            </div>
          </div>

          <div style={heroActions}>
            <button onClick={() => void loadAll()} style={btnSecondary} disabled={loading || busy}>
              Refresh
            </button>
            <button onClick={openCreate} style={btnPrimary} disabled={busy}>
              + Add Score
            </button>
          </div>
        </section>

        <section style={statsGrid}>
          <MetricCard label="Visible Scores" value={stats.totalRows} accent="blue" />
          <MetricCard label="Average" value={stats.avg} accent="green" />
          <MetricCard label="Pass" value={stats.pass} accent="purple" />
          <MetricCard label="Needs Work" value={stats.fail} accent="amber" />
          <MetricCard label="Excellent" value={stats.excellent} accent="green" />
        </section>

        <section style={insightGrid}>
          <div style={insightCard}>
            <div style={insightTitle}>Performance Insights</div>
            <div style={insightSub}>A quick academic overview based on current filters.</div>

            <div style={insightMetricGrid}>
              <InsightMetric label="Average CA" value={quickSummary.avgCa} />
              <InsightMetric label="Average Exam" value={quickSummary.avgExam} />
              <InsightMetric label="Top Performers" value={stats.top} />
              <InsightMetric label="Students Needing Support" value={stats.fail} />
            </div>
          </div>

          <div style={insightCard}>
            <div style={insightTitle}>Grade Distribution</div>
            <div style={insightSub}>How current results are spread across letter grades.</div>

            <div style={distributionWrap}>
              {gradeDistribution.map((item) => (
                <div key={item.letter} style={distributionRow}>
                  <div style={distributionLetter}>{item.letter}</div>
                  <div style={distributionBarTrack}>
                    <div
                      style={{
                        ...distributionBarFill,
                        width: `${stats.totalRows ? (item.count / stats.totalRows) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div style={distributionCount}>{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={twoColGrid}>
          <div style={insightCard}>
            <div style={insightTitle}>Top Subjects</div>
            <div style={insightSub}>Highest average subjects in the current view.</div>

            {topSubjects.length === 0 ? (
              <div style={emptyMini}>No subject data available.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {topSubjects.map((item) => (
                  <div key={item.subject} style={listRow}>
                    <div>
                      <div style={listTitle}>{item.subject}</div>
                      <div style={listMeta}>{item.count} score entr{item.count === 1 ? "y" : "ies"}</div>
                    </div>
                    <div style={listValue}>{item.average}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={insightCard}>
            <div style={insightTitle}>Top Students</div>
            <div style={insightSub}>Best averages among currently visible records.</div>

            {topStudents.length === 0 ? (
              <div style={emptyMini}>No student data available.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                {topStudents.map((item) => (
                  <div key={item.studentId} style={listRow}>
                    <div>
                      <div style={listTitle}>{item.name}</div>
                      <div style={listMeta}>{item.count} score entr{item.count === 1 ? "y" : "ies"}</div>
                    </div>
                    <div style={listValue}>{item.average}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={toolbar}>
          <div style={toolbarLeft}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student, subject, term, or teacher..."
              style={searchInput}
            />

            <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} style={filterInput}>
              <option value="">All terms</option>
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </select>

            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={filterInput}>
              <option value="">All grades</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={String(grade)}>
                  Grade {grade}
                </option>
              ))}
            </select>

            <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} style={filterInput}>
              <option value="">All students</option>
              {students
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((student) => (
                  <option key={student.id} value={String(student.id)}>
                    {student.name}
                  </option>
                ))}
            </select>

            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} style={filterInput}>
              <option value="">All subjects</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div style={toolbarRight}>
            <FilterChip active={viewMode === "all"} onClick={() => setViewMode("all")} label="All" />
            <FilterChip active={viewMode === "top"} onClick={() => setViewMode("top")} label="Top Performers" />
            <FilterChip
              active={viewMode === "needs-work"}
              onClick={() => setViewMode("needs-work")}
              label="Needs Work"
            />
            <button style={btnGhost} onClick={clearFilters} disabled={busy}>
              Clear Filters
            </button>
          </div>
        </section>

        {hasActiveFilters && (
          <div style={activeFilterRow}>
            {query ? <ActiveFilter label={`Search: ${query}`} onRemove={() => setQuery("")} /> : null}
            {termFilter ? <ActiveFilter label={`Term: ${termFilter}`} onRemove={() => setTermFilter("")} /> : null}
            {gradeFilter ? <ActiveFilter label={`Grade: ${gradeFilter}`} onRemove={() => setGradeFilter("")} /> : null}
            {studentFilter ? (
              <ActiveFilter
                label={`Student: ${studentMap.get(Number(studentFilter))?.name || studentFilter}`}
                onRemove={() => setStudentFilter("")}
              />
            ) : null}
            {subjectFilter ? <ActiveFilter label={`Subject: ${subjectFilter}`} onRemove={() => setSubjectFilter("")} /> : null}
            {viewMode !== "all" ? (
              <ActiveFilter
                label={`View: ${viewMode === "top" ? "Top Performers" : "Needs Work"}`}
                onRemove={() => setViewMode("all")}
              />
            ) : null}
          </div>
        )}

        {err && (
          <div style={alertBox}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {err}
          </div>
        )}

        {success && (
          <div style={successBox}>
            <strong style={{ marginRight: 8 }}>Success:</strong>
            {success}
          </div>
        )}

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Score Register</div>
              <div style={panelSub}>
                {loading ? "Loading scores..." : `${filteredScores.length} result(s) found`}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>Loading scores...</div>
          ) : filteredScores.length === 0 ? (
            <div style={emptyState}>No scores found for the current filters.</div>
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
                    <th style={thCenter}>Letter</th>
                    <th style={th}>Effort</th>
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
                      const total = totalScoreFor(row);
                      const letter = gradeLetter(total);
                      const effort = effortLabel(total);

                      return (
                        <tr key={row.id} style={tr}>
                          <td style={td}>
                            <div style={{ fontWeight: 800, color: "#fff" }}>
                              {student?.name || `Student #${row.student_id}`}
                            </div>
                            <div style={tdSub}>{student?.guardian_name || "—"}</div>
                          </td>

                          <td style={td}>Grade {row.grade}</td>
                          <td style={td}>{row.subject}</td>
                          <td style={tdCenter}>{row.cont_ass_score}</td>
                          <td style={tdCenter}>{row.exam_score}</td>
                          <td style={tdCenter}>
                            <span style={totalBadge(total)}>{total}</span>
                          </td>
                          <td style={tdCenter}>
                            <span style={letterBadge(letter)}>{letter}</span>
                          </td>
                          <td style={td}>
                            <span style={effortBadge(total)}>{effort}</span>
                          </td>
                          <td style={td}>{row.term}</td>
                          <td style={td}>
                            {teacher?.username || teacher?.email || `#${row.teacher_id}`}
                          </td>
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
            {formError && <div style={{ ...alertBox, marginTop: 0 }}>{formError}</div>}

            <div style={modalGrid}>
              <Field label="Student">
                <select
                  style={fieldInput}
                  value={form.student_id}
                  onChange={(e) => applyStudentToForm(e.target.value)}
                >
                  <option value="">Select student</option>
                  {students
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((student) => (
                      <option key={student.id} value={String(student.id)}>
                        {student.name} — Grade {student.grade}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Teacher">
                <select
                  style={fieldInput}
                  value={form.teacher_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, teacher_id: e.target.value }))}
                >
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={String(teacher.id)}>
                      {teacher.username || teacher.email || `User #${teacher.id}`}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Term">
                <select
                  style={fieldInput}
                  value={form.term}
                  onChange={(e) => setForm((prev) => ({ ...prev, term: e.target.value }))}
                >
                  {TERMS.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Grade">
                <input
                  style={fieldInput}
                  value={form.grade}
                  onChange={(e) => setForm((prev) => ({ ...prev, grade: digitsOnly(e.target.value) }))}
                  placeholder="Grade"
                />
              </Field>

              <Field label="Subject" full>
                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    style={fieldInput}
                    value={form.subject}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        subject: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Enter subject"
                  />

                  <div style={subjectWrap}>
                    {SUBJECTS.map((subject) => {
                      const active = form.subject === subject;
                      return (
                        <button
                          key={subject}
                          type="button"
                          style={{
                            ...subjectChip,
                            background: active ? "#ffffff" : "rgba(255,255,255,0.06)",
                            color: active ? "#0b1220" : "#f8fafc",
                          }}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              subject,
                            }))
                          }
                        >
                          {subject}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Field>

              <Field label="Continuous Assessment (0–40)">
                <input
                  type="number"
                  min={0}
                  max={40}
                  style={fieldInput}
                  value={form.cont_ass_score}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cont_ass_score: String(clampInt(e.target.value, 0, 40)),
                    }))
                  }
                  placeholder="0"
                />
              </Field>

              <Field label="Exam (0–60)">
                <input
                  type="number"
                  min={0}
                  max={60}
                  style={fieldInput}
                  value={form.exam_score}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      exam_score: String(clampInt(e.target.value, 0, 60)),
                    }))
                  }
                  placeholder="0"
                />
              </Field>

              <Field label="Date">
                <input
                  type="date"
                  style={fieldInput}
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </Field>

              <Field label="Live Performance Preview" full>
                <div style={previewCard}>
                  <div style={previewGrid}>
                    <PreviewMetric label="CA" value={livePreview.ca} />
                    <PreviewMetric label="Exam" value={livePreview.ex} />
                    <PreviewMetric label="Total" value={livePreview.total} />
                    <PreviewMetric label="Letter" value={livePreview.letter} />
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={totalBadge(livePreview.total)}>Total {livePreview.total}</span>
                    <span style={letterBadge(livePreview.letter)}>{livePreview.letter}</span>
                    <span style={effortBadge(livePreview.total)}>{livePreview.effort}</span>
                  </div>
                </div>
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

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "blue" | "green" | "purple" | "amber";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.35)",
    green: "rgba(34,197,94,0.35)",
    purple: "rgba(168,85,247,0.35)",
    amber: "rgba(245,158,11,0.35)",
  };

  return (
    <div style={{ ...metricCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
    </div>
  );
}

function HeroMiniBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMiniBadge}>
      <div style={heroMiniLabel}>{label}</div>
      <div style={heroMiniValue}>{value}</div>
    </div>
  );
}

function InsightMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={insightMetricCard}>
      <div style={insightMetricLabel}>{label}</div>
      <div style={insightMetricValue}>{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: active ? "#ffffff" : "rgba(255,255,255,0.06)",
        color: active ? "#0b1220" : "#f8fafc",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={activeFilterChip}>
      <span>{label}</span>
      <button onClick={onRemove} style={activeFilterRemove}>
        ✕
      </button>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={previewMetric}>
      <div style={previewMetricLabel}>{label}</div>
      <div style={previewMetricValue}>{value}</div>
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
        background: "rgba(2,6,23,0.75)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 60,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "#0f172a",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        <div style={modalHeader}>
          <div style={modalTitle}>{title}</div>
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
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function totalScoreFor(row: Pick<ScoreRow, "cont_ass_score" | "exam_score">) {
  return Number(row.cont_ass_score || 0) + Number(row.exam_score || 0);
}

function effortLabel(total: number) {
  if (total >= 90) return "A Excellent";
  if (total >= 70) return "B Very Good";
  if (total >= 50) return "C Good";
  if (total >= 40) return "D Satisfactory";
  return "E Working Towards";
}

function gradeLetter(total: number) {
  if (total >= 90) return "A";
  if (total >= 80) return "B";
  if (total >= 70) return "C";
  if (total >= 60) return "D";
  if (total >= 50) return "E";
  return "F";
}

function totalBadge(total: number): CSSProperties {
  if (total >= 70) {
    return {
      ...pillBase,
      background: "rgba(34,197,94,0.16)",
      color: "#bbf7d0",
      border: "1px solid rgba(34,197,94,0.28)",
    };
  }

  if (total >= 50) {
    return {
      ...pillBase,
      background: "rgba(245,158,11,0.16)",
      color: "#fde68a",
      border: "1px solid rgba(245,158,11,0.28)",
    };
  }

  return {
    ...pillBase,
    background: "rgba(239,68,68,0.14)",
    color: "#fecaca",
    border: "1px solid rgba(239,68,68,0.28)",
  };
}

function letterBadge(letter: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    A: {
      background: "rgba(34,197,94,0.16)",
      color: "#bbf7d0",
      border: "1px solid rgba(34,197,94,0.30)",
    },
    B: {
      background: "rgba(59,130,246,0.16)",
      color: "#bfdbfe",
      border: "1px solid rgba(59,130,246,0.30)",
    },
    C: {
      background: "rgba(245,158,11,0.16)",
      color: "#fde68a",
      border: "1px solid rgba(245,158,11,0.30)",
    },
    D: {
      background: "rgba(249,115,22,0.16)",
      color: "#fdba74",
      border: "1px solid rgba(249,115,22,0.30)",
    },
    E: {
      background: "rgba(239,68,68,0.14)",
      color: "#fecaca",
      border: "1px solid rgba(239,68,68,0.28)",
    },
    F: {
      background: "rgba(127,29,29,0.30)",
      color: "#fecaca",
      border: "1px solid rgba(248,113,113,0.30)",
    },
  };

  return {
    ...pillBase,
    minWidth: 38,
    justifyContent: "center",
    ...(map[letter] || map.F),
  };
}

function effortBadge(total: number): CSSProperties {
  if (total >= 90) {
    return {
      ...pillBase,
      background: "rgba(34,197,94,0.16)",
      color: "#bbf7d0",
      border: "1px solid rgba(34,197,94,0.30)",
    };
  }

  if (total >= 70) {
    return {
      ...pillBase,
      background: "rgba(59,130,246,0.16)",
      color: "#bfdbfe",
      border: "1px solid rgba(59,130,246,0.30)",
    };
  }

  if (total >= 50) {
    return {
      ...pillBase,
      background: "rgba(245,158,11,0.16)",
      color: "#fde68a",
      border: "1px solid rgba(245,158,11,0.30)",
    };
  }

  if (total >= 40) {
    return {
      ...pillBase,
      background: "rgba(249,115,22,0.16)",
      color: "#fdba74",
      border: "1px solid rgba(249,115,22,0.30)",
    };
  }

  return {
    ...pillBase,
    background: "rgba(239,68,68,0.14)",
    color: "#fecaca",
    border: "1px solid rgba(239,68,68,0.28)",
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function clampInt(value: string | number, min: number, max: number) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function digitsOnly(value: string) {
  return value.replace(/[^\d]/g, "");
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function extractErr(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string; error?: string } | string };
    message?: string;
  };

  const data = err?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const msg = (data as { message?: string; error?: string }).message || (data as { error?: string }).error;
    if (msg) return msg;
  }
  return err?.message || fallback;
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
  position: "relative",
  overflow: "hidden",
};

const backgroundGlowOne: CSSProperties = {
  position: "absolute",
  top: -120,
  right: -100,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)",
  pointerEvents: "none",
};

const backgroundGlowTwo: CSSProperties = {
  position: "absolute",
  bottom: -140,
  left: -120,
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)",
  pointerEvents: "none",
};

const page: CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
  position: "relative",
  zIndex: 1,
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

const heroText: CSSProperties = {
  marginTop: 8,
  maxWidth: 760,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const heroMiniRow: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const heroMiniBadge: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
};

const heroMiniLabel: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const heroMiniValue: CSSProperties = {
  fontSize: 14,
  color: "#fff",
  fontWeight: 900,
  marginTop: 4,
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

const metricCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(8px)",
};

const metricLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const metricValue: CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 950,
  color: "#fff",
};

const insightGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 18,
};

const twoColGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 18,
};

const insightCard: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  backdropFilter: "blur(10px)",
  padding: 16,
};

const insightTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
};

const insightSub: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#94a3b8",
};

const insightMetricGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const insightMetricCard: CSSProperties = {
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: 14,
};

const insightMetricLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
};

const insightMetricValue: CSSProperties = {
  marginTop: 8,
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const distributionWrap: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const distributionRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 1fr 40px",
  gap: 10,
  alignItems: "center",
};

const distributionLetter: CSSProperties = {
  fontWeight: 900,
  color: "#fff",
};

const distributionBarTrack: CSSProperties = {
  height: 12,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const distributionBarFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(96,165,250,0.95), rgba(168,85,247,0.95))",
};

const distributionCount: CSSProperties = {
  textAlign: "right",
  color: "#cbd5e1",
  fontWeight: 800,
};

const listRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const listTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#fff",
};

const listMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const listValue: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const emptyMini: CSSProperties = {
  padding: "12px 0",
  color: "#cbd5e1",
};

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const toolbarLeft: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  flex: 1,
};

const toolbarRight: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const searchInput: CSSProperties = {
  width: 340,
  maxWidth: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const filterInput: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const activeFilterRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
};

const activeFilterChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(96,165,250,0.22)",
  background: "rgba(96,165,250,0.12)",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 800,
};

const activeFilterRemove: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const panel: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
};

const panelHeader: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const panelTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const panelSub: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#94a3b8",
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
  padding: 14,
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
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
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const td: CSSProperties = {
  padding: 14,
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
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const btnPrimary: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#ffffff",
  color: "#0b1220",
  fontWeight: 900,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const btnGhost: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "transparent",
  color: "#cbd5e1",
  fontWeight: 800,
  cursor: "pointer",
};

const miniButton: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const miniDanger: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,0.30)",
  background: "rgba(239,68,68,0.12)",
  color: "#fecaca",
  fontWeight: 800,
  cursor: "pointer",
};

const alertBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
};

const successBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(34,197,94,0.22)",
  background: "rgba(20,83,45,0.24)",
  color: "#bbf7d0",
};

const modalHeader: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const modalTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
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

const modalGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1",
  fontWeight: 800,
};

const fieldInput: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const subjectWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const subjectChip: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: 800,
  cursor: "pointer",
};

const previewCard: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const previewGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const previewMetric: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.6)",
  padding: 12,
};

const previewMetricLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
};

const previewMetricValue: CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 900,
  color: "#fff",
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  whiteSpace: "nowrap",
};