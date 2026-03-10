"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Student = {
  id: number;
  name: string;
  grade: number;
  gender?: string | null;
  guardian_name?: string | null;
};

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type QuickFilter = "all" | AttendanceStatus;

type AttendanceRecord = {
  id?: number;
  date: string;
  student_id: number;
  student_name?: string;
  grade?: number;
  status: AttendanceStatus;
  note?: string;
};

type RowState = {
  student_id: number;
  name: string;
  grade: number;
  status: AttendanceStatus;
  note: string;
  originalStatus: AttendanceStatus;
  originalNote: string;
  guardian_name?: string | null;
  gender?: string | null;
};

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused"];

export default function AttendancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);

  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(todayLocalISO());
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [notesOnly, setNotesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "grade" | "status">("name");

  async function loadAll(showRefresh = false) {
    try {
      setError(null);
      setSuccess(null);

      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const studentParams =
        selectedGrade !== "all" ? { grade: Number(selectedGrade) } : undefined;

      const [studentsRes, attendanceRes] = await Promise.all([
        api.get("/students", { params: studentParams }),
        api.get("/attendance", {
          params: {
            date: selectedDate,
            ...(selectedGrade !== "all" ? { grade: Number(selectedGrade) } : {}),
          },
        }),
      ]);

      const studentList: Student[] = Array.isArray(studentsRes.data) ? studentsRes.data : [];
      const attendanceList: AttendanceRecord[] = Array.isArray(attendanceRes.data)
        ? attendanceRes.data
        : [];

      setStudents(studentList);
      setRecords(attendanceList);

      const mapped: RowState[] = studentList.map((student) => {
        const existing = attendanceList.find((r) => r.student_id === student.id);
        const existingStatus = existing?.status || "present";
        const existingNote = existing?.note || "";

        return {
          student_id: student.id,
          name: student.name,
          grade: student.grade,
          status: existingStatus,
          note: existingNote,
          originalStatus: existingStatus,
          originalNote: existingNote,
          guardian_name: student.guardian_name || "",
          gender: student.gender || "",
        };
      });

      setRows(mapped);
    } catch (e: unknown) {
      setError(extractErr(e, "Failed to load attendance data"));
      setStudents([]);
      setRecords([]);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [selectedDate, selectedGrade]);

  const grades = useMemo(() => {
    const unique = Array.from(new Set(students.map((s) => s.grade))).sort((a, b) => a - b);
    return unique;
  }, [students]);

  const stats = useMemo(() => {
    const present = rows.filter((r) => r.status === "present").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    const late = rows.filter((r) => r.status === "late").length;
    const excused = rows.filter((r) => r.status === "excused").length;
    const withNotes = rows.filter((r) => r.note.trim()).length;
    const changed = rows.filter((r) => hasRowChanged(r)).length;

    const total = rows.length;
    const presentPct = total ? Math.round((present / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      late,
      excused,
      withNotes,
      changed,
      presentPct,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    let list = rows.filter((row) => {
      const matchesSearch =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        String(row.grade).includes(needle) ||
        row.status.toLowerCase().includes(needle) ||
        row.note.toLowerCase().includes(needle) ||
        String(row.guardian_name || "").toLowerCase().includes(needle) ||
        String(row.gender || "").toLowerCase().includes(needle);

      const matchesQuickFilter = quickFilter === "all" || row.status === quickFilter;
      const matchesNotes = !notesOnly || Boolean(row.note.trim());

      return matchesSearch && matchesQuickFilter && matchesNotes;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "grade") return a.grade - b.grade || a.name.localeCompare(b.name);
      if (sortBy === "status") return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [rows, search, quickFilter, notesOnly, sortBy]);

  const recentAttendanceSummary = useMemo(() => {
    return [
      { label: "Present rate", value: `${stats.presentPct}%` },
      { label: "Notes added", value: String(stats.withNotes) },
      { label: "Unsaved changes", value: String(stats.changed) },
      { label: "Records loaded", value: String(records.length) },
    ];
  }, [stats, records.length]);

  const hasActiveFilters = Boolean(
    search.trim() || quickFilter !== "all" || notesOnly || sortBy !== "name"
  );

  function updateRow(studentId: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((row) =>
        row.student_id === studentId
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    );
  }

  function markAll(status: AttendanceStatus) {
    setRows((prev) => prev.map((row) => ({ ...row, status })));
  }

  function clearSecondaryFilters() {
    setSearch("");
    setQuickFilter("all");
    setNotesOnly(false);
    setSortBy("name");
  }

  function resetAllChanges() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        status: row.originalStatus,
        note: row.originalNote,
      }))
    );
    setSuccess("Unsaved changes reset.");
    setError(null);
  }

  async function saveAttendance() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = rows.map((row) => ({
        student_id: row.student_id,
        date: selectedDate,
        status: row.status,
        note: row.note.trim(),
      }));

      await api.put("/attendance", payload);

      await loadAll(true);
      setSuccess("Attendance saved successfully.");
    } catch (e: unknown) {
      setError(extractErr(e, "Failed to save attendance"));
    } finally {
      setSaving(false);
    }
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
              <h1 style={heroTitle}>Attendance</h1>
              <p style={subtitle}>
                Track daily attendance, review student presence, flag absences and lateness,
                and save updates in one polished workflow.
              </p>

              <div style={heroMiniStats}>
                <HeroMiniBadge label="Students" value={String(stats.total)} />
                <HeroMiniBadge label="Present rate" value={`${stats.presentPct}%`} />
                <HeroMiniBadge label="Unsaved" value={String(stats.changed)} />
              </div>
            </div>

            <div style={heroActions}>
              <button
                onClick={() => void loadAll(true)}
                style={btnSecondary}
                disabled={loading || refreshing || saving}
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>

              <button
                onClick={resetAllChanges}
                style={btnSecondary}
                disabled={loading || saving || stats.changed === 0}
              >
                Reset Changes
              </button>

              <button onClick={saveAttendance} style={btnPrimary} disabled={loading || saving}>
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Students" value={stats.total} accent="blue" />
          <StatCard label="Present" value={stats.present} accent="green" />
          <StatCard label="Absent" value={stats.absent} accent="red" />
          <StatCard label="Late" value={stats.late} accent="amber" />
          <StatCard label="Excused" value={stats.excused} accent="slate" />
          <StatCard label="Notes" value={stats.withNotes} accent="purple" />
        </section>

        <section style={insightGrid}>
          <div style={insightCard}>
            <div style={insightTitle}>Today’s Snapshot</div>
            <div style={insightSub}>Quick visibility into the register before you save.</div>

            <div style={snapshotGrid}>
              {recentAttendanceSummary.map((item) => (
                <div key={item.label} style={snapshotCard}>
                  <div style={snapshotLabel}>{item.label}</div>
                  <div style={snapshotValue}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={insightCard}>
            <div style={insightTitle}>Bulk Actions</div>
            <div style={insightSub}>Speed through the register with one-click updates.</div>

            <div style={bulkGrid}>
              <button style={bulkBtn} onClick={() => markAll("present")} disabled={saving}>
                ✅ Mark all present
              </button>
              <button style={bulkBtn} onClick={() => markAll("absent")} disabled={saving}>
                ❌ Mark all absent
              </button>
              <button style={bulkBtn} onClick={() => markAll("late")} disabled={saving}>
                ⏰ Mark all late
              </button>
              <button style={bulkBtn} onClick={() => markAll("excused")} disabled={saving}>
                📝 Mark all excused
              </button>
            </div>
          </div>
        </section>

        <section style={toolbar}>
          <div style={toolbarLeft}>
            <div style={fieldBlock}>
              <label style={fieldLabel}>Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={fieldInput}
              />
            </div>

            <div style={fieldBlock}>
              <label style={fieldLabel}>Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                style={fieldInput}
              >
                <option value="all">All Grades</option>
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ ...fieldBlock, minWidth: 260 }}>
              <label style={fieldLabel}>Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, status, guardian..."
                style={fieldInput}
              />
            </div>

            <div style={fieldBlock}>
              <label style={fieldLabel}>Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "grade" | "status")}
                style={fieldInput}
              >
                <option value="name">Name</option>
                <option value="grade">Grade</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <div style={toolbarRight}>
            <FilterChip
              active={quickFilter === "all"}
              onClick={() => setQuickFilter("all")}
              label="All"
            />
            <FilterChip
              active={quickFilter === "present"}
              onClick={() => setQuickFilter("present")}
              label="Present"
            />
            <FilterChip
              active={quickFilter === "absent"}
              onClick={() => setQuickFilter("absent")}
              label="Absent"
            />
            <FilterChip
              active={quickFilter === "late"}
              onClick={() => setQuickFilter("late")}
              label="Late"
            />
            <FilterChip
              active={quickFilter === "excused"}
              onClick={() => setQuickFilter("excused")}
              label="Excused"
            />
            <FilterChip
              active={notesOnly}
              onClick={() => setNotesOnly((v) => !v)}
              label={notesOnly ? "Notes only ✓" : "Notes only"}
            />
            <button style={smallActionBtn} onClick={clearSecondaryFilters} disabled={saving}>
              Clear
            </button>
          </div>
        </section>

        {hasActiveFilters && (
          <div style={chipBar}>
            {search.trim() ? (
              <ActiveChip label={`Search: ${search.trim()}`} onRemove={() => setSearch("")} />
            ) : null}
            {quickFilter !== "all" ? (
              <ActiveChip label={`Status: ${capitalize(quickFilter)}`} onRemove={() => setQuickFilter("all")} />
            ) : null}
            {notesOnly ? (
              <ActiveChip label="Notes only" onRemove={() => setNotesOnly(false)} />
            ) : null}
            {sortBy !== "name" ? (
              <ActiveChip label={`Sort: ${capitalize(sortBy)}`} onRemove={() => setSortBy("name")} />
            ) : null}
          </div>
        )}

        {error && (
          <div style={alertBox}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {error}
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
            <div style={panelHeaderTop}>
              <div>
                <div style={panelTitle}>Daily Attendance Register</div>
                <div style={panelSubtitle}>
                  {loading
                    ? "Loading attendance..."
                    : `${filteredRows.length} student(s) shown for ${selectedDate}`}
                </div>
              </div>

              <div style={resultPill}>
                {stats.changed} unsaved
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>
              <div style={emptyStateTitle}>Loading attendance...</div>
              <div style={emptyStateText}>Please wait while student records are prepared.</div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div style={emptyState}>
              <div style={emptyStateIcon}>🗂️</div>
              <div style={emptyStateTitle}>No students found</div>
              <div style={emptyStateText}>
                Try another grade filter, clear the search, or add students first.
              </div>
            </div>
          ) : (
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Student</th>
                    <th style={th}>Grade</th>
                    <th style={th}>Status</th>
                    <th style={th}>Quick Actions</th>
                    <th style={th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const changed = hasRowChanged(row);
                    return (
                      <tr
                        key={row.student_id}
                        style={{
                          ...tr,
                          ...(changed ? changedRow : {}),
                        }}
                      >
                        <td style={td}>
                          <div style={studentCell}>
                            <div style={studentAvatar}>{initials(row.name)}</div>
                            <div>
                              <div style={studentNameRow}>
                                <div style={studentName}>{row.name}</div>
                                {changed ? <span style={editedBadge}>Edited</span> : null}
                              </div>
                              <div style={studentMeta}>
                                ID: {row.student_id}
                                {row.guardian_name ? ` • Guardian: ${row.guardian_name}` : ""}
                                {row.gender ? ` • ${capitalize(String(row.gender).toLowerCase())}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={td}>
                          <span style={gradeBadge}>Grade {row.grade}</span>
                        </td>

                        <td style={td}>
                          <select
                            value={row.status}
                            onChange={(e) =>
                              updateRow(row.student_id, {
                                status: e.target.value as AttendanceStatus,
                              })
                            }
                            style={{
                              ...statusSelect,
                              ...statusStyle(row.status),
                            }}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {capitalize(status)}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={td}>
                          <div style={quickActionWrap}>
                            <button
                              style={{ ...quickStatusBtn, ...quickStatusBtnActive("present", row.status) }}
                              onClick={() => updateRow(row.student_id, { status: "present" })}
                            >
                              Present
                            </button>
                            <button
                              style={{ ...quickStatusBtn, ...quickStatusBtnActive("absent", row.status) }}
                              onClick={() => updateRow(row.student_id, { status: "absent" })}
                            >
                              Absent
                            </button>
                            <button
                              style={{ ...quickStatusBtn, ...quickStatusBtnActive("late", row.status) }}
                              onClick={() => updateRow(row.student_id, { status: "late" })}
                            >
                              Late
                            </button>
                            <button
                              style={{ ...quickStatusBtn, ...quickStatusBtnActive("excused", row.status) }}
                              onClick={() => updateRow(row.student_id, { status: "excused" })}
                            >
                              Excused
                            </button>
                          </div>
                        </td>

                        <td style={td}>
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateRow(row.student_id, { note: e.target.value })}
                            placeholder="Add note..."
                            style={noteInput}
                          />
                        </td>
                      </tr>
                    );
                  })}
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
  accent,
}: {
  label: string;
  value: number;
  accent: "blue" | "green" | "red" | "amber" | "slate" | "purple";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(59,130,246,0.22)",
    green: "rgba(34,197,94,0.22)",
    red: "rgba(239,68,68,0.20)",
    amber: "rgba(245,158,11,0.22)",
    slate: "rgba(148,163,184,0.18)",
    purple: "rgba(168,85,247,0.22)",
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

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div style={activeChip}>
      <span>{label}</span>
      <button onClick={onRemove} style={activeChipBtn}>
        ✕
      </button>
    </div>
  );
}

function todayLocalISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function hasRowChanged(row: RowState) {
  return row.status !== row.originalStatus || row.note.trim() !== row.originalNote.trim();
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

function statusStyle(status: AttendanceStatus): CSSProperties {
  if (status === "present") {
    return {
      background: "rgba(34,197,94,0.18)",
      border: "1px solid rgba(34,197,94,0.35)",
      color: "#dcfce7",
    };
  }
  if (status === "absent") {
    return {
      background: "rgba(239,68,68,0.16)",
      border: "1px solid rgba(239,68,68,0.35)",
      color: "#fee2e2",
    };
  }
  if (status === "late") {
    return {
      background: "rgba(245,158,11,0.18)",
      border: "1px solid rgba(245,158,11,0.35)",
      color: "#fef3c7",
    };
  }
  return {
    background: "rgba(148,163,184,0.16)",
    border: "1px solid rgba(148,163,184,0.32)",
    color: "#e2e8f0",
  };
}

function quickStatusBtnActive(
  target: AttendanceStatus,
  current: AttendanceStatus
): CSSProperties {
  if (target !== current) return {};

  return {
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(255,255,255,0.9)",
  };
}

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top right, rgba(59,130,246,0.14), transparent 35%), radial-gradient(circle at top left, rgba(16,185,129,0.10), transparent 30%), linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
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
  width: 250,
  height: 250,
  borderRadius: "50%",
  background: "rgba(59,130,246,0.18)",
  filter: "blur(42px)",
  top: -70,
  right: -30,
};

const heroGlowB: CSSProperties = {
  position: "absolute",
  width: 230,
  height: 230,
  borderRadius: "50%",
  background: "rgba(16,185,129,0.12)",
  filter: "blur(44px)",
  bottom: -70,
  left: -40,
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

const heroMiniStats: CSSProperties = {
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const insightGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 18,
};

const insightCard: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(15,23,42,0.62)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
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

const snapshotGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 14,
};

const snapshotCard: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const snapshotLabel: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  fontWeight: 800,
};

const snapshotValue: CSSProperties = {
  marginTop: 8,
  fontSize: 22,
  color: "#fff",
  fontWeight: 900,
};

const bulkGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const bulkBtn: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
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

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 8,
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

const smallActionBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
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

const chipBar: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 16,
};

const activeChip: CSSProperties = {
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

const activeChipBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const alertBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,0.35)",
  background: "rgba(239,68,68,0.12)",
  color: "#fee2e2",
};

const successBox: CSSProperties = {
  marginBottom: 16,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(34,197,94,0.28)",
  background: "rgba(34,197,94,0.12)",
  color: "#dcfce7",
};

const panel: CSSProperties = {
  marginTop: 16,
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

const panelHeaderTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
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

const resultPill: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 800,
};

const emptyState: CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#cbd5e1",
};

const emptyStateIcon: CSSProperties = {
  fontSize: 34,
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

const tableWrap: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1180,
};

const th: CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 900,
  padding: "14px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
};

const tr: CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const changedRow: CSSProperties = {
  background: "rgba(96,165,250,0.05)",
};

const td: CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "top",
};

const studentCell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const studentAvatar: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, rgba(59,130,246,0.8), rgba(37,99,235,0.8))",
  color: "#fff",
  fontWeight: 900,
  fontSize: 13,
};

const studentNameRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const editedBadge: CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(168,85,247,0.16)",
  color: "#e9d5ff",
  border: "1px solid rgba(168,85,247,0.24)",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};

const studentName: CSSProperties = {
  fontWeight: 800,
  color: "#ffffff",
};

const studentMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#94a3b8",
};

const gradeBadge: CSSProperties = {
  display: "inline-block",
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(148,163,184,0.14)",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 800,
};

const statusSelect: CSSProperties = {
  minWidth: 130,
  padding: "10px 12px",
  borderRadius: 12,
  outline: "none",
  fontWeight: 800,
};

const quickActionWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const quickStatusBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "#e2e8f0",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
};

const noteInput: CSSProperties = {
  width: "100%",
  minWidth: 220,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.82)",
  color: "#fff",
  outline: "none",
};