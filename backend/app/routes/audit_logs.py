from flask import Blueprint, request, jsonify
import json
from datetime import datetime, timedelta

import app.bridge as bridge
from app.decorators import ROLE_ADMIN, current_school_id, roles_required, school_context_required

audit_bp = Blueprint("audit_bp", __name__)


def _row_to_dict(row):
    details = {}
    if row.details_json:
        try:
            details = json.loads(row.details_json)
        except Exception:
            details = {"raw": row.details_json}

    return {
        "id": row.id,
        "school_id": row.school_id,
        "user_id": row.user_id,
        "user_email": row.user_email,
        "module": row.module,
        "action": row.action,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "entity_label": row.entity_label,
        "details": details,
        "ip_address": row.ip_address,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@audit_bp.route("/api/s/<slug>/audit-logs", methods=["GET"])
@audit_bp.route("/api/audit-logs", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN)
def get_audit_logs(slug=None):
    AuditLog = bridge.AuditLog

    module = (request.args.get("module") or "").strip().lower()
    action = (request.args.get("action") or "").strip().lower()
    entity_type = (request.args.get("entity_type") or "").strip().lower()
    q = (request.args.get("q") or "").strip().lower()

    start_date = (request.args.get("start_date") or "").strip()
    end_date = (request.args.get("end_date") or "").strip()

    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", 25)), 1), 100)

    qs = AuditLog.query.filter_by(school_id=current_school_id())

    if module:
        qs = qs.filter(AuditLog.module == module)
    if action:
        qs = qs.filter(AuditLog.action == action)
    if entity_type:
        qs = qs.filter(AuditLog.entity_type == entity_type)

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            qs = qs.filter(AuditLog.created_at >= start_dt)
        except ValueError:
            return jsonify({"error": "Invalid start_date. Use YYYY-MM-DD"}), 400

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            qs = qs.filter(AuditLog.created_at < end_dt)
        except ValueError:
            return jsonify({"error": "Invalid end_date. Use YYYY-MM-DD"}), 400

    if q:
        like = f"%{q}%"
        qs = qs.filter(
            (AuditLog.user_email.ilike(like)) |
            (AuditLog.module.ilike(like)) |
            (AuditLog.action.ilike(like)) |
            (AuditLog.entity_type.ilike(like)) |
            (AuditLog.entity_label.ilike(like)) |
            (AuditLog.entity_id.ilike(like)) |
            (AuditLog.details_json.ilike(like))
        )

    total = qs.count()

    rows = (
        qs.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return jsonify({
        "items": [_row_to_dict(r) for r in rows],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max((total + page_size - 1) // page_size, 1),
            "has_prev": page > 1,
            "has_next": page * page_size < total,
        },
    }), 200


@audit_bp.route("/api/s/<slug>/audit-logs/summary", methods=["GET"])
@audit_bp.route("/api/audit-logs/summary", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN)
def get_audit_logs_summary(slug=None):
    AuditLog = bridge.AuditLog

    rows = AuditLog.query.filter_by(
        school_id=current_school_id()
    ).order_by(AuditLog.created_at.desc()).all()

    def count_for(module_name):
        return sum(1 for r in rows if (r.module or "") == module_name)

    actions = {}
    for r in rows:
        key = r.action or "unknown"
        actions[key] = actions.get(key, 0) + 1

    latest = rows[:10]

    return jsonify({
        "count": len(rows),
        "by_module": {
            "students": count_for("students"),
            "finance": count_for("finance"),
            "resources": count_for("resources"),
            "settings": count_for("settings"),
        },
        "by_action": actions,
        "latest": [_row_to_dict(r) for r in latest],
    }), 200