"""
Flask application factory for SocialAnalytics.
"""

from flask import Flask

from config import get_config
from extensions import db, migrate


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(get_config())

    db.init_app(app)
    migrate.init_app(app, db)

    from routes import auth_bp, web_bp, api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(web_bp)
    app.register_blueprint(api_bp)

    with app.app_context():
        db.create_all()

    return app
