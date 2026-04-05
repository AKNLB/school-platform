from functools import wraps
from flask import session, jsonify
import app.bridge as bridge

ROLE_ADMIN = "admin"
ROLE_TEACHER = "teacher"
ROLE_PARENT = "parent"
ROLE_STUDENT = "student"

def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    User = bridge.User
    return User.query.get(int(uid)) if User else None

def current_role():
    user = current_user()
    return user.role if user else None

def current_school_id():
    return session.get("school_id")

def is_admin():
    return current_role() == ROLE_ADMIN

def is_teacher():
    return current_role() == ROLE_TEACHER

def is_parent():
    return current_role() == ROLE_PARENT

def is_student():
    return current_role() == ROLE_STUDENT

def roles_required(*allowed_roles):
    def outer(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            u = current_user()
            if not u or not u.is_active:
                return jsonify({"error": "Not authenticated"}), 401
            if u.role not in allowed_roles:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return outer

def school_context_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        u = current_user()
        if not u or not u.is_active:
            return jsonify({"error": "Not authenticated"}), 401

        school_id = current_school_id()
        if not school_id:
            return jsonify({"error": "School context missing"}), 403

        if getattr(u, "school_id", None) != school_id:
            return jsonify({"error": "Forbidden"}), 403

        return fn(*args, **kwargs)
    return wrapper