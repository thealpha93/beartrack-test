# PTO Application — Features Specification

> **Stack:** Next.js (App Router) · PostgreSQL · Prisma ORM  
> **Auth:** Invite-only employee registration (no SSO for now)  
> **Roles:** Employee · Manager · Admin  
> **Hierarchy:** Single-level (employee reports to one manager)

---

## 1. Multi-tenancy

Each organisation is a fully isolated **tenant**. All data is scoped by `tenant_id`.

### Tenant setup
- Admin signs up and creates the organisation (name, slug, timezone, fiscal year start month)
- Slug is used for routing: `app.domain.com/[slug]/...` or subdomain per tenant
- Each tenant configures its own regional **public holiday calendar** (country/region selector)
- Tenant-level settings: default working week (Mon–Fri or custom), weekend definition

### Isolation
- Row-level `tenant_id` on every table — enforced at query layer, not just application layer
- Postgres RLS policies as a secondary safety net
- Tenant admin cannot see or affect another tenant's data

---

## 2. Auth & Identity (invite-only)

### Invite flow
1. Admin (or manager) creates an invite for an employee email
2. System sends an invite email with a signed, expiring token (24h TTL)
3. Employee clicks link → registration page (set name + password)
4. Account activated and scoped to the inviting tenant

### Sessions
- Email + password login
- Secure HTTP-only cookie session (no JWTs in localStorage)
- "Forgot password" → email reset link (1h TTL, single-use)
- All sessions invalidated on password change

### Account management
- Employee can update name, password
- Admin can deactivate accounts (soft delete — data retained, login blocked)
- Deactivated employees' historical leave records are preserved

---

## 3. Roles & Permissions

Single-level hierarchy. Every user has exactly one role per tenant.

| Action | Employee | Manager | Admin |
|--------|----------|---------|-------|
| Submit leave request | ✓ | ✓ | ✓ |
| View own balances | ✓ | ✓ | ✓ |
| View team calendar | ✓ (read-only) | ✓ | ✓ |
| Approve / reject requests | — | ✓ (direct reports only) | ✓ (all) |
| View team dashboard | — | ✓ | ✓ |
| Set blackout dates | — | ✓ (own team) | ✓ (org-wide) |
| Manage employees & invites | — | — | ✓ |
| Manage leave policies | — | — | ✓ |
| View org-wide reports | — | — | ✓ |
| Configure tenant settings | — | — | ✓ |

### Manager scope
- A manager can only act on their own direct reports
- An employee can also hold the manager role simultaneously (dual role)
- If a manager is on leave, their pending approvals are escalated to the admin

### Admin impersonation
- Admin can view the application as any user (for support purposes)
- Impersonation is logged in the audit trail

---

## 4. Leave Request Lifecycle

### Request states
```
draft → pending → approved
                → rejected
                → cancelled    (by employee, before approval)
       → revoke_requested      (employee requests to cancel an approved leave)
                → revoked      (manager approves the revocation)
                → revoke_denied
```

### Creating a request
- Employee selects: leave type, start date, end date (or half-day AM/PM, or specific hours)
- System calculates working days in the range (excludes weekends + public holidays)
- System checks balance: if insufficient, show warning (allow or block depending on policy)
- System checks conflicts: warn if team is below minimum headcount during that period
- System checks blackout periods: block if any day falls in a blackout
- System checks minimum notice: warn/block if notice is less than policy minimum
- Employee adds an optional reason note

### Approvals
- On submission → notification sent to manager (email + in-app)
- Manager can approve or reject with an optional note
- If manager is on leave → escalated to admin
- Employee notified by email on any status change

### Cancellation
- Employee can cancel a `pending` request with no manager action needed
- Employee can *request* revocation of an `approved` request (manager must confirm)
- Admin can cancel any request in any state

### Partial-day requests
- Half-day: AM or PM (each counts as 0.5 working days)
- Hourly: specific hours within a day (deducted proportionally from daily allowance)
- Hourly requests require the leave type to have `allow_hourly: true`

### Attachments
- Optional file upload (PDF, image) per request
- Gated per leave type: `attachment_required` | `attachment_optional` | `attachment_none`
- Stored in object storage (S3-compatible), not in DB

---

## 5. Rule-based Leave Policy Engine

This is the core engine. A **leave policy** is a tenant-scoped configuration object stored in the database. No leave logic is hardcoded.

### Leave type definition

Each leave type is a record with the following configurable fields:

```
name                    string         e.g. "Annual Leave", "Sick Leave"
code                    string         e.g. "ANNUAL", "SICK" — used in reports/API
color                   hex string     for calendar display
paid                    boolean
active                  boolean        soft-disable without deleting

--- Entitlement ---
entitlement_basis       enum           FIXED | ACCRUAL
annual_entitlement_days number         e.g. 20 (used if basis = FIXED)
accrual_rate_per_month  number         e.g. 1.67 (used if basis = ACCRUAL)
accrual_day_of_month    number         e.g. 1 = accrue on 1st of each month
max_accrual_balance     number | null  cap on how much can accumulate before use

--- Role overrides (per-role additional days on top of base entitlement) ---
role_overrides          json           { "manager": 5, "admin": 5 }

--- Proration ---
prorate_on_join         boolean        prorate entitlement for mid-year joiners
proration_rounding      enum           FLOOR | CEIL | HALF_UP
prorate_on_exit         boolean        prorate for partial year on termination

--- Carry-forward ---
allow_carry_forward     boolean
carry_forward_max_days  number | null  null = unlimited carry
carry_forward_expiry_days number | null days after new year before carry expires
                                       null = no expiry

--- Negative balance ---
allow_negative_balance  boolean        borrow against future entitlement
max_negative_days       number | null  null = unlimited (not recommended)

--- Request rules ---
requires_approval       boolean        false = auto-approved on submit
min_notice_days         number         0 = same-day allowed
max_consecutive_days    number | null  null = no limit
min_consecutive_days    number         1 (set higher for e.g. min 2 days sabbatical)
allow_half_day          boolean
allow_hourly            boolean

--- Documentation ---
attachment_policy       enum           NONE | OPTIONAL | REQUIRED
attachment_required_after_days number | null  e.g. require doc for sick > 3 days

--- Blackout ---
blackout_periods        json[]         [{ label, start_date, end_date, scope }]
                                       scope: TENANT | TEAM | DEPARTMENT

--- Visibility ---
visible_to_all          boolean        false = only the holder sees their own balance
gender_restriction      enum | null    null | FEMALE | MALE  (for parental leave etc.)
```

### Built-in leave types (preconfigured, admin can customise)

| Code | Name | Basis | Default days | Carry | Notes |
|------|------|-------|--------------|-------|-------|
| `ANNUAL` | Annual leave | FIXED | 20 | Yes (max 5d) | Role overrides applied |
| `SICK` | Sick leave | FIXED | 10 | No | Doc required after 3 days |
| `PARENTAL_M` | Maternity leave | FIXED | 90 | No | Gender-restricted |
| `PARENTAL_P` | Paternity leave | FIXED | 10 | No | Gender-restricted |
| `BEREAVEMENT` | Bereavement leave | FIXED | 5 | No | Auto-approved |
| `UNPAID` | Unpaid leave | FIXED | unlimited | No | Always requires approval |
| `TOIL` | Time off in lieu | ACCRUAL | 0 | Yes (max 10d, 90d expiry) | Earned from comp time |
| `PUBLIC` | Public holiday | FIXED | auto | No | System-managed from calendar |

### Policy evaluation order (for a given request)

1. Resolve base entitlement (FIXED or ACCRUAL)
2. Apply role override (add extra days for manager/admin)
3. Apply proration if joining date is mid-fiscal-year
4. Add carry-forward balance from previous year (check expiry)
5. Subtract already-used days this cycle
6. Result = **available balance**
7. Check request against: available balance, blackout, notice, consecutive limits, headcount threshold

### Fiscal year handling

- Admin sets `fiscal_year_start_month` per tenant (e.g. 1 = January, 4 = April)
- At fiscal year rollover (cron job):
  1. Calculate carry-forward for each employee per leave type
  2. Apply carry cap and log any forfeited days
  3. Grant new year's entitlement (or reset accrual counter)
  4. Mark carry-forward as expiring if `carry_forward_expiry_days` is set

---

## 6. Manager Dashboard

The primary surface for a manager's daily workflow.

### Pending approvals widget
- List of all open requests from direct reports
- Sorted by: submission date (oldest first)
- Per row: employee name + avatar, leave type badge, date range, days count, action buttons (Approve / Reject)
- Inline rejection: click Reject → small inline form for optional note → confirm
- Badge on nav icon showing pending count

