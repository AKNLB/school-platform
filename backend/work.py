# app.py
import os
import tempfile
import base64
import uuid
from datetime import datetime, date

from markupsafe import escape
from flask import (
    Flask,
    request,
    g,
    jsonify,
    send_from_directory,
    abort,
    make_response,
    render_template_string,
    send_file,
    url_for,
)
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
from sqlalchemy import func, case, text
import sqlalchemy as sa
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash


def _sqlite_table_exists(conn, table_name: str) -> bool:
    try:
        row = conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=:t"
        ), {"t": table_name}).fetchone()
        return row is not None
    except Exception:
        return False

from datetime import datetime
from weasyprint import HTML
from flask import g
from flask import abort

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
SCHOOL_LOGO_DIR = os.path.join(UPLOADS_DIR, "school")
os.makedirs(SCHOOL_LOGO_DIR, exist_ok=True)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_ANNOUNCEMENTS = os.path.join(BASE_DIR, "uploads", "announcements")
os.makedirs(UPLOAD_ANNOUNCEMENTS, exist_ok=True)

ALLOWED_ANNOUNCEMENT_ATTACHMENTS = {"pdf", "png", "jpg", "jpeg", "doc", "docx", "xlsx", "pptx", "txt"}

UPLOAD_DOCS = os.path.join(BASE_DIR, "uploaded_docs")
UPLOAD_PHOTOS = os.path.join(BASE_DIR, "uploads", "photos")
RECEIPT_DIR = os.path.join(BASE_DIR, "receipts")

for folder in (UPLOAD_DOCS, UPLOAD_PHOTOS, RECEIPT_DIR):
    os.makedirs(folder, exist_ok=True)

ALLOWED_DOCS = {"pdf", "doc", "docx", "txt", "xlsx", "pptx"}
ALLOWED_PHOTO = {"png", "jpg", "jpeg", "gif"}



def allowed_file(filename: str, allowed_set: set[str]) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_set


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_RESOURCES = os.path.join(BASE_DIR, "uploads", "resources")
os.makedirs(UPLOAD_RESOURCES, exist_ok=True)
ALLOWED_RESOURCE_TYPES = {"pdf", "doc", "docx", "txt", "xlsx", "pptx", "png", "jpg", "jpeg"}
DB_DIR = os.environ.get("DB_DIR", "/data")
os.makedirs(DB_DIR, exist_ok=True)
app = Flask(__name__)

# --- Tenancy URL support: grab <slug> from URL prefix and remove it from view args ---

app.secret_key = os.environ.get("SECRET_KEY", "dev-not-for-production")

# Respect X-Forwarded-* headers when behind nginx / a reverse proxy.
# This is important for correct scheme detection (https) and client IPs.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

DEFAULT_DB = f"sqlite:///{os.path.join(DB_DIR, 'school.db')}"

app.config.update(
    SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", DEFAULT_DB),
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    UPLOAD_DOCS=UPLOAD_DOCS,
    UPLOAD_PHOTOS=UPLOAD_PHOTOS,
    RECEIPT_DIR=RECEIPT_DIR,
    UPLOAD_ANNOUNCEMENTS=UPLOAD_ANNOUNCEMENTS,
    UPLOAD_RESOURCES=UPLOAD_RESOURCES,
)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
_cookie_secure = os.environ.get("COOKIE_SECURE", "0") == "1"
app.config["SESSION_COOKIE_SECURE"] = _cookie_secure


db = SQLAlchemy(app)
migrate = Migrate(app, db)

# CORS: in dev you can allow '*', but for real deployment set CORS_ORIGINS
# to a comma-separated list (e.g. https://app.example.com,https://admin.example.com)
_cors_origins = os.environ.get("CORS_ORIGINS", "*")
_cors_origins = [o.strip() for o in _cors_origins.split(",") if o.strip()] if _cors_origins != "*" else "*"
socketio = SocketIO(app, cors_allowed_origins=_cors_origins)

# Refuse unsafe defaults in production.
if os.environ.get("FLASK_ENV") == "production":
    if app.secret_key == "dev-not-for-production":
        raise RuntimeError("SECRET_KEY must be set in production")
    # If you're behind HTTPS, you should set COOKIE_SECURE=1.
    # We don't hard-fail here, but we do warn loudly in logs.
    if not _cookie_secure:
        print("WARNING: COOKIE_SECURE is not enabled in production (set COOKIE_SECURE=1 when using HTTPS)")


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _sqlite_has_column(table: str, column: str) -> bool:
    rows = db.session.execute(text(f"PRAGMA table_info({table})")).fetchall()
    cols = {r[1] for r in rows}  # r[1] is column name
    return column in cols


def ensure_resource_schema():
    """
    Make sure SQLite table 'resource' has the newer columns used by the Resources tab.
    Safe to run repeatedly.

    Why this exists:
      - You may have created the SQLite DB earlier before we added new columns
        like `category`, `visibility`, `root_id`.
      - SQLite won't auto-add columns from SQLAlchemy model changes.
    """
    db.create_all()

    # Make sure the table exists
    with db.engine.begin() as conn:
        exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='resource'")
        ).fetchone()
        if not exists:
            return

        cols = conn.execute(text("PRAGMA table_info(resource)")).fetchall()
        col_names = {c[1] for c in cols}  # c[1] is the column name

        # Add missing columns (SQLite supports ALTER TABLE ADD COLUMN)
        if "category" not in col_names:
            conn.execute(text("ALTER TABLE resource ADD COLUMN category TEXT"))
        if "visibility" not in col_names:
            conn.execute(text("ALTER TABLE resource ADD COLUMN visibility TEXT"))
        if "root_id" not in col_names:
            conn.execute(text("ALTER TABLE resource ADD COLUMN root_id INTEGER"))



def _resource_safe_store(file_storage):
    original = secure_filename(file_storage.filename or "resource")
    ext = ""
    if "." in original:
        ext = "." + original.rsplit(".", 1)[1].lower()

    stored = f"res_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}_{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(app.config["UPLOAD_RESOURCES"], stored)
    file_storage.save(save_path)
    return original, stored






def ensure_event_columns():
    """Backfill newer columns for Event table on existing SQLite DBs.

    Safe to call on a brand-new DB (table may not exist yet).
    """
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
    """Ensure SQLite table 'task' has newer columns used by the Tasks tab."""
    # Only needed for SQLite (safe for others, but PRAGMA is SQLite-specific)
    try:
        with db.engine.begin() as conn:
            cols = conn.execute(text("PRAGMA table_info(task)")).fetchall()
            col_names = {c[1] for c in cols}

            # add columns progressively (SQLite supports ADD COLUMN)
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
        # If PRAGMA isn't supported (non-SQLite) or table doesn't exist yet,
        # db.create_all() will handle schema creation.
        pass




def ensure_announcement_columns():
    """Backfill newer columns for Announcement table on existing SQLite DBs.

    Safe to call even when the table doesn't exist yet.
    """
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
    """Legacy helper (kept for compatibility)."""
    ensure_announcement_columns()


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
from datetime import datetime

from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    school_id = db.Column(
        db.Integer,
        db.ForeignKey("school.id"),
        nullable=True,
        index=True,
    )

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


class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")


    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)

    # audience targeting: all/teachers/parents/students (store as string)
    audience = db.Column(db.String(20), nullable=False, default="all", index=True)

    # pinned announcements float to top
    pinned = db.Column(db.Boolean, nullable=False, default=False, index=True)

    # metadata
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    # attachments (store multiple filenames as JSON string for simplicity)
    # if you want proper relational table later, we can refactor
    attachments_json = db.Column(db.Text, nullable=False, default="[]")

    created_by = db.relationship("User")

    def to_dict(self):
        import json
        from flask import url_for

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
                    "url": url_for("serve_announcement_attachment", filename=fn, _external=True),
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
    status = db.Column(db.String(10), nullable=False, default="present")  # present/absent/late
    note = db.Column(db.Text, nullable=True)
    student = db.relationship("Student")


class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")

    filename = db.Column(db.String(256), nullable=False)  # original name
    stored_name = db.Column(db.String(300), nullable=False)  # on disk
    uploader = db.Column(db.String(80), nullable=False)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey("school.id"), nullable=True, index=True)
    school = db.relationship("School")


    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)

    due_date = db.Column(db.Date, nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="Pending")  # Pending/In Progress/Done

    # Role visibility: all/admin/teacher/parent/student
    audience = db.Column(db.String(20), nullable=False, default="all", index=True)

    # --- Assignment (MVP+) ---
    # "teacher" or "student" (optional)
    assignee_type = db.Column(db.String(20), nullable=True, index=True)
    # teacher_id or student_id depending on type (optional)
    assignee_id = db.Column(db.Integer, nullable=True, index=True)

    # Audit
    created_by = db.Column(db.String(80), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "due_date": self.due_date.isoformat(),
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

    # Store as YYYY-MM-DD strings for SQLite simplicity (works great)
    date = db.Column(db.String(10), nullable=False, index=True)

    # Optional fields
    start_time = db.Column(db.String(5), nullable=True)  # "HH:MM"
    end_time = db.Column(db.String(5), nullable=True)    # "HH:MM"
    location = db.Column(db.String(200), nullable=True)

    audience = db.Column(db.String(20), nullable=False, default="all", index=True)
    created_at = db.Column(db.String(32), nullable=True)  # ISO string

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

    # Newer fields (may be missing in old SQLite -> ensure_resource_schema adds)
    category = db.Column(db.String(120), nullable=True)
    visibility = db.Column(db.String(30), nullable=True)  # e.g. "all", "teacher", "parent"
    root_id = db.Column(db.Integer, nullable=True)       # for version chains

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

from datetime import datetime

from datetime import datetime

from datetime import datetime

class School(db.Model):
    __tablename__ = "school"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, default="My School")
    academic_year = db.Column(db.String(50), nullable=True, default="")
    theme_color = db.Column(db.String(30), nullable=True, default="#5AB4FF")
    logo_filename = db.Column(db.String(255), nullable=True, default=None)

    # tenancy
    slug = db.Column(db.String(60), unique=True, nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=True)

    users = db.relationship("User", back_populates="school")

    users = db.relationship("User", back_populates="school")


