# BearTracks PTO — MVP Design Spec

**Date:** 2026-06-25  
**Scope:** MVP — Policy engine + auth + leave request flow + manager approvals + employee self-service UI

---

## 1. MVP Scope

### In scope
- Auth: login, invite flow, password reset (email stubbed — log token to console)
- Tenant: seeded (no setup UI)
- Policy engine: full rule-based balance computation
- Employee: my leave page, submit leave request
- Manager: pending approvals, approve/reject, team balance cards
- FY rollover cron job

### Out of scope (post-MVP)
- Admin policy management UI (policies seeded)
- Team calendar
- Notifications (email + in-app)
- Blackout period management UI
- Reporting
- Public holiday sync from Nager.Date (holidays seeded)
- Audit log UI
- Revocation flow UI

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Database | PostgreSQL |
| ORM / query builder | Drizzle |
| Auth / sessions | iron-session (HTTP-only cookie) |
| Email | Stubbed — log tokens to console |
| UI components | shadcn/ui |
| Styling | Tailwind CSS |
| Language | JavaScript |
| Cron | Next.js Route Handler + secret key |

---

## 3. Database Schema

### `tenants`
```
id                      uuid PK
name                    text
slug                    text UNIQUE
timezone                text               e.g. "America/New_York"
fiscal_year_start_month integer            1–12
working_week            integer[]          e.g. [1,2,3,4,5] (ISO day: 1=Mon)
hours_per_workday       integer            default 8
min_headcount_threshold integer            default 1
created_at              timestamptz
```

### `users`
```
id                      uuid PK
tenant_id               uuid FK → tenants
email                   text
password_hash           text
name                    text
role                    enum(employee, manager, admin)
manager_id              uuid FK → users (nullable)
join_date               date
is_active               boolean            default true
created_at              timestamptz
```

### `invites`
```
id                      uuid PK
tenant_id               uuid FK → tenants
email                   text
role                    enum(employee, manager, admin)
invited_by              uuid FK → users
token_hash              text
expires_at              timestamptz        24h TTL
accepted_at             timestamptz (nullable)
created_at              timestamptz
```

### `password_reset_tokens`
```
id                      uuid PK
user_id                 uuid FK → users
token_hash              text
expires_at              timestamptz        1h TTL
used_at                 timestamptz (nullable)
created_at              timestamptz
```

### `leave_types`
```
id                      uuid PK
tenant_id               uuid FK → tenants
name                    text
code                    text               e.g. "ANNUAL"
color                   text               hex string
paid                    boolean
active                  boolean

-- Entitlement
entitlement_basis       enum(FIXED, ACCRUAL)
annual_entitlement_days numeric(6,2)       used if basis=FIXED
accrual_rate_per_month  numeric(6,2)       used if basis=ACCRUAL
accrual_day_of_month    integer (nullable)
max_accrual_balance     numeric(6,2) (nullable)

-- Role overrides
role_overrides          jsonb              e.g. {"manager": 5, "admin": 5}

-- Proration
prorate_on_join         boolean
proration_rounding      enum(FLOOR, CEIL, HALF_UP)
prorate_on_exit         boolean

-- Carry-forward
allow_carry_forward     boolean
carry_forward_max_days  numeric(6,2) (nullable)
carry_forward_expiry_days integer (nullable)

-- Negative balance
allow_negative_balance  boolean
max_negative_days       numeric(6,2) (nullable)

-- Request rules
requires_approval       boolean
min_notice_days         integer
max_consecutive_days    integer (nullable)
min_consecutive_days    integer
allow_half_day          boolean
allow_hourly            boolean

-- Attachment
attachment_policy       enum(NONE, OPTIONAL, REQUIRED)
attachment_required_after_days integer (nullable)

-- Visibility
visible_to_all          boolean
gender_restriction      enum(FEMALE, MALE) (nullable)

created_at              timestamptz
updated_at              timestamptz
```

