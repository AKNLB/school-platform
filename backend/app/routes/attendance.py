from flask import Blueprint, request, jsonify

import app.bridge as bridge
from app.decorators import (
    ROLE_ADMIN,
    ROLE_TEACHER,
    current_school_id,
    roles_required,
    school_context_required,
)

attendance_bp = Blueprint("attendance_bp", __name__)

@attendance_bp.route("/api/s/<slug>/attendance", methods=["GET", "POST", "PUT"])
@attendance_bp.route("/api/attendance", methods=["GET", "POST", "PUT"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def attendance(slug=None):
    Attendance = bridge.Attendance
    Student = bridge.Student
    db = bridge.db

    if request.method == "GET":
        grade = request.args.get("grade", type=int)
        day = request.args.get("date")

        q = Attendance.query.filter_by(school_id=current_school_id())

        if grade is not None:
            q = q.join(Student, Student.id == Attendance.student_id).filter(
                Student.school_id == current_school_id(),
                Student.grade == grade,
            )

        if day:
            q = q.filter(Attendance.date == bridge.parse_date(day))

        recs = q.order_by(Attendance.date.desc(), Attendance.id.desc()).limit(300).all()

        return jsonify(
            [
                {
                    "id": r.id,
                    "date": r.date.isoformat(),
                    "student_id": r.student_id,
                    "student_name": r.student.name if r.student else None,
                    "grade": r.student.grade if r.student else None,
                    "status": r.status,
                    "note": r.note or "",
                }
                for r in recs
            ]
        ), 200

    payload = request.get_json(silent=True) or {}

    if request.method == "POST":
        if not payload.get("student_id") or not payload.get("date"):
            return jsonify({"error": "student_id and date required"}), 400

        student = Student.query.filter_by(
            id=int(payload["student_id"]),
            school_id=current_school_id(),
        ).first()

        if not student:
            return jsonify({"error": "Student not found"}), 404

        r = Attendance(
            school_id=current_school_id(),
            student_id=student.id,
            date=bridge.parse_date(payload["date"]),
            status=(payload.get("status") or "present"),
            note=payload.get("note"),
        )
        db.session.add(r)
        db.session.commit()
        return jsonify({"id": r.id}), 201

    items = payload if isinstance(payload, list) else [payload]

    updated = 0
    created = 0

    for data in items:
        if not isinstance(data, dict):
            continue

        sid = data.get("student_id")
        day = data.get("date")
        if not sid or not day:
            continue

        sid = int(sid)
        dt = bridge.parse_date(day)

        student = Student.query.filter_by(
            id=sid,
            school_id=current_school_id(),
        ).first()

        if not student:
            continue

        r = Attendance.query.filter_by(
            school_id=current_school_id(),
            student_id=sid,
            date=dt,
        ).first()

        if r is None:
            r = Attendance(
                school_id=current_school_id(),
                student_id=sid,
                date=dt,
            )
            db.session.add(r)
            created += 1
        else:
            updated += 1

        if "status" in data and data["status"] is not None:
            r.status = data["status"]
        if "note" in data:
            r.note = data.get("note") or None

    db.session.commit()
    return jsonify({"message": "Attendance saved", "created": created, "updated": updated}), 200


@attendance_bp.route("/api/s/<slug>/attendance/student/<int:student_id>", methods=["GET"])
@attendance_bp.route("/api/attendance/student/<int:student_id>", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def attendance_student_history(student_id: int, slug=None):
    Attendance = bridge.Attendance
    Student = bridge.Student

    limit = int(request.args.get("limit", 30))

    student = Student.query.filter_by(
        id=student_id,
        school_id=current_school_id(),
    ).first()

    if not student:
        return jsonify({"error": "Student not found"}), 404

    rows = (
        Attendance.query
        .filter_by(
            school_id=current_school_id(),
            student_id=student_id,
        )
        .order_by(Attendance.date.desc(), Attendance.id.desc())
        .limit(limit)
        .all()
    )

    return jsonify([
        {
            "id": r.id,
            "student_id": r.student_id,
            "date": r.date.strftime("%Y-%m-%d") if hasattr(r.date, "strftime") else str(r.date),
            "status": r.status,
            "note": r.note or "",
        }
        for r in rows
    ]), 200


@attendance_bp.route("/api/s/<slug>/attendance/report", methods=["GET"])
@attendance_bp.route("/api/attendance/report", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def api_attendance_report(slug=None):
    Attendance = bridge.Attendance

    dt_from = request.args.get("from")
    dt_to = request.args.get("to")

    q = Attendance.query.filter_by(school_id=current_school_id())

    if dt_from:
        q = q.filter(Attendance.date >= dt_from)
    if dt_to:
        q = q.filter(Attendance.date <= dt_to)

    rows = q.order_by(Attendance.date.asc()).all()

    records = [
        {
            "date": a.date,
            "student_id": a.student_id,
            "status": a.status,
            "note": a.note,
        }
        for a in rows
    ]

    present = sum(1 for r in records if (r["status"] or "").lower() == "present")
    absent = sum(1 for r in records if (r["status"] or "").lower() == "absent")
    late = sum(1 for r in records if (r["status"] or "").lower() == "late")
    excused = sum(1 for r in records if (r["status"] or "").lower() == "excused")

    return jsonify({
        "records": records,
        "summary": {
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "total_marked": len(records),
        }
    }), 200