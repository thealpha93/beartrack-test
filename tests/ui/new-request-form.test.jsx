// tests/ui/new-request-form.test.jsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('@/app/actions/leave-requests', () => ({ submitLeaveRequest: vi.fn() }))
vi.mock('@/app/actions/balances', () => ({ getEmployeeBalance: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ slug: 'acme' }),
}))

import { submitLeaveRequest } from '@/app/actions/leave-requests'
import { getEmployeeBalance } from '@/app/actions/balances'
import { NewRequestForm } from '@/app/[slug]/(app)/requests/new/NewRequestForm'

const leaveTypes = [
  { id: 'lt-1', name: 'Annual Leave', color: '#10B981', code: 'ANNUAL', allow_half_day: true, allow_hourly: false },
  { id: 'lt-2', name: 'Sick Leave', color: '#F59E0B', code: 'SICK', allow_half_day: false, allow_hourly: false },
]

const defaultProps = {
  slug: 'acme',
  leaveTypes,
  holidays: [],
  workingWeek: [1, 2, 3, 4, 5],
  employeeId: 'emp-1',
}

describe('NewRequestForm', () => {
  beforeEach(() => {
    getEmployeeBalance.mockResolvedValue({ ok: true, data: { available: 15, used: 5, total: 20 } })
    submitLeaveRequest.mockResolvedValue({ ok: true, data: { requestId: 'req-new', warnings: [] } })
  })

  it('renders step 1 with all leave types', () => {
    render(<NewRequestForm {...defaultProps} />)
    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('Sick Leave')).toBeInTheDocument()
  })

  it('Next button is disabled on step 1 until a leave type is selected', () => {
    render(<NewRequestForm {...defaultProps} />)
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('advances to step 2 after selecting a leave type', async () => {
    render(<NewRequestForm {...defaultProps} />)
    await userEvent.click(screen.getByText('Annual Leave'))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Select dates')).toBeInTheDocument()
  })

  it('shows blocking error on step 5 without allowing submission', async () => {
    submitLeaveRequest.mockResolvedValue({
      ok: false,
      errors: [{ message: 'Insufficient balance', blocking: true }],
    })
    render(<NewRequestForm {...defaultProps} />)
    await userEvent.click(screen.getByText('Annual Leave'))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    // fill dates
    const dateInputs = screen.getAllByDisplayValue('')
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-03' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-07' } })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(screen.getByText('Insufficient balance')).toBeInTheDocument())
  })

  it('shows balance preview on step 5', async () => {
    render(<NewRequestForm {...defaultProps} />)
    await userEvent.click(screen.getByText('Annual Leave'))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    const dateInputs = screen.getAllByDisplayValue('')
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-03' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-07' } })
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await waitFor(() => expect(screen.getByText(/current balance/i)).toBeInTheDocument())
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })
})