#-----
from flask import g

def get_school_or_404(slug: str):
    slug = (slug or "").strip().lower()
    school = School.query.filter_by(slug=slug).first()
    if not school:
        abort(404, description="School not found")
    return school


def require_login():
    uid = session.get("user_id")
    if not uid:
        abort(401, description="Not logged in")
    user = User.query.get(int(uid))
    if not user or not user.is_active:
        session.clear()
        abort(401, description="Not logged in")
    return user


def require_school_access(school: School, user: User):
    # superadmin can access any school
    if user.is_superadmin:
        return

    # normal users must belong to this school
    if not user.school_id or int(user.school_id) != int(school.id):
        abort(403, description="Forbidden (wrong school)")





# -----------------------------------------------------------------------------
# Init & Seed
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Tenancy (multi-school) helpers
# -----------------------------------------------------------------------------
from flask import has_request_context

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
    """Resolve the active school for this request.

    Priority:
      1) /api/s/<slug>/... routes
      2) X-School-Slug header
      3) session["school_id"]
      4) single-school fallback (first school)
    """
    g.school_id = None
    g.school_slug = None
    g.user = None
    g.is_superadmin = False

    # 1) slug in URL (prefer view_args, but fall back to parsing the path)
    slug = None

    # when Flask routing is matched, view_args should contain slug
    if request.view_args and isinstance(request.view_args, dict):
        slug = request.view_args.get("slug")

    # fallback: parse /api/s/<slug>/... directly from the path
    if not slug and request.path.startswith("/api/s/"):
        parts = request.path.split("/")
        # ["", "api", "s", "<slug>", ...]
        if len(parts) >= 4 and parts[3]:
            slug = parts[3]


    # 2) header fallback
    if not slug:
        slug = request.headers.get("X-School-Slug")

    # if you're hitting a /api/s/<slug>/... route, slug MUST exist
    if request.path.startswith("/api/s/") and not slug:
        return jsonify({"error": "School slug required"}), 400

    if slug:
        sch = School.query.filter_by(slug=slug).first()

        # if slug was provided in the URL but school doesn't exist, return 404
        if request.path.startswith("/api/s/") and not sch:
            abort(404, description="School not found")

        if sch:
            g.school_id = sch.id
            g.school_slug = sch.slug
            g.school = sch


    # 3) session
    if g.school_id is None:
        sid = session.get("school_id")
        if sid is not None:
            try:
                g.school_id = int(sid)
            except Exception:
                g.school_id = None

    # user context (and superadmin)
    uid = session.get("user_id")
    if uid:
        try:
            u = User.query.get(int(uid))
        except Exception:
            u = None
        if u:
            g.user = u
            g.is_superadmin = bool(getattr(u, "is_superadmin", False))
            # if no school chosen yet, use user's school
            if g.school_id is None and getattr(u, "school_id", None) is not None:
                g.school_id = int(u.school_id)

    # 4) fallback to the only/first school
    if g.school_id is None:
        try:
            first = db.session.execute(sa.text("SELECT id, slug FROM school ORDER BY id LIMIT 1")).first()
            if first:
                g.school_id = int(first[0])
                g.school_slug = first[1]
        except Exception:
            pass


# Auto-scope ORM SELECTs to the active school for tenant-owned tables.
from sqlalchemy.orm import with_loader_criteria
from sqlalchemy import event as _sa_event


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

def init_db():
    """Create tables and seed a default school + demo users/students.

    IMPORTANT:
      - In production, you typically seed via an admin UI / scripts.
      - Keep this lightweight and idempotent.
    """
    db.create_all()

    # Ensure at least one school exists
    school = School.query.order_by(School.id).first()
    if not school:
        school = School(
            name="ABC Learning Centre",
            slug="abc-learning-centre",
            created_at=datetime.utcnow(),
        )
        db.session.add(school)
        db.session.commit()

    # Ensure school settings exists for this school
    if not SchoolSettings.query.filter_by(school_id=school.id).first():
        db.session.add(
            SchoolSettings(
                school_id=school.id,
                school_name=school.name,
            )
        )

    # Seed a few demo users (scoped to the default school)
    if not User.query.filter_by(school_id=school.id).first():
        admin = User(username="admin", email="admin@school.com", role="admin", school_id=school.id)
        admin.set_password("admin123")

        t1 = User(username="teacher1", email="teacher1@school.com", role="teacher", school_id=school.id)
        t1.set_password("teachpass")

        mom = User(username="mom@example.com", email=None, role="parent", school_id=school.id)
        mom.set_password("parentpass")

        db.session.add_all([admin, t1, mom])

    # Seed a couple students for the default school
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


if __name__ == "__main__":
    # dev-only convenience
    with app.app_context():
        init_db()


    pass
    # init_db()  # disabled: run migrations first





# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------



def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def student_to_dict(s: Student) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "dob": s.dob.isoformat() if s.dob else None,
        "gender": s.gender,
        "national_id": s.national_id,
        "grade": s.grade,
        "email": s.email,
        "guardian_name": s.guardian_name,
        "guardian_contact": s.guardian_contact,
        "home_address": s.home_address,
        "emergency_contact": s.emergency_contact,
        "photo_url": (
            url_for("serve_photo", filename=s.photo_filename, _external=True)
            if s.photo_filename
            else None
        ),
    }

def generate_remark(avg_score, attendance_pct):
    if avg_score >= 85 and attendance_pct >= 95:
        return "Excellent performance. Keep it up."
    if avg_score >= 70:
        return "Good effort. More consistency will yield better results."
    if avg_score >= 50:
        return "Fair performance. Needs more focus and practice."
    return "Needs serious improvement. Extra support recommended."

def get_or_create_school():
    sch = School.query.first()
    if not sch:
        sch = School(name="My School", academic_year="", theme_color="#5AB4FF", logo_filename=None)
        db.session.add(sch)
        db.session.commit()
    return sch


from flask import jsonify, request
from datetime import date

# -----------------------------
# MVP Endpoints to prevent 404s
# -----------------------------
from datetime import datetime
#----Get School Info------
@app.route("/api/s/<slug>/school", methods=["GET"])
@app.route("/api/school", methods=["GET"])
def api_school_get():
    sch = get_or_create_school()
    return jsonify({
        "id": sch.id,
        "name": sch.name,
        "academic_year": sch.academic_year or "",
        "theme_color": sch.theme_color or "#5AB4FF",
        "logo_url": f"/api/school/logo" if sch.logo_filename else None,
    })
#-----Update school info----
@app.route("/api/s/<slug>/school", methods=["PUT"])
@app.route("/api/school", methods=["PUT"])
def api_school_update():
    """
    Update school settings (single-school mode).

    Enforces theme_color strictly as a 6-digit hex color: #RRGGBB
    """
    sch = get_or_create_school()
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    academic_year = (data.get("academic_year") or "").strip()
    theme_color = (data.get("theme_color") or "").strip()

    if name:
        sch.name = name
    sch.academic_year = academic_year

    if theme_color:
        import re
        if not re.fullmatch(r"#([0-9a-fA-F]{6})", theme_color):
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "theme_color must be a hex color like #1A2B3C",
                    }
                ),
                400,
            )
        # Normalize for consistency
        sch.theme_color = theme_color.upper()

    db.session.commit()

    return jsonify(
        {
            "ok": True,
            "school": {
                "id": sch.id,
                "name": sch.name,
                "academic_year": sch.academic_year or "",
                "theme_color": sch.theme_color or "#5AB4FF",
                "logo_url": f"/api/school/logo" if sch.logo_filename else None,
            },
        }
    )

#------Upload Logo------
from werkzeug.utils import secure_filename

ALLOWED_LOGO_EXTS = {"png", "jpg", "jpeg", "webp"}