### `leave_requests`
```
id                      uuid PK
tenant_id               uuid FK → tenants
employee_id             uuid FK → users
leave_type_id           uuid FK → leave_types
status                  enum(draft, pending, approved, rejected, cancelled,
                             revoke_requested, revoked, revoke_denied)
start_date              date
end_date                date
day_type                enum(FULL, HALF_AM, HALF_PM, HOURLY)
hours                   numeric(5,2) (nullable)  for HOURLY
working_days            numeric(5,2)             computed at submission, stored for display
note                    text (nullable)
attachment_url          text (nullable)
reviewed_by             uuid FK → users (nullable)
reviewed_at             timestamptz (nullable)
review_note             text (nullable)
created_at              timestamptz
updated_at              timestamptz
```

### `leave_ledger`
```
id                      uuid PK
tenant_id               uuid FK → tenants
employee_id             uuid FK → users
leave_type_id           uuid FK → leave_types
entry_type              enum(CARRY_FORWARD, MANUAL_ADJUSTMENT)
days                    numeric(6,2)             positive = credit, negative = debit
fiscal_year             integer                  e.g. 2026
expires_on              date (nullable)           for CARRY_FORWARD with expiry
reason                  text (nullable)           required for MANUAL_ADJUSTMENT
adjusted_by             uuid FK → users (nullable)
created_at              timestamptz
```

### `public_holidays`
```
id                      uuid PK
tenant_id               uuid FK → tenants
date                    date
name                    text
year                    integer
created_at              timestamptz
```

**Indexes:**
- `leave_requests(tenant_id, employee_id, leave_type_id, status)` — balance query
- `leave_requests(tenant_id, employee_id, start_date, end_date)` — calendar / headcount
- `leave_ledger(tenant_id, employee_id, leave_type_id)` — balance query
- `public_holidays(tenant_id, year)` — working days calc
- `users(tenant_id, manager_id)` — direct reports lookup
- `invites(token_hash)` — invite lookup

---

## 4. Architecture & Layering

Three strict layers. Nothing skips a layer; nothing imports upward.

```
┌─────────────────────────────────────────────┐
│  App Layer                                   │
│  app/actions/  ·  app/api/cron/              │
│  Thin orchestrators — no business logic      │
│  Validates user input (Zod) before DAL       │
├─────────────────────────────────────────────┤
│  Data Access Layer  (lib/dal/)               │
│  All Drizzle queries live here               │
│  Every function takes tenantId as 1st param  │
│  Returns plain objects, not Drizzle models   │
├─────────────────────────────────────────────┤
│  Policy Engine  (lib/policy-engine/)         │
│  Pure functions — zero DB / Drizzle imports  │
│  All inputs passed explicitly                │
│  Input → Output, no side effects             │
└─────────────────────────────────────────────┘
```

### File structure

```
lib/
  policy-engine/
    index.js            re-exports public API
    balance.js          computeAvailableBalance (pipeline orchestrator)
    entitlement.js      computeBaseEntitlement, applyRoleOverride, applyProration
    carry-forward.js    addCarryForward, addManualAdjustments
    validation.js       validateRequest, individual check functions
    working-days.js     countWorkingDays
    types.js            JSDoc @typedef shapes
  dal/
    leave-types.js
    leave-requests.js
    ledger.js
    employees.js
    public-holidays.js
  db/
    index.js            Drizzle client
    schema.js           all table definitions
  session.js            iron-session config + getSession helper
  fiscal-year.js        deriveFiscalYear(startMonth, date) utility

app/
  middleware.js          tenant resolution from slug, redirect to login if no session
  [slug]/
    (auth)/
      login/page.js
      invite/[token]/page.js
      reset-password/[token]/page.js
    (app)/
      layout.js          auth guard + tenant injection into context
      dashboard/page.js  employee self-service (my leave)
      requests/
        new/page.js      multi-step leave request form
        [id]/page.js     request detail
      manager/page.js    manager dashboard
  actions/
    auth.js
    leave-requests.js
    balances.js
  api/
    cron/
      fy-rollover/route.js

scripts/
  seed.js
```

---

## 5. Policy Engine

### Balance pipeline

`computeAvailableBalance(inputs)` orchestrates these pure steps in order:

```
inputs = {
  policy,           // leave_type row
  employee,         // { id, role, joinDate, gender }
  fiscalYear,       // { start: Date, end: Date }
  approvedRequests, // leave_request rows with status='approved' in this FY
  ledgerEntries,    // leave_ledger rows for this employee + type
  today,            // Date — for accrual and carry expiry checks
}
```

