from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
from datetime import datetime

import app.bridge as bridge
from app.decorators import ROLE_ADMIN, roles_required, school_context_required, current_school_id
from app.audit import log_audit
settings_bp = Blueprint("settings_bp", __name__)

def _get_settings_model():
    return bridge.SchoolSettings

def _get_or_create_settings():
    SchoolSettings = _get_settings_model()
    db = bridge.db
    sid = current_school_id()

    s = SchoolSettings.query.filter_by(school_id=sid).first()
    if not s:
        s = SchoolSettings(
            school_id=sid,
            school_name="My School",
        )
        db.session.add(s)
        db.session.commit()
    return s
from flask import url_for
def _allowed_file(filename: str, allowed_set: set[str]) -> bool:
    return bridge.allowed_file(filename, allowed_set)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
STORAGE_ROOT = os.getenv("STORAGE_ROOT") or BASE_DIR

def _assets_dir():
    return os.path.join(STORAGE_ROOT, "assets")

@settings_bp.route("/api/s/<slug>/settings", methods=["GET"])
@settings_bp.route("/api/settings", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN)
def get_settings(slug=None):
    s = _get_or_create_settings()

    def file_url(fname):
        if not fname:
            return None

        public_backend_origin = (os.getenv("PUBLIC_BACKEND_ORIGIN") or "").rstrip("/")
        if public_backend_origin:
            return f"{public_backend_origin}/assets/{fname}"

        return url_for("settings_bp.serve_asset", filename=fname, _external=True)

    return jsonify({
        "school_name": s.school_name or "",
        "address": s.address or "",
        "phone": s.phone or "",
        "email": s.email or "",
        "logo_url": file_url(s.logo_filename),
        "principal_name": s.principal_name or "",
        "principal_signature_url": file_url(s.principal_signature_filename),
        "teacher_signature_url": file_url(s.teacher_signature_filename),
    }), 200

@settings_bp.route("/api/s/<slug>/settings", methods=["PUT"])
@settings_bp.route("/api/settings", methods=["PUT"])
@school_context_required
@roles_required(ROLE_ADMIN)
@bridge.limiter.limit("20 per hour")
def update_settings(slug=None):
    db = bridge.db
    s = _get_or_create_settings()

    data = request.get_json(silent=True) or {}
    changed_fields = []

    for k in ["school_name", "address", "phone", "email", "principal_name"]:
        if k in data:
            new_value = data[k] or ""
            if getattr(s, k) != new_value:
                changed_fields.append(k)
            setattr(s, k, new_value)

    db.session.commit()

    log_audit(
        module="settings",
        action="update",
        entity_type="school_settings",
        entity_id=s.school_id,
        entity_label=s.school_name or "School Settings",
        details={"changed_fields": changed_fields},
    )

    return jsonify({"message": "Settings updated"}), 200

@settings_bp.route("/api/s/<slug>/settings/upload", methods=["POST"])
@settings_bp.route("/api/settings/upload", methods=["POST"])
@school_context_required
@roles_required(ROLE_ADMIN)
@bridge.limiter.limit("20 per hour")
def upload_settings_asset(slug=None):
    kind = (request.form.get("kind") or "").strip()
    f = request.files.get("file")

    if not f or not f.filename:
        return jsonify({"error": "file required"}), 400

    allowed = {"png", "jpg", "jpeg"}
    if not _allowed_file(f.filename, allowed):
        return jsonify({"error": "png/jpg only"}), 400

    s = _get_or_create_settings()
    db = bridge.db

    fname = secure_filename(f"{kind}_{int(datetime.utcnow().timestamp())}_{f.filename}")
    save_dir = _assets_dir()
    os.makedirs(save_dir, exist_ok=True)
    f.save(os.path.join(save_dir, fname))

    if kind == "logo":
        s.logo_filename = fname
    elif kind == "principal_signature":
        s.principal_signature_filename = fname
    elif kind == "teacher_signature":
        s.teacher_signature_filename = fname
    else:
        return jsonify({"error": "kind must be logo | principal_signature | teacher_signature"}), 400

    db.session.commit()
    log_audit(
    module="settings",
    action="upload_asset",
    entity_type="school_asset",
    entity_id=s.school_id,
    entity_label=kind,
    details={"kind": kind, "filename": fname},
    )
    return jsonify({
        "message": "uploaded",
        "filename": fname,
        "url": f"{(os.getenv('PUBLIC_BACKEND_ORIGIN') or '').rstrip('/')}/assets/{fname}"
            if os.getenv("PUBLIC_BACKEND_ORIGIN")
            else url_for("settings_bp.serve_asset", filename=fname, _external=True),
        "kind": kind,
    }), 201

@settings_bp.route("/assets/<filename>")
def serve_asset(filename):
    return send_from_directory(_assets_dir(), filename)