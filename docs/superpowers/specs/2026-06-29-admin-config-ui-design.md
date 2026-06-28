# Admin Configuration UI — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give admin users a self-service UI to manage leave types, users, public holidays, and tenant settings — eliminating the need for direct database access to configure the system.

**Scope:** Leave type management, user management, public holiday management, tenant settings. Accrual-based entitlements, attachment policy, consecutive day limits, role overrides, TOIL ledger, and blackout periods are explicitly out of scope for this sprint.

---

## Global Constraints

- Next.js 16 App Router, JavaScript only (no TypeScript)
- All database queries must live in `lib/dal/` — no inline Drizzle in server actions or pages
- Server actions in `app/actions/` — one new file `app/actions/admin.js` for all admin mutations
- Existing `inviteUser` action in `app/actions/auth.js` is reused as-is (not duplicated)
- All admin routes gated to `role === 'admin'` — redirect to dashboard otherwise
- Follow existing UI patterns: shadcn `Card`, `Button`, `buttonVariants` for link-buttons; plain `<input>` / `<select>` / `<textarea>` with Tailwind for forms
- No new npm dependencies

---

## Architecture

### Route Structure

```
app/[slug]/(app)/admin/
  layout.js              ← admin role gate + sidebar sub-nav
  page.js                ← redirect → ./leave-types
  leave-types/
    page.js              ← list all leave types
    new/page.js          ← create form (server component wrapping client form)
    [id]/page.js         ← edit form (server component wrapping client form)
  users/
    page.js              ← list all users + invite button
    invite/page.js       ← invite form
    [id]/page.js         ← edit user form
  holidays/
    page.js              ← year view + inline add form
  settings/
    page.js              ← tenant settings form
```

### Navigation

The top nav in `app/[slug]/(app)/layout.js` gains an "Admin" link visible only when `user.role === 'admin'`, pointing to `/${slug}/admin`.

The admin layout renders a left sidebar with four links:
- Leave Types → `/${slug}/admin/leave-types`
- Users → `/${slug}/admin/users`
- Holidays → `/${slug}/admin/holidays`
- Settings → `/${slug}/admin/settings`

The sidebar highlights the active section based on the current pathname.

### Server Actions

All admin mutations live in `app/actions/admin.js`:

```
createLeaveType({ name, code, color, paid, annual_entitlement_days,
                  prorate_on_join, requires_approval, allow_half_day,
                  allow_carry_forward, carry_forward_max_days,
                  allow_negative_balance })
updateLeaveType(id, fields)          ← same fields minus code (read-only on edit)
deactivateLeaveType(id)
reactivateLeaveType(id)

updateUser(id, { name, role, manager_id, join_date })
deactivateUser(id)
reactivateUser(id)

addPublicHoliday({ date, name, year })
deletePublicHoliday(id)

updateTenantSettings({ name, timezone, fiscal_year_start_month,
                       working_week, hours_per_workday,
                       min_headcount_threshold })
```

All actions call `getSession()`, verify `role === 'admin'`, then delegate to DAL functions. All return `{ ok, errors }` consistent with the existing action pattern.

### DAL Additions

New functions added to existing DAL files:

**`lib/dal/leave-types.js`**
- `getAllLeaveTypes(tenantId)` — returns active and inactive, ordered by name
- `createLeaveType(tenantId, data)`
- `updateLeaveType(tenantId, id, data)`
- `setLeaveTypeActive(tenantId, id, active)`

**`lib/dal/employees.js`**
- `getAllUsersByTenant(tenantId)` — returns active and inactive users
- `updateEmployee(tenantId, id, { name, role, manager_id, join_date })`
- `setUserActive(tenantId, id, active)`

**`lib/dal/leave-requests.js`**
- `getRequestsByLeaveType(tenantId, leaveTypeId, statuses)` — returns requests matching any of the given statuses; used to count active requests before deactivating a leave type