1. **`computeBaseEntitlement(policy, fiscalYear, today)`**
   - FIXED: return `annual_entitlement_days`
   - ACCRUAL: `accrual_rate_per_month × monthsElapsed(fiscalYear.start, today)`, capped at `max_accrual_balance ?? Infinity`

2. **`applyRoleOverride(base, policy, role)`**
   - `base + (policy.role_overrides[role] ?? 0)`

3. **`applyProration(entitlement, policy, employee.joinDate, fiscalYear)`**
   - If `!policy.prorate_on_join` or `joinDate <= fiscalYear.start`: return entitlement unchanged
   - `daysInFY = fiscalYear.end - fiscalYear.start`
   - `remainingDays = fiscalYear.end - joinDate`
   - `prorated = entitlement × (remainingDays / daysInFY)`
   - Round per `proration_rounding` (FLOOR / CEIL / HALF_UP)

4. **`addCarryForward(entitlement, ledgerEntries, today)`**
   - Filter `CARRY_FORWARD` entries where `expires_on` is null or `expires_on > today`
   - Sum their `days` and add to entitlement

5. **`addManualAdjustments(entitlement, ledgerEntries)`**
   - Sum all `MANUAL_ADJUSTMENT` entry `days` (positive and negative) and add to entitlement

6. **`subtractUsed(entitlement, approvedRequests)`**
   - Sum `working_days` across all approved requests

**Result:**
```js
{
  available,      // entitlement after all steps minus used
  used,           // sum of approved working_days this FY
  total,          // entitlement after steps 1–5 (before subtracting used)
  carryForward,   // amount added in step 4
  adjustments,    // net amount added in step 5
}
```

### Request validation

`validateRequest(request, balance, policy, context)` → `ValidationResult[]`

```js
context = {
  today,
  publicHolidays,   // Date[]
  workingWeek,      // integer[]
  blackoutPeriods,  // { start, end, leaveTypeIds }[] — post-MVP, passed as []
  teamApprovedRequests, // approved requests for direct-report peers in range
  minHeadcount,     // integer from tenant config
}
```

Each check returns `{ ok, reason, blocking }`. Non-blocking = warning; blocking = prevents submission.

| Check | Blocking? |
|---|---|
| `checkBalance` — if `!allow_negative_balance`: available >= request.working_days; if `allow_negative_balance`: (available - request.working_days) >= -(max_negative_days ?? Infinity) | Yes |
| `checkBlackout` — no requested day falls in a blackout period (empty array for MVP) | Yes |
| `checkNotice` — start_date >= today + min_notice_days | Configurable per policy |
| `checkConsecutive` — working_days within min/max_consecutive_days | Yes |
| `checkHeadcount` — team available >= min_headcount on all requested days | No (warning) |

Validations run in this order; all are evaluated (not short-circuited) so the UI can show all issues at once.

### Working days utility

`countWorkingDays(startDate, endDate, workingWeek, publicHolidays)`

- Iterates dates in range inclusive
- Excludes ISO weekdays not in `workingWeek`
- Excludes dates present in `publicHolidays`
- Returns a number (integer for FULL, 0.5 for HALF_*, proportional for HOURLY)

For HALF_AM / HALF_PM: returns `0.5` directly (start === end enforced at form level).  
For HOURLY: `countWorkingDays` is not called — `working_days = request.hours / tenant.hours_per_workday` computed directly in the Server Action before insertion and engine input assembly.

---

## 6. Data Access Layer

Every function signature starts with `tenantId` — enforced at the function signature level.

### `lib/dal/leave-types.js`
- `getLeaveType(tenantId, leaveTypeId)`
- `getActiveLeaveTypes(tenantId)`

### `lib/dal/leave-requests.js`
- `getApprovedRequestsForFY(tenantId, employeeId, leaveTypeId, fyStart, fyEnd)`
- `getPendingRequestsForManager(tenantId, managerId)` — joins to filter direct reports
- `getTeamRequestsForDateRange(tenantId, employeeIds, startDate, endDate)` — headcount check
- `insertRequest(tenantId, data)` — inside a transaction in the Server Action
- `updateRequestStatus(tenantId, requestId, status, reviewData)`
- `getRequestById(tenantId, requestId)`
- `getRequestsByEmployee(tenantId, employeeId, filters)`

