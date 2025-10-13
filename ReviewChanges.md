# Backend Changes Review

This document tracks all backend changes and modifications made during development. Only backend changes should be documented here.

## Format
Each change should include:
- Date of change
- Description of what was changed
- Reason for the change
- Any breaking changes or migration requirements

---

## Changes Log

### 2025-10-10 - Initial Setup
- Created ReviewChanges.md to track backend modifications
- Added .env.example file for environment variable documentation
- Set up local development environment configuration

---

## Notes
- Remember to document all API endpoint changes
- Include database schema modifications
- Note any new dependencies added
- Highlight breaking changes that affect the frontend or deployment
### 2025-10-11 - Temporary Admin Auth + Static Portal
- Added /api/admin/login endpoint that accepts any username/password and returns a JWT (temporary dev-only auth)
- Added /api/admin/data protected check endpoint that validates the JWT (no DB lookup)
- Wired admin routes in Express app and enabled static serving of admin portal at /admin
- Note: Admin portal also copied into frontend at wager-ui/public/admin for site subpages
- Breaking changes: none
- Migration: none
- Env: uses existing JWT_SECRET; optional ADMIN_STATIC_DIR to override admin static path

### 2025-10-11 - Admin dev login flag
- Gated /api/admin/login behind ALLOW_ANY_ADMIN_LOGIN env var
- When not enabled, endpoint returns 403 and no token is issued
- No database changes

