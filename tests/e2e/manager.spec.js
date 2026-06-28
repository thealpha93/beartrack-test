import { test, expect } from '@playwright/test'
import { fillDateInput } from './helpers.js'

test.describe('Manager Approvals', () => {
  test('manager can approve a pending request', async ({ page }) => {
    // Submit a leave request as employee (bob)
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'bob@acme.com')
    await page.fill('input[name="password"]', 'employee123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/acme/dashboard')

    await page.click('text=New Request')
    await page.waitForURL('/acme/requests/new')
    await page.click('text=Annual Leave')
    await page.click('text=Next')

    const monday = getNextMonday()
    const tuesday = new Date(monday)
    tuesday.setDate(monday.getDate() + 1)

    const dateInputs = page.locator('input[type="date"]')
    await fillDateInput(dateInputs.first(), monday.toISOString().slice(0, 10))
    await fillDateInput(dateInputs.last(), tuesday.toISOString().slice(0, 10))
    await expect(page.getByText(/working day/i)).toBeVisible()
    await page.click('text=Next')
    await page.click('text=Full day')
    await page.click('text=Next')
    await page.click('text=Next')
    await page.click('text=Submit request')
    await page.waitForURL('/acme/dashboard')

    // Log in as manager and approve
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'manager@acme.com')
    await page.fill('input[name="password"]', 'manager123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/acme/manager')

    // Find the pending approval section and verify Bob Employee appears
    const pendingSection = page.locator('section').filter({ hasText: 'Pending Approvals' })
    await expect(pendingSection.getByText('Bob Employee').first()).toBeVisible()

    // Approve all pending requests until none remain
    while (true) {
      const buttons = pendingSection.getByRole('button', { name: 'Approve' })
      const count = await buttons.count()
      if (count === 0) break
      await buttons.first().click()
      await expect(buttons).toHaveCount(count - 1)
    }

    await expect(page.getByText('No pending requests.')).toBeVisible()
  })
})

function getNextMonday() {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + 7) // next-next Monday to avoid conflicts
  return d
}