### `lib/dal/ledger.js`
- `getLedgerEntries(tenantId, employeeId, leaveTypeId)`
- `insertLedgerEntry(tenantId, data)`

### `lib/dal/employees.js`
- `getEmployee(tenantId, userId)`
- `getDirectReports(tenantId, managerId)`
- `getUserByEmail(tenantId, email)`

### `lib/dal/public-holidays.js`
- `getPublicHolidays(tenantId, year)` → `Date[]`

---

## 7. App Layer (Server Actions)

All Server Actions return a consistent shape:
```js
// success
{ ok: true, data: { ... } }

// domain validation failure  
{ ok: false, errors: [{ field, message, blocking }] }

// system failure (caught exception)
{ ok: false, errors: [{ message: 'Something went wrong' }] }
```

### `app/actions/balances.js`

**`getEmployeeBalance(employeeId, leaveTypeId, date)`**
1. Get session → resolve tenantId
2. Fetch policy, employee, tenant (parallel)
3. Derive fiscalYear from `tenant.fiscal_year_start_month` + `date`
4. Fetch approvedRequests + ledgerEntries (parallel)
5. Call `computeAvailableBalance(inputs)`
6. Return `{ ok: true, data: BalanceResult }`

**`getTeamBalances(managerId)`**
- Get direct reports, then call `getEmployeeBalance` for each in `Promise.all`
- Returns balance for Annual, Sick, TOIL per employee

### `app/actions/leave-requests.js`

**`submitLeaveRequest(data)`**
1. Validate input shape with Zod
2. Get session → resolve employeeId, tenantId
3. Fetch policy, tenant, public holidays
4. Compute `working_days = countWorkingDays(...)`
5. Get balance via `computeAvailableBalance`
6. Fetch team requests for date range (headcount check)
7. Call `validateRequest` — if blocking errors, return `{ ok: false, errors }`
8. Inside a Drizzle transaction:
   - Re-fetch balance (race condition guard)
   - Re-run blocking validations
   - Insert request with status = `requires_approval ? 'pending' : 'approved'`
9. Return `{ ok: true, data: { requestId } }`

**`approveRequest(requestId, note)`**
1. Verify session is manager or admin
2. Verify requestId belongs to a direct report (manager) or any employee (admin)
3. Verify current status is `pending`
4. `updateRequestStatus` → `approved`

**`rejectRequest(requestId, note)`** — same guard as approve, status → `rejected`

**`cancelRequest(requestId)`**
1. Verify session is the request owner
2. Verify status is `pending`
3. Update status → `cancelled`

### `app/actions/auth.js`

**`login(email, password)`**
1. Look up user by email + tenantId (resolved from slug in middleware)
2. Verify password with bcrypt
3. Check `is_active`
4. Write iron-session: `{ userId, tenantId, role }`
5. Return `{ ok: true }`

**`logout()`** — destroy session

**`sendInvite(email, role)`** — admin/manager only; generate token, hash + store in `invites`, log token to console

**`acceptInvite(token, name, password)`**
1. Hash token, look up invite (check expiry + not already accepted)
2. Create user with hashed password
3. Mark invite `accepted_at`
4. Write session

**`requestPasswordReset(email)`** — generate token, hash + store, log to console

**`resetPassword(token, newPassword)`** — verify token (expiry, not used), update password_hash, mark token used

---

## 8. Auth & Sessions

**`lib/session.js`**
```js
import { getIronSession } from 'iron-session'

export const sessionOptions = {
  password: process.env.SESSION_SECRET,  // 32+ char secret
  cookieName: 'beartracks_session',
  cookieOptions: { secure: process.env.NODE_ENV === 'production' },
}

export async function getSession(req, res) {
  return getIronSession(req, res, sessionOptions)
}
```

Session shape: `{ userId, tenantId, role }`

**`app/middleware.js`**
- Reads `[slug]` from URL
- Looks up tenant by slug → attaches `tenantId` to request headers
- If accessing `(app)` routes with no valid session → redirect to `/[slug]/login`

