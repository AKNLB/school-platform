import os
import uuid
from datetime import datetime, date
from functools import wraps

import sqlalchemy as sa
from flask import (
    Flask,
    abort,
    g,
    jsonify,
    request,
    session,
    url_for,
)
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
from sqlalchemy import text
from sqlalchemy.orm import with_loader_criteria
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

# -----------------------------------------------------------------------------
# Paths / config
# -----------------------------------------------------------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STORAGE_ROOT = os.getenv("STORAGE_ROOT") or BASE_DIR

UPLOADS_DIR = os.path.join(STORAGE_ROOT, "uploads")
SCHOOL_LOGO_DIR = os.path.join(UPLOADS_DIR, "school")
UPLOAD_ANNOUNCEMENTS = os.path.join(UPLOADS_DIR, "announcements")
UPLOAD_DOCS = os.path.join(STORAGE_ROOT, "uploaded_docs")
UPLOAD_PHOTOS = os.path.join(UPLOADS_DIR, "photos")
UPLOAD_RESOURCES = os.path.join(UPLOADS_DIR, "resources")
RECEIPT_DIR = os.path.join(STORAGE_ROOT, "receipts")

for folder in (
    SCHOOL_LOGO_DIR,
    UPLOAD_ANNOUNCEMENTS,
    UPLOAD_DOCS,
    UPLOAD_PHOTOS,
    UPLOAD_RESOURCES,
    RECEIPT_DIR,
):
    os.makedirs(folder, exist_ok=True)

ALLOWED_ANNOUNCEMENT_ATTACHMENTS = {
    "pdf", "png", "jpg", "jpeg", "doc", "docx", "xlsx", "pptx", "txt"
}
ALLOWED_DOCS = {"pdf", "doc", "docx", "txt", "xlsx", "pptx"}
ALLOWED_PHOTO = {"png", "jpg", "jpeg", "gif"}
ALLOWED_RESOURCE_TYPES = {"pdf", "doc", "docx", "txt", "xlsx", "pptx", "png", "jpg", "jpeg"}

DB_DIR = os.getenv("DB_DIR")
if not DB_DIR:
    if os.getenv("FLY_APP_NAME"):
        DB_DIR = "/data"
    else:
        DB_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DB_DIR, exist_ok=True)

DEFAULT_DB = f"sqlite:///{os.path.join(DB_DIR, 'school.db')}"

# -----------------------------------------------------------------------------
# App / extensions
# -----------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-not-for-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

app.config.update(
    SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", DEFAULT_DB),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    UPLOAD_DOCS=UPLOAD_DOCS,
    UPLOAD_PHOTOS=UPLOAD_PHOTOS,
    RECEIPT_DIR=RECEIPT_DIR,
    UPLOAD_ANNOUNCEMENTS=UPLOAD_ANNOUNCEMENTS,
    UPLOAD_RESOURCES=UPLOAD_RESOURCES,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
)

csrf = CSRFProtect()
csrf.init_app(app)

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    storage_uri=os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
)
limiter.init_app(app)

db = SQLAlchemy(app)
migrate = Migrate(app, db)

_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
_cors_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()]

CORS(app, supports_credentials=True, origins=_cors_origins)
socketio = SocketIO(app, cors_allowed_origins=_cors_origins)

if os.environ.get("FLASK_ENV") == "production":
    if app.secret_key == "dev-not-for-production":
        raise RuntimeError("SECRET_KEY must be set in production")
    if not app.config["SESSION_COOKIE_SECURE"]:
        print("WARNING: COOKIE_SECURE is not enabled in production (set COOKIE_SECURE=1 when using HTTPS)")

# -----------------------------------------------------------------------------
# Small helpers
# -----------------------------------------------------------------------------
def allowed_file(filename: str, allowed_set: set[str]) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_set


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def parse_time(value: str):
    value = (value or "").strip()
    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"Invalid time: {value}")


def _sqlite_table_exists(conn, table_name: str) -> bool:
    try:
        row = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
            {"t": table_name},
        ).fetchone()
        return row is not None
    except Exception:
        return False


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
from datetime import datetime
class AuditLog(db.Model):
    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, nullable=False, index=True)
    user_id = db.Column(db.Integer, nullable=True, index=True)
    user_email = db.Column(db.String(255), nullable=True, index=True)

    module = db.Column(db.String(50), nullable=False, index=True)
    action = db.Column(db.String(50), nullable=False, index=True)

    entity_type = db.Column(db.String(50), nullable=False, index=True)
    entity_id = db.Column(db.String(50), nullable=True, index=True)
    entity_label = db.Column(db.String(255), nullable=True)

    details_json = db.Column(db.Text, nullable=True)

    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School", back_populates="users")

    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    role = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    is_superadmin = db.Column(db.Boolean, nullable=False, default=False)

    def set_password(self, raw_password: str):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw_password)


