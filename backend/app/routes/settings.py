from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import os
from datetime import datetime

import app.bridge as bridge
from app.decorators import ROLE_ADMIN, roles_required, school_context_required, current_school_id

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

def _assets_dir():
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "assets",
    )

@settings_bp.route("/api/s/<slug>/settings", methods=["GET"])
@settings_bp.route("/api/settings", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN)
def get_settings(slug=None):
    s = _get_or_create_settings()

    def file_url(fname):
        return url_for("settings_bp.serve_asset", filename=fname, _external=True) if fname else None

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
    for k in ["school_name", "address", "phone", "email", "principal_name"]:
        if k in data:
            setattr(s, k, data[k] or "")

    db.session.commit()
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
    return jsonify({"message": "uploaded", "filename": fname}), 201

@settings_bp.route("/assets/<filename>")
def serve_asset(filename):
    return send_from_directory(_assets_dir(), filename)