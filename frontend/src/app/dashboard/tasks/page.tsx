"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Audience = "all" | "admin" | "teacher" | "parent" | "student";
type TaskStatus = "Pending" | "In Progress" | "Done";
type AssigneeType = "teacher" | "student" | "";

type Task = {
  id: number;
  title: string;
  description?: string | null;
  due_date: string;
  status: TaskStatus;
  audience: string;
  assignee_type?: string | null;
  assignee_id?: number | null;
  created_by?: string | null;
};

type Student = {
  id: number;
  name: string;
  grade: number;
};

type UserRow = {
  id: number;
  username?: string;
  email?: string | null;
  role?: string;
};

type TaskForm = {
  title: string;
  description: string;
  due_date: string;
  status: TaskStatus;
  audience: Audience;
  assignee_type: AssigneeType;
  assignee_id: string;
  created_by: string;
};

const emptyForm: TaskForm = {
  title: "",
  description: "",
  due_date: todayISO(),
  status: "Pending",
  audience: "all",
  assignee_type: "",
  assignee_id: "",
  created_by: "",
};

const STATUS_OPTIONS: TaskStatus[] = ["Pending", "In Progress", "Done"];
const AUDIENCE_OPTIONS: Audience[] = ["all", "admin", "teacher", "parent", "student"];

