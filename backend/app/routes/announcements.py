from flask import Blueprint, request, jsonify, send_from_directory
import os
import json

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

announcements_bp = Blueprint("announcements_bp", __name__)

def _normalize_audience(value: str) -> str:
    v = (value or "all").strip().lower()
    mapping = {
        "all": "all",
        "teacher": "teachers",
        "teachers": "teachers",
        "parent": "parents",
        "parents": "parents",
        "student": "students",
        "students": "students",
    }
    return mapping.get(v, "")

def _attachments_list(a):
    try:
        return json.loads(getattr(a, "attachments_json", "[]") or "[]")
    except Exception:
        return []


@announcements_bp.route("/api/s/<slug>/announcements", methods=["GET"])
@announcements_bp.route("/api/announcements", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def announcements_list(slug=None):
    Announcement = bridge.Announcement

    audience = (request.args.get("audience") or "").strip().lower()
    q = (request.args.get("q") or "").strip().lower()

    qs = Announcement.query.filter_by(school_id=current_school_id())

    if audience and audience != "all":
        qs = qs.filter(
            (Announcement.audience == "all") | (Announcement.audience == audience)
        )

    rows = qs.order_by(Announcement.pinned.desc(), Announcement.created_at.desc()).all()

    if q:
        rows = [
            a for a in rows
            if q in (a.title or "").lower()
            or q in (a.description or "").lower()
        ]

    return jsonify([a.to_dict() for a in rows]), 200


@announcements_bp.route("/api/s/<slug>/announcements", methods=["POST"])
@announcements_bp.route("/api/announcements", methods=["POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
@bridge.limiter.limit("60 per hour")
def announcements_create(slug=None):
    Announcement = bridge.Announcement
    db = bridge.db

    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    description = (
        data.get("description")
        or data.get("body")
        or data.get("message")
        or ""
    ).strip()
    audience = _normalize_audience(data.get("audience") or "all")
    pinned = bool(data.get("pinned", False))
    print("ANNOUNCEMENT PAYLOAD:", data)
    if not title:
        return jsonify({"error": "title is required"}), 400

    if not description:
        return jsonify({"error": "description is required"}), 400

    if not audience:
        return jsonify({"error": "audience must be all|teacher(s)|parent(s)|student(s)"}), 400

    current_user = getattr(bridge, "current_user", None)
    user = current_user() if callable(current_user) else None

    a = Announcement(
        school_id=current_school_id(),
        title=title,
        description=description,
        audience=audience,
        pinned=pinned,
        created_by_user_id=getattr(user, "id", None),
        attachments_json="[]",
    )
    db.session.add(a)
    db.session.commit()

    return jsonify(a.to_dict()), 201


@announcements_bp.route("/api/s/<slug>/announcements/<int:aid>", methods=["GET"])
@announcements_bp.route("/api/announcements/<int:aid>", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def announcements_get(aid, slug=None):
    Announcement = bridge.Announcement

    a = Announcement.query.filter_by(
        id=aid,
        school_id=current_school_id()
    ).first()

    if not a:
        return jsonify({"error": "Announcement not found"}), 404

    return jsonify(a.to_dict()), 200


@announcements_bp.route("/api/s/<slug>/announcements/<int:aid>", methods=["PUT"])
@announcements_bp.route("/api/announcements/<int:aid>", methods=["PUT"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
@bridge.limiter.limit("60 per hour")
def announcements_update(aid, slug=None):
    Announcement = bridge.Announcement
    db = bridge.db

    a = Announcement.query.filter_by(
        id=aid,
        school_id=current_school_id()
    ).first()

    if not a:
        return jsonify({"error": "Announcement not found"}), 404

    data = request.get_json(silent=True) or {}

    if "title" in data:
        a.title = (data.get("title") or "").strip()
    if "description" in data or "body" in data or "message" in data:
        a.description = (
            data.get("description")
            or data.get("body")
            or data.get("message")
            or ""
        ).strip()
    if "audience" in data:
        aud = _normalize_audience(data.get("audience") or "all")
        if not aud:
            return jsonify({"error": "audience must be all|teacher(s)|parent(s)|student(s)"}), 400
        a.audience = aud
    if "pinned" in data:
        a.pinned = bool(data.get("pinned"))

    if not (a.title or "").strip():
        return jsonify({"error": "title cannot be empty"}), 400

    if not (a.description or "").strip():
        return jsonify({"error": "description cannot be empty"}), 400

    db.session.commit()
    return jsonify(a.to_dict()), 200


@announcements_bp.route("/api/s/<slug>/announcements/<int:aid>", methods=["DELETE"])
@announcements_bp.route("/api/announcements/<int:aid>", methods=["DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def announcements_delete(aid, slug=None):
    Announcement = bridge.Announcement
    db = bridge.db

    a = Announcement.query.filter_by(
        id=aid,
        school_id=current_school_id()
    ).first()

    if not a:
        return jsonify({"error": "Announcement not found"}), 404

    for filename in _attachments_list(a):
        try:
            path = os.path.join(bridge.UPLOAD_ANNOUNCEMENTS, filename)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    db.session.delete(a)
    db.session.commit()
    return jsonify({"message": "Announcement deleted"}), 200


@announcements_bp.route("/api/s/<slug>/announcements/<int:aid>/attachments", methods=["POST"])
@announcements_bp.route("/api/announcements/<int:aid>/attachments", methods=["POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
@bridge.limiter.limit("100 per hour")
def announcements_upload_attachment(aid, slug=None):
    Announcement = bridge.Announcement
    db = bridge.db

    a = Announcement.query.filter_by(
        id=aid,
        school_id=current_school_id()
    ).first()

    if not a:
        return jsonify({"error": "Announcement not found"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file is required"}), 400

    if not bridge.allowed_file(file.filename, bridge.ALLOWED_ANNOUNCEMENT_ATTACHMENTS):
        return jsonify({
            "error": f"Unsupported file type. Allowed: {sorted(bridge.ALLOWED_ANNOUNCEMENT_ATTACHMENTS)}"
        }), 400

    safe_name = bridge.secure_filename(file.filename)
    stored_name = f"{int(__import__('time').time())}_{safe_name}"

    os.makedirs(bridge.UPLOAD_ANNOUNCEMENTS, exist_ok=True)
    file.save(os.path.join(bridge.UPLOAD_ANNOUNCEMENTS, stored_name))

    attachments = _attachments_list(a)
    attachments.append(stored_name)
    a.attachments_json = json.dumps(attachments)

    db.session.commit()
    return jsonify({"message": "Attachment uploaded", "filename": stored_name}), 201


@announcements_bp.route("/api/s/<slug>/announcements/<int:aid>/attachments/<path:filename>", methods=["DELETE"])
@announcements_bp.route("/api/announcements/<int:aid>/attachments/<path:filename>", methods=["DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def announcements_delete_attachment(aid, filename, slug=None):
    Announcement = bridge.Announcement
    db = bridge.db

    a = Announcement.query.filter_by(
        id=aid,
        school_id=current_school_id()
    ).first()

    if not a:
        return jsonify({"error": "Announcement not found"}), 404

    attachments = _attachments_list(a)
    if filename not in attachments:
        return jsonify({"error": "Attachment not found"}), 404

    attachments = [x for x in attachments if x != filename]
    a.attachments_json = json.dumps(attachments)

    try:
        path = os.path.join(bridge.UPLOAD_ANNOUNCEMENTS, filename)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    db.session.commit()
    return jsonify({"message": "Attachment deleted"}), 200


@announcements_bp.route("/announcement-attachments/<path:filename>", methods=["GET"])
def serve_announcement_attachment(filename):
    return send_from_directory(bridge.UPLOAD_ANNOUNCEMENTS, filename)