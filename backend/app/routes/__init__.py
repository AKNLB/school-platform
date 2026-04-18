def register_routes(app):
    from app.routes.auth import auth_bp
    from app.routes.admin_users import admin_users_bp
    from app.routes.school import school_bp
    from app.routes.students import students_bp
    from app.routes.attendance import attendance_bp
    from app.routes.scores import scores_bp
    from app.routes.settings import settings_bp
    from app.routes.finance import finance_bp
    from app.routes.report_cards import report_cards_bp
    from app.routes.resources import resources_bp
    from app.routes.announcements import announcements_bp
    from app.routes.tasks import tasks_bp
    from app.routes.events import events_bp
    from app.routes.audit_logs import audit_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_users_bp)
    app.register_blueprint(school_bp)
    app.register_blueprint(students_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(scores_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(finance_bp)
    app.register_blueprint(report_cards_bp)
    app.register_blueprint(resources_bp)
    app.register_blueprint(announcements_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(events_bp)
    app.register_blueprint(audit_bp)