**Password hashing:** bcrypt with cost factor 12.

---

## 9. UI & Routes

### Route structure
```
/[slug]/login
/[slug]/invite/[token]
/[slug]/reset-password/[token]
/[slug]/dashboard            employee: my leave + balance summary
/[slug]/requests/new         multi-step leave request form
/[slug]/requests/[id]        request detail
/[slug]/manager              manager: pending approvals + team view
```

### Key pages

**`/[slug]/dashboard` — Employee self-service**
- Balance cards row: one card per active leave type showing available / used / total with a visual progress bar (shadcn Progress)
- "New Request" button → `/requests/new`
- Request history table: columns — type badge, date range, days, status badge, actions (cancel if pending)
- Filter bar: status, leave type, date range

**`/[slug]/requests/new` — Leave request form (5 steps)**
- Step 1: Leave type selector (cards with color + name)
- Step 2: Date range picker — highlights weekends and public holidays in red
- Step 3: Day type (Full day / Half day AM / Half day PM / Hourly) — shown only if policy allows
- Step 4: Note (optional textarea)
- Step 5: Summary — shows working days count, balance before/after, submit button
- Working days count and balance impact update live as dates change (client-side, re-fetches balance on date change)
- Non-blocking warnings shown on Step 5 (e.g. headcount warning) with ability to still submit
- Blocking errors shown inline on the relevant step

**`/[slug]/manager` — Manager dashboard**
- Pending approvals list: employee name + avatar initial, leave type badge, date range, days count, Approve / Reject buttons
- Inline rejection: click Reject → small form for optional note → confirm
- Team balance cards: grid of direct reports, each showing Annual / Sick / TOIL balances
- Team availability strip (current week): horizontal calendar, one row per direct report, cells coloured by leave type

### Server vs Client Components

Default to **Server Components**. Use `'use client'` only where interactivity requires it.

| Component | Type | Reason |
|---|---|---|
| Dashboard page (balance cards, request history) | Server | Fetches data server-side, no interaction |
| Manager page (approvals list, balance cards) | Server | Data fetch only |
| Team availability strip | Server | Static render per request |
| Multi-step leave request form | Client | Local step state, live balance update |
| Date range picker | Client | Interactive UI |
| Inline approve/reject on manager page | Client | Button interaction + optimistic update |
| Balance update on date change | Client | Calls Server Action on date change, shows live result |

The live balance update on the request form works as follows: when the user changes dates, a Client Component calls `getEmployeeBalance` as a Server Action and updates the displayed balance impact without a full page reload.

### Component conventions
- Use shadcn/ui for: Button, Card, Badge, Table, Dialog, Form, Input, Select, Tabs, Progress, Calendar (date picker)
- Leave type color shown as a coloured dot/badge using the `color` hex field
- Status badges: pending = yellow, approved = green, rejected = red, cancelled = grey
- All forms validated client-side (react-hook-form + Zod) before calling Server Actions
- Server Action errors displayed inline beneath the relevant field or as a toast

---

## 10. FY Rollover Cron

**`app/api/cron/fy-rollover/route.js`** — POST, protected by `Authorization: Bearer <CRON_SECRET>` header.

For each tenant where today === fiscal year start:
1. Get all active employees for tenant
2. Get all leave types with `allow_carry_forward = true`
3. For each employee × leave type:
   - Compute closing balance of the expiring FY (run full pipeline with FY dates = expiring year)
   - `carryAmount = Math.min(closingBalance, policy.carry_forward_max_days ?? Infinity)`
   - If `carryAmount <= 0`: skip
   - Compute `expires_on`:  
     `policy.carry_forward_expiry_days ? new FY start + expiry days : null`
   - Insert `CARRY_FORWARD` ledger entry with `fiscal_year = new FY year`
   - If `closingBalance > carryAmount`: log forfeited days to console (audit log post-MVP)
4. Return `{ ok: true, processed: N }`

Cron trigger: external scheduler (e.g. Vercel Cron) hits this endpoint daily at midnight UTC. The handler checks per-tenant whether "today" in the **tenant's own timezone** matches their FY start date — use a library like `date-fns-tz` to convert UTC now to the tenant's `timezone` before comparing. Safe to run daily across all timezones.