def allowed_logo(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_LOGO_EXTS

@app.route("/api/s/<slug>/school/logo", methods=["POST"])
@app.route("/api/school/logo", methods=["POST"])
def api_school_logo_upload():
    sch = get_or_create_school()

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
    path = os.path.join(SCHOOL_LOGO_DIR, stored)

    f.save(path)
    sch.logo_filename = stored
    db.session.commit()

    return jsonify({"ok": True, "logo_url": "/api/school/logo"})

#----Serve Logo-----
@app.route("/api/s/<slug>/school/logo", methods=["GET"])
@app.route("/api/school/logo", methods=["GET"])
def api_school_logo_get():
    sch = get_or_create_school()
    if not sch.logo_filename:
        return jsonify({"error": "No logo uploaded"}), 404

    path = os.path.join(SCHOOL_LOGO_DIR, sch.logo_filename)
    if not os.path.exists(path):
        return jsonify({"error": "Logo missing on disk"}), 404

    # download_name shows nice filename in browser downloads
    return send_file(path, as_attachment=False, download_name=sch.logo_filename)


@app.route("/api/s/<slug>/events", methods=["GET"])
@app.route("/api/events", methods=["GET"])
def events_list():
    date = request.args.get("date")
    dt_from = request.args.get("from")
    dt_to = request.args.get("to")
    audience = (request.args.get("audience") or "").strip().lower()

    # ✅ MUST initialize query FIRST
    q = Event.query

    if date:
        q = q.filter(Event.date == date)
    elif dt_from and dt_to:
        q = q.filter(Event.date >= dt_from).filter(Event.date <= dt_to)

    if audience and audience != "all":
        q = q.filter(Event.audience == audience)

    rows = (
        q.order_by(
            Event.date.asc(),
            (Event.start_time.is_(None)).asc(),
            Event.start_time.asc()
        )
        .all()
    )

    return jsonify([e.to_dict() for e in rows]), 200


@app.route("/api/s/<slug>/events", methods=["POST"])
@app.route("/api/events", methods=["POST"])
def events_create():
    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    date = (data.get("date") or "").strip()
    if not title or not date:
        return jsonify({"error": "title and date are required"}), 400

    audience = (data.get("audience") or "all").strip().lower()
    if audience not in ("all", "teachers", "parents", "students"):
        return jsonify({"error": "audience must be all|teachers|parents|students"}), 400

    ev = Event(
        title=title,
        description=(data.get("description") or "").strip() or None,
        date=date,
        start_time=(data.get("start_time") or "").strip() or None,
        end_time=(data.get("end_time") or "").strip() or None,
        location=(data.get("location") or "").strip() or None,
        audience=audience,
        created_at=datetime.utcnow().isoformat(),
    )
    db.session.add(ev)
    db.session.commit()
    return jsonify(ev.to_dict()), 201


@app.route("/api/s/<slug>/events/<int:eid>", methods=["PUT"])
@app.route("/api/events/<int:eid>", methods=["PUT"])
def events_update(eid):
    ev = Event.query.get_or_404(eid)
    data = request.get_json(silent=True) or {}

    if "title" in data:
        ev.title = (data.get("title") or "").strip()
    if "description" in data:
        ev.description = (data.get("description") or "").strip() or None
    if "date" in data:
        ev.date = (data.get("date") or "").strip()
    if "start_time" in data:
        ev.start_time = (data.get("start_time") or "").strip() or None
    if "end_time" in data:
        ev.end_time = (data.get("end_time") or "").strip() or None
    if "location" in data:
        ev.location = (data.get("location") or "").strip() or None
    if "audience" in data:
        aud = (data.get("audience") or "all").strip().lower()
        if aud not in ("all", "teachers", "parents", "students"):
            return jsonify({"error": "audience must be all|teachers|parents|students"}), 400
        ev.audience = aud

    if not ev.title or not ev.date:
        return jsonify({"error": "title and date cannot be empty"}), 400

    db.session.commit()
    return jsonify(ev.to_dict()), 200


@app.route("/api/s/<slug>/events/<int:eid>", methods=["DELETE"])
@app.route("/api/events/<int:eid>", methods=["DELETE"])
def events_delete(eid):
    ev = Event.query.get_or_404(eid)
    db.session.delete(ev)
    db.session.commit()
    return jsonify({"message": "Event deleted"}), 200

#------endpoint-------
import json
from flask import request, jsonify, session

from flask import g

@app.route("/api/s/<slug>/auth/login", methods=["POST"], endpoint="auth_login")
@app.route("/api/auth/login", methods=["POST"], endpoint="auth_login_noslug")
def auth_login(slug=None):
    # Support both /api/s/<slug>/... and /api/... by accepting slug from:
    # - URL param (preferred)
    # - JSON payload ("slug")
    # - request header X-School-Slug
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



@app.post("/api/s/<slug>/auth/logout")
@app.post("/api/auth/logout")
def auth_logout(slug=None):
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/s/<slug>/auth/me")
@app.get("/api/auth/me")
def auth_me(slug=None):
    # /api/auth/me uses the session's school_id by default.
    # If slug is provided, enforce it.
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

    # enforce membership
    require_school_access(school, user)

    return jsonify({
        "school": {"id": school.id, "slug": school.slug, "name": school.name},
        "user": {"id": g.user.id, "username": g.user.username, "email": g.user.email, "role": g.user.role},
    })

from functools import wraps
from flask import session, jsonify, g

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        uid = session.get("user_id")
        if not uid:
            return jsonify({"error": "Not authenticated"}), 401
        # g.user is already set in your before_request, so just double-check
        if not getattr(g, "user", None):
            return jsonify({"error": "Not authenticated"}), 401
        return fn(*args, **kwargs)
    return wrapper


from functools import wraps

def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    return User.query.get(int(uid))

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        u = current_user()
        if not u or not u.is_active or u.role != "admin":
            return jsonify({"error": "Forbidden"}), 403
        return fn(*args, **kwargs)
    return wrapper

@app.post("/admin/users")
@app.post("/api/admin/users")
@app.post("/api/s/<slug>/admin/users")
@admin_required
def admin_create_user(slug=None):
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip().lower()
    email = (data.get("email") or "").strip().lower() or None
    role = (data.get("role") or "").strip().lower()
    password = data.get("password") or ""

    if role not in ("admin", "teacher", "parent", "student"):
        return jsonify({"error": "role must be admin|teacher|parent|student"}), 400

    if not username:
        return jsonify({"error": "username is required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username already exists"}), 409

    if email and User.query.filter_by(email=email).first():
        return jsonify({"error": "email already exists"}), 409

    if not password:
        # generate a temp password if not supplied
        import secrets
        password = secrets.token_urlsafe(8)

    u = User(username=username, email=email, role=role, is_active=True)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()

    # Return temp password so admin can share it (later we’ll replace with invite email)
    return jsonify({"ok": True, "user": {"id": u.id, "username": u.username, "email": u.email, "role": u.role}, "temp_password": password}), 201

@app.get("/admin/users")
@app.get("/api/admin/users")
@app.get("/api/s/<slug>/admin/users")
@admin_required
def admin_list_users(slug=None):
    users = User.query.order_by(User.id.desc()).limit(200).all()
    return jsonify([{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active} for u in users])

@app.patch("/admin/users/<int:user_id>")
@app.patch("/api/admin/users/<int:user_id>")
@app.patch("/api/s/<slug>/admin/users/<int:user_id>")
@admin_required
def admin_update_user(user_id: int, slug=None):
    data = request.get_json(silent=True) or {}
    is_active = data.get("is_active")
    role = data.get("role")
    email = data.get("email")

    u = User.query.get_or_404(user_id)

    if email is not None:
        email = (str(email).strip().lower() or None)
        if email:
            existing = User.query.filter(User.email == email, User.id != u.id).first()
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
    return jsonify({"ok": True, "user": {"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active}})

@app.post("/admin/users/<int:user_id>/reset-password")
@app.post("/api/admin/users/<int:user_id>/reset-password")
@app.post("/api/s/<slug>/admin/users/<int:user_id>/reset-password")
@admin_required
def admin_reset_password(user_id: int, slug=None):
    import secrets
    u = User.query.get_or_404(user_id)

    temp_password = secrets.token_urlsafe(8)
    u.set_password(temp_password)
    db.session.commit()

    return jsonify({"ok": True, "user": {"id": u.id, "username": u.username, "email": u.email, "role": u.role}, "temp_password": temp_password})


@app.route("/api/s/<slug>/announcements", methods=["GET"])
@app.route("/api/announcements", methods=["GET"])
def announcements_list():
    """
    Optional query params:
      audience=all|teachers|parents|students
      pinned=true|false
      limit=50
    """
    audience = (request.args.get("audience") or "").strip().lower()
    pinned = request.args.get("pinned")
    limit = request.args.get("limit", type=int) or 50

    q = Announcement.query

    if audience:
        q = q.filter(Announcement.audience == audience)

    if pinned is not None:
        want = str(pinned).lower() in ("1", "true", "yes", "y")
        q = q.filter(Announcement.pinned == want)

    rows = (
        q.order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
         .limit(limit)
         .all()
    )
    return jsonify([a.to_dict() for a in rows]), 200


@app.route("/api/s/<slug>/announcements", methods=["POST"])
@app.route("/api/announcements", methods=["POST"])
def announcements_create():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    audience = (data.get("audience") or "all").strip().lower()
    pinned = bool(data.get("pinned", False))
    created_by_user_id = data.get("created_by_user_id")

    if not title or not description:
        return jsonify({"error": "title and description are required"}), 400

    if audience not in ("all", "teachers", "parents", "students"):
        return jsonify({"error": "audience must be all|teachers|parents|students"}), 400

    a = Announcement(
        title=title,
        description=description,
        audience=audience,
        pinned=pinned,
        created_by_user_id=int(created_by_user_id) if created_by_user_id else None,
        attachments_json="[]",
    )
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict()), 201


@app.route("/api/s/<slug>/announcements/<int:aid>", methods=["GET"])
@app.route("/api/announcements/<int:aid>", methods=["GET"])
def announcements_get(aid):
    a = Announcement.query.get_or_404(aid)
    return jsonify(a.to_dict()), 200


@app.route("/api/s/<slug>/announcements/<int:aid>", methods=["PUT"])
@app.route("/api/announcements/<int:aid>", methods=["PUT"])
def announcements_update(aid):
    a = Announcement.query.get_or_404(aid)
    data = request.get_json(silent=True) or {}

    if "title" in data:
        a.title = (data.get("title") or "").strip()
    if "description" in data:
        a.description = (data.get("description") or "").strip()
    if "audience" in data:
        audience = (data.get("audience") or "all").strip().lower()
        if audience not in ("all", "teachers", "parents", "students"):
            return jsonify({"error": "audience must be all|teachers|parents|students"}), 400
        a.audience = audience
    if "pinned" in data:
        a.pinned = bool(data.get("pinned"))
    if "created_by_user_id" in data:
        a.created_by_user_id = int(data["created_by_user_id"]) if data["created_by_user_id"] else None

    if not a.title or not a.description:
        return jsonify({"error": "title and description cannot be empty"}), 400

    db.session.commit()
    return jsonify(a.to_dict()), 200


@app.route("/api/s/<slug>/announcements/<int:aid>", methods=["DELETE"])
@app.route("/api/announcements/<int:aid>", methods=["DELETE"])
def announcements_delete(aid):
    a = Announcement.query.get_or_404(aid)

    # delete files from disk too
    try:
        files = json.loads(a.attachments_json or "[]")
    except Exception:
        files = []

    for fn in files:
        try:
            path = os.path.join(app.config["UPLOAD_ANNOUNCEMENTS"], fn)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

    db.session.delete(a)
    db.session.commit()
    return jsonify({"message": "Announcement deleted"}), 200


@app.route("/api/s/<slug>/announcements/<int:aid>/attachments", methods=["POST"])
@app.route("/api/announcements/<int:aid>/attachments", methods=["POST"])
def announcements_upload_attachment(aid):
    """
    multipart/form-data:
      file=<attachment>
    """
    a = Announcement.query.get_or_404(aid)

    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "file is required"}), 400

    if not allowed_file(f.filename, ALLOWED_ANNOUNCEMENT_ATTACHMENTS):
        return jsonify({"error": "Invalid attachment type"}), 400

    stored = secure_filename(f"ann_{aid}_{int(datetime.utcnow().timestamp())}_{f.filename}")
    f.save(os.path.join(app.config["UPLOAD_ANNOUNCEMENTS"], stored))

    try:
        arr = json.loads(a.attachments_json or "[]")
        if not isinstance(arr, list):
            arr = []
    except Exception:
        arr = []

    arr.append(stored)
    a.attachments_json = json.dumps(arr)
    db.session.commit()

    return jsonify(a.to_dict()), 201


@app.route("/api/s/<slug>/announcements/<int:aid>/attachments/<path:filename>", methods=["DELETE"])
@app.route("/api/announcements/<int:aid>/attachments/<path:filename>", methods=["DELETE"])
def announcements_delete_attachment(aid, filename):
    a = Announcement.query.get_or_404(aid)

    try:
        arr = json.loads(a.attachments_json or "[]")
        if not isinstance(arr, list):
            arr = []
    except Exception:
        arr = []

    if filename not in arr:
        return jsonify({"error": "attachment not found"}), 404

    arr = [x for x in arr if x != filename]
    a.attachments_json = json.dumps(arr)
    db.session.commit()

    # delete file from disk
    try:
        path = os.path.join(app.config["UPLOAD_ANNOUNCEMENTS"], filename)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    return jsonify(a.to_dict()), 200


@app.route("/announcement-attachments/<path:filename>")
def serve_announcement_attachment(filename):
    return send_from_directory(app.config["UPLOAD_ANNOUNCEMENTS"], filename)



@app.route("/api/s/<slug>/documents", methods=["GET"])
@app.route("/api/documents", methods=["GET"])
def api_documents_list():
    # Later: return real documents from DB
    return jsonify([]), 200


@app.route("/api/s/<slug>/events", methods=["GET"])
@app.route("/api/events", methods=["GET"])
def api_events_list():
    # Expected query: ?date=YYYY-MM-DD
    d = request.args.get("date", str(date.today()))
    # Later: return real events filtered by date
    return jsonify([]), 200


from sqlalchemy import or_

@app.route("/api/s/<slug>/tasks", methods=["GET", "POST"])
@app.route("/api/tasks", methods=["GET", "POST"])
def api_tasks():
    if request.method == "GET":
        role = (request.args.get("role") or "").strip().lower()  # admin/teacher/parent/student
        q = (request.args.get("q") or "").strip()
        status = (request.args.get("status") or "").strip()

        # Assignment filters (MVP+)
        assignee_type = (request.args.get("assignee_type") or "").strip().lower()  # teacher/student
        assignee_id = request.args.get("assignee_id")

        qs = Task.query

        if status:
            qs = qs.filter(Task.status == status)

        if q:
            qs = qs.filter(or_(
                Task.title.ilike(f"%{q}%"),
                Task.description.ilike(f"%{q}%")
            ))

        # Role visibility:
        # - admin sees all
        # - others see audience=all OR audience=<role> OR tasks assigned to them (by assignee_type/id)
        if role and role != "admin":
            vis_conditions = [Task.audience == "all", Task.audience == role]

            # If the client passes assignee_type/id, include tasks assigned to them
            if assignee_type and assignee_id:
                try:
                    aid = int(assignee_id)
                    vis_conditions.append(
                        (Task.assignee_type == assignee_type) & (Task.assignee_id == aid)
                    )
                except Exception:
                    pass

            qs = qs.filter(or_(*vis_conditions))

        # Optional: directly filter by assignment (for admin dashboards)
        if assignee_type and assignee_id:
            try:
                aid = int(assignee_id)
                qs = qs.filter(Task.assignee_type == assignee_type, Task.assignee_id == aid)
            except Exception:
                pass

        rows = qs.order_by(Task.due_date.asc(), Task.id.desc()).all()
        return jsonify([t.to_dict() for t in rows]), 200

    # POST create
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    due_date = data.get("due_date")

    if not title:
        return jsonify({"error": "title required"}), 400
    if not due_date:
        return jsonify({"error": "due_date required"}), 400

    assignee_type = (data.get("assignee_type") or "").strip().lower() or None
    assignee_id = data.get("assignee_id", None)
    if assignee_id in ("", None):
        assignee_id = None

    # validate assignment
    if assignee_type and assignee_type not in ("teacher", "student"):
        return jsonify({"error": "assignee_type must be teacher or student"}), 400

    t = Task(
        title=title,
        description=(data.get("description") or "").strip() or None,
        due_date=parse_date(due_date),
        status=(data.get("status") or "Pending").strip(),
        audience=(data.get("audience") or "all").strip().lower(),
        assignee_type=assignee_type,
        assignee_id=int(assignee_id) if assignee_id is not None else None,
        created_by=(data.get("created_by") or "").strip() or None,
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@app.route("/api/s/<slug>/tasks/<int:tid>", methods=["PUT", "DELETE"])
@app.route("/api/tasks/<int:tid>", methods=["PUT", "DELETE"])
def api_task_modify(tid):
    t = Task.query.get_or_404(tid)

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}

        if "title" in data:
            t.title = (data["title"] or "").strip()
        if "description" in data:
            t.description = (data["description"] or "").strip() or None
        if "due_date" in data:
            t.due_date = parse_date(data["due_date"])
        if "status" in data:
            t.status = (data["status"] or "Pending").strip()

        if "audience" in data:
            t.audience = (data["audience"] or "all").strip().lower()

        # assignment updates
        if "assignee_type" in data:
            at = (data["assignee_type"] or "").strip().lower() or None
            if at and at not in ("teacher", "student"):
                return jsonify({"error": "assignee_type must be teacher or student"}), 400
            t.assignee_type = at

        if "assignee_id" in data:
            aid = data["assignee_id"]
            t.assignee_id = int(aid) if aid not in (None, "") else None

        db.session.commit()
        return jsonify(t.to_dict()), 200

    db.session.delete(t)
    db.session.commit()
    return jsonify({"message": "Task deleted"}), 200


@app.route("/api/s/<slug>/resources", methods=["GET", "POST"])
@app.route("/api/resources", methods=["GET", "POST"])
def api_resources():
    """
    GET  /api/resources?q=...&type=...&category=...&visibility=...
    POST /api/resources  (multipart form-data: file, type, uploader, category, visibility)
    """
    if request.method == "GET":
        # optional filters
        q = (request.args.get("q") or "").strip().lower()
        filetype = (request.args.get("type") or "").strip().lower()
        category = (request.args.get("category") or "").strip().lower()
        visibility = (request.args.get("visibility") or "").strip().lower()

        qs = Resource.query

        if filetype:
            qs = qs.filter(Resource.filetype == filetype)
        if category:
            qs = qs.filter(Resource.category == category)
        if visibility:
            qs = qs.filter(Resource.visibility == visibility)

        rows = qs.order_by(Resource.upload_date.desc()).all()

        # simple search in python
        if q:
            rows = [
                r for r in rows
                if q in (r.filename or "").lower()
                or q in (r.filetype or "").lower()
                or q in (r.category or "").lower()
            ]

        return jsonify([r.to_dict() for r in rows]), 200

    # POST (upload)
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required (multipart form-data)"}), 400

    if not allowed_file(file.filename or "", ALLOWED_RESOURCE_TYPES):
        return jsonify({"error": f"Unsupported file type. Allowed: {sorted(ALLOWED_RESOURCE_TYPES)}"}), 400

    uploader = (request.form.get("uploader") or "").strip() or None
    filetype = (request.form.get("type") or "file").strip().lower()
    category = (request.form.get("category") or "").strip() or None
    visibility = (request.form.get("visibility") or "all").strip().lower() or "all"

    original, stored = _resource_safe_store(file)

    r = Resource(
        filename=original,
        stored_name=stored,
        filetype=filetype,
        version=1,
        uploader=uploader,
        upload_date=now_str(),
        category=category,
        visibility=visibility,
        root_id=None,
    )
    db.session.add(r)
    db.session.commit()

    # set root_id to itself for version chains
    r.root_id = r.id
    db.session.commit()

    return jsonify(r.to_dict()), 201


@app.route("/api/s/<slug>/resources/<int:rid>/download", methods=["GET"], endpoint="api_resource_download_v1")
@app.route("/api/resources/<int:rid>/download", methods=["GET"], endpoint="api_resource_download_v1")
def api_resource_download(rid: int):
    """
    GET /api/resources/<rid>/download
    """
    r = Resource.query.get_or_404(rid)
    return send_from_directory(
        app.config["UPLOAD_RESOURCES"],
        r.stored_name,
        as_attachment=True,
        download_name=r.filename,
    )


@app.route("/api/s/<slug>/resources/<int:rid>/version", methods=["POST"], endpoint="api_resource_new_version_v1")
@app.route("/api/resources/<int:rid>/version", methods=["POST"], endpoint="api_resource_new_version_v1")
def api_resource_new_version(rid: int):
    """
    POST /api/resources/<rid>/version  (multipart form-data: file, uploader)
    Creates a new Resource row as a new version linked by root_id.
    """
    parent = Resource.query.get_or_404(rid)

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "file is required (multipart form-data)"}), 400

    if not allowed_file(file.filename or "", ALLOWED_RESOURCE_TYPES):
        return jsonify({"error": f"Unsupported file type. Allowed: {sorted(ALLOWED_RESOURCE_TYPES)}"}), 400

    uploader = (request.form.get("uploader") or "").strip() or None

    original, stored = _resource_safe_store(file)

    r = Resource(
        filename=original,
        stored_name=stored,
        filetype=parent.filetype,
        version=(parent.version or 1) + 1,
        uploader=uploader or parent.uploader,
        upload_date=now_str(),
        category=parent.category,
        visibility=parent.visibility,
        root_id=parent.root_id or parent.id,
    )
    db.session.add(r)
    db.session.commit()

    return jsonify(r.to_dict()), 201


