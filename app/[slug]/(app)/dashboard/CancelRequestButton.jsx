'use client'

import { useRouter } from 'next/navigation'
import { cancelRequest } from '@/app/actions/leave-requests'
import { Button } from '@/components/ui/button'

export function CancelRequestButton({ requestId }) {
  const router = useRouter()

  async function handleCancel() {
    const result = await cancelRequest(requestId)
    if (result.ok) router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCancel}>
      Cancel
    </Button>
  )
}