**`lib/dal/public-holidays.js`**
- `createPublicHoliday(tenantId, { date, name, year })`
- `deletePublicHoliday(tenantId, id)`

**`lib/dal/tenants.js`**
- `updateTenant(tenantId, data)`

---

## Section 1: Leave Type Management

### List Page (`/admin/leave-types`)

Server component. Fetches all leave types for the tenant (active and inactive) via `getAllLeaveTypes(tenantId)`.

Renders a table:

| Column | Content |
|---|---|
| (colour) | 12px filled circle using `lt.color` |
| Name | `lt.name` |
| Code | `lt.code` in monospace |
| Entitlement | `lt.annual_entitlement_days` days/year |
| Paid | "Paid" / "Unpaid" badge |
| Approval | "Auto-approved" / "Requires approval" badge |
| Status | "Active" / "Inactive" badge |
| Actions | "Edit" link button |

Inactive rows rendered at 50% opacity. "New leave type" button (top right) links to `/admin/leave-types/new`.

### Create Form (`/admin/leave-types/new`)

Server component page that passes static data (none needed) to a `LeaveTypeForm` client component with `mode="create"`.

### Edit Form (`/admin/leave-types/[id]`)

Server component page fetches the leave type by ID and the count of pending/approved requests for that leave type (`getRequestsByLeaveType(tenantId, id, ['pending','approved'])`). Passes both as props to `LeaveTypeForm` with `mode="edit"`. Redirects to list if ID not found.

### `LeaveTypeForm` Client Component

Fields:

| Field | Input type | Validation | Notes |
|---|---|---|---|
| Name | `<input type="text">` | Required | |
| Code | `<input type="text">` | Required, uppercase, unique | Read-only when `mode="edit"` |
| Colour | `<input type="color">` + hex text preview | Required | Default `#6B7280` |
| Paid | Toggle (checkbox styled) | — | |
| Entitlement (days/year) | `<input type="number" min="0" step="0.5">` | Required, ≥ 0 | |
| Prorate on join | Toggle | — | |
| Requires approval | Toggle | — | |
| Allow half-day | Toggle | — | |
| Allow carry forward | Toggle | — | Reveals "Max carry forward days" when on |
| Max carry forward days | `<input type="number" min="0">` | Required when carry forward on | Hidden when carry forward off |
| Allow negative balance | Toggle | — | |

On submit, calls `createLeaveType` or `updateLeaveType` action. On success, redirects to `/admin/leave-types`. Errors rendered inline below the form.

In `mode="edit"`, a "Deactivate" / "Reactivate" button (separate from Save) calls `deactivateLeaveType` / `reactivateLeaveType`. If the leave type has pending or approved requests, the page shows a warning: "This leave type has active requests. Deactivating it will not affect existing requests." Deactivation does not block — it only sets `active = false`.

---

## Section 2: User Management

### List Page (`/admin/users`)

Server component. Fetches all users for the tenant (active and inactive) via a new `getAllUsersByTenant(tenantId)` DAL function. Also fetches all users to resolve manager names.

Renders a table:

| Column | Content |
|---|---|
| Name | `user.name` |
| Email | `user.email` |
| Role | Badge: employee / manager / admin |
| Manager | Manager's name, or "—" for top-level |
| Join date | Formatted date |
| Status | "Active" / "Inactive" badge |
| Actions | "Edit" link button |

Inactive rows at 50% opacity. "Invite user" button (top right) links to `/admin/users/invite`.

### Invite Form (`/admin/users/invite`)

Client component. Calls the existing `inviteUser` action from `app/actions/auth.js`.

Fields:
- Email (`<input type="email">`, required)
- Role (select: employee / manager / admin, required)
- Manager (select from active users, shown only when role is `employee`)

On success in non-production: displays the invite link on screen (token returned by the action). In production: shows "Invite sent" (email sending out of scope). On error: shows inline error message.

### Edit Form (`/admin/users/[id]`)

Server component page fetches the user, passes to `UserEditForm` client component. Redirects to list if not found.