@app.route("/api/s/<slug>/resources/<int:rid>", methods=["DELETE"], endpoint="api_resource_delete_v1")
@app.route("/api/resources/<int:rid>", methods=["DELETE"], endpoint="api_resource_delete_v1")
def api_resource_delete(rid: int):
    """
    DELETE /api/resources/<rid>
    Deletes the row and the stored file if present.
    """
    r = Resource.query.get_or_404(rid)

    # delete file on disk
    try:
        path = os.path.join(app.config["UPLOAD_RESOURCES"], r.stored_name)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    db.session.delete(r)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200



@app.route("/api/s/<slug>/attendance/report", methods=["GET"])
@app.route("/api/attendance/report", methods=["GET"])
def api_attendance_report():
    # Optional query params:
    # ?from=YYYY-MM-DD&to=YYYY-MM-DD
    dt_from = request.args.get("from")
    dt_to = request.args.get("to")

    q = Attendance.query

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

    # summary
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
            "total_marked": len(records)
        }
    }), 200


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.route("/")
def index():
    return "<h1>School Administration API is running ✅</h1>"

#------remark route------

# ---- Auth ----
@app.route("/api/s/<slug>/login", methods=["POST"])
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    user = User.query.filter_by(username=data.get("username")).first()
    if user and user.check_password(data.get("password", "")):
        return jsonify({"id": user.id, "username": user.username, "role": user.role})
    return jsonify({"message": "Invalid credentials"}), 401