export default function TasksPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [assigneeTypeFilter, setAssigneeTypeFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<"all" | "today" | "overdue" | "upcoming">("all");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const [tasksRes, studentsRes, usersRes] = await Promise.allSettled([
        api.get("/tasks"),
        api.get("/students"),
        api.get("/admin/users"),
      ]);

      const loadedTasks =
        tasksRes.status === "fulfilled" && Array.isArray(tasksRes.value.data)
          ? (tasksRes.value.data as Task[])
          : [];

      const loadedStudents =
        studentsRes.status === "fulfilled" && Array.isArray(studentsRes.value.data)
          ? (studentsRes.value.data as Student[])
          : [];

      const loadedUsers =
        usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data)
          ? (usersRes.value.data as UserRow[])
          : [];

      setTasks(loadedTasks);
      setStudents(loadedStudents);
      setUsers(loadedUsers);

      if (tasksRes.status === "rejected" && studentsRes.status === "rejected") {
        throw new Error("Failed to load tasks and supporting data.");
      }
    } catch (e: unknown) {
      setErr(extractErr(e, "Failed to load tasks."));
      setTasks([]);
      setStudents([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const teachers = useMemo(
    () => users.filter((u) => (u.role || "").toLowerCase() === "teacher" || (u.role || "").toLowerCase() === "admin"),
    [users]
  );

  const studentMap = useMemo(() => {
    const map = new Map<number, Student>();
    students.forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [students]);

  const teacherMap = useMemo(() => {
    const map = new Map<number, UserRow>();
    teachers.forEach((t) => map.set(Number(t.id), t));
    return map;
  }, [teachers]);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((task) => {
      const assigneeLabel =
        task.assignee_type === "student"
          ? studentMap.get(Number(task.assignee_id))?.name || ""
          : task.assignee_type === "teacher"
            ? teacherMap.get(Number(task.assignee_id))?.username ||
              teacherMap.get(Number(task.assignee_id))?.email ||
              ""
            : "";

      const matchesQuery =
        !needle ||
        task.title.toLowerCase().includes(needle) ||
        String(task.description || "").toLowerCase().includes(needle) ||
        String(task.created_by || "").toLowerCase().includes(needle) ||
        assigneeLabel.toLowerCase().includes(needle);

      const matchesStatus = !statusFilter || task.status === statusFilter;
      const matchesAudience = !audienceFilter || task.audience === audienceFilter;
      const matchesAssigneeType = !assigneeTypeFilter || task.assignee_type === assigneeTypeFilter;

      let matchesDue = true;
      const due = parseSafeDate(task.due_date);

      if (dueFilter !== "all" && due) {
        const dueDay = new Date(due);
        dueDay.setHours(0, 0, 0, 0);

        if (dueFilter === "today") matchesDue = dueDay.getTime() === today.getTime();
        if (dueFilter === "overdue") matchesDue = dueDay.getTime() < today.getTime() && task.status !== "Done";
        if (dueFilter === "upcoming") matchesDue = dueDay.getTime() > today.getTime();
      }

      return matchesQuery && matchesStatus && matchesAudience && matchesAssigneeType && matchesDue;
    });
  }, [tasks, query, statusFilter, audienceFilter, assigneeTypeFilter, dueFilter, studentMap, teacherMap]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const pending = filteredTasks.filter((t) => t.status === "Pending").length;
    const inProgress = filteredTasks.filter((t) => t.status === "In Progress").length;
    const done = filteredTasks.filter((t) => t.status === "Done").length;
    const overdue = filteredTasks.filter((t) => isOverdue(t)).length;

    return { total, pending, inProgress, done, overdue };
  }, [filteredTasks]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(task: Task) {
    setMode("edit");
    setEditing(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : todayISO(),
      status: normalizeStatus(task.status),
      audience: normalizeAudience(task.audience),
      assignee_type: normalizeAssigneeType(task.assignee_type),
      assignee_id: task.assignee_id ? String(task.assignee_id) : "",
      created_by: task.created_by || "",
    });
    setFormError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  function validateForm(f: TaskForm): string | null {
    if (!f.title.trim()) return "Title is required.";
    if (!f.due_date) return "Due date is required.";
    if (f.assignee_type && !f.assignee_id) return "Please choose an assignee.";
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
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date,
      status: form.status,
      audience: form.audience,
      assignee_type: form.assignee_type || null,
      assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      created_by: form.created_by.trim() || null,
    };

    setBusy(true);

    try {
      if (mode === "create") {
        const res = await api.post("/tasks", payload);
        const created = res?.data as Task | undefined;

        if (created?.id) {
          setTasks((prev) => [created, ...prev]);
        } else {
          await loadAll();
        }
      } else {
        if (!editing?.id) throw new Error("No task selected.");

        const res = await api.put(`/tasks/${editing.id}`, payload);
        const updated = res?.data as Task | undefined;

        if (updated?.id) {
          setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        } else {
          await loadAll();
        }
      }

      setOpen(false);
    } catch (e: unknown) {
      setFormError(extractErr(e, "Failed to save task."));
    } finally {
      setBusy(false);
    }
  }

  async function removeTask(task: Task) {
    const ok = window.confirm(`Delete "${task.title}"?`);
    if (!ok) return;

    setBusy(true);
    setErr(null);

    const previous = tasks;
    setTasks((curr) => curr.filter((x) => x.id !== task.id));

    try {
      await api.delete(`/tasks/${task.id}`);
    } catch (e: unknown) {
      setTasks(previous);
      setErr(extractErr(e, "Failed to delete task."));
    } finally {
      setBusy(false);
    }
  }

  async function quickStatusUpdate(task: Task, nextStatus: TaskStatus) {
    const previous = tasks;
    setTasks((curr) => curr.map((x) => (x.id === task.id ? { ...x, status: nextStatus } : x)));

    try {
      await api.put(`/tasks/${task.id}`, { status: nextStatus });
    } catch (e: unknown) {
      setTasks(previous);
      setErr(extractErr(e, "Failed to update task status."));
    }
  }

  const formAssignees = useMemo(() => {
    if (form.assignee_type === "student") return students;
    if (form.assignee_type === "teacher") return teachers;
    return [];
  }, [form.assignee_type, students, teachers]);

  return (
    <div style={pageShell}>
      <div style={page}>
        <section style={hero}>
          <div>
            <div style={eyebrow}>Workflows & Follow-Up</div>
            <h1 style={heroTitle}>Tasks</h1>
            <p style={heroText}>
              Create work items, assign them to teachers or students, track progress,
              and keep your school operations moving.
            </p>
          </div>

          <div style={heroActions}>
            <button onClick={() => void loadAll()} style={btnSecondary} disabled={loading || busy}>
              Refresh
            </button>
            <button onClick={openCreate} style={btnPrimary} disabled={busy}>
              + New Task
            </button>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard label="Visible Tasks" value={stats.total} accent="blue" />
          <StatCard label="Pending" value={stats.pending} accent="amber" />
          <StatCard label="In Progress" value={stats.inProgress} accent="purple" />
          <StatCard label="Completed" value={stats.done} accent="green" />
          <StatCard label="Overdue" value={stats.overdue} accent="red" />
        </section>

        <section style={toolbar}>
          <div style={toolbarLeft}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, description, assignee, or creator..."
              style={searchInput}
            />

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterInput}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)} style={filterInput}>
              <option value="">All audiences</option>
              {AUDIENCE_OPTIONS.map((aud) => (
                <option key={aud} value={aud}>
                  {labelAudience(aud)}
                </option>
              ))}
            </select>

            <select
              value={assigneeTypeFilter}
              onChange={(e) => setAssigneeTypeFilter(e.target.value)}
              style={filterInput}
            >
              <option value="">All assignees</option>
              <option value="teacher">Teachers</option>
              <option value="student">Students</option>
            </select>

            <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as typeof dueFilter)} style={filterInput}>
              <option value="all">All due dates</option>
              <option value="today">Due today</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>

          <div style={toolbarRight}>
            <button
              style={btnGhost}
              onClick={() => {
                setQuery("");
                setStatusFilter("");
                setAudienceFilter("");
                setAssigneeTypeFilter("");
                setDueFilter("all");
              }}
              disabled={busy}
            >
              Clear Filters
            </button>
          </div>
        </section>

        {err && (
          <div style={alertBox}>
            <strong style={{ marginRight: 8 }}>Error:</strong>
            {err}
          </div>
        )}

        <section style={panel}>
          <div style={panelHeader}>
            <div>
              <div style={panelTitle}>Task Board</div>
              <div style={panelSub}>
                {loading ? "Loading tasks..." : `${filteredTasks.length} task(s) shown`}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={emptyState}>Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div style={emptyState}>No tasks found for the current filters.</div>
          ) : (
            <div style={taskGrid}>
              {filteredTasks
                .slice()
                .sort((a, b) => {
                  const aDone = a.status === "Done" ? 1 : 0;
                  const bDone = b.status === "Done" ? 1 : 0;
                  if (aDone !== bDone) return aDone - bDone;
                  return String(a.due_date).localeCompare(String(b.due_date));
                })
                .map((task) => {
                  const totalState = statusTone(task.status, isOverdue(task));
                  const assignee = getAssigneeLabel(task, studentMap, teacherMap);

                  return (
                    <article key={task.id} style={taskCard(totalState.border)}>
                      <div style={taskTopRow}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={statusPill(totalState)}>{task.status}</span>
                          <span style={audiencePill}>{labelAudience(task.audience)}</span>
                          {task.assignee_type ? (
                            <span style={assigneePill}>
                              {task.assignee_type === "teacher" ? "Teacher" : "Student"}: {assignee}
                            </span>
                          ) : null}
                          {isOverdue(task) ? <span style={overduePill}>Overdue</span> : null}
                        </div>

                        <div style={tinyMuted}>#{task.id}</div>
                      </div>

                      <h3 style={taskTitle}>{task.title}</h3>

                      <div style={taskDescription}>
                        {task.description?.trim() || "No description provided."}
                      </div>

                      <div style={metaGrid}>
                        <Meta label="Due" value={formatDate(task.due_date)} />
                        <Meta label="Creator" value={task.created_by || "—"} />
                        <Meta label="Assignee" value={assignee || "Unassigned"} />
                        <Meta label="Type" value={task.assignee_type ? capitalize(task.assignee_type) : "General"} />
                      </div>

                      <div style={quickActionRow}>
                        <button
                          style={miniSoftBtn}
                          onClick={() => void quickStatusUpdate(task, "Pending")}
                          disabled={busy || task.status === "Pending"}
                        >
                          Mark Pending
                        </button>
                        <button
                          style={miniSoftBtn}
                          onClick={() => void quickStatusUpdate(task, "In Progress")}
                          disabled={busy || task.status === "In Progress"}
                        >
                          Start
                        </button>
                        <button
                          style={miniDoneBtn}
                          onClick={() => void quickStatusUpdate(task, "Done")}
                          disabled={busy || task.status === "Done"}
                        >
                          Complete
                        </button>
                      </div>

                      <div style={cardActions}>
                        <button style={miniButton} onClick={() => openEdit(task)} disabled={busy}>
                          Edit
                        </button>
                        <button style={miniDanger} onClick={() => void removeTask(task)} disabled={busy}>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </section>

        {open && (
          <Modal title={mode === "create" ? "Create Task" : "Edit Task"} onClose={closeModal}>
            {formError && <div style={{ ...alertBox, marginTop: 0 }}>{formError}</div>}

            <div style={modalGrid}>
              <Field label="Title" full>
                <input
                  style={fieldInput}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Upload term timetable"
                />
              </Field>

              <Field label="Due Date">
                <input
                  type="date"
                  style={fieldInput}
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </Field>

              <Field label="Status">
                <select
                  style={fieldInput}
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Audience">
                <select
                  style={fieldInput}
                  value={form.audience}
                  onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value as Audience }))}
                >
                  {AUDIENCE_OPTIONS.map((aud) => (
                    <option key={aud} value={aud}>
                      {labelAudience(aud)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Assign To">
                <select
                  style={fieldInput}
                  value={form.assignee_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      assignee_type: e.target.value as AssigneeType,
                      assignee_id: "",
                    }))
                  }
                >
                  <option value="">No assignee</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>
              </Field>

              <Field label="Assignee">
                <select
                  style={fieldInput}
                  value={form.assignee_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignee_id: e.target.value }))}
                  disabled={!form.assignee_type}
                >
                  <option value="">Select assignee</option>
                  {form.assignee_type === "student"
                    ? (formAssignees as Student[]).map((student) => (
                        <option key={student.id} value={String(student.id)}>
                          {student.name} — Grade {student.grade}
                        </option>
                      ))
                    : (formAssignees as UserRow[]).map((teacher) => (
                        <option key={teacher.id} value={String(teacher.id)}>
                          {teacher.username || teacher.email || `User #${teacher.id}`}
                        </option>
                      ))}
                </select>
              </Field>

              <Field label="Created By">
                <input
                  style={fieldInput}
                  value={form.created_by}
                  onChange={(e) => setForm((prev) => ({ ...prev, created_by: e.target.value }))}
                  placeholder="e.g. Admin Office"
                />
              </Field>

              <Field label="Description" full>
                <textarea
                  style={{ ...fieldInput, minHeight: 140, resize: "vertical" }}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add more details for this task..."
                />
              </Field>

              <Field label="Live Task Preview" full>
                <div style={previewCard}>
                  <div style={previewTop}>
                    <span style={statusPill(statusTone(form.status, isDateOverdue(form.due_date) && form.status !== "Done"))}>
                      {form.status}
                    </span>
                    <span style={audiencePill}>{labelAudience(form.audience)}</span>
                    {form.assignee_type ? (
                      <span style={assigneePill}>
                        {capitalize(form.assignee_type)} assigned
                      </span>
                    ) : null}
                  </div>

                  <div style={previewTitle}>{form.title || "Task title preview"}</div>
                  <div style={previewText}>
                    {form.description || "Task description preview will appear here."}
                  </div>

                  <div style={previewMeta}>
                    <span>Due: {form.due_date || "—"}</span>
                    <span>Created by: {form.created_by || "—"}</span>
                    <span>
                      Assignee:{" "}
                      {form.assignee_type && form.assignee_id
                        ? getFormAssigneeLabel(form, students, teachers)
                        : "Unassigned"}
                    </span>
                  </div>
                </div>
              </Field>
            </div>

            <div style={modalActions}>
              <button style={btnSecondary} onClick={closeModal} disabled={busy}>
                Cancel
              </button>
              <button style={btnPrimary} onClick={() => void submit()} disabled={busy}>
                {busy ? "Saving..." : mode === "create" ? "Save Task" : "Update Task"}
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
  accent,
}: {
  label: string;
  value: number;
  accent: "blue" | "amber" | "purple" | "green" | "red";
}) {
  const accentMap: Record<string, string> = {
    blue: "rgba(96,165,250,0.35)",
    amber: "rgba(245,158,11,0.35)",
    purple: "rgba(168,85,247,0.35)",
    green: "rgba(34,197,94,0.35)",
    red: "rgba(239,68,68,0.35)",
  };

  return (
    <div style={{ ...statCard, boxShadow: `inset 0 0 0 1px ${accentMap[accent]}` }}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaBox}>
      <div style={metaLabel}>{label}</div>
      <div style={metaValue}>{value}</div>
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
        background: "rgba(2,6,23,0.76)",
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

function normalizeStatus(value: string): TaskStatus {
  if (value === "Done" || value === "In Progress") return value;
  return "Pending";
}

function normalizeAudience(value: string): Audience {
  if (value === "admin" || value === "teacher" || value === "parent" || value === "student") return value;
  return "all";
}

function normalizeAssigneeType(value?: string | null): AssigneeType {
  if (value === "teacher" || value === "student") return value;
  return "";
}

function parseSafeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function labelAudience(value?: string | null) {
  const v = String(value || "all");
  if (v === "all") return "All";
  if (v === "admin") return "Admin";
  if (v === "teacher") return "Teachers";
  if (v === "parent") return "Parents";
  if (v === "student") return "Students";
  return v;
}

function isOverdue(task: Task) {
  return isDateOverdue(task.due_date) && task.status !== "Done";
}

function isDateOverdue(dateStr?: string | null) {
  const due = parseSafeDate(dateStr);
  if (!due) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function getAssigneeLabel(
  task: Task,
  studentMap: Map<number, Student>,
  teacherMap: Map<number, UserRow>
) {
  if (task.assignee_type === "student" && task.assignee_id) {
    const student = studentMap.get(Number(task.assignee_id));
    return student ? `${student.name}` : `Student #${task.assignee_id}`;
  }

  if (task.assignee_type === "teacher" && task.assignee_id) {
    const teacher = teacherMap.get(Number(task.assignee_id));
    return teacher?.username || teacher?.email || `Teacher #${task.assignee_id}`;
  }

  return "";
}

function getFormAssigneeLabel(form: TaskForm, students: Student[], teachers: UserRow[]) {
  if (form.assignee_type === "student") {
    const student = students.find((s) => String(s.id) === form.assignee_id);
    return student ? student.name : "Selected student";
  }
  if (form.assignee_type === "teacher") {
    const teacher = teachers.find((t) => String(t.id) === form.assignee_id);
    return teacher?.username || teacher?.email || "Selected teacher";
  }
  return "Unassigned";
}

function statusTone(status: string, overdue: boolean) {
  if (overdue) {
    return {
      bg: "rgba(239,68,68,0.14)",
      text: "#fecaca",
      border: "rgba(239,68,68,0.30)",
    };
  }

  if (status === "Done") {
    return {
      bg: "rgba(34,197,94,0.16)",
      text: "#bbf7d0",
      border: "rgba(34,197,94,0.30)",
    };
  }

  if (status === "In Progress") {
    return {
      bg: "rgba(168,85,247,0.16)",
      text: "#e9d5ff",
      border: "rgba(168,85,247,0.30)",
    };
  }

  return {
    bg: "rgba(245,158,11,0.16)",
    text: "#fde68a",
    border: "rgba(245,158,11,0.30)",
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

const heroText: CSSProperties = {
  marginTop: 8,
  maxWidth: 760,
  color: "#cbd5e1",
  lineHeight: 1.6,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
  marginBottom: 18,
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

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
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

const taskGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
  gap: 14,
  padding: 16,
};

const taskCard = (border: string): CSSProperties => ({
  borderRadius: 16,
  border: `1px solid ${border}`,
  background: "rgba(255,255,255,0.04)",
  padding: 16,
  display: "grid",
  gap: 14,
});

const taskTopRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const taskTitle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#fff",
};

const taskDescription: CSSProperties = {
  color: "#cbd5e1",
  lineHeight: 1.55,
  minHeight: 54,
  whiteSpace: "pre-wrap",
};

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const metaBox: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(15,23,42,0.6)",
  padding: 12,
};

const metaLabel: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 800,
};

const metaValue: CSSProperties = {
  marginTop: 6,
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
};

const quickActionRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const cardActions: CSSProperties = {
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
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const miniSoftBtn: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  fontWeight: 700,
  cursor: "pointer",
};

const miniDoneBtn: CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(34,197,94,0.30)",
  background: "rgba(34,197,94,0.14)",
  color: "#bbf7d0",
  fontWeight: 800,
  cursor: "pointer",
};

const miniDanger: CSSProperties = {
  padding: "9px 12px",
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

const previewCard: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
};

const previewTop: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const previewTitle: CSSProperties = {
  marginTop: 12,
  fontSize: 18,
  fontWeight: 900,
  color: "#fff",
};

const previewText: CSSProperties = {
  marginTop: 8,
  color: "#cbd5e1",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
};

const previewMeta: CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#94a3b8",
  fontSize: 13,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
};

const tinyMuted: CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
};

const audiencePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  background: "rgba(255,255,255,0.06)",
  color: "#e5e7eb",
  border: "1px solid rgba(255,255,255,0.12)",
};

const assigneePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  background: "rgba(59,130,246,0.14)",
  color: "#bfdbfe",
  border: "1px solid rgba(59,130,246,0.25)",
};

const overduePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  background: "rgba(239,68,68,0.14)",
  color: "#fecaca",
  border: "1px solid rgba(239,68,68,0.28)",
};

function statusPill(tone: { bg: string; text: string; border: string }): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    background: tone.bg,
    color: tone.text,
    border: `1px solid ${tone.border}`,
  };
}