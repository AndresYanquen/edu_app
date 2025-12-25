# Academy API

Minimal single-academy backend built with Node.js, Express, PostgreSQL, and Knex. Provides course/cohort management plus JWT access tokens with refresh-cookie rotation.

## Requirements
- Node.js >= 18
- PostgreSQL 14 or newer

## Setup
1. Install deps: `npm install`
2. Copy `cp .env.example .env` and set `DATABASE_URL` (plus other secrets)
3. Reset local DB: `npm run db:reset`
4. Start server: `npm run dev`
5. Health check available at `GET /health`

## Scripts
- `npm run dev` – start API
- `npm run migrate` – latest migrations
- `npm run seed` – seed demo data
- `npm run db:reset` – rollback all, reapply, seed

## Authentication
`POST /auth/login` returns a short-lived access token (store in memory) and sets an httpOnly `refresh_token` cookie. Use `Authorization: Bearer <accessToken>` for protected calls, `POST /auth/refresh` to rotate tokens, and `POST /auth/logout` to revoke + clear the cookie.