class School(db.Model):
    __tablename__ = "school"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, default="My School")
    academic_year = db.Column(db.String(50), nullable=True, default="")
    theme_color = db.Column(db.String(30), nullable=True, default="#5AB4FF")
    logo_filename = db.Column(db.String(255), nullable=True, default=None)
    slug = db.Column(db.String(60), unique=True, nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=True)

    users = db.relationship("User", back_populates="school")


class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    audience = db.Column(db.String(20), nullable=False, default="all", index=True)
    pinned = db.Column(db.Boolean, nullable=False, default=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    attachments_json = db.Column(db.Text, nullable=False, default="[]")

    created_by = db.relationship("User")

    def to_dict(self):
        import json

        try:
            attachments = json.loads(self.attachments_json or "[]")
        except Exception:
            attachments = []

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "audience": self.audience,
            "pinned": bool(self.pinned),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by_user_id": self.created_by_user_id,
            "attachments": [
                {
                    "filename": fn,
                    "url": url_for(
                        "announcements_bp.serve_announcement_attachment",
                        filename=fn,
                        _external=True,
                    ),
                }
                for fn in attachments
            ],
        }


class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    name = db.Column(db.String(120), nullable=False)
    dob = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(10), nullable=True)
    national_id = db.Column(db.String(50), nullable=True)
    grade = db.Column(db.Integer, nullable=False, default=1)
    email = db.Column(db.String(120), nullable=True)
    guardian_name = db.Column(db.String(120), nullable=True)
    guardian_contact = db.Column(db.String(120), nullable=True)
    home_address = db.Column(db.String(256), nullable=True)
    emergency_contact = db.Column(db.String(120), nullable=True)
    photo_filename = db.Column(db.String(120), nullable=True)