@app.route("/api/s/<slug>/signup", methods=["POST"])
@app.route("/api/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"error": "username & password required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "username taken"}), 409
    u = User(username=username, role="parent")
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    return jsonify({"message": "User created", "username": u.username}), 201


# ---- Students CRUD ----
@app.route("/api/s/<slug>/students", methods=["GET", "POST"])
@app.route("/api/students", methods=["GET", "POST"])
def students():
    if request.method == "GET":
        return jsonify([student_to_dict(s) for s in Student.query.order_by(Student.id).all()])

    data = request.get_json(silent=True) or {}
    if not data.get("name"):
        return jsonify({"error": "Name required"}), 400

    s = Student(
        name=data["name"].strip(),
        dob=parse_date(data["dob"]) if data.get("dob") else None,
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
    return jsonify({"id": s.id}), 201


@app.route("/api/s/<slug>/students/<int:student_id>", methods=["GET", "PUT", "DELETE"])
@app.route("/api/students/<int:student_id>", methods=["GET", "PUT", "DELETE"])
def modify_student(student_id):
    s = Student.query.get_or_404(student_id)

    # ✅ This GET fixes your 405 issue on /api/students/<id>
    if request.method == "GET":
        return jsonify(student_to_dict(s)), 200

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
            s.dob = parse_date(data["dob"]) if data["dob"] else None
        if "grade" in data:
            s.grade = int(data["grade"])

        db.session.commit()
        return jsonify({"message": "Student updated"}), 200

    db.session.delete(s)
    db.session.commit()
    return jsonify({"message": "Student deleted"}), 200


# ---- Photo upload & serve ----
@app.route("/api/s/<slug>/students/<int:student_id>/photo", methods=["POST"])
@app.route("/api/students/<int:student_id>/photo", methods=["POST"])
def upload_student_photo(student_id):
    s = Student.query.get_or_404(student_id)

    file = request.files.get("photo")
    if not file or file.filename == "":
        return jsonify({"error": "No file"}), 400
    if not allowed_file(file.filename, ALLOWED_PHOTO):
        return jsonify({"error": "Invalid type"}), 400

    fname = secure_filename(f"{student_id}_{int(datetime.utcnow().timestamp())}_{file.filename}")
    file.save(os.path.join(app.config["UPLOAD_PHOTOS"], fname))

    s.photo_filename = fname
    db.session.commit()
    return jsonify({"message": "Photo uploaded", "photo_url": url_for("serve_photo", filename=fname, _external=True)}), 201


@app.route("/photos/<filename>")
def serve_photo(filename):
    return send_from_directory(app.config["UPLOAD_PHOTOS"], filename)

# -----------------------------------------------------------------------------
# Health / Ping
# -----------------------------------------------------------------------------
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
    # if tenancy middleware resolved the school, it will be on g
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


# ---- Attendance ----
# ---- Attendance ----
@app.route("/api/s/<slug>/attendance", methods=["GET", "POST", "PUT"])
@app.route("/api/attendance", methods=["GET", "POST", "PUT"])
def attendance():
    if request.method == "GET":
        grade = request.args.get("grade", type=int)
        day = request.args.get("date")  # YYYY-MM-DD

        q = Attendance.query
        if grade is not None:
            q = q.join(Student, Student.id == Attendance.student_id).filter(Student.grade == grade)
        if day:
            q = q.filter(Attendance.date == parse_date(day))

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

    # POST = create a brand new record
    if request.method == "POST":
        if not payload.get("student_id") or not payload.get("date"):
            return jsonify({"error": "student_id and date required"}), 400

        r = Attendance(
            student_id=int(payload["student_id"]),
            date=parse_date(payload["date"]),
            status=(payload.get("status") or "present"),
            note=payload.get("note"),
        )
        db.session.add(r)
        db.session.commit()
        return jsonify({"id": r.id}), 201

    # PUT = update / upsert (supports bulk)
    # Accepts:
    #  - single object: { student_id, date, status, note }
    #  - OR array of those objects
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
        dt = parse_date(day)

        # upsert by (student_id, date)
        r = Attendance.query.filter_by(student_id=sid, date=dt).first()
        if r is None:
            r = Attendance(student_id=sid, date=dt)
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

@app.route("/api/s/<slug>/attendance/student/<int:student_id>", methods=["GET"])
@app.route("/api/attendance/student/<int:student_id>", methods=["GET"])
def attendance_student_history(student_id: int):
    limit = int(request.args.get("limit", 30))
    rows = (
        Attendance.query
        .filter_by(student_id=student_id)
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
    ])



# ---- Scores / Grades ----
@app.route("/api/s/<slug>/scores", methods=["GET", "POST"])
@app.route("/api/scores", methods=["GET", "POST"])
def scores():
    if request.method == "GET":
        student_id = request.args.get("student_id", type=int)
        term = request.args.get("term")
        grade = request.args.get("grade", type=int)

        q = Score.query
        if student_id is not None:
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

    r = Score(
        student_id=int(data["student_id"]),
        subject=str(data["subject"]).strip(),
        cont_ass_score=int(data["cont_ass_score"]),
        exam_score=int(data["exam_score"]),
        teacher_id=int(data["teacher_id"]),
        term=str(data["term"]).strip(),
        grade=int(data["grade"]),
        date=parse_date(data["date"]) if data.get("date") else date.today(),
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201


@app.route("/api/s/<slug>/scores/<int:score_id>", methods=["PUT", "DELETE"])
@app.route("/api/scores/<int:score_id>", methods=["PUT", "DELETE"])
def modify_score(score_id):
    r = Score.query.get_or_404(score_id)

    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        for fld in ["subject", "cont_ass_score", "exam_score", "teacher_id", "term", "grade"]:
            if fld in data:
                setattr(r, fld, data[fld])
        if "date" in data:
            r.date = parse_date(data["date"]) if data["date"] else r.date
        db.session.commit()
        return jsonify(r.to_dict()), 200

    db.session.delete(r)
    db.session.commit()
    return jsonify({"message": "Score deleted"}), 200


# ---- Tuition / Payments ----
@app.route("/api/s/<slug>/tuition/<int:student_id>", methods=["GET"])
@app.route("/api/tuition/<int:student_id>", methods=["GET"])
def get_tuition_info(student_id):
    term = request.args.get("term")
    q = TuitionInfo.query.filter_by(student_id=student_id)
    if term:
        q = q.filter_by(term=term)
    tuition = q.order_by(TuitionInfo.id.desc()).first()
    if not tuition:
        return jsonify({"message": "No tuition info found"}), 404

    return jsonify(
        {
            "id": tuition.id,
            "student_id": tuition.student_id,
            "term": tuition.term,
            "total_amount": tuition.total_amount,
            "amount_paid": tuition.amount_paid,

            # ✅ BOTH fields provided
            "balance": float(tuition.total_amount) - float(tuition.amount_paid),
            "balance_due": float(tuition.total_amount) - float(tuition.amount_paid),

            "payment_plan": tuition.payment_plan,
            "status": tuition.status,
            "payments": [
                {
                    "id": p.id,
                    "amount": p.amount,
                    "method": p.method,
                    "reference": p.reference,
                    "timestamp": p.timestamp.isoformat() if p.timestamp else None,
                    "note": p.note,
                }
                for p in tuition.payments
            ],
        }
    ), 200



@app.route("/api/s/<slug>/tuition", methods=["POST"])
@app.route("/api/tuition", methods=["POST"])
def create_or_update_tuition():
    data = request.get_json(silent=True) or {}
    required = ["student_id", "term", "total_amount"]
    missing = [k for k in required if k not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    student_id = int(data["student_id"])
    term = str(data["term"]).strip()
    total_amount = float(data["total_amount"])

    tuition = TuitionInfo.query.filter_by(student_id=student_id, term=term).first()
    if not tuition:
        tuition = TuitionInfo(student_id=student_id, term=term, total_amount=total_amount)
        db.session.add(tuition)
    else:
        tuition.total_amount = total_amount

    if "amount_paid" in data:
        tuition.amount_paid = float(data["amount_paid"])
    tuition.payment_plan = data.get("payment_plan")
    tuition.status = data.get("status")

    db.session.commit()
    return jsonify({"id": tuition.id}), 200


@app.route("/api/s/<slug>/tuition/<int:tuition_id>/payment", methods=["POST"])
@app.route("/api/tuition/<int:tuition_id>/payment", methods=["POST"])
def add_payment(tuition_id):
    tuition = TuitionInfo.query.get_or_404(tuition_id)
    data = request.get_json(silent=True) or {}

    if "amount" not in data:
        return jsonify({"error": "amount is required"}), 400

    p = PaymentHistory(
        tuition_id=tuition.id,
        amount=float(data["amount"]),
        method=data.get("method"),
        reference=data.get("reference"),
        note=data.get("note"),
    )
    db.session.add(p)

    tuition.amount_paid = float(tuition.amount_paid or 0) + float(p.amount)
    db.session.commit()
    return jsonify({"payment_id": p.id, "amount_paid": tuition.amount_paid}), 201

@app.route("/api/s/<slug>/settings", methods=["GET"])
@app.route("/api/settings", methods=["GET"])
def get_settings():
    s = SchoolSettings.query.first()
    if not s:
        s = SchoolSettings(school_name="My School")
        db.session.add(s); db.session.commit()

    def file_url(fname):
        return url_for("serve_asset", filename=fname, _external=True) if fname else None

    return jsonify({
        "school_name": s.school_name,
        "address": s.address,
        "phone": s.phone,
        "email": s.email,
        "logo_url": file_url(s.logo_filename),
        "principal_name": s.principal_name,
        "principal_signature_url": file_url(s.principal_signature_filename),
        "teacher_signature_url": file_url(s.teacher_signature_filename),
    }), 200


@app.route("/api/s/<slug>/settings", methods=["PUT"])
@app.route("/api/settings", methods=["PUT"])
def update_settings():
    s = SchoolSettings.query.first()
    if not s:
        s = SchoolSettings(school_name="My School")
        db.session.add(s)

    data = request.get_json(silent=True) or {}
    for k in ["school_name", "address", "phone", "email", "principal_name"]:
        if k in data:
            setattr(s, k, data[k] or "")

    db.session.commit()
    return jsonify({"message": "Settings updated"}), 200


@app.route("/api/s/<slug>/settings/upload", methods=["POST"])
@app.route("/api/settings/upload", methods=["POST"])
def upload_settings_asset():
    """
    multipart/form-data:
      file=<png/jpg>
      kind=logo | principal_signature | teacher_signature
    """
    kind = (request.form.get("kind") or "").strip()
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "file required"}), 400

    if not allowed_file(f.filename, {"png", "jpg", "jpeg"}):
        return jsonify({"error": "png/jpg only"}), 400

    s = SchoolSettings.query.first()
    if not s:
        s = SchoolSettings(school_name="My School")
        db.session.add(s); db.session.commit()

    fname = secure_filename(f"{kind}_{int(datetime.utcnow().timestamp())}_{f.filename}")
    save_dir = os.path.join(BASE_DIR, "assets")
    os.makedirs(save_dir, exist_ok=True)
    f.save(os.path.join(save_dir, fname))

    if kind == "logo":
        s.logo_filename = fname
    elif kind == "principal_signature":
        s.principal_signature_filename = fname
    elif kind == "teacher_signature":
        s.teacher_signature_filename = fname
    else:
        return jsonify({"error": "kind must be logo | principal_signature | teacher_signature"}), 400

    db.session.commit()
    return jsonify({"message": "uploaded", "filename": fname}), 201


