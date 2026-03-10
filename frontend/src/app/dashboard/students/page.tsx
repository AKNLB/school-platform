"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Student = {
  id: number;
  name: string;
  dob?: string | null;
  gender?: string | null;
  national_id?: string | null;
  grade: number;
  email?: string | null;
  guardian_name?: string | null;
  guardian_contact?: string | null;
  home_address?: string | null;
  emergency_contact?: string | null;
  photo_url?: string | null;
};

type AttendanceRow = {
  id: number;
  student_id: number;
  date: string;
  status: string;
  note?: string;
};

type PaymentRow = {
  id: number;
  student_id: number;
  tuition_id?: number;
  amount: number;
  method?: string | null;
  reference?: string | null;
  note?: string | null;
  timestamp?: string | null;
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

type TuitionInfo = {
  id: number;
  student_id: number;
  term: string;
  total_amount: number;
  amount_paid: number;
  balance?: number;
  balance_due?: number;
  payment_plan?: string | null;
  status?: string | null;
  payments?: Array<{
    id: number;
    amount: number;
    method?: string | null;
    reference?: string | null;
    timestamp?: string | null;
    note?: string | null;
  }>;
};

type StudentForm = {
  name: string;
  dob: string;
  gender: string;
  national_id: string;
  grade: string;
  email: string;
  guardian_name: string;
  guardian_contact: string;
  home_address: string;
  emergency_contact: string;
};

type ViewFilter = "all" | "strong" | "needs-support";

const emptyForm: StudentForm = {
  name: "",
  dob: "",
  gender: "",
  national_id: "",
  grade: "",
  email: "",
  guardian_name: "",
  guardian_contact: "",
  home_address: "",
  emergency_contact: "",
};

const TERMS = ["Term 1", "Term 2", "Term 3"];

export default function StudentsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [tuition, setTuition] = useState<TuitionInfo | null>(null);

  const [term, setTerm] = useState<string>("Term 1");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadStudents() {
    setLoading(true);
    setErr(null);

    try {
      const res = await api.get("/students");
      const rows = Array.isArray(res.data) ? (res.data as Student[]) : [];
      setStudents(rows);

      if (rows.length > 0) {
        setSelectedId((prev) => (prev && rows.some((s) => s.id === prev) ? prev : rows[0].id));
      } else {
        setSelectedId(null);
      }
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load students."));
      setStudents([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentDetail(studentId: number, activeTerm: string) {
    setDetailLoading(true);
    setErr(null);

    try {
      const [attendanceRes, paymentsRes, scoresRes, tuitionRes] = await Promise.allSettled([
        api.get(`/attendance/student/${studentId}`, { params: { limit: 120 } }),
        api.get(`/payments/${studentId}`, { params: { term: activeTerm } }),
        api.get("/scores", { params: { student_id: studentId, term: activeTerm } }),
        api.get(`/tuition/${studentId}`, { params: { term: activeTerm } }),
      ]);

      if (attendanceRes.status === "fulfilled") {
        setAttendance(Array.isArray(attendanceRes.value.data) ? attendanceRes.value.data : []);
      } else {
        setAttendance([]);
      }

      if (paymentsRes.status === "fulfilled") {
        setPayments(Array.isArray(paymentsRes.value.data) ? paymentsRes.value.data : []);
      } else {
        setPayments([]);
      }

      if (scoresRes.status === "fulfilled") {
        setScores(Array.isArray(scoresRes.value.data) ? scoresRes.value.data : []);
      } else {
        setScores([]);
      }

      if (tuitionRes.status === "fulfilled" && tuitionRes.value?.data && typeof tuitionRes.value.data === "object") {
        setTuition(tuitionRes.value.data as TuitionInfo);
      } else {
        setTuition(null);
      }
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load student records."));
      setAttendance([]);
      setPayments([]);
      setScores([]);
      setTuition(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadStudentDetail(selectedId, term);
  }, [selectedId, term]);

  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(students.map((s) => Number(s.grade)).filter((g) => !Number.isNaN(g))));
    return grades.sort((a, b) => a - b);
  }, [students]);

  const attendanceSummary = useMemo(() => {
    const out = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const row of attendance) {
      const s = String(row.status || "").toLowerCase();
      if (s === "present") out.present++;
      else if (s === "absent") out.absent++;
      else if (s === "late") out.late++;
      else if (s === "excused") out.excused++;
    }
    return out;
  }, [attendance]);

  const scoreSummary = useMemo(() => {
    const rows = scores.map((s) => ({
      ...s,
      total: Number(s.cont_ass_score || 0) + Number(s.exam_score || 0),
    }));
    const total = rows.reduce((sum, r) => sum + r.total, 0);
    const avg = rows.length ? round1(total / rows.length) : 0;
    const best = rows.length ? Math.max(...rows.map((r) => r.total)) : 0;
    const weakest = rows.length ? Math.min(...rows.map((r) => r.total)) : 0;
    const pass = rows.filter((r) => r.total >= 50).length;
    const fail = rows.length - pass;
    const topSubject = rows.length ? [...rows].sort((a, b) => b.total - a.total)[0] : null;
    const lowSubject = rows.length ? [...rows].sort((a, b) => a.total - b.total)[0] : null;

    return {
      count: rows.length,
      avg,
      best,
      weakest,
      pass,
      fail,
      rows,
      topSubject,
      lowSubject,
    };
  }, [scores]);

  const financeSummary = useMemo(() => {
    const totalPaidFromPayments = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      totalDue: Number(tuition?.total_amount || 0),
      totalPaid: Number(tuition?.amount_paid ?? totalPaidFromPayments ?? 0),
      balance:
        Number(
          tuition?.balance_due ??
            tuition?.balance ??
            Math.max(Number(tuition?.total_amount || 0) - Number(tuition?.amount_paid || 0), 0)
        ) || 0,
      status: tuition?.status || "Not set",
      paymentCount: payments.length,
      plan: tuition?.payment_plan || "--",
    };
  }, [tuition, payments]);

  const recentActivity = useMemo(() => {
    const scoreItems = scores.map((s) => ({
      type: "score" as const,
      title: `${s.subject} score recorded`,
      value: `${Number(s.cont_ass_score || 0) + Number(s.exam_score || 0)}`,
      date: s.date,
    }));

    const paymentItems = payments.map((p) => ({
      type: "payment" as const,
      title: `Payment received`,
      value: `$${money(p.amount)}`,
      date: p.timestamp || "",
    }));

    const attendanceItems = attendance.map((a) => ({
      type: "attendance" as const,
      title: `Attendance marked ${a.status}`,
      value: a.note || a.status,
      date: a.date,
    }));

    return [...scoreItems, ...paymentItems, ...attendanceItems]
      .filter((x) => x.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [scores, payments, attendance]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedId) || null,
    [students, selectedId]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        String(s.id).includes(q) ||
        String(s.grade ?? "").includes(q) ||
        (s.guardian_name || "").toLowerCase().includes(q) ||
        (s.guardian_contact || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q);

      const matchesGrade = !gradeFilter || String(s.grade) === gradeFilter;

      return matchesSearch && matchesGrade;
    });
  }, [students, search, gradeFilter]);

  const studentInsights = useMemo(() => {
    const total = students.length;
    const withGuardian = students.filter((s) => Boolean(s.guardian_name || s.guardian_contact)).length;
    const withEmail = students.filter((s) => Boolean(s.email)).length;
    const avgGrade = total
      ? round1(students.reduce((sum, s) => sum + Number(s.grade || 0), 0) / total)
      : 0;

    return { total, withGuardian, withEmail, avgGrade };
  }, [students]);

  const directoryRows = useMemo(() => {
    return filteredStudents.filter((student) => {
      if (viewFilter === "all") return true;
      if (viewFilter === "strong") return student.grade >= 6;
      if (viewFilter === "needs-support") return student.grade <= 3;
      return true;
    });
  }, [filteredStudents, viewFilter]);

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function closeCreate() {
    if (busy) return;
    setOpen(false);
  }

  function validateForm(v: StudentForm) {
    if (!v.name.trim()) return "Student name is required.";
    if (!v.grade.trim()) return "Grade is required.";
    if (Number.isNaN(Number(v.grade))) return "Grade must be a number.";
    return null;
  }

  async function createStudent() {
    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    setBusy(true);
    setFormError(null);
    setErr(null);
    setSuccess(null);

    try {
      const payload = {
        name: form.name.trim(),
        dob: form.dob.trim() || null,
        gender: form.gender.trim() || null,
        national_id: form.national_id.trim() || null,
        grade: Number(form.grade),
        email: form.email.trim() || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_contact: form.guardian_contact.trim() || null,
        home_address: form.home_address.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
      };

      await api.post("/students", payload);
      setSuccess("Student added successfully.");
      setOpen(false);
      await loadStudents();
    } catch (e: unknown) {
      setFormError(extractErr(e, "Failed to add student."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(student: Student) {
    const ok = window.confirm(
      `Delete student "${student.name}"?\n\nThis will remove the student profile.`
    );
    if (!ok) return;

    setBusy(true);
    setErr(null);
    setSuccess(null);

    try {
      await api.delete(`/students/${student.id}`);
      setSuccess(`Deleted ${student.name}.`);
      await loadStudents();
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to delete student."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageShell}>
      <div style={bgGlowOne} />
      <div style={bgGlowTwo} />

      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>Student Intelligence Hub</div>
            <h1 style={heroTitle}>Students</h1>
            <p style={heroText}>
              View each student’s profile, attendance, finance records, academic performance,
              and recent activity from one premium command center.
            </p>

            <div style={heroMiniRow}>
              <HeroMiniBadge label="Students" value={String(studentInsights.total)} />
              <HeroMiniBadge label="With Guardians" value={String(studentInsights.withGuardian)} />
              <HeroMiniBadge label="Avg Grade" value={String(studentInsights.avgGrade)} />
            </div>
          </div>

          <div style={heroActions}>
            <button onClick={() => void loadStudents()} style={btnSecondary} disabled={loading || busy}>
              Refresh
            </button>
            <button onClick={openCreate} style={btnPrimary} disabled={busy}>
              + Add Student
            </button>
          </div>
        </section>

        <section style={premiumStatsGrid}>
          <StatCard label="Students" value={String(students.length)} accent="blue" />
          <StatCard label="Selected Term" value={term} accent="purple" />
          <StatCard
            label="Attendance Loaded"
            value={selectedStudent ? String(attendance.length) : "--"}
            accent="green"
          />
          <StatCard
            label="Scores Loaded"
            value={selectedStudent ? String(scores.length) : "--"}
            accent="amber"
          />
        </section>

        <section style={premiumInsightsGrid}>
          <div style={premiumInsightCard}>
            <div style={premiumInsightTitle}>Directory Insights</div>
            <div style={premiumInsightSub}>A quick snapshot of the student population.</div>

            <div style={insightMetricGrid}>
              <InsightMetric label="With Email" value={String(studentInsights.withEmail)} />
              <InsightMetric label="Guardian Records" value={String(studentInsights.withGuardian)} />
              <InsightMetric label="Grades Listed" value={String(gradeOptions.length)} />
              <InsightMetric label="Current Selection" value={selectedStudent ? "Loaded" : "None"} />
            </div>
          </div>

          <div style={premiumInsightCard}>
            <div style={premiumInsightTitle}>Student Focus</div>
            <div style={premiumInsightSub}>Use quick filters to review different groups fast.</div>

            <div style={chipWrap}>
              <FilterChip active={viewFilter === "all"} onClick={() => setViewFilter("all")} label="All" />
              <FilterChip active={viewFilter === "strong"} onClick={() => setViewFilter("strong")} label="Upper Grades" />
              <FilterChip
                active={viewFilter === "needs-support"}
                onClick={() => setViewFilter("needs-support")}
                label="Lower Grades"
              />
            </div>
          </div>
        </section>

        {err && (
          <div style={errorAlert}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {err}
          </div>
        )}

        {success && (
          <div style={successAlert}>
            <strong style={{ marginRight: 8 }}>Success:</strong>
            {success}
          </div>
        )}

        <div style={layout}>
          <section style={leftPanel}>
            <div style={panelHeader}>
              <div>
                <div style={panelTitle}>Student Directory</div>
                <div style={panelSub}>Select a student to view cross-page records.</div>
              </div>
            </div>

            <div style={toolbar}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, ID, guardian, grade..."
                style={searchInput}
              />

              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                style={fieldInput}
              >
                <option value="">All grades</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={String(grade)}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </div>

            <div style={listWrap}>
              {loading ? (
                <div style={emptyState}>Loading students...</div>
              ) : directoryRows.length === 0 ? (
                <div style={emptyState}>No students found.</div>
              ) : (
                directoryRows.map((student) => {
                  const active = selectedId === student.id;

                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedId(student.id)}
                      style={{
                        ...studentRow,
                        ...(active ? activeStudentRow : {}),
                      }}
                    >
                      <div style={studentAvatar}>
                        {student.photo_url ? (
                          <img src={student.photo_url} alt={student.name} style={avatarImg} />
                        ) : (
                          <span>{initials(student.name)}</span>
                        )}
                      </div>

                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={studentName}>{student.name}</div>
                        <div style={studentMeta}>
                          ID #{student.id} • Grade {student.grade}
                        </div>
                        <div style={studentMeta}>
                          {student.guardian_name || "No guardian"}
                          {student.guardian_contact ? ` • ${student.guardian_contact}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section style={rightPanel}>
            {!selectedStudent ? (
              <div style={panel}>
                <div style={emptyState}>Select a student to view details.</div>
              </div>
            ) : (
              <>
                <section style={panel}>
                  <div style={detailHero}>
                    <div style={detailHeroLeft}>
                      <div style={bigAvatar}>
                        {selectedStudent.photo_url ? (
                          <img src={selectedStudent.photo_url} alt={selectedStudent.name} style={bigAvatarImg} />
                        ) : (
                          <span>{initials(selectedStudent.name)}</span>
                        )}
                      </div>

                      <div>
                        <div style={detailName}>{selectedStudent.name}</div>
                        <div style={detailMeta}>
                          Student ID #{selectedStudent.id} • Grade {selectedStudent.grade}
                        </div>
                        <div style={detailMeta}>
                          {selectedStudent.gender || "Gender not set"}
                          {selectedStudent.dob ? ` • DOB ${selectedStudent.dob}` : ""}
                        </div>
                        <div style={detailMeta}>
                          {selectedStudent.email || "No email"}
                        </div>
                      </div>
                    </div>

                    <div style={detailActions}>
                      <select
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        style={fieldInput}
                      >
                        {TERMS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => void loadStudentDetail(selectedStudent.id, term)}
                        style={btnSecondary}
                        disabled={detailLoading || busy}
                      >
                        Refresh Student Data
                      </button>

                      <button
                        onClick={() => void deleteStudent(selectedStudent)}
                        style={btnDanger}
                        disabled={busy}
                      >
                        Delete Student
                      </button>
                    </div>
                  </div>
                </section>

                <section style={detailStatsGrid}>
                  <StatCard label="Present" value={String(attendanceSummary.present)} accent="green" />
                  <StatCard label="Absent" value={String(attendanceSummary.absent)} accent="amber" />
                  <StatCard label="Average Score" value={String(scoreSummary.avg)} accent="blue" />
                  <StatCard label="Balance" value={`$${money(financeSummary.balance)}`} accent="purple" />
                </section>

                <div style={sectionGrid}>
                  <Card title="Student Profile" subtitle="Core profile and contact details">
                    <InfoGrid>
                      <InfoItem label="National ID" value={selectedStudent.national_id || "--"} />
                      <InfoItem label="Guardian" value={selectedStudent.guardian_name || "--"} />
                      <InfoItem label="Guardian Contact" value={selectedStudent.guardian_contact || "--"} />
                      <InfoItem label="Emergency Contact" value={selectedStudent.emergency_contact || "--"} />
                      <InfoItem label="Home Address" value={selectedStudent.home_address || "--"} full />
                    </InfoGrid>
                  </Card>

                  <Card title="Finance Summary" subtitle={`Records for ${term}`}>
                    <InfoGrid>
                      <InfoItem label="Total Due" value={`$${money(financeSummary.totalDue)}`} />
                      <InfoItem label="Total Paid" value={`$${money(financeSummary.totalPaid)}`} />
                      <InfoItem label="Balance" value={`$${money(financeSummary.balance)}`} />
                      <InfoItem label="Status" value={financeSummary.status} />
                      <InfoItem label="Payment Plan" value={financeSummary.plan} />
                      <InfoItem label="Payments" value={String(financeSummary.paymentCount)} />
                    </InfoGrid>

                    <div style={miniSectionTitle}>Payment History</div>
                    {payments.length === 0 ? (
                      <div style={emptyInline}>No payments found for this term.</div>
                    ) : (
                      <div style={tableWrap}>
                        <table style={table}>
                          <thead>
                            <tr>
                              <th style={th}>Date</th>
                              <th style={th}>Amount</th>
                              <th style={th}>Method</th>
                              <th style={th}>Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.slice(0, 8).map((p) => (
                              <tr key={p.id}>
                                <td style={td}>{formatDateTime(p.timestamp)}</td>
                                <td style={td}>${money(p.amount)}</td>
                                <td style={td}>{p.method || "--"}</td>
                                <td style={td}>{p.reference || "--"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>

                <div style={sectionGrid}>
                  <Card title="Attendance Record" subtitle="Most recent attendance entries">
                    {detailLoading ? (
                      <div style={emptyInline}>Loading attendance...</div>
                    ) : attendance.length === 0 ? (
                      <div style={emptyInline}>No attendance records found.</div>
                    ) : (
                      <>
                        <InfoGrid>
                          <InfoItem label="Present" value={String(attendanceSummary.present)} />
                          <InfoItem label="Absent" value={String(attendanceSummary.absent)} />
                          <InfoItem label="Late" value={String(attendanceSummary.late)} />
                          <InfoItem label="Excused" value={String(attendanceSummary.excused)} />
                        </InfoGrid>

                        <div style={tableWrap}>
                          <table style={table}>
                            <thead>
                              <tr>
                                <th style={th}>Date</th>
                                <th style={th}>Status</th>
                                <th style={th}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendance.slice(0, 12).map((row) => (
                                <tr key={row.id}>
                                  <td style={td}>{row.date}</td>
                                  <td style={td}>
                                    <span style={statusPill(row.status)}>{row.status}</span>
                                  </td>
                                  <td style={td}>{row.note || "--"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </Card>

                  <Card title="Scores Record" subtitle={`Academic records for ${term}`}>
                    {detailLoading ? (
                      <div style={emptyInline}>Loading scores...</div>
                    ) : scoreSummary.rows.length === 0 ? (
                      <div style={emptyInline}>No scores found for this term.</div>
                    ) : (
                      <>
                        <InfoGrid>
                          <InfoItem label="Subjects" value={String(scoreSummary.count)} />
                          <InfoItem label="Average" value={String(scoreSummary.avg)} />
                          <InfoItem label="Best Score" value={String(scoreSummary.best)} />
                          <InfoItem label="Lowest Score" value={String(scoreSummary.weakest)} />
                          <InfoItem label="Passed" value={String(scoreSummary.pass)} />
                          <InfoItem label="Needs Support" value={String(scoreSummary.fail)} />
                        </InfoGrid>

                        <div style={miniInsightRow}>
                          <div style={miniInsightCard}>
                            <div style={miniInsightLabel}>Top Subject</div>
                            <div style={miniInsightValue}>
                              {scoreSummary.topSubject?.subject || "--"}{" "}
                              {scoreSummary.topSubject ? `• ${scoreSummary.topSubject.total}` : ""}
                            </div>
                          </div>

                          <div style={miniInsightCard}>
                            <div style={miniInsightLabel}>Weakest Subject</div>
                            <div style={miniInsightValue}>
                              {scoreSummary.lowSubject?.subject || "--"}{" "}
                              {scoreSummary.lowSubject ? `• ${scoreSummary.lowSubject.total}` : ""}
                            </div>
                          </div>
                        </div>

                        <div style={tableWrap}>
                          <table style={table}>
                            <thead>
                              <tr>
                                <th style={th}>Subject</th>
                                <th style={th}>CA</th>
                                <th style={th}>Exam</th>
                                <th style={th}>Total</th>
                                <th style={th}>Term</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scoreSummary.rows.map((row) => {
                                const total = Number(row.cont_ass_score || 0) + Number(row.exam_score || 0);
                                return (
                                  <tr key={row.id}>
                                    <td style={td}>{row.subject}</td>
                                    <td style={td}>{row.cont_ass_score}</td>
                                    <td style={td}>{row.exam_score}</td>
                                    <td style={td}>
                                      <strong>{total}</strong>
                                    </td>
                                    <td style={td}>{row.term}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </Card>
                </div>

                <Card title="Recent Activity" subtitle="Latest attendance, score, and finance events">
                  {recentActivity.length === 0 ? (
                    <div style={emptyInline}>No recent activity found.</div>
                  ) : (
                    <div style={activityFeed}>
                      {recentActivity.map((item, idx) => (
                        <div key={`${item.type}-${item.date}-${idx}`} style={activityRow}>
                          <div style={activityDot(item.type)} />
                          <div style={{ flex: 1 }}>
                            <div style={activityTitle}>{item.title}</div>
                            <div style={activityMeta}>
                              {item.value} • {formatDateTime(item.date)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )}
          </section>
        </div>

        {open && (
          <Modal title="Add New Student" onClose={closeCreate}>
            {formError && <div style={{ ...errorAlert, marginBottom: 12 }}>{formError}</div>}

            <div style={createIntroCard}>
              <div style={createIntroTitle}>Student Registration</div>
              <div style={createIntroText}>
                Add the student’s core identity, guardian details, and emergency information so all school records stay linked from day one.
              </div>
            </div>

            <div style={formGrid}>
              <Field label="Student Name" full>
                <input
                  style={fieldInput}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                />
              </Field>

              <Field label="Date of Birth">
                <input
                  type="date"
                  style={fieldInput}
                  value={form.dob}
                  onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                />
              </Field>

              <Field label="Gender">
                <select
                  style={fieldInput}
                  value={form.gender}
                  onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>

              <Field label="Grade">
                <input
                  style={fieldInput}
                  value={form.grade}
                  onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                  placeholder="e.g. 5"
                />
              </Field>

              <Field label="National ID">
                <input
                  style={fieldInput}
                  value={form.national_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, national_id: e.target.value }))}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Email" full>
                <input
                  style={fieldInput}
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="student@email.com"
                />
              </Field>

              <Field label="Guardian Name">
                <input
                  style={fieldInput}
                  value={form.guardian_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, guardian_name: e.target.value }))}
                  placeholder="Guardian name"
                />
              </Field>

              <Field label="Guardian Contact">
                <input
                  style={fieldInput}
                  value={form.guardian_contact}
                  onChange={(e) => setForm((prev) => ({ ...prev, guardian_contact: e.target.value }))}
                  placeholder="Phone or email"
                />
              </Field>

              <Field label="Home Address" full>
                <textarea
                  style={{ ...fieldInput, minHeight: 90, resize: "vertical" }}
                  value={form.home_address}
                  onChange={(e) => setForm((prev) => ({ ...prev, home_address: e.target.value }))}
                  placeholder="Enter home address"
                />
              </Field>

              <Field label="Emergency Contact" full>
                <input
                  style={fieldInput}
                  value={form.emergency_contact}
                  onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact: e.target.value }))}
                  placeholder="Emergency contact"
                />
              </Field>
            </div>

            <div style={modalActions}>
              <button style={btnSecondary} onClick={closeCreate} disabled={busy}>
                Cancel
              </button>
              <button style={btnPrimary} onClick={() => void createStudent()} disabled={busy}>
                {busy ? "Saving..." : "Add Student"}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section style={panel}>
      <div style={panelHeader}>
        <div>
          <div style={panelTitle}>{title}</div>
          {subtitle ? <div style={panelSub}>{subtitle}</div> : null}
        </div>
      </div>
      <div style={panelBody}>{children}</div>
    </section>
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
        <div style={{ padding: 16 }}>{children}</div>
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

function InfoGrid({ children }: { children: ReactNode }) {
  return <div style={infoGrid}>{children}</div>;
}

function InfoItem({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div style={{ ...infoItem, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={infoLabel}>{label}</div>
      <div style={infoValue}>{value}</div>
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
  accent: "blue" | "green" | "purple" | "amber";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.30)",
    green: "rgba(34,197,94,0.30)",
    purple: "rgba(168,85,247,0.30)",
    amber: "rgba(245,158,11,0.30)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
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

function InsightMetric({ label, value }: { label: string; value: string }) {
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

function initials(name: string) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("");
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function money(n: number) {
  return Number(n || 0).toFixed(2);
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

function statusPill(status: string): CSSProperties {
  const s = String(status || "").toLowerCase();

  let bg = "rgba(148,163,184,0.16)";
  let color = "#cbd5e1";
  let border = "rgba(148,163,184,0.25)";

  if (s === "present") {
    bg = "rgba(34,197,94,0.16)";
    color = "#bbf7d0";
    border = "rgba(34,197,94,0.25)";
  } else if (s === "absent") {
    bg = "rgba(239,68,68,0.16)";
    color = "#fecaca";
    border = "rgba(239,68,68,0.25)";
  } else if (s === "late") {
    bg = "rgba(245,158,11,0.16)";
    color = "#fde68a";
    border = "rgba(245,158,11,0.25)";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: bg,
    color,
    border: `1px solid ${border}`,
    fontWeight: 800,
    fontSize: 12,
    textTransform: "capitalize",
  };
}

function activityDot(type: "score" | "payment" | "attendance"): CSSProperties {
  const map: Record<string, CSSProperties> = {
    score: { background: "rgba(59,130,246,0.9)" },
    payment: { background: "rgba(34,197,94,0.9)" },
    attendance: { background: "rgba(245,158,11,0.9)" },
  };

  return {
    width: 12,
    height: 12,
    borderRadius: 999,
    flexShrink: 0,
    ...(map[type] || { background: "rgba(148,163,184,0.9)" }),
  };
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
  color: "#f8fafc",
  padding: 24,
  position: "relative",
  overflow: "hidden",
};

const bgGlowOne: CSSProperties = {
  position: "absolute",
  top: -120,
  right: -100,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)",
  pointerEvents: "none",
};

const bgGlowTwo: CSSProperties = {
  position: "absolute",
  bottom: -160,
  left: -120,
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,0.16), transparent 70%)",
  pointerEvents: "none",
};

const page: CSSProperties = {
  maxWidth: 1450,
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

const premiumStatsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const premiumInsightsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 18,
};

const premiumInsightCard: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  backdropFilter: "blur(10px)",
  padding: 16,
};

const premiumInsightTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#fff",
};

const premiumInsightSub: CSSProperties = {
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

const chipWrap: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const layout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "340px 1fr",
  gap: 16,
  alignItems: "start",
};

const leftPanel: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.72)",
  overflow: "hidden",
  backdropFilter: "blur(10px)",
  position: "sticky",
  top: 24,
};

const rightPanel: CSSProperties = {
  display: "grid",
  gap: 16,
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

const panelBody: CSSProperties = {
  padding: 16,
};

const toolbar: CSSProperties = {
  padding: 12,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "grid",
  gap: 10,
};

const searchInput: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  outline: "none",
};

const listWrap: CSSProperties = {
  maxHeight: "70vh",
  overflow: "auto",
  padding: 10,
};

const studentRow: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.03)",
  color: "#fff",
  marginBottom: 10,
  cursor: "pointer",
};

const activeStudentRow: CSSProperties = {
  background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(168,85,247,0.12))",
  border: "1px solid rgba(96,165,250,0.28)",
};

const studentAvatar: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 999,
  background: "rgba(96,165,250,0.18)",
  border: "1px solid rgba(96,165,250,0.26)",
  display: "grid",
  placeItems: "center",
  fontWeight: 900,
  flexShrink: 0,
  overflow: "hidden",
};

const avatarImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const studentName: CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
};

const studentMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const detailHero: CSSProperties = {
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const detailHeroLeft: CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
};

const bigAvatar: CSSProperties = {
  width: 78,
  height: 78,
  borderRadius: 22,
  background: "rgba(96,165,250,0.18)",
  border: "1px solid rgba(96,165,250,0.26)",
  display: "grid",
  placeItems: "center",
  fontSize: 24,
  fontWeight: 900,
  overflow: "hidden",
  flexShrink: 0,
};

const bigAvatarImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const detailName: CSSProperties = {
  fontSize: 26,
  fontWeight: 950,
};

const detailMeta: CSSProperties = {
  marginTop: 6,
  color: "#cbd5e1",
  fontSize: 14,
};

const detailActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const detailStatsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const sectionGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const infoItem: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 12,
};

const infoLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const infoValue: CSSProperties = {
  marginTop: 6,
  fontSize: 15,
  color: "#fff",
  fontWeight: 700,
  lineHeight: 1.45,
};

const miniSectionTitle: CSSProperties = {
  marginTop: 18,
  marginBottom: 10,
  fontSize: 14,
  fontWeight: 900,
  color: "#e2e8f0",
};

const miniInsightRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 14,
};

const miniInsightCard: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
};

const miniInsightLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
  textTransform: "uppercase",
};

const miniInsightValue: CSSProperties = {
  marginTop: 8,
  color: "#fff",
  fontWeight: 900,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  marginTop: 12,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#94a3b8",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  textTransform: "uppercase",
  letterSpacing: 0.6,
};

const td: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  color: "#e5e7eb",
  fontSize: 14,
};

const emptyState: CSSProperties = {
  padding: 20,
  color: "#cbd5e1",
};

const emptyInline: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14,
};

const statCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(8px)",
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
  color: "#fff",
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

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const createIntroCard: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(96,165,250,0.08)",
  marginBottom: 14,
};

const createIntroTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#dbeafe",
  marginBottom: 6,
};

const createIntroText: CSSProperties = {
  fontSize: 13,
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.72)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
};

const modalCard: CSSProperties = {
  width: "min(1000px, 100%)",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0f172a",
  boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
  overflow: "hidden",
};

const modalHeader: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const modalTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#fff",
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

const btnDanger: CSSProperties = {
  padding: "11px 15px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
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

const errorAlert: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.22)",
  background: "rgba(127,29,29,0.24)",
  color: "#fecaca",
};

const successAlert: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(34,197,94,0.22)",
  background: "rgba(20,83,45,0.24)",
  color: "#bbf7d0",
};

const activityFeed: CSSProperties = {
  display: "grid",
  gap: 12,
};

const activityRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const activityTitle: CSSProperties = {
  fontWeight: 800,
  color: "#fff",
};

const activityMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#94a3b8",
};