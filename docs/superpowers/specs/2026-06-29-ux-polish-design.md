# UX Polish — Design Spec

**Goal:** Fix six targeted UX gaps in the BearTracks frontend: shared utilities, wizard step labels, admin form grouping, input component consistency, admin empty states, and admin page headings.

**Scope:** UI polish only — no backend changes, no new routes, no database changes. Mobile layout excluded.

**Tech stack:** Next.js 16 App Router, JavaScript, shadcn/ui, Tailwind CSS.

---

## Global Constraints

- JavaScript only — no TypeScript
- No new npm dependencies
- Follow existing shadcn/ui component patterns
- `<select>` and `<textarea>` remain as plain HTML — only `<input>` elements are swapped to shadcn `<Input>`
- No mobile layout changes

---

## 1. Shared Utilities

### `components/ui/empty-state.jsx`

A reusable empty-state component used across admin list pages.

```jsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function EmptyState({ label, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-gray-500 mb-4">{label}</p>
      {action && (
        <Link href={action.href} className={buttonVariants({ variant: 'outline' })}>
          {action.label}
        </Link>
      )}
    </div>
  )
}
```

**Props:**
- `label` (string) — the message, e.g. "No leave types yet."
- `action` (optional `{ label, href }`) — renders a link-button when provided

### `lib/utils/format.js`

```js
export function formatDays(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}
```

Shows `20` not `20.0`; shows `0.5` as `0.5`.

---

## 2. Wizard Step Labels

**File:** `app/[slug]/(app)/requests/new/NewRequestForm.jsx`

Replace the 5 plain progress bars with a labeled step indicator.

Add a constant above the component:

```js
const STEPS = ['Leave type', 'Dates', 'Day type', 'Note', 'Review']
```

Replace the current bar rendering with:

```jsx
<div className="flex gap-2">
  {STEPS.map((label, i) => {
    const s = i + 1
    const active = s <= step
    return (
      <div key={s} className="flex-1 flex flex-col items-center gap-1">
        <div className={`h-1.5 w-full rounded-full ${active ? 'bg-blue-500' : 'bg-gray-200'}`} />
        <span className={`text-xs ${s === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>
    )
  })}
</div>
```

No click interactivity on the labels.

---

## 3. Admin Form Grouping

### `LeaveTypeForm.jsx`

Group the 10 fields into three sections using a section heading pattern:

```jsx
<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Basics</p>
<hr className="border-gray-100" />
```

**Sections:**

| Section | Fields |
|---|---|
| Basics | Name, Code, Colour |
| Entitlement | Paid, Days/year, Prorate on join |
| Request options | Requires approval, Half-day, Carry forward (+ max days), Negative balance |

The warning banner (active requests) and error/button row remain below all sections, ungrouped.

### `TenantSettingsForm.jsx`

Same heading/divider treatment, two sections:

| Section | Fields |
|---|---|
| Organisation | Company name, Timezone, Fiscal year start |
| Working time | Working week, Hours per workday, Min headcount threshold |

`InviteForm.jsx` and `UserEditForm.jsx` have 2–4 fields each — no grouping needed.

---

## 4. Input Component Consistency

Replace the duplicated `inputClass` string and raw `<input>` elements in the following files with the shadcn `<Input>` component (`import { Input } from '@/components/ui/input'`):

- `app/[slug]/(app)/admin/leave-types/LeaveTypeForm.jsx`
- `app/[slug]/(app)/admin/users/UserEditForm.jsx`
- `app/[slug]/(app)/admin/users/InviteForm.jsx`
- `app/[slug]/(app)/admin/settings/TenantSettingsForm.jsx`
- `app/[slug]/(app)/admin/holidays/HolidaysClient.jsx`

**Swap rule:** Only `<input type="text|email|number|date">` are replaced. `<input type="color">` stays as plain HTML (shadcn Input does not support color pickers). `<select>` and `<textarea>` stay as plain HTML.

The `inputClass` constant is deleted from each file after the swap.

---

## 5. Admin Empty States

Use `<EmptyState>` when the data array is empty. The table (including its `<thead>`) is not rendered when there is no data — only the empty state is shown.

### `leave-types/page.js`

```jsx
{leaveTypes.length === 0
  ? <EmptyState label="No leave types yet." action={{ label: 'Add leave type', href: `/${slug}/admin/leave-types/new` }} />
  : <table>...</table>
}
```

### `users/page.js`

```jsx
{users.length === 0
  ? <EmptyState label="No users yet." action={{ label: 'Invite user', href: `/${slug}/admin/users/invite` }} />
  : <table>...</table>
}
```

### `holidays/HolidaysClient.jsx`

```jsx
{holidays.length === 0
  ? <EmptyState label={`No holidays for ${year}.`} />
  : <table>...</table>
}
```

No action button for holidays — the inline add form is already present on the same page.

---

## 6. Admin Page Headings

Add `<h1 className="text-2xl font-semibold mb-6">` at the top of content in these server component pages, above the form component:

| Page | Heading text |
|---|---|
| `leave-types/new/page.js` | New leave type |
| `leave-types/[id]/page.js` | Edit leave type |
| `users/invite/page.js` | Invite user |
| `users/[id]/page.js` | Edit user |
| `settings/page.js` | Settings |

List pages (`leave-types/page.js`, `users/page.js`, `holidays/page.js`) already have sufficient context from the sidebar — no heading added.

---

## Testing

- No new integration or E2E tests — these are pure UI changes
- Run existing UI tests after: `npm run test:ui`
- Manual spot-check: visit each changed page and verify heading, grouping, empty state, and step labels render correctly