Fields:

| Field | Input type | Notes |
|---|---|---|
| Name | `<input type="text">` | Required |
| Role | Select (employee / manager / admin) | |
| Manager | Select (active users except self) | Hidden when role is manager or admin |
| Join date | `<input type="date">` | Affects proration on next balance calculation |

On submit, calls `updateUser` action. On success, redirects to `/admin/users`.

A "Deactivate" / "Reactivate" button separate from Save calls `deactivateUser` / `reactivateUser`. Deactivating a user with pending requests shows a warning: "This user has N pending leave requests. They will remain pending until a manager reviews them." Deactivation is not blocked — it sets `is_active = false`, which prevents login.

---

## Section 3: Public Holiday Management

### Single Page (`/admin/holidays`)

Server component. Accepts an optional `year` search param (defaults to current year). Fetches holidays for that year via `getPublicHolidays(tenantId, year)`.

**Year switcher:** Previous / Next buttons adjust the `year` param. Displayed as "← 2025 · 2026 · 2027 →" with the current year centred.

**Holiday list:** Each row shows date (formatted), name, and a Delete button. Clicking Delete triggers an inline confirmation ("Delete?" + "Yes" / "Cancel" buttons in the same row). Confirmation calls `deletePublicHoliday` action and refreshes.

**Inline add form** below the list:
- `<input type="date">` (required)
- `<input type="text" placeholder="Holiday name">` (required)
- "Add" button

On submit, calls `addPublicHoliday`. The `year` is derived server-side from the submitted date. On success, the list refreshes. On error, shows inline message.

---

## Section 4: Tenant Settings

### Single Page (`/admin/settings`)

Server component fetches tenant via `getTenantById`. Passes values to a `TenantSettingsForm` client component.

Fields:

| Field | Input | Validation |
|---|---|---|
| Company name | `<input type="text">` | Required |
| Timezone | `<select>` (curated list of ~20 common IANA zones) | Required |
| Fiscal year start | `<select>` (January–December, values 1–12) | Required |
| Working week | Checkboxes (Mon=1 … Sun=7) | At least 1 day required |
| Hours per workday | `<input type="number" min="1" max="24">` | Required |
| Min headcount threshold | `<input type="number" min="0">` | Required |

If fiscal year start is changed from its current value, a warning banner appears above the Save button: "Changing the fiscal year start affects how leave balances are calculated for all employees going forward. Existing approved requests are not recalculated."

On submit, calls `updateTenantSettings`. On success: shows a toast / inline "Saved" confirmation. On error: shows inline error.

**Curated timezone list** (hardcoded in the form component):
`Europe/London`, `Europe/Paris`, `Europe/Berlin`, `Europe/Amsterdam`, `Europe/Dublin`, `Europe/Lisbon`, `America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`, `America/Toronto`, `America/Vancouver`, `America/Sao_Paulo`, `Asia/Dubai`, `Asia/Kolkata`, `Asia/Singapore`, `Asia/Tokyo`, `Asia/Shanghai`, `Australia/Sydney`, `Pacific/Auckland`

---

## Error Handling

All server actions return `{ ok: boolean, errors: [{ message: string }] }`. Client form components display errors inline below the form, styled as red text on a red-50 background — consistent with the existing `NewRequestForm` pattern.

Admin-only gate in `app/[slug]/(app)/admin/layout.js` redirects non-admin users to `/${slug}/dashboard` before rendering any child routes.

---

## Testing

- **Unit tests**: none needed — admin actions delegate directly to DAL with no business logic beyond role gating.
- **Integration tests** (`tests/integration/admin-actions.test.js`): cover each server action — create/update/deactivate leave type, update/deactivate user, add/delete holiday, update tenant settings. Mock session with `role: 'admin'` and verify non-admin calls are rejected.
- **No E2E tests** for admin panel in this sprint — the integration tests cover correctness; E2E can be added once the UI stabilises.
