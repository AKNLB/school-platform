from flask import Blueprint, request, jsonify, make_response, url_for
import os
from pathlib import Path

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

report_cards_bp = Blueprint("report_cards_bp", __name__)


def _money(v):
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def _assets_dir():
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "assets",
    )


def _file_uri(filename: str | None):
    if not filename:
        return None
    path = os.path.join(_assets_dir(), filename)
    if not os.path.exists(path):
        return None
    return Path(path).resolve().as_uri()


def _student_payload(student):
    return {
        "id": student.id,
        "name": student.name,
        "grade": student.grade,
        "gender": student.gender,
        "email": student.email,
        "guardian_name": student.guardian_name,
        "guardian_contact": student.guardian_contact,
        "photo_filename": getattr(student, "photo_filename", None),
    }


def _score_payload(score):
    cont = int(score.cont_ass_score or 0)
    exam = int(score.exam_score or 0)
    total = cont + exam
    return {
        "id": score.id,
        "subject": score.subject,
        "cont_ass_score": cont,
        "exam_score": exam,
        "total": total,
        "teacher_id": score.teacher_id,
        "term": score.term,
        "grade": score.grade,
        "date": score.date.isoformat() if score.date else None,
    }


def _build_report_card(student_id: int, term: str | None):
    Student = bridge.Student
    Score = bridge.Score
    SchoolSettings = bridge.SchoolSettings

    student = Student.query.filter_by(
        id=student_id,
        school_id=current_school_id()
    ).first()

    if not student:
        return None, {"error": "Student not found"}, 404

    q = Score.query.filter_by(
        school_id=current_school_id(),
        student_id=student.id
    )

    if term:
        q = q.filter(Score.term == term)

    scores = q.order_by(Score.subject.asc(), Score.id.asc()).all()

    score_items = [_score_payload(s) for s in scores]
    grand_total = sum(item["total"] for item in score_items)
    subject_count = len(score_items)
    average = round(grand_total / subject_count, 2) if subject_count else 0

    settings = SchoolSettings.query.filter_by(
        school_id=current_school_id()
    ).first()

    school = {
        "school_name": getattr(settings, "school_name", "") if settings else "",
        "address": getattr(settings, "address", "") if settings else "",
        "phone": getattr(settings, "phone", "") if settings else "",
        "email": getattr(settings, "email", "") if settings else "",
        "principal_name": getattr(settings, "principal_name", "") if settings else "",
        "logo_url": url_for("settings_bp.serve_asset", filename=settings.logo_filename, _external=True)
        if settings and getattr(settings, "logo_filename", None) else None,
        "principal_signature_url": url_for("settings_bp.serve_asset", filename=settings.principal_signature_filename, _external=True)
        if settings and getattr(settings, "principal_signature_filename", None) else None,
        "teacher_signature_url": url_for("settings_bp.serve_asset", filename=settings.teacher_signature_filename, _external=True)
        if settings and getattr(settings, "teacher_signature_filename", None) else None,
    }

    payload = {
        "school": school,
        "student": _student_payload(student),
        "term": term,
        "scores": score_items,
        "summary": {
            "subject_count": subject_count,
            "grand_total": grand_total,
            "average": average,
        },
    }

    return payload, None, 200


