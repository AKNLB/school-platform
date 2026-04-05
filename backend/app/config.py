import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_DIR = os.getenv("DB_DIR")

if not DB_DIR:
    if os.getenv("FLY_APP_NAME"):
        DB_DIR = "/data"
    else:
        DB_DIR = os.path.join(BASE_DIR, "data")

DEFAULT_DB = f"sqlite:///{os.path.join(DB_DIR, 'school.db')}"

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-not-for-production")
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", DEFAULT_DB)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"

    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    CORS_ORIGINS = [
        o.strip()
        for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]

    UPLOAD_DOCS = os.path.join(BASE_DIR, "uploaded_docs")
    UPLOAD_PHOTOS = os.path.join(BASE_DIR, "uploads", "photos")
    RECEIPT_DIR = os.path.join(BASE_DIR, "receipts")
    UPLOAD_ANNOUNCEMENTS = os.path.join(BASE_DIR, "uploads", "announcements")
    UPLOAD_RESOURCES = os.path.join(BASE_DIR, "uploads", "resources")