// @vitest-environment jsdom
import { vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, className }) => <a href={href} className={className}>{children}</a>,
}))
vi.mock('@/components/ui/button', () => ({
  buttonVariants: () => 'btn-outline',
}))

import { render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/ui/empty-state'

describe('EmptyState', () => {
  it('renders the label', () => {
    render(<EmptyState label="No leave types yet." />)
    expect(screen.getByText('No leave types yet.')).toBeInTheDocument()
  })

  it('renders an action link when action is provided', () => {
    render(
      <EmptyState
        label="No items."
        action={{ label: 'Add one', href: '/admin/leave-types/new' }}
      />
    )
    const link = screen.getByRole('link', { name: 'Add one' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/admin/leave-types/new')
  })

  it('renders no link when action is omitted', () => {
    render(<EmptyState label="No holidays for 2026." />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
