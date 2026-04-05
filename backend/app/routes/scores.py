from flask import Blueprint, request, jsonify

import app.bridge as bridge
from app.decorators import (
    ROLE_ADMIN,
    ROLE_TEACHER,
    current_school_id,
    is_admin,
    roles_required,
    school_context_required,
)

scores_bp = Blueprint("scores_bp", __name__)

@scores_bp.route("/api/s/<slug>/scores", methods=["GET", "POST"])
@scores_bp.route("/api/scores", methods=["GET", "POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def scores(slug=None):
    Score = bridge.Score
    Student = bridge.Student
    db = bridge.db

    if request.method == "GET":
        student_id = request.args.get("student_id", type=int)
        term = request.args.get("term")
        grade = request.args.get("grade", type=int)

        q = Score.query.filter_by(school_id=current_school_id())

        if student_id is not None:
            student = Student.query.filter_by(
                id=student_id,
                school_id=current_school_id()
            ).first()
            if not student:
                return jsonify({"error": "Student not found"}), 404
            q = q.filter(Score.student_id == student_id)

        if term:
            q = q.filter(Score.term == term)

        if grade is not None:
            q = q.filter(Score.grade == grade)

        rows = q.order_by(Score.date.desc(), Score.id.desc()).all()
        return jsonify([r.to_dict() for r in rows]), 200

    data = request.get_json(silent=True) or {}
    required = ["student_id", "subject", "cont_ass_score", "exam_score", "teacher_id", "term", "grade"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    student = Student.query.filter_by(
        id=int(data["student_id"]),
        school_id=current_school_id()
    ).first()

    if not student:
        return jsonify({"error": "Student not found"}), 404

    r = Score(
        school_id=current_school_id(),
        student_id=student.id,
        subject=str(data["subject"]).strip(),
        cont_ass_score=int(data["cont_ass_score"]),
        exam_score=int(data["exam_score"]),
        teacher_id=int(data["teacher_id"]),
        term=str(data["term"]).strip(),
        grade=int(data["grade"]),
        date=bridge.parse_date(data["date"]) if data.get("date") else bridge.date.today(),
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201


@scores_bp.route("/api/s/<slug>/scores/<int:score_id>", methods=["PUT", "DELETE"])
@scores_bp.route("/api/scores/<int:score_id>", methods=["PUT", "DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER)
def modify_score(score_id, slug=None):
    Score = bridge.Score
    Student = bridge.Student
    db = bridge.db

    r = Score.query.filter_by(
        id=score_id,
        school_id=current_school_id()
    ).first()

    if not r:
        return jsonify({"error": "Score not found"}), 404

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}

        if "student_id" in data:
            student = Student.query.filter_by(
                id=int(data["student_id"]),
                school_id=current_school_id()
            ).first()
            if not student:
                return jsonify({"error": "Student not found"}), 404
            r.student_id = student.id

        for fld in ["subject", "cont_ass_score", "exam_score", "teacher_id", "term", "grade"]:
            if fld in data:
                setattr(r, fld, data[fld])

        if "date" in data:
            r.date = bridge.parse_date(data["date"]) if data["date"] else r.date

        db.session.commit()
        return jsonify(r.to_dict()), 200

    if not is_admin():
        return jsonify({"error": "Forbidden"}), 403

    db.session.delete(r)
    db.session.commit()
    return jsonify({"message": "Score deleted"}), 200