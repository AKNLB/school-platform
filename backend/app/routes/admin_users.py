from flask import Blueprint, request, jsonify
import app.bridge as bridge

from app.decorators import (
    ROLE_ADMIN,
    current_school_id,
    roles_required,
    school_context_required,
)

admin_users_bp = Blueprint("admin_users_bp", __name__)

@admin_users_bp.post("/admin/users")
@admin_users_bp.post("/api/admin/users")
@admin_users_bp.post("/api/s/<slug>/admin/users")
@school_context_required
@roles_required(ROLE_ADMIN)
@bridge.limiter.limit("20 per minute")
def admin_create_user(slug=None):
    User = bridge.User
    db = bridge.db

    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip().lower()
    email = (data.get("email") or "").strip().lower() or None
    role = (data.get("role") or "").strip().lower()
    password = data.get("password") or ""

    if role not in ("admin", "teacher", "parent", "student"):
        return jsonify({"error": "role must be admin|teacher|parent|student"}), 400

    if not username:
        return jsonify({"error": "username is required"}), 400

    existing_username = User.query.filter_by(
        school_id=current_school_id(),
        username=username
    ).first()
    if existing_username:
        return jsonify({"error": "username already exists"}), 409

    if email:
        existing_email = User.query.filter_by(
            school_id=current_school_id(),
            email=email
        ).first()
        if existing_email:
            return jsonify({"error": "email already exists"}), 409

    if not password:
        import secrets
        password = secrets.token_urlsafe(8)

    u = User(
        school_id=current_school_id(),
        username=username,
        email=email,
        role=role,
        is_active=True,
    )
    u.set_password(password)
    db.session.add(u)
    db.session.commit()

    return jsonify({
        "ok": True,
        "user": {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
        },
        "temp_password": password,
    }), 201

@admin_users_bp.get("/admin/users")
@admin_users_bp.get("/api/admin/users")
@admin_users_bp.get("/api/s/<slug>/admin/users")
@school_context_required
@roles_required(ROLE_ADMIN)
def admin_list_users(slug=None):
    User = bridge.User

    users = (
        User.query
        .filter_by(school_id=current_school_id())
        .order_by(User.id.desc())
        .limit(200)
        .all()
    )

    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in users
    ])

@admin_users_bp.patch("/admin/users/<int:user_id>")
@admin_users_bp.patch("/api/admin/users/<int:user_id>")
@admin_users_bp.patch("/api/s/<slug>/admin/users/<int:user_id>")
@school_context_required
@roles_required(ROLE_ADMIN)
@bridge.limiter.limit("30 per minute")
def admin_update_user(user_id: int, slug=None):
    User = bridge.User
    db = bridge.db

    data = request.get_json(silent=True) or {}
    is_active = data.get("is_active")
    role = data.get("role")
    email = data.get("email")

    u = User.query.filter_by(
        id=user_id,
        school_id=current_school_id()
    ).first()

    if not u:
        return jsonify({"error": "User not found"}), 404

    if email is not None:
        email = (str(email).strip().lower() or None)
        if email:
            existing = User.query.filter(
                User.school_id == current_school_id(),
                User.email == email,
                User.id != u.id
            ).first()
            if existing:
                return jsonify({"error": "email already exists"}), 409
        u.email = email

    if role is not None:
        role = str(role).strip().lower()
        if role not in ("admin", "teacher", "parent", "student"):
            return jsonify({"error": "invalid role"}), 400
        u.role = role

    if is_active is not None:
        u.is_active = bool(is_active)

    db.session.commit()
    return jsonify({
        "ok": True,
        "user": {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
        }
    })

@admin_users_bp.post("/admin/users/<int:user_id>/reset-password")
@admin_users_bp.post("/api/admin/users/<int:user_id>/reset-password")
@admin_users_bp.post("/api/s/<slug>/admin/users/<int:user_id>/reset-password")
@school_context_required
@roles_required(ROLE_ADMIN)
@bridge.limiter.limit("10 per minute")
def admin_reset_password(user_id: int, slug=None):
    User = bridge.User
    db = bridge.db
    import secrets

    u = User.query.filter_by(
        id=user_id,
        school_id=current_school_id()
    ).first()

    if not u:
        return jsonify({"error": "User not found"}), 404

    temp_password = secrets.token_urlsafe(8)
    u.set_password(temp_password)
    db.session.commit()

    return jsonify({
        "ok": True,
        "user": {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
        },
        "temp_password": temp_password,
    })