---

## 11. Seed Script

**`scripts/seed.js`** — run with `node scripts/seed.js`

Creates:
1. **Tenant:** `{ name: 'Acme Corp', slug: 'acme', timezone: 'UTC', fiscal_year_start_month: 1, working_week: [1,2,3,4,5], hours_per_workday: 8, min_headcount_threshold: 1 }`
2. **Users:**
   - admin@acme.com / password: `admin123` / role: admin
   - manager@acme.com / password: `manager123` / role: manager
   - alice@acme.com / password: `employee123` / role: employee / manager: manager
   - bob@acme.com / password: `employee123` / role: employee / manager: manager
3. **Leave types:** all 8 built-in types from the spec with default configuration values
4. **Public holidays:** 10 hardcoded UK public holidays for 2026 (no API call needed)

---

## 12. Error Handling

Two categories — kept strictly separate:

**Domain errors** (expected business rule violations): returned as `ValidationResult[]` from the engine. Never thrown. The app layer reads them and surfaces them to the UI as structured errors. The UI shows all errors at once (no short-circuit).

**System errors** (unexpected): Drizzle failures, missing env vars, etc. Thrown as exceptions. Server Actions wrap their body in try/catch and return `{ ok: false, errors: [{ message: 'Something went wrong' }] }`. Raw error details never sent to the client; logged server-side.

---

## 13. Testing Strategy

### Tooling

| Tool | Purpose |
|---|---|
| **Vitest** | Unit + integration test runner — fast, native ESM, no config overhead |
| **Postgres in Docker** | Real DB for DAL and Server Action tests — no mocking, no in-memory substitutes |
| **Playwright** | E2E browser tests for critical user flows |

### Test layers

**Engine unit tests** (bulk of suite) — pure functions, no mocking, no DB:
- Every entitlement calculation path (FIXED, ACCRUAL, with/without proration, mid-year join)
- Carry-forward: cap applied correctly, expiry respected, multiple entries summed
- Role overrides
- Each validation check in isolation
- Working days: weekends excluded, public holidays excluded, half-day = 0.5

**DAL integration tests** — real test DB (Postgres via Docker), seeded per test:
- Tenant isolation: query for tenant A never returns tenant B data
- Correct FY date scoping on approved requests query

**Server Action tests** — real test DB:
- `submitLeaveRequest` blocks on blocking validations
- `submitLeaveRequest` commits correctly when valid
- `approveRequest` rejects if caller is not the direct report's manager
- Transaction guard: concurrent submissions don't double-book

**E2E tests (Playwright)** — runs against the full running app, seeded DB:
- Employee: login → view dashboard balances → submit a leave request → see it as pending
- Manager: login → approve a pending request → employee request shows as approved
- Auth: invalid login rejected, invite flow creates account and logs in
- Role guard: employee visiting `/manager` is redirected

---

## 14. Key Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Balance storage | Computed (never stored) | Eliminates sync bugs; negligible perf cost at this scale |
| Accrual | On-the-fly at read time | No cron dependency; always accurate |
| Carry-forward | Locked ledger entry at FY rollover | Prevents retroactive policy changes affecting prior year |
| Policy changes | Edit freely, effective next FY | Simplest UX; cron snapshots policy at rollover |
| Engine architecture | Pure functional pipeline | Stateless, easily unit-tested, maps directly to spec's evaluation order |
| ORM | Drizzle | Lighter than Prisma; SQL-first; better for complex queries; no type-safety loss in JS |
| Sessions | iron-session | Lightweight; HTTP-only cookie; no overhead of NextAuth for simple credentials flow |
| Email | Stubbed (log to console) | MVP only — log tokens, integrate Resend post-MVP |
| Language | JavaScript | Reduces boilerplate; JSDoc for key function signatures |
| UI | shadcn/ui + Tailwind | First-class Next.js App Router support |
| UI component model | Server Components by default, Client only for interactivity | Minimal JS bundle, data fetched server-side |
| Test runner | Vitest | Fast, native ESM, no config overhead |
| E2E | Playwright | Real browser, covers full login→submit→approve flow |
