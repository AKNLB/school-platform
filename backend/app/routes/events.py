from flask import Blueprint, request, jsonify

from app.audit import log_audit
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

events_bp = Blueprint("events_bp", __name__)

def _safe_iso_date(value):
    if value in (None, ""):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)

def _event_to_dict(e):
    if hasattr(e, "to_dict") and callable(e.to_dict):
        return e.to_dict()

    return {
        "id": e.id,
        "title": getattr(e, "title", ""),
        "description": getattr(e, "description", ""),
        "date": getattr(e, "date", None).isoformat() if getattr(e, "date", None) else None,
        "start_time": getattr(e, "start_time", None),
        "end_time": getattr(e, "end_time", None),
        "location": getattr(e, "location", ""),
        "audience": getattr(e, "audience", "all"),
        "created_at": getattr(e, "created_at", None).isoformat() if getattr(e, "created_at", None) else None,
    }


def _normalize_audience(value: str) -> str:
    v = (value or "all").strip().lower()
    mapping = {
        "all": "all",
        "teacher": "teachers",
        "teachers": "teachers",
        "parent": "parents",
        "parents": "parents",
        "student": "students",
        "students": "students",
    }
    return mapping.get(v, "")


def _parse_date_value(value):
    if value in (None, ""):
        return None
    return bridge.parse_date(str(value))


def _parse_time_value(value):
    if value in (None, ""):
        return None

    parsed = bridge.parse_time(str(value))
    if hasattr(parsed, "strftime"):
        return parsed.strftime("%H:%M")
    return str(parsed)


def _extract_event_date(data):
    return (
        data.get("date")
        or data.get("event_date")
        or data.get("start_date")
        or data.get("day")
    )


@events_bp.route("/api/s/<slug>/events", methods=["GET", "POST"])
@events_bp.route("/api/events", methods=["GET", "POST"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def events_collection(slug=None):
    Event = bridge.Event
    db = bridge.db

    if request.method == "GET":
        audience = _normalize_audience(request.args.get("audience") or "")
        q = (request.args.get("q") or "").strip().lower()

        qs = Event.query.filter_by(school_id=current_school_id())

        if audience and audience != "all":
            qs = qs.filter((Event.audience == "all") | (Event.audience == audience))

        rows = qs.order_by(Event.id.desc()).all()

        if q:
            rows = [
                e for e in rows
                if q in (getattr(e, "title", "") or "").lower()
                or q in (getattr(e, "description", "") or "").lower()
                or q in (getattr(e, "location", "") or "").lower()
            ]

        return jsonify([_event_to_dict(e) for e in rows]), 200

    data = request.get_json(silent=True) or {}

    title = (data.get("title") or "").strip()
    description = (data.get("description") or data.get("body") or "").strip()
    location = (data.get("location") or "").strip()
    audience = _normalize_audience(data.get("audience") or "all")

    if not title:
        return jsonify({"error": "title is required"}), 400
    if not audience:
        return jsonify({"error": "audience must be all|teacher(s)|parent(s)|student(s)"}), 400

    event_date_raw = _extract_event_date(data)

    try:
        event_date = _parse_date_value(event_date_raw)
    except Exception:
        return jsonify({"error": "Invalid date"}), 400

    try:
        start_time = _parse_time_value(data.get("start_time"))
    except Exception:
        return jsonify({"error": "Invalid start_time"}), 400

    try:
        end_time = _parse_time_value(data.get("end_time"))
    except Exception:
        return jsonify({"error": "Invalid end_time"}), 400

    if event_date is None:
        return jsonify({"error": "date is required"}), 400

    kwargs = {
        "school_id": current_school_id(),
        "title": title,
        "description": description,
        "date": event_date,
        "start_time": start_time,
        "end_time": end_time,
        "location": location,
        "audience": audience,
    }

    event = Event(**kwargs)
    db.session.add(event)
    db.session.commit()

    log_audit(
        module="events",
        action="create",
        entity_type="event",
        entity_id=event.id,
        entity_label=event.title,
        details={
            "date": event.date.isoformat() if getattr(event, "date", None) else None,
            "start_time": getattr(event, "start_time", None),
            "end_time": getattr(event, "end_time", None),
            "location": getattr(event, "location", ""),
            "audience": getattr(event, "audience", "all"),
        },
    )

    return jsonify(_event_to_dict(event)), 201


@events_bp.route("/api/s/<slug>/events/<int:eid>", methods=["PUT", "DELETE"])
@events_bp.route("/api/events/<int:eid>", methods=["PUT", "DELETE"])
@school_context_required
@roles_required(ROLE_ADMIN, ROLE_TEACHER, ROLE_PARENT, ROLE_STUDENT)
def events_item(eid, slug=None):
    Event = bridge.Event
    db = bridge.db

    event = Event.query.filter_by(
        id=eid,
        school_id=current_school_id()
    ).first()

    if not event:
        return jsonify({"error": "Event not found"}), 404

    if request.method == "DELETE":
        event_title = getattr(event, "title", "")
        event_date = _safe_iso_date(getattr(event, "date", None))
        event_start_time = getattr(event, "start_time", None)
        event_end_time = getattr(event, "end_time", None)
        event_location = getattr(event, "location", "")
        event_audience = getattr(event, "audience", "all")

        db.session.delete(event)
        db.session.commit()

        log_audit(
            module="events",
            action="delete",
            entity_type="event",
            entity_id=eid,
            entity_label=event_title,
            details={
                "date": event_date,
                "start_time": event_start_time,
                "end_time": event_end_time,
                "location": event_location,
                "audience": event_audience,
            },
        )

        return jsonify({"message": "Event deleted"}), 200

    data = request.get_json(silent=True) or {}

    if "title" in data:
        new_title = (data.get("title") or "").strip()
        if not new_title:
            return jsonify({"error": "title cannot be empty"}), 400
        event.title = new_title

    if "description" in data or "body" in data:
        event.description = (data.get("description") or data.get("body") or "").strip()

    if "location" in data:
        event.location = (data.get("location") or "").strip()

    if "audience" in data:
        audience = _normalize_audience(data.get("audience") or "")
        if not audience:
            return jsonify({"error": "audience must be all|teacher(s)|parent(s)|student(s)"}), 400
        event.audience = audience

    if any(k in data for k in ("date", "event_date", "start_date", "day")):
        raw = _extract_event_date(data)
        try:
            parsed = _parse_date_value(raw)
        except Exception:
            return jsonify({"error": "Invalid date"}), 400
        if parsed is None:
            return jsonify({"error": "date cannot be empty"}), 400
        event.date = parsed

    if "start_time" in data:
        try:
            event.start_time = _parse_time_value(data.get("start_time"))
        except Exception:
            return jsonify({"error": "Invalid start_time"}), 400

    if "end_time" in data:
        try:
            event.end_time = _parse_time_value(data.get("end_time"))
        except Exception:
            return jsonify({"error": "Invalid end_time"}), 400

    db.session.commit()

    log_audit(
        module="events",
        action="update",
        entity_type="event",
        entity_id=event.id,
        entity_label=event.title,
        details={
            "updated_fields": list(data.keys()),
            "date": _safe_iso_date(getattr(event, "date", None)),
            "start_time": getattr(event, "start_time", None),
            "end_time": getattr(event, "end_time", None),
            "location": getattr(event, "location", ""),
            "audience": getattr(event, "audience", "all"),
        },
    )

    return jsonify(_event_to_dict(event)), 200