class Attendance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    date = db.Column(db.Date, nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    status = db.Column(db.String(10), nullable=False, default="present")
    note = db.Column(db.Text, nullable=True)
    student = db.relationship("Student")


class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    filename = db.Column(db.String(256), nullable=False)
    stored_name = db.Column(db.String(300), nullable=False)
    uploader = db.Column(db.String(80), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.Date, nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="Pending")
    audience = db.Column(db.String(20), nullable=False, default="all", index=True)
    assignee_type = db.Column(db.String(20), nullable=True, index=True)
    assignee_id = db.Column(db.Integer, nullable=True, index=True)
    created_by = db.Column(db.String(80), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "status": self.status,
            "audience": self.audience,
            "assignee_type": self.assignee_type,
            "assignee_id": self.assignee_id,
            "created_by": self.created_by,
        }


class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    date = db.Column(db.String(10), nullable=False, index=True)
    start_time = db.Column(db.String(5), nullable=True)
    end_time = db.Column(db.String(5), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    audience = db.Column(db.String(20), nullable=False, default="all", index=True)
    created_at = db.Column(db.String(32), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "date": self.date,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "location": self.location,
            "audience": self.audience,
            "created_at": self.created_at,
        }


class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False)
    subject = db.Column(db.String(50), nullable=False)
    cont_ass_score = db.Column(db.Integer, nullable=False)
    exam_score = db.Column(db.Integer, nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    date = db.Column(db.Date, default=date.today, nullable=False)
    term = db.Column(db.String(20), nullable=False)
    grade = db.Column(db.Integer, nullable=False)

    student = db.relationship("Student", backref="scores")
    teacher = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "subject": self.subject,
            "cont_ass_score": self.cont_ass_score,
            "exam_score": self.exam_score,
            "teacher_id": self.teacher_id,
            "date": self.date.isoformat(),
            "term": self.term,
            "grade": self.grade,
        }


class TuitionInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    student_id = db.Column(db.Integer, db.ForeignKey("student.id"), nullable=False, index=True)
    term = db.Column(db.String(20), nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    amount_paid = db.Column(db.Float, default=0)
    payment_plan = db.Column(db.String(20))
    status = db.Column(db.String(20))
    payments = db.relationship("PaymentHistory", backref="tuition", cascade="all, delete-orphan")


class PaymentHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    tuition_id = db.Column(db.Integer, db.ForeignKey("tuition_info.id"), nullable=False, index=True)
    amount = db.Column(db.Float, nullable=False)
    method = db.Column(db.String(30))
    reference = db.Column(db.String(100))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    note = db.Column(db.Text)


class SchoolSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    school_name = db.Column(db.String(200), default="My School")
    address = db.Column(db.String(300), default="")
    phone = db.Column(db.String(80), default="")
    email = db.Column(db.String(120), default="")
    logo_filename = db.Column(db.String(200), nullable=True)
    principal_name = db.Column(db.String(120), default="Principal")
    principal_signature_filename = db.Column(db.String(200), nullable=True)
    teacher_signature_filename = db.Column(db.String(200), nullable=True)


class Resource(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    filename = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    filetype = db.Column(db.String(50), nullable=False, default="file")
    version = db.Column(db.Integer, nullable=False, default=1)
    uploader = db.Column(db.String(120), nullable=True)
    upload_date = db.Column(db.String(50), nullable=False, default=now_str)
    category = db.Column(db.String(120), nullable=True)
    visibility = db.Column(db.String(30), nullable=True)
    root_id = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "stored_name": self.stored_name,
            "filetype": self.filetype,
            "version": self.version,
            "uploader": self.uploader,
            "upload_date": self.upload_date,
            "category": self.category,
            "visibility": self.visibility,
            "root_id": self.root_id,
        }


# -----------------------------------------------------------------------------
# School / auth helpers
# -----------------------------------------------------------------------------
def get_school_or_404(slug: str):
    slug = (slug or "").strip().lower()
    school = School.query.filter_by(slug=slug).first()
    if not school:
        abort(404, description="School not found")
    return school


def require_school_access(school: School, user: User):
    if user.is_superadmin:
        return
    if not user.school_id or int(user.school_id) != int(school.id):
        abort(403, description="Forbidden (wrong school)")


ROLE_ADMIN = "admin"
ROLE_TEACHER = "teacher"
ROLE_PARENT = "parent"
ROLE_STUDENT = "student"


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        uid = session.get("user_id")
        if not uid:
            return jsonify({"error": "Not authenticated"}), 401
        if not getattr(g, "user", None):
            return jsonify({"error": "Not authenticated"}), 401
        return fn(*args, **kwargs)
    return wrapper


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return db.session.get(User, int(uid))


def current_role():
    user = current_user()
    return user.role if user else None


def current_school_id():
    return session.get("school_id")


# -----------------------------------------------------------------------------
# Schema backfill helpers
# -----------------------------------------------------------------------------
def ensure_resource_schema():
    db.create_all()
    with db.engine.begin() as conn:
        exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='resource'")
        ).fetchone()
        if not exists:
            return

        cols = conn.execute(text("PRAGMA table_info(resource)")).fetchall()
        col_names = {c[1] for c in cols}

        if "category" not in col_names:
            conn.execute(text("ALTER TABLE resource ADD COLUMN category TEXT"))
        if "visibility" not in col_names:
            conn.execute(text("ALTER TABLE resource ADD COLUMN visibility TEXT"))
        if "root_id" not in col_names:
            conn.execute(text("ALTER TABLE resource ADD COLUMN root_id INTEGER"))


def ensure_event_columns():
    with db.engine.begin() as conn:
        if not _sqlite_table_exists(conn, "event"):
            return

        cols = conn.execute(text("PRAGMA table_info(event)")).fetchall()
        col_names = {c[1] for c in cols}

        if "start_time" not in col_names:
            conn.execute(text("ALTER TABLE event ADD COLUMN start_time TEXT"))
        if "end_time" not in col_names:
            conn.execute(text("ALTER TABLE event ADD COLUMN end_time TEXT"))
        if "audience" not in col_names:
            conn.execute(text("ALTER TABLE event ADD COLUMN audience TEXT DEFAULT 'all'"))
        if "created_at" not in col_names:
            conn.execute(text("ALTER TABLE event ADD COLUMN created_at TEXT"))
            conn.execute(
                text("UPDATE event SET created_at = :now WHERE created_at IS NULL"),
                {"now": datetime.utcnow().isoformat()},
            )
        if "location" not in col_names:
            conn.execute(text("ALTER TABLE event ADD COLUMN location TEXT"))


def ensure_task_schema():
    try:
        with db.engine.begin() as conn:
            cols = conn.execute(text("PRAGMA table_info(task)")).fetchall()
            col_names = {c[1] for c in cols}

            if "description" not in col_names:
                conn.execute(text("ALTER TABLE task ADD COLUMN description TEXT"))
            if "status" not in col_names:
                conn.execute(text("ALTER TABLE task ADD COLUMN status TEXT DEFAULT 'Pending'"))
            if "audience" not in col_names:
                conn.execute(text("ALTER TABLE task ADD COLUMN audience TEXT DEFAULT 'all'"))
            if "assignee_type" not in col_names:
                conn.execute(text("ALTER TABLE task ADD COLUMN assignee_type TEXT"))
            if "assignee_id" not in col_names:
                conn.execute(text("ALTER TABLE task ADD COLUMN assignee_id INTEGER"))
            if "created_by" not in col_names:
                conn.execute(text("ALTER TABLE task ADD COLUMN created_by TEXT"))
    except Exception:
        pass


def ensure_announcement_columns():
    with db.engine.begin() as conn:
        if not _sqlite_table_exists(conn, "announcement"):
            return

        cols = conn.execute(text("PRAGMA table_info(announcement)")).fetchall()
        col_names = {c[1] for c in cols}

        if "audience" not in col_names:
            conn.execute(text("ALTER TABLE announcement ADD COLUMN audience TEXT DEFAULT 'all'"))
        if "pinned" not in col_names:
            conn.execute(text("ALTER TABLE announcement ADD COLUMN pinned INTEGER DEFAULT 0"))
        if "created_at" not in col_names:
            conn.execute(text("ALTER TABLE announcement ADD COLUMN created_at TEXT"))
            conn.execute(
                text("UPDATE announcement SET created_at = :now WHERE created_at IS NULL"),
                {"now": datetime.utcnow().isoformat()},
            )
        if "created_by_user_id" not in col_names:
            conn.execute(text("ALTER TABLE announcement ADD COLUMN created_by_user_id INTEGER"))
        if "attachments_json" not in col_names:
            conn.execute(text("ALTER TABLE announcement ADD COLUMN attachments_json TEXT DEFAULT '[]'"))


def ensure_announcement_audience_column():
    ensure_announcement_columns()


# -----------------------------------------------------------------------------
# Tenancy
# -----------------------------------------------------------------------------
TENANT_MODELS = [
    Student,
    Announcement,
    Resource,
    Document,
    Attendance,
    Score,
    Task,
    Event,
    TuitionInfo,
    PaymentHistory,
    SchoolSettings,
]


@app.before_request
def _set_tenancy_context():
    g.school_id = None
    g.school_slug = None
    g.user = None
    g.is_superadmin = False

    slug = None
    if request.view_args and isinstance(request.view_args, dict):
        slug = request.view_args.get("slug")

    if not slug and request.path.startswith("/api/s/"):
        parts = request.path.split("/")
        if len(parts) >= 4 and parts[3]:
            slug = parts[3]

    if not slug:
        slug = request.headers.get("X-School-Slug")

    if request.path.startswith("/api/s/") and not slug:
        return jsonify({"error": "School slug required"}), 400

    if slug:
        sch = School.query.filter_by(slug=slug).first()
        if request.path.startswith("/api/s/") and not sch:
            abort(404, description="School not found")
        if sch:
            g.school_id = sch.id
            g.school_slug = sch.slug
            g.school = sch

    if g.school_id is None:
        sid = session.get("school_id")
        if sid is not None:
            try:
                g.school_id = int(sid)
            except Exception:
                g.school_id = None

    uid = session.get("user_id")
    if uid:
        try:
            u = db.session.get(User, int(uid))
        except Exception:
            u = None
        if u:
            g.user = u
            g.is_superadmin = bool(getattr(u, "is_superadmin", False))
            if g.school_id is None and getattr(u, "school_id", None) is not None:
                g.school_id = int(u.school_id)

    if g.school_id is None:
        try:
            first = db.session.execute(
                sa.text("SELECT id, slug FROM school ORDER BY id LIMIT 1")
            ).first()
            if first:
                g.school_id = int(first[0])
                g.school_slug = first[1]
        except Exception:
            pass


from sqlalchemy import event as _sa_event
from flask import has_request_context

@_sa_event.listens_for(db.session, "do_orm_execute")
def _tenant_scope_orm(execute_state):
    if not has_request_context():
        return
    if getattr(g, "is_superadmin", False):
        return
    sid = getattr(g, "school_id", None)
    if not sid:
        return
    if not execute_state.is_select:
        return

    stmt = execute_state.statement
    for M in TENANT_MODELS:
        stmt = stmt.options(
            with_loader_criteria(
                M,
                lambda cls, sid=sid: cls.school_id == sid,
                include_aliases=True,
            )
        )
    execute_state.statement = stmt


@_sa_event.listens_for(db.session, "before_flush")
def _tenant_set_school_id(session_, flush_context, instances):
    if not has_request_context():
        return
    if getattr(g, "is_superadmin", False):
        return
    sid = getattr(g, "school_id", None)
    if not sid:
        return

    for obj in session_.new:
        if hasattr(obj, "school_id") and getattr(obj, "school_id", None) is None:
            try:
                obj.school_id = int(sid)
            except Exception:
                obj.school_id = sid


# -----------------------------------------------------------------------------
# Seed / init
# -----------------------------------------------------------------------------
def init_db():
    db.create_all()
    ensure_resource_schema()
    ensure_task_schema()
    ensure_event_columns()
    ensure_announcement_columns()

    school = School.query.order_by(School.id).first()
    if not school:
        school = School(
            name="ABC Learning Centre",
            slug="abc-learning-centre",
            created_at=datetime.utcnow(),
        )
        db.session.add(school)
        db.session.commit()

    if not SchoolSettings.query.filter_by(school_id=school.id).first():
        db.session.add(
            SchoolSettings(
                school_id=school.id,
                school_name=school.name,
            )
        )

    if not User.query.filter_by(school_id=school.id).first():
        admin = User(username="admin", email="admin@school.com", role="admin", school_id=school.id)
        admin.set_password("admin123")

        t1 = User(username="teacher1", email="teacher1@school.com", role="teacher", school_id=school.id)
        t1.set_password("teachpass")

        mom = User(username="mom@example.com", email=None, role="parent", school_id=school.id)
        mom.set_password("parentpass")

        db.session.add_all([admin, t1, mom])

    if not Student.query.filter_by(school_id=school.id).first():
        db.session.add_all(
            [
                Student(
                    school_id=school.id,
                    name="Alice Smith",
                    dob=date(2015, 5, 10),
                    gender="Female",
                    national_id="A123",
                    grade=5,
                    email="alice@example.com",
                    guardian_name="Mary Smith",
                    guardian_contact="mary@example.com",
                    home_address="123 Maple Ave",
                    emergency_contact="mary@example.com",
                ),
                Student(
                    school_id=school.id,
                    name="Bob Johnson",
                    dob=date(2014, 8, 23),
                    gender="Male",
                    national_id="B456",
                    grade=6,
                    email="bob@example.com",
                    guardian_name="John Johnson",
                    guardian_contact="john@example.com",
                    home_address="456 Oak St",
                    emergency_contact="john@example.com",
                ),
            ]
        )

    db.session.commit()


# -----------------------------------------------------------------------------
# Remaining non-modular routes
# -----------------------------------------------------------------------------
@app.route("/")
def index():
    return "<h1>School Administration API is running ✅</h1>"


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many requests. Please slow down and try again."}), 429


@app.get("/api/health")
def api_health():
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    path = None
    exists = None
    size = None

    try:
        if uri.startswith("sqlite:///"):
            path = uri.replace("sqlite:///", "", 1).replace("////", "/")
            exists = os.path.exists(path)
            size = os.path.getsize(path) if exists else None
    except Exception:
        pass

    try:
        db.session.execute(sa.text("SELECT 1")).first()
        db_ok = True
        err = None
    except Exception as e:
        db_ok = False
        err = str(e)

    return jsonify({
        "ok": True,
        "service": "backend",
        "db_ok": db_ok,
        "db_uri": uri,
        "db_path": path,
        "db_exists": exists,
        "db_size": size,
        "error": err,
    }), 200


@app.get("/api/s/<slug>/ping")
def tenant_ping(slug):
    return jsonify({
        "ok": True,
        "slug": slug,
        "school_id": getattr(g, "school_id", None),
        "school_slug": getattr(g, "school_slug", None),
    })


@app.get("/api/ping")
def ping():
    return jsonify({"ok": True, "service": "backend"})


@app.get("/api/health/db")
def health_db():
    try:
        db.session.execute(sa.text("SELECT 1")).first()
        db.session.execute(sa.text("PRAGMA journal_mode=WAL;"))
        return jsonify({"ok": True, "db": "ok", "journal_mode": "WAL"})
    except Exception as e:
        return jsonify({"ok": False, "db": "error", "error": str(e)}), 500


@app.route("/api/s/<slug>/documents", methods=["GET"])
@app.route("/api/documents", methods=["GET"])
def api_documents_list(slug=None):
    return jsonify([]), 200


@app.get("/api/s/<slug>/parent/me")
@app.get("/api/parent/me")
def parent_me(slug=None):
    username = request.args.get("username", "").strip()
    if not username:
        return jsonify({"error": "username is required"}), 400

    parent = User.query.filter_by(username=username, role="parent").first()
    if not parent:
        return jsonify({"error": "parent not found"}), 404

    rows = db.session.execute(
        text("SELECT student_id FROM parents_students WHERE parent_id = :pid"),
        {"pid": parent.id},
    ).fetchall()
    student_ids = [r[0] for r in rows]

    children = []
    if student_ids:
        students = Student.query.filter(Student.id.in_(student_ids)).all()
        children = [
            {
                "id": s.id,
                "name": s.name,
                "grade": s.grade,
                "guardian_name": getattr(s, "guardian_name", None),
                "guardian_contact": getattr(s, "guardian_contact", None),
                "photo_url": (
                    url_for("students_bp.serve_photo", filename=s.photo_filename, _external=True)
                    if getattr(s, "photo_filename", None)
                    else None
                ),
            }
            for s in students
        ]

    return jsonify({
        "parent": {"id": parent.id, "username": parent.username},
        "count": len(children),
        "children": children,
    })


# -----------------------------------------------------------------------------
# CLI seed
# -----------------------------------------------------------------------------
import click

@app.cli.command("seed")
@click.option("--name", default="ABC Learning Centre")
@click.option("--slug", default="abc-learning-centre")
@click.option("--email", default="admin@school.com")
@click.option("--password", default="admin123")
def seed_cmd(name, slug, email, password):
    s = School.query.filter_by(slug=slug).first()
    if not s:
        s = School(name=name, slug=slug)
        db.session.add(s)
        db.session.commit()
        print("✅ Created school:", s.id, s.slug)

    u = User.query.filter_by(email=email.lower(), school_id=s.id).first()
    if not u:
        u = User(
            email=email.lower(),
            username="admin",
            school_id=s.id,
            role="admin",
            is_active=True,
            is_superadmin=True,
        )
        u.password_hash = generate_password_hash(password)
        db.session.add(u)
        db.session.commit()
        print("✅ Created admin:", u.id, u.email)
    else:
        print("ℹ️ Admin already exists:", u.id, u.email)


# -----------------------------------------------------------------------------
# Bridge wiring + modular routes
# -----------------------------------------------------------------------------
import app.bridge as bridge

bridge.db = db
bridge.limiter = limiter
bridge.csrf = csrf

bridge.User = User
bridge.School = School
bridge.Student = Student
bridge.Attendance = Attendance
bridge.Score = Score
bridge.SchoolSettings = SchoolSettings
bridge.TuitionInfo = TuitionInfo
bridge.PaymentHistory = PaymentHistory
bridge.Resource = Resource
bridge.Announcement = Announcement
bridge.Task = Task
bridge.Event = Event

bridge.date = date
bridge.allowed_file = allowed_file
bridge.parse_date = parse_date
bridge.parse_time = parse_time
bridge.ALLOWED_PHOTO = ALLOWED_PHOTO
bridge.secure_filename = secure_filename
bridge.uuid = uuid
bridge.now_str = now_str
bridge.ALLOWED_RESOURCE_TYPES = ALLOWED_RESOURCE_TYPES
bridge.UPLOAD_ANNOUNCEMENTS = UPLOAD_ANNOUNCEMENTS
bridge.ALLOWED_ANNOUNCEMENT_ATTACHMENTS = ALLOWED_ANNOUNCEMENT_ATTACHMENTS
bridge.current_user = current_user
bridge.get_school_or_404 = get_school_or_404
bridge.require_school_access = require_school_access
bridge.AuditLog = AuditLog
from app.routes import register_routes
register_routes(app)



# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
if os.environ.get("AUTO_INIT_DB", "0") == "1":
    with app.app_context():
        init_db()

if __name__ == "__main__":
    with app.app_context():
        init_db()
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 1994)), debug=True)