@app.route("/assets/<filename>")
def serve_asset(filename):
    return send_from_directory(os.path.join(BASE_DIR, "assets"), filename)

# -----------------------------------------------------------------------------
# Report Card (JSON + PDF download)
# -----------------------------------------------------------------------------
def term_date_range(term: str, year: int):
    # simple defaults; adjust later to your actual school calendar
    if term == "Term 1":
        return date(year, 9, 1), date(year, 12, 31)
    if term == "Term 2":
        return date(year, 1, 1), date(year, 4, 30)
    if term == "Term 3":
        return date(year, 5, 1), date(year, 8, 31)
    # fallback
    return date(year, 1, 1), date(year, 12, 31)


def build_report_card(student_id: int, term: str, grade: int):
    student = Student.query.get_or_404(student_id)
    settings = SchoolSettings.query.first()

    # --- Scores (term+grade) ---
    scores = (
        Score.query
        .filter_by(student_id=student_id, term=term, grade=grade)
        .order_by(Score.subject.asc(), Score.date.desc())
        .all()
    )

    subjects = []
    total_sum = 0
    for sc in scores:
        total = int(sc.cont_ass_score or 0) + int(sc.exam_score or 0)
        subjects.append({
            "subject": sc.subject,
            "cont_ass": int(sc.cont_ass_score or 0),
            "exam": int(sc.exam_score or 0),
            "total": total,
        })
        total_sum += total

    avg = round(total_sum / len(subjects), 1) if subjects else 0

    def effort_label(x):
        if x >= 90: return "A Excellent"
        if x >= 70: return "B Very Good"
        if x >= 50: return "C Good"
        if x >= 40: return "D Satisfactory"
        return "E Working Towards"

    # --- Rank (position within same grade+term by average total) ---
    # average per student = sum(total)/count(subjects)
    # Use simple Python ranking to keep it reliable.
    all_students = Student.query.filter_by(grade=grade).all()
    ranking = []
    for st in all_students:
        st_scores = Score.query.filter_by(student_id=st.id, term=term, grade=grade).all()
        if not st_scores:
            continue
        st_totals = [(int(x.cont_ass_score or 0) + int(x.exam_score or 0)) for x in st_scores]
        st_avg = round(sum(st_totals) / max(len(st_totals), 1), 1)
        ranking.append((st.id, st_avg))
    ranking.sort(key=lambda x: x[1], reverse=True)

    position = None
    for i, (sid, _) in enumerate(ranking, start=1):
        if sid == student_id:
            position = i
            break

    # --- Attendance summary for term date range ---
    year = date.today().year
    start, end = term_date_range(term, year)

    rows = (
        Attendance.query
        .filter(Attendance.student_id == student_id)
        .filter(Attendance.date >= start, Attendance.date <= end)
        .all()
    )

    present = sum(1 for r in rows if r.status == "present")
    absent  = sum(1 for r in rows if r.status == "absent")
    late    = sum(1 for r in rows if r.status == "late")
    excused = sum(1 for r in rows if r.status == "excused")

    return {
        "school": {
            "school_name": settings.school_name if settings else "My School",
            "address": settings.address if settings else "",
            "phone": settings.phone if settings else "",
            "email": settings.email if settings else "",
            "logo_url": url_for("serve_asset", filename=settings.logo_filename, _external=True) if (settings and settings.logo_filename) else None,
            "principal_name": settings.principal_name if settings else "Principal",
            "principal_signature_url": url_for("serve_asset", filename=settings.principal_signature_filename, _external=True) if (settings and settings.principal_signature_filename) else None,
            "teacher_signature_url": url_for("serve_asset", filename=settings.teacher_signature_filename, _external=True) if (settings and settings.teacher_signature_filename) else None,
        },
        "student": student_to_dict(student),
        "term": term,
        "grade": grade,
        "average": avg,
        "effort": effort_label(avg),
        "position": position,
        "class_size": len(ranking),
        "attendance": {
            "range": {"start": start.isoformat(), "end": end.isoformat()},
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "total_days": len(rows),
        },
        # placeholders for now (we'll store later if you want)
        "remarks": {
            "teacher": "",
            "principal": "",
        },
        "subjects": subjects,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }



@app.route("/api/s/<slug>/report-card/<int:student_id>", methods=["GET"])
@app.route("/api/report-card/<int:student_id>", methods=["GET"])
def report_card_json(student_id):
    term = request.args.get("term")
    return jsonify(build_report_card(student_id, term)), 200

@app.route("/api/s/<slug>/report_card", methods=["GET"])
@app.route("/api/report_card", methods=["GET"])
def api_report_card_json():
    student_id = request.args.get("student_id", type=int)
    term = (request.args.get("term") or "").strip()
    grade = request.args.get("grade", type=int)

    if not student_id or not term or grade is None:
        return jsonify({"error": "student_id, term, grade are required"}), 400

    student = Student.query.get_or_404(student_id)

    # Pull scores for this student/term/grade
    scores = (Score.query
              .filter_by(student_id=student_id, term=term, grade=grade)
              .order_by(Score.date.desc())
              .all())

    # Latest score per subject
    latest = {}
    for s in scores:
        if s.subject not in latest:
            latest[s.subject] = s

    subjects = []
    total_sum = 0.0
    for subj, s in sorted(latest.items(), key=lambda x: x[0].lower()):
        ca = float(s.cont_ass_score or 0)
        ex = float(s.exam_score or 0)
        tot = ca + ex
        total_sum += tot
        subjects.append({
            "subject": subj,
            "cont_ass": ca,
            "exam": ex,
            "total": tot
        })

    avg = round((total_sum / len(subjects)), 2) if subjects else 0.0

    return jsonify({
        "student_id": student.id,
        "name": student.name,
        "grade": student.grade,
        "term": term,
        "average": avg,
        "subjects": subjects
    }), 200

@app.route("/api/s/<slug>/payments/<int:student_id>", methods=["GET"])
@app.route("/api/payments/<int:student_id>", methods=["GET"])
def api_payments_by_student(student_id):
    term = request.args.get("term")
    q = (PaymentHistory.query
         .join(TuitionInfo, TuitionInfo.id == PaymentHistory.tuition_id)
         .filter(TuitionInfo.student_id == student_id))

    if term:
        q = q.filter(TuitionInfo.term == term)

    payments = q.order_by(PaymentHistory.timestamp.desc()).all()

    return jsonify([
        {
            "id": p.id,
            "student_id": student_id,
            "tuition_id": p.tuition_id,
            "amount": float(p.amount or 0),
            "method": p.method,
            "reference": p.reference,
            "note": p.note,
            "timestamp": p.timestamp.isoformat() if p.timestamp else None,
        }
        for p in payments
    ]), 200