@report_cards_bp.route("/api/s/<slug>/report-card/<int:student_id>", methods=["GET"])
@report_cards_bp.route("/api/report-card/<int:student_id>", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def report_card_json(student_id, slug=None):
    term = request.args.get("term")
    payload, err, status = _build_report_card(student_id, term)
    if err:
        return jsonify(err), status
    return jsonify(payload), 200


@report_cards_bp.route("/api/s/<slug>/report_card", methods=["GET"])
@report_cards_bp.route("/api/report_card", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def api_report_card_json(slug=None):
    student_id = request.args.get("student_id", type=int)
    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    term = request.args.get("term")
    payload, err, status = _build_report_card(student_id, term)
    if err:
        return jsonify(err), status
    return jsonify(payload), 200


try:
    from weasyprint import HTML
except Exception:
    HTML = None


@report_cards_bp.route("/api/s/<slug>/report-card/<int:student_id>/pdf", methods=["GET"])
@report_cards_bp.route("/api/report-card/<int:student_id>/pdf", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
@bridge.limiter.limit("30 per hour")
def report_card_pdf(student_id, slug=None):
    if HTML is None:
        return jsonify({"error": "WeasyPrint not installed. Install: pip install weasyprint"}), 500

    term = (request.args.get("term") or "Term 1").strip()

    payload, err, status = _build_report_card(student_id, term)
    if err:
        return jsonify(err), status

    student = payload["student"]
    school = payload["school"]
    scores = payload["scores"]
    summary = payload["summary"]

    SchoolSettings = bridge.SchoolSettings
    settings = SchoolSettings.query.filter_by(
        school_id=current_school_id()
    ).first()

    logo_src = _file_uri(getattr(settings, "logo_filename", None) if settings else None)
    teacher_sig_src = _file_uri(getattr(settings, "teacher_signature_filename", None) if settings else None)
    principal_sig_src = _file_uri(getattr(settings, "principal_signature_filename", None) if settings else None)

    rows_html = "".join(
        f"<tr><td>{x['subject']}</td><td class='num'>{x['cont_ass_score']}</td><td class='num'>{x['exam_score']}</td><td class='num strong'>{x['total']}</td></tr>"
        for x in scores
    ) or "<tr><td colspan='4' style='text-align:center; opacity:.7;'>No scores yet</td></tr>"

    logo_html = (
        f"<img class='logo' src='{logo_src}' />"
        if logo_src
        else "<div class='logo-fallback'>LOGO</div>"
    )
    t_sig = (
        f"<img class='sig' src='{teacher_sig_src}' />"
        if teacher_sig_src
        else ""
    )
    p_sig = (
        f"<img class='sig' src='{principal_sig_src}' />"
        if principal_sig_src
        else ""
    )

    html = f"""
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          @page {{
            size: A4;
            margin: 18mm;
          }}
          body {{
            font-family: Arial, sans-serif;
            color: #111;
          }}
          .header {{
            display: flex;
            gap: 14px;
            align-items: center;
            border-bottom: 2px solid #111;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }}
          .logo {{
            width: 70px;
            height: 70px;
            object-fit: contain;
          }}
          .logo-fallback {{
            width: 70px;
            height: 70px;
            border: 1px solid #111;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
          }}
          .school {{
            flex: 1;
          }}
          .name {{
            font-size: 18px;
            font-weight: 900;
            letter-spacing: .3px;
          }}
          .meta {{
            font-size: 11px;
            opacity: .75;
            margin-top: 2px;
          }}
          .title {{
            margin-top: 6px;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: .4px;
          }}
          .grid {{
            display: grid;
            grid-template-columns: 1.2fr .8fr;
            gap: 10px;
            margin-top: 10px;
          }}
          .box {{
            border: 1px solid #222;
            border-radius: 12px;
            padding: 10px;
          }}
          .row {{
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding: 4px 0;
          }}
          .label {{
            font-size: 11px;
            opacity: .7;
          }}
          .value {{
            font-size: 12px;
            font-weight: 700;
          }}
          table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }}
          th, td {{
            border-bottom: 1px solid #ddd;
            padding: 8px 6px;
            font-size: 12px;
          }}
          th {{
            text-align: left;
            font-size: 11px;
            letter-spacing: .3px;
            text-transform: uppercase;
            opacity: .85;
          }}
          .num {{
            text-align: right;
          }}
          .strong {{
            font-weight: 900;
          }}
          .pill {{
            display: inline-block;
            padding: 6px 10px;
            border: 1px solid #111;
            border-radius: 999px;
            font-weight: 900;
            font-size: 12px;
          }}
          .signatures {{
            margin-top: 14px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            align-items: end;
          }}
          .sigbox {{
            border-top: 1px solid #222;
            padding-top: 8px;
            font-size: 12px;
          }}
          .sig {{
            height: 42px;
            object-fit: contain;
            display: block;
            margin-bottom: 4px;
          }}
          .footer {{
            margin-top: 14px;
            font-size: 10px;
            opacity: .75;
            display: flex;
            justify-content: space-between;
          }}
        </style>
      </head>
      <body>
        <div class="header">
          {logo_html}
          <div class="school">
            <div class="name">{school.get("school_name","")}</div>
            <div class="meta">{school.get("address","")}</div>
            <div class="meta">{school.get("phone","")} {(" • " + school.get("email","")) if school.get("email") else ""}</div>
            <div class="title">Student Report Card</div>
          </div>
          <div style="text-align:right;">
            <div class="pill">{payload.get("term") or ""}</div>
            <div class="meta" style="margin-top:6px; font-size:11px;">Grade {student.get("grade","")}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="row"><span class="label">Student</span><span class="value">{student.get("name","")}</span></div>
            <div class="row"><span class="label">Student ID</span><span class="value">{student.get("id","")}</span></div>
            <div class="row"><span class="label">Guardian</span><span class="value">{student.get("guardian_name") or "—"}</span></div>
            <div class="row"><span class="label">Contact</span><span class="value">{student.get("guardian_contact") or "—"}</span></div>
          </div>

          <div class="box">
            <div class="row"><span class="label">Average</span><span class="value">{summary["average"]}</span></div>
            <div class="row"><span class="label">Subjects</span><span class="value">{summary["subject_count"]}</span></div>
            <div class="row"><span class="label">Grand Total</span><span class="value">{summary["grand_total"]}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Subject</th><th class='num'>CA</th><th class='num'>Exam</th><th class='num'>Total</th></tr>
          </thead>
          <tbody>{rows_html}</tbody>
        </table>

        <div class="signatures">
          <div class="sigbox">
            {t_sig}
            <div><b>Teacher Signature</b></div>
          </div>
          <div class="sigbox">
            {p_sig}
            <div><b>{school.get("principal_name","Principal")}</b></div>
          </div>
        </div>

        <div class="footer">
          <div>Official Document • {school.get("school_name","")}</div>
          <div>Student ID: {student.get("id","")}</div>
        </div>
      </body>
    </html>
    """

    pdf_bytes = HTML(string=html, base_url=request.url_root).write_pdf()
    filename = f"report_card_{student_id}_{term.replace(' ', '_')}.pdf"

    resp = make_response(pdf_bytes)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return resp


@report_cards_bp.route("/api/s/<slug>/report_card/pdf", methods=["GET"])
@report_cards_bp.route("/api/report_card/pdf", methods=["GET"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
@bridge.limiter.limit("30 per hour")
def report_card_legacy_pdf(slug=None):
    student_id = request.args.get("student_id", type=int)
    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    return report_card_pdf(student_id, slug=slug)