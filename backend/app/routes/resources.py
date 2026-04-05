from flask import Blueprint, request, jsonify, send_from_directory, current_app
import os

import app.bridge as bridge
from app.decorators import (
    ROLE_ADMIN,
    ROLE_TEACHER,
    current_school_id,
    roles_required,
    school_context_required,
)

resources_bp = Blueprint("resources_bp", __name__)


def _resource_to_dict(r):
    return {
        "id": r.id,
        "root_id": r.root_id,
        "filename": r.filename,
        "stored_name": r.stored_name,
        "filetype": r.filetype,
        "version": r.version,
        "uploader": r.uploader,
        "upload_date": r.upload_date,
        "category": r.category,
        "visibility": r.visibility,
    }


def _resource_safe_store(file):
    secure_name = bridge.secure_filename(file.filename or "resource")
    base, ext = os.path.splitext(secure_name)
    stored = f"{base}_{bridge.uuid.uuid4().hex}{ext}"

    save_dir = current_app.config["UPLOAD_RESOURCES"]
    os.makedirs(save_dir, exist_ok=True)

    file.save(os.path.join(save_dir, stored))
    return secure_name, stored


@resources_bp.route("/api/s/<slug>/resources", methods=["GET", "POST"])
@resources_bp.route("/api/resources", methods=["GET", "POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def api_resources(slug=None):
    Resource = bridge.Resource
    db = bridge.db

    if request.method == "GET":
        q = (request.args.get("q") or "").strip().lower()
        filetype = (request.args.get("type") or "").strip().lower()
        category = (request.args.get("category") or "").strip().lower()
        visibility = (request.args.get("visibility") or "").strip().lower()

        qs = Resource.query.filter_by(school_id=current_school_id())

        if filetype:
            qs = qs.filter(Resource.filetype == filetype)
        if category:
            qs = qs.filter(Resource.category == category)
        if visibility:
            qs = qs.filter(Resource.visibility == visibility)

        rows = qs.order_by(Resource.id.desc()).all()

        if q:
            rows = [
                r for r in rows
                if q in (r.filename or "").lower()
                or q in (r.filetype or "").lower()
                or q in (r.category or "").lower()
            ]

        return jsonify([_resource_to_dict(r) for r in rows]), 200

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required (multipart form-data)"}), 400

    if not bridge.allowed_file(file.filename or "", bridge.ALLOWED_RESOURCE_TYPES):
        return jsonify({
            "error": f"Unsupported file type. Allowed: {sorted(bridge.ALLOWED_RESOURCE_TYPES)}"
        }), 400

    uploader = (request.form.get("uploader") or "").strip() or None
    filetype = (request.form.get("type") or "file").strip().lower()
    category = (request.form.get("category") or "").strip() or None
    visibility = (request.form.get("visibility") or "all").strip().lower() or "all"

    original, stored = _resource_safe_store(file)

    r = Resource(
        school_id=current_school_id(),
        filename=original,
        stored_name=stored,
        filetype=filetype,
        version=1,
        uploader=uploader,
        upload_date=bridge.now_str(),
        category=category,
        visibility=visibility,
        root_id=None,
    )
    db.session.add(r)
    db.session.commit()

    r.root_id = r.id
    db.session.commit()

    return jsonify(_resource_to_dict(r)), 201


@resources_bp.route("/api/s/<slug>/resources/<int:rid>/download", methods=["GET"])
@resources_bp.route("/api/resources/<int:rid>/download", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def api_resource_download(rid: int, slug=None):
    Resource = bridge.Resource

    r = Resource.query.filter_by(
        id=rid,
        school_id=current_school_id()
    ).first()

    if not r:
        return jsonify({"error": "Resource not found"}), 404

    return send_from_directory(
        current_app.config["UPLOAD_RESOURCES"],
        r.stored_name,
        as_attachment=True,
        download_name=r.filename,
    )


@resources_bp.route("/api/s/<slug>/resources/<int:rid>/version", methods=["POST"])
@resources_bp.route("/api/resources/<int:rid>/version", methods=["POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def api_resource_new_version(rid: int, slug=None):
    Resource = bridge.Resource
    db = bridge.db

    parent = Resource.query.filter_by(
        id=rid,
        school_id=current_school_id()
    ).first()

    if not parent:
        return jsonify({"error": "Resource not found"}), 404

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required (multipart form-data)"}), 400

    if not bridge.allowed_file(file.filename or "", bridge.ALLOWED_RESOURCE_TYPES):
        return jsonify({
            "error": f"Unsupported file type. Allowed: {sorted(bridge.ALLOWED_RESOURCE_TYPES)}"
        }), 400

    uploader = (request.form.get("uploader") or "").strip() or None

    original, stored = _resource_safe_store(file)

    r = Resource(
        school_id=current_school_id(),
        filename=original,
        stored_name=stored,
        filetype=parent.filetype,
        version=(parent.version or 1) + 1,
        uploader=uploader or parent.uploader,
        upload_date=bridge.now_str(),
        category=parent.category,
        visibility=parent.visibility,
        root_id=parent.root_id or parent.id,
    )
    db.session.add(r)
    db.session.commit()

    return jsonify(_resource_to_dict(r)), 201


@resources_bp.route("/api/s/<slug>/resources/<int:rid>", methods=["DELETE"])
@resources_bp.route("/api/resources/<int:rid>", methods=["DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN)
def api_resource_delete(rid: int, slug=None):
    Resource = bridge.Resource
    db = bridge.db

    r = Resource.query.filter_by(
        id=rid,
        school_id=current_school_id()
    ).first()

    if not r:
        return jsonify({"error": "Resource not found"}), 404

    try:
        path = os.path.join(current_app.config["UPLOAD_RESOURCES"], r.stored_name)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    db.session.delete(r)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200