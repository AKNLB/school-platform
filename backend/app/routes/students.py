from flask import Blueprint, request, jsonify, url_for, send_from_directory
from werkzeug.utils import secure_filename
import os
from datetime import datetime
from app.audit import log_audit
import app.bridge as bridge
from app.decorators import (
    ROLE_ADMIN,
    ROLE_TEACHER,
    ROLE_PARENT,
    ROLE_STUDENT,
    current_school_id,
    is_admin,
    roles_required,
    school_context_required,
)

students_bp = Blueprint("students_bp", __name__)

def _student_to_dict(student):
    return {
        "id": student.id,
        "name": student.name,
        "dob": student.dob.isoformat() if student.dob else None,
        "gender": student.gender,
        "national_id": student.national_id,
        "grade": student.grade,
        "email": student.email,
        "guardian_name": student.guardian_name,
        "guardian_contact": student.guardian_contact,
        "home_address": student.home_address,
        "emergency_contact": student.emergency_contact,
        "photo_url": (
            url_for("students_bp.serve_photo", filename=student.photo_filename, _external=True)
            if student.photo_filename
            else None
        ),
    }

@students_bp.route("/api/s/<slug>/students", methods=["GET", "POST"])
@students_bp.route("/api/students", methods=["GET", "POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def students(slug=None):
    Student = bridge.Student
    db = bridge.db

    if request.method == "GET":
        rows = Student.query.filter_by(
            school_id=current_school_id()
        ).order_by(Student.id).all()
        return jsonify([_student_to_dict(s) for s in rows]), 200

    if not is_admin():
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"error": "Name required"}), 400

    s = Student(
        school_id=current_school_id(),
        name=data["name"].strip(),
        dob=bridge.parse_date(data["dob"]) if data.get("dob") else None,
        gender=data.get("gender"),
        national_id=data.get("national_id"),
        grade=int(data.get("grade", 1)),
        email=data.get("email"),
        guardian_name=data.get("guardian_name"),
        guardian_contact=data.get("guardian_contact"),
        home_address=data.get("home_address"),
        emergency_contact=data.get("emergency_contact"),
    )
    db.session.add(s)
    db.session.commit()

    log_audit(
        module="students",
        action="create",
        entity_type="student",
        entity_id=s.id,
        entity_label=s.name,
        details={"grade": s.grade, "guardian_name": s.guardian_name},
    )

    return jsonify({"id": s.id}), 201

@students_bp.route("/api/s/<slug>/students/<int:student_id>", methods=["GET", "PUT", "DELETE"])
@students_bp.route("/api/students/<int:student_id>", methods=["GET", "PUT", "DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def modify_student(student_id, slug=None):
    Student = bridge.Student
    db = bridge.db

    s = Student.query.filter_by(
        id=student_id,
        school_id=current_school_id()
    ).first()

    if not s:
        return jsonify({"error": "Student not found"}), 404

    if request.method == "GET":
        return jsonify(_student_to_dict(s)), 200

    if request.method in ["PUT", "DELETE"] and not is_admin():
        return jsonify({"error": "Forbidden"}), 403

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}

        for fld in [
            "name",
            "gender",
            "national_id",
            "email",
            "guardian_name",
            "guardian_contact",
            "home_address",
            "emergency_contact",
        ]:
            if fld in data:
                setattr(s, fld, data[fld])

        if "dob" in data:
            s.dob = bridge.parse_date(data["dob"]) if data["dob"] else None
        if "grade" in data:
            s.grade = int(data["grade"])

        db.session.commit()

        log_audit(
            module="students",
            action="update",
            entity_type="student",
            entity_id=s.id,
            entity_label=s.name,
            details={"updated_fields": list(data.keys())},
        )

        return jsonify({"message": "Student updated"}), 200

    # DELETE
    student_name = s.name
    student_grade = s.grade

    db.session.delete(s)
    db.session.commit()

    log_audit(
        module="students",
        action="delete",
        entity_type="student",
        entity_id=student_id,
        entity_label=student_name,
        details={"grade": student_grade},
    )

    return jsonify({"message": "Student deleted"}), 200

@students_bp.route("/api/s/<slug>/students/<int:student_id>/photo", methods=["POST"])
@students_bp.route("/api/students/<int:student_id>/photo", methods=["POST"])
@school_context_required
@roles_required(ROLE_ADMIN)
@bridge.limiter.limit("20 per hour")
def upload_student_photo(student_id, slug=None):
    Student = bridge.Student
    db = bridge.db

    s = Student.query.filter_by(
        id=student_id,
        school_id=current_school_id()
    ).first()

    if not s:
        return jsonify({"error": "Student not found"}), 404

    file = request.files.get("photo")
    if not file or file.filename == "":
        return jsonify({"error": "No file"}), 400

    if not bridge.allowed_file(file.filename, bridge.ALLOWED_PHOTO):
        return jsonify({"error": "Invalid type"}), 400

    upload_photos_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "uploads",
        "photos",
    )
    os.makedirs(upload_photos_dir, exist_ok=True)

    fname = secure_filename(f"{student_id}_{int(datetime.utcnow().timestamp())}_{file.filename}")
    file.save(os.path.join(upload_photos_dir, fname))

    s.photo_filename = fname
    db.session.commit()

    log_audit(
        module="students",
        action="upload_photo",
        entity_type="student",
        entity_id=s.id,
        entity_label=s.name,
        details={"photo_filename": fname},
    )

    return jsonify({
        "message": "Photo uploaded",
        "photo_url": url_for("students_bp.serve_photo", filename=fname, _external=True)
    }), 201

@students_bp.route("/photos/<filename>")
def serve_photo(filename):
    upload_photos_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "uploads",
        "photos",
    )
    return send_from_directory(upload_photos_dir, filename)