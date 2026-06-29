# BearTracks

A multi-tenant leave management system. Each company gets its own slug-scoped workspace (`/acme/dashboard`), with employee, manager, and admin roles.

## Features

- Multi-tenant with slug-based routing (`/[slug]/...`)
- Employee login, password reset, and invite-based registration
- Leave request submission, approval/rejection by managers
- Public holiday management per tenant
- Leave balance calculation with proration, carry-forward, and TOIL accrual
- Admin UI for leave types, users, holidays, and tenant settings

---

## Prerequisites

- Node.js 20+
- Docker (for local Postgres via `docker-compose`)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://beartracks:beartracks@localhost:5432/beartracks
DATABASE_URL_TEST=postgresql://beartracks:beartracks@localhost:5433/beartracks_test
SESSION_SECRET=replace-with-a-long-random-string
```

### 3. Start the database

```bash
docker-compose up -d
```

This starts two Postgres containers:
- `db` on port `5432` — development database
- `db_test` on port `5433` — test database

### 4. Run migrations

```bash
npm run db:migrate        # development database
npm run db:migrate:test   # test database
```

### 5. Seed the development database

```bash
npm run seed
```

This creates an `acme` tenant with the following accounts:

| Email | Password | Role |
|---|---|---|
| `admin@acme.com` | `admin123` | Admin |
| `manager@acme.com` | `manager123` | Manager |
| `alice@acme.com` | `employee123` | Employee |
| `bob@acme.com` | `employee123` | Employee |

---

## Running locally

```bash
npm run dev
```

Open [http://localhost:3000/acme/login](http://localhost:3000/acme/login).

---

## Testing

```bash
npm test                  # all tests (unit + integration + ui)
npm run test:unit         # unit tests only (no DB required)
npm run test:integration  # integration tests (requires DB_TEST running)
npm run test:ui           # component tests (jsdom)
npm run test:e2e          # Playwright end-to-end (starts dev server automatically)
npm run test:watch        # watch mode
```

Integration and E2E tests require both databases running and `.env.local` configured.

---

## Database

Schema lives in [lib/db/schema.js](lib/db/schema.js). Migrations are managed by Drizzle Kit and live in [drizzle/](drizzle/).

```bash
# Generate a new migration after editing schema.js
npm run db:generate

# Apply migrations
npm run db:migrate
```

---

## Project structure

```
app/
  [slug]/           # all routes are tenant-scoped
    (auth)/         # login, register, invite, password reset (no nav shell)
    (app)/          # authenticated shell with top nav
      dashboard/
      requests/
      approvals/    # manager-only
      admin/        # admin-only: leave types, users, holidays, settings
  actions/          # Next.js Server Actions
lib/
  dal/              # all database queries (no raw Drizzle outside here)
  db/               # schema + Drizzle client
  policy-engine/    # leave balance calculation
  session.js        # iron-session wrapper
tests/
  unit/
  integration/
  ui/
  e2e/
scripts/
  seed.js           # development data
drizzle/            # migration files
```

---

## Adding a new tenant

Use the admin UI at `/[slug]/admin/settings`, or insert directly via seed for development. Each tenant has its own slug, timezone, fiscal year start, and working week.
