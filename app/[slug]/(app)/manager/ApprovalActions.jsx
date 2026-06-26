'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveRequest, rejectRequest } from '@/app/actions/leave-requests'
import { Button } from '@/components/ui/button'

export function ApprovalActions({ requestId }) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleApprove() {
    setLoading(true)
    await approveRequest(requestId)
    router.refresh()
  }

  async function handleReject() {
    setLoading(true)
    await rejectRequest(requestId, note)
    router.refresh()
  }

  if (rejecting) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Reason (optional)"
          className="border rounded px-2 py-1 text-sm w-40"
        />
        <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={loading}>Approve</Button>
      <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={loading}>
        Reject
      </Button>
    </div>
  )
}
