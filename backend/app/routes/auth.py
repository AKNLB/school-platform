from flask import Blueprint, request, jsonify, session, g
from flask_wtf.csrf import generate_csrf
import app.bridge as bridge

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/api/s/<slug>/auth/login", methods=["POST"], endpoint="auth_login")
@auth_bp.route("/api/auth/login", methods=["POST"], endpoint="auth_login_noslug")
@bridge.csrf.exempt
@bridge.limiter.limit("10 per minute")
def auth_login(slug=None):
    User = bridge.User
    get_school_or_404 = bridge.get_school_or_404

    data = request.get_json(silent=True) or {}
    if not slug:
        slug = data.get("slug") or request.headers.get("X-School-Slug") or getattr(g, "school_slug", None)
        if not slug and getattr(g, "school", None):
            slug = g.school.slug

    if not slug:
        return jsonify({"error": "School slug required (provide /api/s/<slug>/... or send slug in JSON/body or X-School-Slug header)"}), 400

    school = get_school_or_404(str(slug))

    identifier = (data.get("email") or data.get("username") or "").strip().lower()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"error": "Email/username and password are required"}), 400

    user = User.query.filter_by(email=identifier, school_id=school.id).first()
    if not user:
        user = User.query.filter_by(username=identifier, school_id=school.id).first()

    if not user:
        user = User.query.filter((User.email == identifier) | (User.username == identifier)).first()
        if not (user and user.is_superadmin):
            user = None

    if not user or not user.is_active or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    session["user_id"] = user.id
    session["school_id"] = school.id

    return jsonify({
        "ok": True,
        "school": {"id": school.id, "slug": school.slug, "name": school.name},
        "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role},
    })

@auth_bp.post("/api/s/<slug>/auth/logout")
@auth_bp.post("/api/auth/logout")
def auth_logout(slug=None):
    session.clear()
    return jsonify({"ok": True})

@auth_bp.get("/api/s/<slug>/auth/me")
@auth_bp.get("/api/auth/me")
def auth_me(slug=None):
    User = bridge.User
    School = bridge.School
    get_school_or_404 = bridge.get_school_or_404
    require_school_access = bridge.require_school_access

    if slug:
        school = get_school_or_404(slug)
    else:
        sid = session.get("school_id")
        if not sid:
            return jsonify({"user": None})
        school = School.query.get(int(sid))
        if not school:
            session.clear()
            return jsonify({"user": None})

    uid = session.get("user_id")
    sid = session.get("school_id")

    if not uid or not sid or int(sid) != int(school.id):
        return jsonify({"user": None})

    user = User.query.get(int(uid))
    if not user or not user.is_active:
        session.clear()
        return jsonify({"user": None})

    require_school_access(school, user)

    return jsonify({
        "school": {"id": school.id, "slug": school.slug, "name": school.name},
        "user": {"id": user.id, "username": user.username, "email": user.email, "role": user.role},
    })

@auth_bp.route("/api/csrf-token", methods=["GET"])
def get_csrf_token():
    return jsonify({"csrf_token": generate_csrf()})