# Production readiness checklist (before exposing publicly)

This repo runs locally with Docker Compose. Before you put it on a public VPS, do these **in order**.

## 1) Secrets + environment

1. Copy `.env.prod.example` -> `.env.prod`
2. Set a strong `SECRET_KEY` (32+ random bytes; do **not** reuse your local key)
3. Decide database:
   - **Recommended:** Postgres via `docker-compose.prod.yml` (default)
   - Not recommended for public: SQLite (concurrency + backup issues)

## 2) Database

- With Postgres enabled, your DB lives in the `postgres_data` volume.
- Migrations run automatically on container startup (`flask db upgrade`).

## 3) CORS + cookies

1. Set `CORS_ORIGINS` to your production domain (comma-separated)
2. Ensure `COOKIE_SECURE=1` **after HTTPS is working** (cookies won't set over plain HTTP)

## 4) Health + restarts

- `docker-compose.prod.yml` includes:
  - `restart: unless-stopped` on services
  - healthchecks for backend + postgres

## 5) Logging

- Use `docker compose logs -f nginx backend frontend`
- Consider shipping logs to a service on the VPS (journald, Loki, etc.)

## 6) Backups

- Postgres: dump nightly (`pg_dump`) and store off-box
- Uploaded files: back up volumes `backend_uploads`, `backend_docs`, `backend_resources`

## 7) HTTPS

- Recommended approach on a VPS:
  - Put a reverse proxy (Caddy or nginx + certbot) in front
  - Or add a dedicated `caddy` service for automatic TLS

## 8) Security basics

- Create a real admin user and rotate the default password
- Rate-limit login endpoints (optional but recommended)
- If you add file uploads from the internet, validate MIME types and enforce size limits

---

When you're ready, you can deploy with:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```
