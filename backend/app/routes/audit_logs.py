from flask import Blueprint, request, jsonify
import json

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
    limit = min(int(request.args.get("limit", 100)), 300)

    qs = AuditLog.query.filter_by(school_id=current_school_id())

    if module:
        qs = qs.filter(AuditLog.module == module)
    if action:
        qs = qs.filter(AuditLog.action == action)
    if entity_type:
        qs = qs.filter(AuditLog.entity_type == entity_type)

    rows = qs.order_by(AuditLog.created_at.desc()).limit(limit).all()

    if q:
        rows = [
            r for r in rows
            if q in (r.user_email or "").lower()
            or q in (r.module or "").lower()
            or q in (r.action or "").lower()
            or q in (r.entity_type or "").lower()
            or q in (r.entity_label or "").lower()
            or q in (r.entity_id or "").lower()
            or q in (r.details_json or "").lower()
        ]

    return jsonify([_row_to_dict(r) for r in rows]), 200


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