#-------Parents me------
from sqlalchemy import text

@app.get("/api/s/<slug>/parent/me")
@app.get("/api/parent/me")
def parent_me():
    username = request.args.get("username", "").strip()
    if not username:
        return jsonify({"error": "username is required"}), 400

    # find parent user
    parent = User.query.filter_by(username=username, role="parent").first()
    if not parent:
        return jsonify({"error": "parent not found"}), 404

    # pull linked student_ids from parents_students
    rows = db.session.execute(
        text("SELECT student_id FROM parents_students WHERE parent_id = :pid"),
        {"pid": parent.id},
    ).fetchall()
    student_ids = [r[0] for r in rows]

    children = []
    if student_ids:
        students = Student.query.filter(Student.id.in_(student_ids)).all()
        children = [s.to_dict() if hasattr(s, "to_dict") else {
            "id": s.id, "name": s.name, "grade": s.grade, "guardian_name": getattr(s, "guardian_name", None),
            "guardian_contact": getattr(s, "guardian_contact", None), "photo_url": getattr(s, "photo_url", None)
        } for s in students]

    return jsonify({
        "parent": {"id": parent.id, "username": parent.username},
        "count": len(children),
        "children": children
    })


# -----------------------------------------------------------------------------
# Premium Report Card PDF
# -----------------------------------------------------------------------------

