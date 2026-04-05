from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import re

import app.bridge as bridge
from app.decorators import ROLE_ADMIN, roles_required, school_context_required

school_bp = Blueprint("school_bp", __name__)

ALLOWED_LOGO_EXTS = {"png", "jpg", "jpeg", "webp"}

def allowed_logo(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_LOGO_EXTS

def _get_school_model():
    return bridge.School

def _get_or_create_school():
    School = _get_school_model()
    db = bridge.db

    sch = School.query.first()
    if not sch:
        sch = School(
            name="My School",
            academic_year="",
            theme_color="#5AB4FF",
            logo_filename=None,
        )
        db.session.add(sch)
        db.session.commit()
    return sch

@school_bp.route("/api/s/<slug>/school", methods=["GET"])
@school_bp.route("/api/school", methods=["GET"])
def api_school_get():
    sch = _get_or_create_school()
    return jsonify({
        "id": sch.id,
        "name": sch.name,
        "academic_year": sch.academic_year or "",
        "theme_color": sch.theme_color or "#5AB4FF",
        "logo_url": f"/api/school/logo" if sch.logo_filename else None,
    })

@school_bp.route("/api/s/<slug>/school", methods=["PUT"])
@school_bp.route("/api/school", methods=["PUT"])
@bridge.limiter.limit("20 per hour")
@school_context_required
@roles_required(ROLE_ADMIN)
def api_school_update():
    db = bridge.db
    sch = _get_or_create_school()
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    academic_year = (data.get("academic_year") or "").strip()
    theme_color = (data.get("theme_color") or "").strip()

    if name:
        sch.name = name
    sch.academic_year = academic_year

    if theme_color:
        if not re.fullmatch(r"#([0-9a-fA-F]{6})", theme_color):
            return jsonify({
                "ok": False,
                "error": "theme_color must be a hex color like #1A2B3C",
            }), 400
        sch.theme_color = theme_color.upper()

    db.session.commit()

    return jsonify({
        "ok": True,
        "school": {
            "id": sch.id,
            "name": sch.name,
            "academic_year": sch.academic_year or "",
            "theme_color": sch.theme_color or "#5AB4FF",
            "logo_url": f"/api/school/logo" if sch.logo_filename else None,
        },
    })

@school_bp.route("/api/s/<slug>/school/logo", methods=["POST"])
@school_bp.route("/api/school/logo", methods=["POST"])
@bridge.limiter.limit("20 per hour")
@school_context_required
@roles_required(ROLE_ADMIN)
def api_school_logo_upload():
    db = bridge.db
    sch = _get_or_create_school()

    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_logo(f.filename):
        return jsonify({"error": "Invalid file type. Use png/jpg/jpeg/webp"}), 400

    safe = secure_filename(f.filename)
    ext = safe.rsplit(".", 1)[1].lower()
    stored = f"school_logo_{sch.id}.{ext}"
    school_logo_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "school")
    os.makedirs(school_logo_dir, exist_ok=True)
    path = os.path.join(school_logo_dir, stored)

    f.save(path)
    sch.logo_filename = stored
    db.session.commit()

    return jsonify({"ok": True, "logo_url": "/api/school/logo"})

@school_bp.route("/api/s/<slug>/school/logo", methods=["GET"])
@school_bp.route("/api/school/logo", methods=["GET"])
def api_school_logo_get():
    sch = _get_or_create_school()
    if not sch.logo_filename:
        return jsonify({"error": "No logo uploaded"}), 404

    school_logo_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "school")
    path = os.path.join(school_logo_dir, sch.logo_filename)

    if not os.path.exists(path):
        return jsonify({"error": "Logo missing on disk"}), 404

    return send_file(path, as_attachment=False, download_name=sch.logo_filename)