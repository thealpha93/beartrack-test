import { test, expect } from '@playwright/test'
import { fillDateInput } from './helpers.js'

test.describe('Leave Request', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'alice@acme.com')
    await page.fill('input[name="password"]', 'employee123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/acme/dashboard')
  })

  test('dashboard shows balance cards', async ({ page }) => {
    // Scope to balance card titles (data-slot="card-title") to avoid strict mode
    // violation with request history table cells that also contain leave type names
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Annual Leave' })).toBeVisible()
    await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Sick Leave' })).toBeVisible()
  })

  test('employee can submit a leave request', async ({ page }) => {
    await page.click('text=New Request')
    await page.waitForURL('/acme/requests/new')

    // Step 1: select Annual Leave
    await page.click('text=Annual Leave')
    await page.click('text=Next')

    // Step 2: select dates (next Monday to Friday)
    const nextMonday = getNextMonday()
    const nextFriday = new Date(nextMonday)
    nextFriday.setDate(nextMonday.getDate() + 4)
    const startDateStr = nextMonday.toISOString().slice(0, 10)
    const endDateStr = nextFriday.toISOString().slice(0, 10)

    const dateInputs = page.locator('input[type="date"]')
    await fillDateInput(dateInputs.first(), startDateStr)
    await fillDateInput(dateInputs.last(), endDateStr)

    // Wait for working days to be computed and displayed
    await expect(page.getByText(/working day/i)).toBeVisible()
    await page.click('text=Next')

    // Step 3: day type (full day)
    await page.click('text=Full day')
    await page.click('text=Next')

    // Step 4: note (optional, skip)
    await page.click('text=Next')

    // Step 5: summary — verify working days shown and submit
    await expect(page.getByText('Working days:')).toBeVisible()
    await page.click('text=Submit request')
    await page.waitForURL('/acme/dashboard')

    await expect(page.getByText('pending')).toBeVisible()
  })
})

function getNextMonday() {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  return d
}
