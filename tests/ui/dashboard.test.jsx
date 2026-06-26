// tests/ui/dashboard.test.jsx
// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/app/actions/leave-requests', () => ({
  cancelRequest: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { cancelRequest } from '@/app/actions/leave-requests'
import { CancelRequestButton } from '@/app/[slug]/(app)/dashboard/CancelRequestButton'

describe('CancelRequestButton', () => {
  it('renders a Cancel button', () => {
    render(<CancelRequestButton requestId="req-1" />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls cancelRequest with the correct requestId when clicked', async () => {
    cancelRequest.mockResolvedValue({ ok: true })
    render(<CancelRequestButton requestId="req-123" />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(cancelRequest).toHaveBeenCalledWith('req-123'))
  })

  it('does not throw when cancelRequest returns an error', async () => {
    cancelRequest.mockResolvedValue({ ok: false, errors: [{ message: 'Not allowed' }] })
    render(<CancelRequestButton requestId="req-bad" />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(cancelRequest).toHaveBeenCalled())
  })
})
