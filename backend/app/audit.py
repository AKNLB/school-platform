import json
from flask import request

import app.bridge as bridge
from app.decorators import current_school_id

def log_audit(
    module: str,
    action: str,
    entity_type: str,
    entity_id=None,
    entity_label=None,
    details=None,
):
    try:
        db = bridge.db
        AuditLog = bridge.AuditLog

        user_id = None
        user_email = None

        if callable(bridge.current_user):
            user = bridge.current_user()
            if user:
                user_id = getattr(user, "id", None)
                user_email = getattr(user, "email", None)

        row = AuditLog(
            school_id=current_school_id(),
            user_id=user_id,
            user_email=user_email,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            entity_label=entity_label,
            details_json=json.dumps(details or {}),
            ip_address=request.headers.get("x-forwarded-for", request.remote_addr),
        )
        db.session.add(row)
        db.session.flush()
    except Exception:
        pass