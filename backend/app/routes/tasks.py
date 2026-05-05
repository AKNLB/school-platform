from flask import Blueprint, request, jsonify

from app.audit import log_audit
import app.bridge as bridge
from app.decorators import (
    ROLE_ADMIN,
    ROLE_TEACHER,
    ROLE_PARENT,
    ROLE_STUDENT,
    current_school_id,
    roles_required,
    school_context_required,
)

tasks_bp = Blueprint("tasks_bp", __name__)


def _task_to_dict(t):
    if hasattr(t, "to_dict") and callable(t.to_dict):
        return t.to_dict()

    return {
        "id": t.id,
        "title": getattr(t, "title", ""),
        "description": getattr(t, "description", ""),
        "status": getattr(t, "status", ""),
        "priority": getattr(t, "priority", ""),
        "due_date": t.due_date.isoformat() if getattr(t, "due_date", None) else None,
        "assigned_to_user_id": getattr(t, "assigned_to_user_id", None),
        "created_by_user_id": getattr(t, "created_by_user_id", None),
        "created_at": t.created_at.isoformat() if getattr(t, "created_at", None) else None,
    }


def _normalize_status(value: str) -> str:
    v = (value or "").strip().lower()
    mapping = {
        "todo": "todo",
        "to-do": "todo",
        "pending": "todo",
        "inprogress": "in_progress",
        "in_progress": "in_progress",
        "in progress": "in_progress",
        "doing": "in_progress",
        "done": "done",
        "completed": "done",
    }
    return mapping.get(v, "")


def _normalize_priority(value: str) -> str:
    v = (value or "").strip().lower()
    mapping = {
        "low": "low",
        "medium": "medium",
        "normal": "medium",
        "high": "high",
        "urgent": "high",
    }
    return mapping.get(v, "")


@tasks_bp.route("/api/s/<slug>/tasks", methods=["GET", "POST"])
@tasks_bp.route("/api/tasks", methods=["GET", "POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def api_tasks(slug=None):
    Task = bridge.Task
    db = bridge.db

    if request.method == "GET":
        status = _normalize_status(request.args.get("status") or "")
        priority = _normalize_priority(request.args.get("priority") or "")
        q = (request.args.get("q") or "").strip().lower()

        qs = Task.query.filter_by(school_id=current_school_id())

        if status:
            qs = qs.filter(Task.status == status)
        if priority:
            qs = qs.filter(Task.priority == priority)

        rows = qs.order_by(Task.id.desc()).all()

        if q:
            rows = [
                t for t in rows
                if q in (getattr(t, "title", "") or "").lower()
                or q in (getattr(t, "description", "") or "").lower()
            ]

        return jsonify([_task_to_dict(t) for t in rows]), 200

    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or data.get("body") or "").strip()
    status = _normalize_status(data.get("status") or "todo") or "todo"
    priority = _normalize_priority(data.get("priority") or "medium") or "medium"
    due_date_raw = data.get("due_date")

    if not title:
        return jsonify({"error": "title is required"}), 400

    due_date = None
    if due_date_raw:
        try:
            due_date = bridge.parse_date(str(due_date_raw))
        except Exception:
            return jsonify({"error": "Invalid due_date"}), 400

    current_user = getattr(bridge, "current_user", None)
    user = current_user() if callable(current_user) else None

    kwargs = {
        "school_id": current_school_id(),
        "title": title,
        "description": description,
    }

    if hasattr(Task, "status"):
        kwargs["status"] = status

    if hasattr(Task, "priority"):
        kwargs["priority"] = priority

    if hasattr(Task, "created_by_user_id"):
        kwargs["created_by_user_id"] = getattr(user, "id", None)

    if hasattr(Task, "assigned_to_user_id") and data.get("assigned_to_user_id") not in (None, ""):
        try:
            kwargs["assigned_to_user_id"] = int(data.get("assigned_to_user_id"))
        except Exception:
            return jsonify({"error": "assigned_to_user_id must be an integer"}), 400

    if hasattr(Task, "due_date"):
        kwargs["due_date"] = due_date

    t = Task(**kwargs)
    db.session.add(t)
    db.session.commit()

    log_audit(
        module="tasks",
        action="create",
        entity_type="task",
        entity_id=t.id,
        entity_label=t.title,
        details={
            "status": getattr(t, "status", None),
            "priority": getattr(t, "priority", None),
            "assigned_to_user_id": getattr(t, "assigned_to_user_id", None),
            "due_date": t.due_date.isoformat() if getattr(t, "due_date", None) else None,
        },
    )

    return jsonify(_task_to_dict(t)), 201


@tasks_bp.route("/api/s/<slug>/tasks/<int:tid>", methods=["PUT", "DELETE"])
@tasks_bp.route("/api/tasks/<int:tid>", methods=["PUT", "DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def api_task_modify(tid, slug=None):
    Task = bridge.Task
    db = bridge.db

    t = Task.query.filter_by(
        id=tid,
        school_id=current_school_id()
    ).first()

    if not t:
        return jsonify({"error": "Task not found"}), 404

    if request.method == "DELETE":
        task_title = getattr(t, "title", "")
        task_status = getattr(t, "status", "")
        task_priority = getattr(t, "priority", "")
        task_due_date = t.due_date.isoformat() if getattr(t, "due_date", None) else None

        db.session.delete(t)
        db.session.commit()

        log_audit(
            module="tasks",
            action="delete",
            entity_type="task",
            entity_id=tid,
            entity_label=task_title,
            details={
                "status": task_status,
                "priority": task_priority,
                "due_date": task_due_date,
            },
        )

        return jsonify({"message": "Task deleted"}), 200

    data = request.get_json(silent=True) or {}

    if "title" in data:
        new_title = (data.get("title") or "").strip()
        if not new_title:
            return jsonify({"error": "title cannot be empty"}), 400
        t.title = new_title

    if "description" in data or "body" in data:
        t.description = (data.get("description") or data.get("body") or "").strip()

    if "status" in data:
        status = _normalize_status(data.get("status") or "")
        if not status:
            return jsonify({"error": "Invalid status"}), 400
        t.status = status

    if "priority" in data:
        priority = _normalize_priority(data.get("priority") or "")
        if not priority:
            return jsonify({"error": "Invalid priority"}), 400
        t.priority = priority

    if "assigned_to_user_id" in data and hasattr(t, "assigned_to_user_id"):
        raw = data.get("assigned_to_user_id")
        if raw in (None, ""):
            t.assigned_to_user_id = None
        else:
            try:
                t.assigned_to_user_id = int(raw)
            except Exception:
                return jsonify({"error": "assigned_to_user_id must be an integer"}), 400

    if "due_date" in data and hasattr(t, "due_date"):
        raw = data.get("due_date")
        if raw in (None, ""):
            t.due_date = None
        else:
            try:
                t.due_date = bridge.parse_date(str(raw))
            except Exception:
                return jsonify({"error": "Invalid due_date"}), 400

    db.session.commit()

    log_audit(
        module="tasks",
        action="update",
        entity_type="task",
        entity_id=t.id,
        entity_label=t.title,
        details={
            "updated_fields": list(data.keys()),
            "status": getattr(t, "status", None),
            "priority": getattr(t, "priority", None),
            "assigned_to_user_id": getattr(t, "assigned_to_user_id", None),
            "due_date": t.due_date.isoformat() if getattr(t, "due_date", None) else None,
        },
    )

    return jsonify(_task_to_dict(t)), 200