import { test, expect } from '@playwright/test'

test.describe('Auth', () => {
  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'wrong@acme.com')
    await page.fill('input[name="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    await expect(page.getByText('Invalid credentials')).toBeVisible()
  })

  test('valid employee login redirects to dashboard', async ({ page }) => {
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'alice@acme.com')
    await page.fill('input[name="password"]', 'employee123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/acme/dashboard')
    // Use heading role to avoid strict mode violation with nav link
    await expect(page.getByRole('heading', { name: 'My Leave' })).toBeVisible()
  })

  test('valid manager login redirects to manager page', async ({ page }) => {
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'manager@acme.com')
    await page.fill('input[name="password"]', 'manager123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/acme/manager')
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/acme/dashboard')
    await expect(page).toHaveURL('/acme/login')
  })

  test('employee cannot access manager page', async ({ page }) => {
    await page.goto('/acme/login')
    await page.fill('input[name="email"]', 'alice@acme.com')
    await page.fill('input[name="password"]', 'employee123')
    await page.click('button[type="submit"]')
    // Wait for login to complete before navigating
    await page.waitForURL('/acme/dashboard')
    await page.goto('/acme/manager')
    await expect(page).toHaveURL('/acme/dashboard')
  })
})