### Team availability this week
- Horizontal calendar strip (Mon–Sun current week, browsable)
- Each row = one direct report
- Cells coloured by leave type if on leave, greyed out for weekends/public holidays
- "Out" label on leave cells; hover shows leave type + request ID

### Team leave summary (current month)
- Mini stat cards: total days taken, days pending, headcount on leave today
- Breakdown by leave type (small bar or number list)

### Upcoming leaves (next 30 days)
- Chronological list of approved leaves starting in the next 30 days
- Grouped by week
- Conflict indicator: if ≥ N employees are off simultaneously (N = configurable threshold)

### Employee balance cards
- Grid of direct reports
- Per card: name, avatar, and balance for top 3 leave types (Annual, Sick, TOIL)
- Click → full employee leave page

### Quick actions
- "Invite employee" shortcut (opens invite modal)
- "Set blackout date" shortcut

---

## 7. Team Calendar

- Full-month calendar view (navigable by month)
- Each day cell shows coloured chips per employee on leave
- Legend: leave type → colour
- Filter by: employee, leave type
- Public holidays shown as grey background on the day cell
- Export to iCal / Google Calendar (per-user subscription link)

---

## 8. Employee Self-Service

### My leave page
- Balance summary: all leave types with available / used / total
- Visual balance bar per type
- Submit new request button
- List of own requests (filterable by status, date range, type)
- Pending revocation requests shown separately

### Leave request form
- Step 1: select leave type
- Step 2: pick date range (date picker highlights weekends and public holidays)
- Step 3: half-day / hourly options (if enabled for that type)
- Step 4: add note, upload attachment (if required)
- Step 5: summary + confirm
- Working-days count updates live as dates change

---

## 9. Notifications

| Trigger | Who gets notified | Channel |
|---------|------------------|---------|
| New request submitted | Manager | Email + in-app |
| Request approved | Employee | Email + in-app |
| Request rejected | Employee | Email + in-app |
| Revocation approved | Employee | Email + in-app |
| Revocation denied | Employee | Email + in-app |
| Balance low (< 2 days remaining) | Employee | In-app only |
| Carry-forward expiring in 30 days | Employee | Email + in-app |
| Blackout period approaching | All affected employees | Email + in-app |
| Invite sent | Invitee | Email only |

Email: transactional, plain HTML template, reply-to = manager/admin address  
In-app: notification bell, unread count, mark-all-read

---

## 10. Admin Panel

### Employee management
- List all employees (name, email, role, manager, join date, status)
- Change role, reassign manager, deactivate account
- View any employee's leave history and balances

### Leave policy management
- CRUD on leave types
- See the full rule configuration for each type
- Duplicate an existing type as a starting point
- Preview: "what would this policy give to an employee joining on [date]?"

### Org settings
- Tenant name, timezone, fiscal year start
- Working week definition
- Public holiday calendar (country/region)
- Minimum headcount threshold (for conflict warnings)

### Blackout periods
- Create org-wide blackout: label, date range, applies to which leave types
- Blackouts can be scoped: entire org, specific department, specific team

### Audit log
- Immutable log: actor, action, target, timestamp, IP address
- Filterable by actor, action type, date range
- Actions logged: login, role change, invite sent, request state change, policy change, balance adjustment

### Manual balance adjustment
- Admin can credit or debit any employee's leave balance for a specific type
- Requires a mandatory reason (stored in audit log)
- Useful for: onboarding adjustments, carried-over entitlements from previous system

---

## 11. Reporting

### Standard reports (CSV export)
- Leave usage by employee (YTD): days taken per type
- Leave usage by type (YTD): total org consumption
- Balance summary: all employees, all types, current balances
- Audit log export

### Dashboard charts (admin view)
- Monthly leave days taken (bar chart, current fiscal year)
- Leave type distribution (pie/donut)
- Top 10 employees by leave taken

---

## 12. Public Holidays

- Admin selects country + optional region on tenant setup
- System fetches public holidays for the fiscal year from a third-party API (Nager.Date — free, no key required)
- Holidays stored locally per tenant per year (not fetched on every request)
- Public holidays are automatically excluded from working day calculations
- Admin can manually add, edit, or remove individual holidays
- `PUBLIC` leave type is auto-credited to all employees on the day (no request needed)

---

## Out of scope (v1)

- SSO / SAML
- Slack / Teams integration
- Mobile app
- Payroll system integration
- Multi-level approval chains
- Department/team hierarchy (beyond single manager)
- Custom approval delegation rules
- AI-powered insights