# Leave Policies — Acme Corp

All policies are configured per leave type in the database and enforced by the policy engine at request submission time.

## Tenant Settings

| Setting | Value |
|---|---|
| Fiscal year start | 1 January |
| Working week | Monday – Friday |
| Hours per workday | 8 |
| Minimum team headcount | 1 |

---

## Leave Types

### Annual Leave

| Field | Value |
|---|---|
| Code | `ANNUAL` |
| Paid | Yes |
| Entitlement | 20 days/year (fixed) |
| Role overrides | Manager +5 days, Admin +5 days |
| Prorated on join | Yes (rounded down) |
| Carry forward | Up to 5 days (no expiry) |
| Requires approval | Yes |
| Half-day requests | Allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |
| Consecutive day limits | None |

---

### Sick Leave

| Field | Value |
|---|---|
| Code | `SICK` |
| Paid | Yes |
| Entitlement | 10 days/year (fixed) |
| Prorated on join | Yes (rounded down) |
| Carry forward | No |
| Requires approval | No (auto-approved) |
| Half-day requests | Not allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |
| Medical attachment | Required after 3 consecutive days |

---

### Maternity Leave

| Field | Value |
|---|---|
| Code | `PARENTAL_M` |
| Paid | Yes |
| Entitlement | 90 days/year (fixed) |
| Eligible | Female employees only |
| Prorated on join | Yes (rounded down) |
| Carry forward | No |
| Requires approval | Yes |
| Half-day requests | Not allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |

---

### Paternity Leave

| Field | Value |
|---|---|
| Code | `PARENTAL_P` |
| Paid | Yes |
| Entitlement | 10 days/year (fixed) |
| Eligible | Male employees only |
| Prorated on join | Yes (rounded down) |
| Carry forward | No |
| Requires approval | Yes |
| Half-day requests | Not allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |

---

### Bereavement Leave

| Field | Value |
|---|---|
| Code | `BEREAVEMENT` |
| Paid | Yes |
| Entitlement | 5 days/year (fixed) |
| Prorated on join | Yes (rounded down) |
| Carry forward | No |
| Requires approval | No (auto-approved) |
| Half-day requests | Not allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |

---

### Time Off in Lieu (TOIL)

| Field | Value |
|---|---|
| Code | `TOIL` |
| Paid | Yes |
| Entitlement | Accrual-based (balance credited via manual ledger entries) |
| Carry forward | Up to 10 days, expires after 90 days |
| Requires approval | Yes |
| Half-day requests | Not allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |

> TOIL balance is zero by default. Days are credited by an admin via ledger adjustments when overtime is worked.

---

### Unpaid Leave

| Field | Value |
|---|---|
| Code | `UNPAID` |
| Paid | No |
| Entitlement | Effectively unlimited (999 days) |
| Prorated on join | Yes (rounded down) |
| Carry forward | No |
| Requires approval | Yes |
| Half-day requests | Not allowed |
| Hourly requests | Not allowed |
| Negative balance | Not allowed |
| Notice period | None |

---

## Validation Rules

These rules are enforced on every submission by the policy engine:

| Rule | Behaviour |
|---|---|
| **Balance check** | Blocks request if available balance is insufficient. Negative balances are not permitted for any leave type. |
| **Blackout periods** | Blocks request if dates overlap a configured blackout period. None currently configured. |
| **Notice period** | Blocks request if the start date is fewer than the required days from today. Currently 0 for all types (no minimum notice). |
| **Consecutive days** | Blocks request if the number of working days exceeds the maximum, or is fewer than the minimum. No caps currently configured. |
| **Headcount** | Non-blocking warning if the team would drop below the minimum headcount (1 person) on any day in the requested period. Does not prevent submission. |

---

## Public Holidays 2026

Public holidays are excluded from working day counts.

| Date | Name |
|---|---|
| 1 Jan 2026 | New Year's Day |
| 3 Apr 2026 | Good Friday |
| 6 Apr 2026 | Easter Monday |
| 4 May 2026 | Early May Bank Holiday |
| 25 May 2026 | Spring Bank Holiday |
| 31 Aug 2026 | Summer Bank Holiday |
| 25 Dec 2026 | Christmas Day |
| 26 Dec 2026 | Boxing Day |
| 28 Dec 2026 | Boxing Day (substitute) |
