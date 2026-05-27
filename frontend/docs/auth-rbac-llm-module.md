# Auth + RBAC + LLM Module

## Demo Accounts

- `admin / admin123`
- `finance / finance123`
- `sap / sap123`
- `dms / dms123`

## Auth APIs

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## RBAC APIs

- `GET /api/rbac/roles`
- `PUT /api/rbac/roles/:role/permissions`
- `GET /api/rbac/users`
- `PUT /api/rbac/users/:userId/roles`
- `GET /api/rbac/audit-logs`

## Model Provider APIs

- `GET /api/model-providers`
- `POST /api/model-providers`
- `PUT /api/model-providers/:id`
- `DELETE /api/model-providers/:id`
- `POST /api/model-providers/:id/test`

Compatibility endpoint:

- `GET /api/model-config`

## Notes

- JWT access token uses HS256 and is validated by backend middleware.
- Refresh token is stored in-memory for the current process lifetime.
- RBAC permissions are role-based and resolved to a flat permission list per user.
- Model provider API stores masked API key only for management display.
