// tests/ui/manager.test.js
// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('@/app/actions/leave-requests', () => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { approveRequest, rejectRequest } from '@/app/actions/leave-requests'
import { ApprovalActions } from '@/app/[slug]/(app)/manager/ApprovalActions'

describe('ApprovalActions', () => {
  beforeEach(() => {
    approveRequest.mockResolvedValue({ ok: true })
    rejectRequest.mockResolvedValue({ ok: true })
  })

  it('renders Approve and Reject buttons', () => {
    render(<ApprovalActions requestId="req-1" />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('calls approveRequest with requestId when Approve clicked', async () => {
    render(<ApprovalActions requestId="req-42" />)
    await userEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => expect(approveRequest).toHaveBeenCalledWith('req-42'))
  })

  it('shows inline rejection form when Reject clicked', async () => {
    render(<ApprovalActions requestId="req-1" />)
    await userEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(screen.getByPlaceholderText(/reason/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls rejectRequest with note when Confirm clicked', async () => {
    render(<ApprovalActions requestId="req-7" />)
    await userEvent.click(screen.getByRole('button', { name: /reject/i }))
    await userEvent.type(screen.getByPlaceholderText(/reason/i), 'Team too busy')
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(rejectRequest).toHaveBeenCalledWith('req-7', 'Team too busy'))
  })

  it('dismisses rejection form when Cancel clicked', async () => {
    render(<ApprovalActions requestId="req-1" />)
    await userEvent.click(screen.getByRole('button', { name: /reject/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/reason/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
  })
})