@app.route("/api/s/<slug>/report-card/<int:student_id>/pdf", methods=["GET"])
@app.route("/api/report-card/<int:student_id>/pdf", methods=["GET"])
def report_card_pdf(student_id):
    term = request.args.get("term") or "Term 1"
    grade = request.args.get("grade", type=int)

    if grade is None:
        st = Student.query.get_or_404(student_id)
        grade = st.grade

    report = build_report_card(student_id, term, grade)

    # ✅ Pull remarks from query string (so Next.js can pass them in)
    teacher_remark = (request.args.get("teacher_remark") or "").strip()
    principal_remark = (request.args.get("principal_remark") or "").strip()

    # Ensure remarks dict exists
    if "remarks" not in report or not isinstance(report["remarks"], dict):
        report["remarks"] = {"teacher": "", "principal": ""}

    # Only override if provided (keeps future DB-stored values intact)
    if teacher_remark:
        report["remarks"]["teacher"] = teacher_remark
    if principal_remark:
        report["remarks"]["principal"] = principal_remark

    s = report["student"]
    sch = report["school"]
    att = report["attendance"]
    subs = report["subjects"]

    rows_html = "".join(
        f"<tr><td>{x['subject']}</td><td class='num'>{x['cont_ass']}</td><td class='num'>{x['exam']}</td><td class='num strong'>{x['total']}</td></tr>"
        for x in subs
    ) or "<tr><td colspan='4' style='text-align:center; opacity:.7;'>No scores yet</td></tr>"

    logo_html = (
        f"<img class='logo' src='{sch['logo_url']}' />"
        if sch.get("logo_url")
        else "<div class='logo-fallback'>LOGO</div>"
    )

    t_sig = f"<img class='sig' src='{sch['teacher_signature_url']}' />" if sch.get("teacher_signature_url") else ""
    p_sig = f"<img class='sig' src='{sch['principal_signature_url']}' />" if sch.get("principal_signature_url") else ""

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
            width: 70px; height: 70px;
            border: 1px solid #111;
            display: flex; align-items:center; justify-content:center;
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
          .num {{ text-align: right; }}
          .strong {{ font-weight: 900; }}
          .summary {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 12px;
          }}
          .pill {{
            display: inline-block;
            padding: 6px 10px;
            border: 1px solid #111;
            border-radius: 999px;
            font-weight: 900;
            font-size: 12px;
          }}
          .remarks .line {{
            margin-top: 8px;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 10px;
            min-height: 42px;
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
            <div class="name">{sch["school_name"]}</div>
            <div class="meta">{sch.get("address","")}</div>
            <div class="meta">{sch.get("phone","")} {(" • " + sch.get("email","")) if sch.get("email") else ""}</div>
            <div class="title">Student Report Card</div>
          </div>
          <div style="text-align:right;">
            <div class="pill">{report["term"]}</div>
            <div class="meta" style="margin-top:6px; font-size:11px;">Grade {report["grade"]}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="row"><span class="label">Student</span><span class="value">{s["name"]}</span></div>
            <div class="row"><span class="label">Student ID</span><span class="value">{s["id"]}</span></div>
            <div class="row"><span class="label">Guardian</span><span class="value">{s.get("guardian_name") or "—"}</span></div>
            <div class="row"><span class="label">Contact</span><span class="value">{s.get("guardian_contact") or "—"}</span></div>
          </div>

          <div class="box">
            <div class="row"><span class="label">Average</span><span class="value">{report["average"]}</span></div>
            <div class="row"><span class="label">Effort</span><span class="value">{report["effort"]}</span></div>
            <div class="row"><span class="label">Position</span><span class="value">{report["position"] or "—"} / {report["class_size"] or "—"}</span></div>
            <div class="row"><span class="label">Generated</span><span class="value">{report["generated_at"][:10]}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr><th>Subject</th><th class="num">CA</th><th class="num">Exam</th><th class="num">Total</th></tr>
          </thead>
          <tbody>
            {rows_html}
          </tbody>
        </table>

        <div class="summary">
          <div class="box">
            <div style="font-weight:900; margin-bottom:6px;">Attendance Summary</div>
            <div class="row"><span class="label">Range</span><span class="value">{att["range"]["start"]} → {att["range"]["end"]}</span></div>
            <div class="row"><span class="label">Present</span><span class="value">{att["present"]}</span></div>
            <div class="row"><span class="label">Absent</span><span class="value">{att["absent"]}</span></div>
            <div class="row"><span class="label">Late</span><span class="value">{att["late"]}</span></div>
            <div class="row"><span class="label">Excused</span><span class="value">{att["excused"]}</span></div>
            <div class="row"><span class="label">Total Days Marked</span><span class="value">{att["total_days"]}</span></div>
          </div>

          <div class="box remarks">
            <div style="font-weight:900; margin-bottom:6px;">Remarks</div>
            <div style="font-size:11px; opacity:.75;">Teacher</div>
            <div class="line">{report["remarks"].get("teacher") or ""}</div>
            <div style="font-size:11px; opacity:.75; margin-top:8px;">Principal</div>
            <div class="line">{report["remarks"].get("principal") or ""}</div>
          </div>
        </div>

        <div class="signatures">
          <div class="sigbox">
            {t_sig}
            <div><b>Teacher Signature</b></div>
          </div>
          <div class="sigbox">
            {p_sig}
            <div><b>{sch["principal_name"]} (Principal)</b></div>
          </div>
        </div>

        <div class="footer">
          <div>Official Document • {sch["school_name"]}</div>
          <div>Student ID: {s["id"]}</div>
        </div>
      </body>
    </html>
    """

    pdf_bytes = HTML(string=html).write_pdf()
    filename = f"report_card_{student_id}_{term.replace(' ', '_')}.pdf"

    resp = make_response(pdf_bytes)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return resp


# -----------------------------------------------------------------------------
# Premium report card
# -----------------------------------------------------------------------------
# --- Premium Finance: Receipt + Statement + Dashboard ---
from flask import make_response, request, jsonify
from datetime import datetime, date
import csv, io

try:
    from weasyprint import HTML
except Exception:
    HTML = None


def _money(x) -> str:
    try:
        return f"{float(x or 0):.2f}"
    except Exception:
        return "0.00"


def _dtlabel(dt) -> str:
    if not dt:
        return ""
    if isinstance(dt, str):
        return dt
    try:
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(dt)


def _school_header_html(settings):
    # settings already exists in your app (/api/settings) :contentReference[oaicite:2]{index=2}
    name = (settings.school_name if settings else "") or "School"
    address = (settings.address if settings else "") or ""
    phone = (settings.phone if settings else "") or ""
    email = (settings.email if settings else "") or ""
    logo_url = None
    if settings and getattr(settings, "logo_filename", None):
        # you already have serve_asset/file_url pattern in /api/settings
        try:
            from flask import url_for
            logo_url = url_for("serve_asset", filename=settings.logo_filename, _external=True)
        except Exception:
            logo_url = None

    logo = f"<img src='{logo_url}' style='height:54px; object-fit:contain;'/>" if logo_url else ""
    return f"""
    <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
      <div style="display:flex; align-items:center; gap:12px;">
        {logo}
        <div>
          <div style="font-size:18px; font-weight:700; letter-spacing:0.2px;">{name}</div>
          <div style="font-size:12px; color:#444;">{address}</div>
          <div style="font-size:12px; color:#444;">{phone} {(" • " + email) if email else ""}</div>
        </div>
      </div>
      <div style="text-align:right; font-size:12px; color:#444;">
        <div>Generated: {datetime.utcnow().strftime("%Y-%m-%d %H:%M")} UTC</div>
      </div>
    </div>
    """


@app.route("/api/s/<slug>/payments/<int:payment_id>/receipt.pdf", methods=["GET"])
@app.route("/api/payments/<int:payment_id>/receipt.pdf", methods=["GET"])
@app.route("/api/payments/<int:payment_id>/receipt/pdf", methods=["GET"])  # ✅ alias for Next.js
def payment_receipt_pdf(payment_id):
    if HTML is None:
        return jsonify({"error": "WeasyPrint not installed. Install: pip install weasyprint"}), 500

    p = PaymentHistory.query.get_or_404(payment_id)
    tuition = p.tuition
    student = Student.query.get_or_404(tuition.student_id)
    settings = SchoolSettings.query.first()

    balance = float(tuition.total_amount or 0) - float(tuition.amount_paid or 0)

    html = f"""
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body {{ font-family: Arial, sans-serif; margin: 24px; color:#111; }}
          .card {{ border:1px solid #e6e6e6; border-radius:12px; padding:16px; margin-top:14px; }}
          .grid {{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
          .title {{ font-size:20px; font-weight:800; margin-top:16px; }}
          .muted {{ color:#555; font-size:12px; }}
          .row {{ display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px dashed #eee; }}
          .row:last-child {{ border-bottom:none; }}
          .pill {{ display:inline-block; padding:4px 10px; border-radius:999px; background:#f3f5ff; font-size:12px; }}
          .totals {{ font-size:14px; }}
          .big {{ font-size:18px; font-weight:800; }}
          .footer {{ margin-top:18px; font-size:11px; color:#666; }}
        </style>
      </head>
      <body>
        {_school_header_html(settings)}

        <div class="title">Payment Receipt</div>
        <div class="muted">Receipt ID: <b>PAY-{p.id}</b> • Term: <b>{tuition.term or ""}</b> • Grade: <b>{student.grade}</b></div>

        <div class="card grid">
          <div>
            <div style="font-weight:700; margin-bottom:8px;">Student</div>
            <div><b>{student.name}</b></div>
            <div class="muted">Student ID: {student.id}</div>
            <div class="muted">Guardian: {student.guardian_name or ""}</div>
            <div class="muted">Contact: {student.guardian_contact or ""}</div>
          </div>

          <div>
            <div style="font-weight:700; margin-bottom:8px;">Payment</div>
            <div class="row"><span>Amount</span><span class="big">${_money(p.amount)}</span></div>
            <div class="row"><span>Method</span><span>{p.method or ""}</span></div>
            <div class="row"><span>Reference</span><span>{p.reference or ""}</span></div>
            <div class="row"><span>Date</span><span>{_dtlabel(p.timestamp)}</span></div>
            <div class="row"><span>Note</span><span>{(p.note or "").strip()}</span></div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:700; margin-bottom:8px;">Tuition Summary</div>
          <div class="row totals"><span>Total Due</span><span>${_money(tuition.total_amount)}</span></div>
          <div class="row totals"><span>Total Paid</span><span>${_money(tuition.amount_paid)}</span></div>
          <div class="row totals"><span>Balance</span><span><b>${_money(balance)}</b></span></div>
          <div style="margin-top:8px;">
            <span class="pill">Status: {(tuition.status or "Partial")}</span>
            <span class="pill">Plan: {(tuition.payment_plan or "")}</span>
          </div>
        </div>

        <div class="footer">
          This receipt confirms the payment was recorded in the school finance system.
        </div>
      </body>
    </html>
    """

    pdf = HTML(string=html).write_pdf()
    resp = make_response(pdf)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = f"inline; filename=receipt_PAY-{p.id}.pdf"
    return resp

#--------api-----
@app.route("/api/s/<slug>/finance/statement", methods=["GET"])
@app.route("/api/finance/statement", methods=["GET"])
def finance_statement_export():
    student_id = request.args.get("student_id", type=int)
    term = (request.args.get("term") or "").strip()
    fmt = (request.args.get("format") or "pdf").lower()

    if not student_id or not term:
        return jsonify({"error": "student_id and term are required"}), 400

    tuition = TuitionInfo.query.filter_by(student_id=student_id, term=term).first()
    if not tuition:
        return jsonify({"error": "No tuition record for that student/term"}), 404

    student = Student.query.get_or_404(student_id)
    settings = SchoolSettings.query.first()

    payments = (
        PaymentHistory.query
        .filter_by(tuition_id=tuition.id)
        .order_by(PaymentHistory.timestamp.desc())
        .all()
    )

    balance = float(tuition.total_amount or 0) - float(tuition.amount_paid or 0)

    if fmt == "csv":
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["Student", student.name])
        w.writerow(["Student ID", student.id])
        w.writerow(["Grade", student.grade])
        w.writerow(["Term", term])
        w.writerow([])
        w.writerow(["Total Due", _money(tuition.total_amount)])
        w.writerow(["Total Paid", _money(tuition.amount_paid)])
        w.writerow(["Balance", _money(balance)])
        w.writerow(["Status", tuition.status or ""])
        w.writerow([])
        w.writerow(["Payment ID", "Date", "Amount", "Method", "Reference", "Note"])

        for p in payments:
            w.writerow([
                p.id,
                _dtlabel(p.timestamp),
                _money(p.amount),
                p.method or "",
                p.reference or "",
                (p.note or "").strip(),
            ])

        resp = make_response(out.getvalue())
        resp.headers["Content-Type"] = "text/csv; charset=utf-8"
        resp.headers["Content-Disposition"] = f"attachment; filename=statement_student-{student_id}_{term.replace(' ','_')}.csv"
        return resp

    # PDF
    if HTML is None:
        return jsonify({"error": "WeasyPrint not installed. Install: pip install weasyprint"}), 500

    rows_html = ""
    for p in payments:
        rows_html += f"""
          <tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">PAY-{p.id}</td>
            <td style="padding:8px; border-bottom:1px solid #eee;">{_dtlabel(p.timestamp)}</td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${_money(p.amount)}</td>
            <td style="padding:8px; border-bottom:1px solid #eee;">{p.method or ""}</td>
            <td style="padding:8px; border-bottom:1px solid #eee;">{p.reference or ""}</td>
          </tr>
        """

    html = f"""
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body {{ font-family: Arial, sans-serif; margin:24px; color:#111; }}
          .card {{ border:1px solid #e6e6e6; border-radius:12px; padding:16px; margin-top:14px; }}
          table {{ width:100%; border-collapse:collapse; }}
          th {{ text-align:left; font-size:12px; color:#444; padding:8px; border-bottom:1px solid #ddd; }}
          .title {{ font-size:20px; font-weight:800; margin-top:16px; }}
          .muted {{ color:#555; font-size:12px; }}
        </style>
      </head>
      <body>
        {_school_header_html(settings)}
        <div class="title">Tuition Statement</div>
        <div class="muted"><b>{student.name}</b> • Student ID {student.id} • Grade {student.grade} • Term <b>{term}</b></div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; gap:12px;">
            <div><div class="muted">Total Due</div><div style="font-size:18px; font-weight:800;">${_money(tuition.total_amount)}</div></div>
            <div><div class="muted">Paid</div><div style="font-size:18px; font-weight:800;">${_money(tuition.amount_paid)}</div></div>
            <div><div class="muted">Balance</div><div style="font-size:18px; font-weight:800;">${_money(balance)}</div></div>
            <div><div class="muted">Status</div><div style="font-size:14px; font-weight:700;">{tuition.status or ""}</div></div>
          </div>
        </div>

        <div class="card">
          <div style="font-weight:700; margin-bottom:10px;">Payments</div>
          <table>
            <thead>
              <tr>
                <th>Receipt</th><th>Date</th><th style="text-align:right;">Amount</th><th>Method</th><th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows_html if rows_html else "<tr><td colspan='5' style='padding:10px; color:#666;'>No payments recorded.</td></tr>"}
            </tbody>
          </table>
        </div>
      </body>
    </html>
    """

    pdf = HTML(string=html).write_pdf()
    resp = make_response(pdf)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = f"inline; filename=statement_student-{student_id}_{term.replace(' ','_')}.pdf"
    return resp



@app.route("/api/s/<slug>/finance/summary", methods=["GET"])
@app.route("/api/finance/summary", methods=["GET"])
def finance_summary():
    """Backward-compatible alias for older clients that call /api/finance/summary.
    Returns the same payload as /api/finance/dashboard.
    Query params: term (required), grade (optional int).
    """
    return finance_dashboard()


@app.route("/api/s/<slug>/finance/dashboard", methods=["GET"])
@app.route("/api/finance/dashboard", methods=["GET"])
def finance_dashboard():
    term = (request.args.get("term") or "").strip()
    grade = request.args.get("grade", type=int)

    if not term:
        return jsonify({"error": "term is required"}), 400

    q = (
        db.session.query(TuitionInfo, Student)
        .join(Student, Student.id == TuitionInfo.student_id)
        .filter(TuitionInfo.term == term)
    )
    if grade is not None:
        q = q.filter(Student.grade == grade)

    rows = q.all()

    total_due = 0.0
    total_paid = 0.0
    outstanding = []

    for tuition, student in rows:
        due = float(tuition.total_amount or 0)
        paid = float(tuition.amount_paid or 0)
        bal = due - paid

        total_due += due
        total_paid += paid

        if bal > 0.0001:
            outstanding.append({
                "student_id": student.id,
                "name": student.name,
                "grade": student.grade,
                "total_due": due,
                "paid": paid,
                "balance": bal,
                "status": tuition.status or "Partial",
            })

    outstanding.sort(key=lambda x: x["balance"], reverse=True)

    return jsonify({
        "term": term,
        "grade": grade,
        "total_due": round(total_due, 2),
        "total_paid": round(total_paid, 2),
        "total_balance": round(total_due - total_paid, 2),
        "students_count": len(rows),
        "outstanding_count": len(outstanding),
        "outstanding_top": outstanding[:20],
    }), 200

# -----------------------------------------------------------------------------
# Legacy alias (keep frontend working with /api/report_card/pdf)
# -----------------------------------------------------------------------------
@app.route("/api/s/<slug>/report_card/pdf", methods=["GET"])
@app.route("/api/report_card/pdf", methods=["GET"])
def report_card_legacy_pdf():
    sid = request.args.get("student_id", type=int)
    if not sid:
        return jsonify({"error": "student_id required"}), 400
    # Uses the SAME request.args (term/grade/teacher_remark/principal_remark all pass through)
    return report_card_pdf(sid)




import click
from werkzeug.security import generate_password_hash

@app.cli.command("seed")
@click.option("--name", default="ABC Learning Centre")
@click.option("--slug", default="abc-learning-centre")
@click.option("--email", default="admin@school.com")
@click.option("--password", default="admin123")
def seed_cmd(name, slug, email, password):
    """Create a school + admin user if missing."""
    from work import db, School, User  # or remove if already in scope

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
# Run
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 1994)), debug=True)



if os.environ.get("AUTO_INIT_DB", "0") == "1":
    with app.app_context():
        init_db()

