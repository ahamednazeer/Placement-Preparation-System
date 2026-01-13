"""Middleware exports."""
from .auth_middleware import jwt_bearer, jwt_bearer_optional, JWTBearer
from .rbac_middleware import (
    RoleChecker,
    require_admin,
    require_placement_officer,
    require_student,
    require_any_authenticated,
    roles_required,
    get_user_id,
    get_user_role,
)
from .logging_middleware import LoggingMiddleware

__all__ = [
    "jwt_bearer",
    "jwt_bearer_optional",
    "JWTBearer",
    "RoleChecker",
    "require_admin",
    "require_placement_officer",
    "require_student",
    "require_any_authenticated",
    "roles_required",
    "get_user_id",
    "get_user_role",
    "LoggingMiddleware",
]
