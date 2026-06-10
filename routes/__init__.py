"""
Routes package initialization
"""
from flask import Blueprint

auth_bp = Blueprint('auth', __name__)
web_bp = Blueprint('web', __name__)
api_bp = Blueprint('api', __name__, url_prefix='/api')

from . import api, auth, web  # noqa: F401
